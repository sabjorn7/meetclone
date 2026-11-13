import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import vm from 'node:vm';
import fs from 'node:fs';
import { verifyAuthEmail, classifyClaim, classifyUnisender, finishAuthEmail } from '../scripts/lib/auth-email-hook.mjs';
import { authEmailWorkflow } from '../scripts/lib/auth-email-workflow.mjs';

const secret = 'v1,whsec_' + Buffer.alloc(32, 7).toString('base64');
const config = { hookSecrets: secret, unisenderKey: 'synthetic-provider', supabaseKey: 'synthetic-server', listId: '123' };
const now = 1800000000123;
const event = () => ({ user: { id: '11111111-1111-4111-8111-111111111111', email: 'learner@example.test' }, email_data: {
    token: '123456', token_hash: 'a'.repeat(64), email_action_type: 'signup',
    site_url: 'https://sb.meetgu.ru', redirect_to: 'https://app.meetgu.ru/login?email_confirmation=1',
} });
function signed(value = event(), id = '11111111-1111-4111-8111-111111111112', timestamp = String(Math.floor(now / 1000)), rawOverride) {
    const raw = rawOverride || Buffer.from(JSON.stringify(value));
    const signature = crypto.createHmac('sha256', Buffer.alloc(32, 7)).update(`${id}.${timestamp}.`).update(raw).digest('base64');
    return { raw, headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': 'v1,' + signature } };
}
function verify(input = signed(), conf = config, time = now) { return verifyAuthEmail(input.raw, input.headers, conf, crypto, time); }
const response = (body, statusCode = 200) => ({ statusCode, body });
const accepted = email => response({ result: [{ index: 0, email, id: 'synthetic-message-id' }] });

test('signed raw GoTrue event produces the expected Russian email and native verify link', () => {
    const result = verify(); assert.equal(result.send, true);
    assert.equal(result.mail.subject, 'Подтвердите электронную почту — MeetGuru');
    assert.equal(result.mail.senderName, 'MeetGuru'); assert.equal(result.mail.senderEmail, 'adv@meetgu.ru');
    assert(result.mail.html.includes('Подтвердить почту')); assert(result.mail.html.includes('lang="ru"'));
    const href = result.mail.html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&');
    const url = new URL(href); assert.equal(url.origin, 'https://sb.meetgu.ru'); assert.equal(url.pathname, '/auth/v1/verify');
    assert.equal(url.searchParams.get('token'), event().email_data.token_hash); assert.equal(url.searchParams.get('type'), 'signup');
    assert.equal(url.searchParams.get('redirect_to'), event().email_data.redirect_to);
    assert(!JSON.stringify(result).includes(secret)); assert(!JSON.stringify(result).includes(config.supabaseKey));
});
test('signature verification is over original bytes, never a re-serialized object', () => {
    const raw = Buffer.from(JSON.stringify(event(), null, 2) + '\n');
    assert.equal(verify(signed(event(), undefined, undefined, raw)).send, true);
    const input = signed(); input.raw = Buffer.concat([input.raw, Buffer.from(' ')]);
    assert.equal(verify(input).status, 401);
});
test('missing, invalid, short, and stale signatures fail before any sending', () => {
    for (const headers of [{}, { ...signed().headers, 'webhook-signature': 'v1,YQ==' }, { ...signed().headers, 'webhook-timestamp': '1000000000' }]) {
        const r = verify({ raw: signed().raw, headers }); assert.equal(r.send, false); assert.equal(r.status, 401);
    }
});
test('hook key rotation supports multiple signed secrets without unsigned fallbacks', () => {
    const other = 'v1,whsec_' + Buffer.alloc(32, 8).toString('base64');
    assert.equal(verify(signed(), { ...config, hookSecrets: other + '|' + secret }).send, true);
    assert.equal(verify(signed(), { ...config, hookSecrets: 'plain-insecure-secret' }).status, 503);
});
test('configuration, oversized payload, JSON, email and redirect validation fail closed', () => {
    for (const key of Object.keys(config)) assert.equal(verify(signed(), { ...config, [key]: '' }).send, false);
    assert.equal(verify(signed(), { ...config, listId: 'not-a-list' }).send, false);
    assert.equal(verify({ ...signed(), raw: Buffer.alloc(204801) }).status, 400);
    assert.equal(verify(signed(event(), undefined, undefined, Buffer.from('{'))).status, 400);
    for (const mutate of [e => e.user.email = 'mail\r\n@example.test', e => e.email_data.redirect_to = 'https://evil.test', e => e.email_data.token_hash = 'not-a-hash']) {
        const e = event(); mutate(e); assert.equal(verify(signed(e)).send, false);
    }
});
test('unsupported Auth events cannot be silently acknowledged or converted into signup', () => {
    for (const action of ['recovery', 'magiclink', 'invite', 'email_change', 'reauthentication']) {
        const e = event(); e.email_data.email_action_type = action; const r = verify(signed(e));
        assert.equal(r.status, 422); assert.equal(r.send, false);
    }
});
test('GoTrue retries with different webhook IDs share a delivery key; resend gets a new key', () => {
    const first = verify(); const retry = verify(signed(event(), '11111111-1111-4111-8111-111111111113'));
    assert.equal(first.deliveryKey, retry.deliveryKey); assert.notEqual(first.owner, retry.owner);
    const resent = event(); resent.email_data.token_hash = 'b'.repeat(64);
    assert.notEqual(first.deliveryKey, verify(signed(resent)).deliveryKey);
});
test('deadlines and claims gate sending; only a committed accepted tombstone is a duplicate success', () => {
    const verified = verify();
    assert.equal(verify(signed(), config, now + 4500).send, false);
    assert.equal(classifyClaim(response([{ decision: 'send' }]), verified, now).send, true);
    assert.deepEqual(classifyClaim(response([{ decision: 'accepted' }]), verified, now).body, {});
    for (const r of [response([{ decision: 'blocked' }]), response([], 200), response({}, 500), { error: {} }]) {
        assert.notEqual(classifyClaim(r, verified, now).status, 200);
    }
    assert.equal(classifyClaim(response([{ decision: 'send' }]), verified, verified.deadline - 100).send, false);
});
test('Unisender acceptance is explicit; JSON errors, HTML, timeouts and wrong recipient never pass', () => {
    const email = event().user.email;
    assert.equal(classifyUnisender(accepted(email), email).state, 'accepted');
    for (const r of [response({ error: 'rejected' }), response({ result: [{ errors: [{ code: 'unchecked_sender_email' }] }] })]) {
        assert.equal(classifyUnisender(r, email).state, 'failed');
    }
    for (const r of [response('<html>error</html>'), { error: 'timeout with sensitive data' }, response({}, 503), response({ result: { email_id: 12 } }), accepted('other@example.test')]) {
        assert.equal(classifyUnisender(r, email).state, 'uncertain');
    }
});
test('only accepted delivery persisted under the claimed owner produces 200 empty JSON', () => {
    assert.deepEqual(finishAuthEmail(response([{ state: 'accepted' }]), { state: 'accepted' }), { status: 200, body: {} });
    for (const provider of ['failed', 'uncertain']) assert.equal(finishAuthEmail(response([{ state: provider }]), { state: provider }).status, 503);
    assert.equal(finishAuthEmail(response([]), { state: 'accepted' }).status, 503);
});

// Execute generated Code nodes, branches and HTTP expressions with a synthetic in-memory
// ledger and mocked HTTP transport. No real n8n executions or provider/Supabase requests.
async function runGraph(input, ledger, fault, metrics) {
    const workflow = authEmailWorkflow(); const values = new Map(); const vnow = Date.now();
    const n = Math.floor(vnow / 1000); const fresh = signed(event(), input.headers['webhook-id'], String(n));
    if (input.badSignature) fresh.headers['webhook-signature'] = 'v1,bad';
    let item = { headers: fresh.headers }, name = 'Verify signature';
    const evalExpression = text => {
        if (typeof text !== 'string' || !text.startsWith('={{')) return text;
        return vm.runInNewContext('(' + text.slice(3, -2) + ')', { $json: item, $env: env, $: label => ({ first: () => ({ json: values.get(label) }) }), Date, Math, JSON });
    };
    const env = { MEETGURU_AUTH_HOOK_SECRETS: secret, MEETGURU_UNISENDER_API_KEY: config.unisenderKey, MEETGURU_AUTH_SUPABASE_SERVICE_KEY: config.supabaseKey, MEETGURU_AUTH_UNISENDER_LIST_ID: config.listId };
    while (name) {
        const node = workflow.nodes.find(x => x.name === name); let branch = 0;
        if (node.type.endsWith('.code')) {
            const sandbox = { Buffer, Date, Math, JSON, encodeURIComponent, require: id => { assert.equal(id, 'crypto'); return crypto; },
                $env: env, $input: { first: () => ({ json: item }) }, $: label => ({ first: () => ({ json: values.get(label) }) }),
                console: { log() { throw Error('Payload logging forbidden'); }, error() { throw Error('Payload logging forbidden'); } },
                helpers: { getBinaryDataBuffer: async () => fresh.raw } };
            const wrapped = vm.runInNewContext('(async function(){' + node.parameters.jsCode + '})', sandbox);
            item = JSON.parse(JSON.stringify((await wrapped.call({ helpers: sandbox.helpers }))[0].json));
        } else if (node.type.endsWith('.if')) branch = evalExpression(node.parameters.conditions.conditions[0].leftValue) ? 0 : 1;
        else if (node.type.endsWith('.httpRequest')) {
            const p = node.parameters; assert.equal(node.retryOnFail || false, false);
            assert(evalExpression(p.options.timeout) > 0 && evalExpression(p.options.timeout) <= (name === 'Unisender API' ? 2000 : 600));
            if (name === 'Claim delivery') {
                const body = evalExpression(p.jsonBody); metrics.claims++;
                if (fault === 'ledgerDown') item = { error: 'sensitive simulated database error' };
                else if (ledger.has(body.p_key)) item = response([{ decision: ledger.get(body.p_key) === 'accepted' ? 'accepted' : 'blocked' }]);
                else { ledger.set(body.p_key, 'sending'); item = response([{ decision: 'send' }]); }
            } else if (name === 'Unisender API') {
                metrics.sent++;
                const body = Object.fromEntries(p.bodyParameters.parameters.map(v => [v.name, evalExpression(v.value)]));
                assert.equal(body.sender_name, 'MeetGuru'); assert.equal(body.sender_email, 'adv@meetgu.ru'); assert(!body.body.includes('password'));
                item = fault === 'providerError' ? response({ error: 'synthetic API rejection' })
                    : fault === 'providerTimeout' ? { error: 'synthetic transport timeout' } : accepted(body.email);
            } else {
                const body = evalExpression(p.jsonBody);
                if (fault === 'finishDown') item = { error: 'sensitive simulated database error' };
                else { ledger.set(body.p_key, body.p_state); item = response([{ state: body.p_state }]); }
            }
        } else if (node.type.endsWith('.respondToWebhook')) return { status: evalExpression(node.parameters.options.responseCode), body: JSON.parse(evalExpression(node.parameters.responseBody)) };
        values.set(name, item); name = workflow.connections[name]?.main?.[branch]?.[0]?.node;
    }
    throw Error('No explicit webhook response');
}
test('generated workflow: first registration sends once; changed webhook-id duplicate returns success without resending', async () => {
    const ledger = new Map(), metrics = { claims: 0, sent: 0 };
    assert.equal((await runGraph(signed(), ledger, null, metrics)).status, 200);
    assert.equal((await runGraph(signed(event(), '11111111-1111-4111-8111-111111111114'), ledger, null, metrics)).status, 200);
    assert.equal(metrics.sent, 1);
});
test('generated workflow: parallel requests share one claim and never send twice', async () => {
    const ledger = new Map(), metrics = { claims: 0, sent: 0 };
    const results = await Promise.all(Array.from({ length: 12 }, () => runGraph(signed(), ledger, null, metrics)));
    assert.equal(metrics.sent, 1); assert(results.some(r => r.status === 200));
});
test('generated workflow: forged request cannot reach ledger or Unisender', async () => {
    const metrics = { claims: 0, sent: 0 }; const input = signed(); input.badSignature = true;
    assert.equal((await runGraph(input, new Map(), null, metrics)).status, 401);
    assert.equal(metrics.sent, 0); assert.equal(metrics.claims, 0);
});
for (const fault of ['ledgerDown', 'providerError', 'providerTimeout', 'finishDown']) test('generated workflow fails closed: ' + fault, async () => {
    const metrics = { claims: 0, sent: 0 }, ledger = new Map();
    const r = await runGraph(signed(), ledger, fault, metrics); assert.equal(r.status, 503);
    assert(!JSON.stringify(r).includes('sensitive')); assert(!JSON.stringify(r).includes('synthetic'));
    if (fault === 'ledgerDown') assert.equal(metrics.sent, 0);
    else { await runGraph(signed(), ledger, fault, metrics); assert.equal(metrics.sent, 1); }
});
test('workflow secrets and payload retention are disabled; SQL is private and unprivileged roles cannot execute RPCs', () => {
    const w = authEmailWorkflow(); const serialized = JSON.stringify(w);
    assert.equal(w.settings.saveDataErrorExecution, 'none'); assert.equal(w.settings.saveDataSuccessExecution, 'none');
    assert.equal(w.settings.saveManualExecutions, false); assert.equal(w.settings.saveExecutionProgress, false);
    assert.equal(w.settings.executionTimeout, 5); assert(!serialized.includes(config.unisenderKey)); assert(!serialized.includes(secret));
    assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../n8n/workflows/supabase-auth-email.json', import.meta.url), 'utf8')), w);
    assert(!w.nodes.some(n => /console\.|\.log\(/.test(n.parameters.jsCode || '')));
    assert(!w.nodes.some(n => /admin\/generate_link|\/auth\/v1\/signup/.test(n.parameters.url || '')));
    const sql = fs.readFileSync(new URL('../supabase/migrations/pending_auth_email_hook_dedup.sql', import.meta.url), 'utf8');
    assert(sql.includes('enable row level security')); assert(sql.includes("set search_path = pg_catalog"));
});
