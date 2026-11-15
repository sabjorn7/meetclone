// Runs INSIDE the internal Compose network. Never prints URLs/tokens/payloads/credentials.
import fs from 'node:fs';
import crypto from 'node:crypto';
const auth = 'https://sb.meetgu.ru/auth/v1';
const callback = 'https://app.meetgu.ru/login?email_confirmation=1';
const controlUrl = 'https://sb.meetgu.ru/__test/';
const hookUrl = 'https://n8n.meetgu.ru/webhook/supabase-auth-email-meetguru';
const service = process.env.MG_AUTH_IT_SERVICE_JWT;
const password = 'Fixture-only-Password-123!';
const checks = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(condition, label) { if (!condition) throw Error(label); }
async function request(url, { method = 'GET', data, headers = {}, raw, timeout = 15000 } = {}) {
    const response = await fetch(url, { method, headers: { ...(data || raw ? { 'content-type': 'application/json' } : {}), ...headers },
        body: raw || (data ? JSON.stringify(data) : undefined), redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    const text = await response.text(); let json; try { json = JSON.parse(text); } catch {}
    return { status: response.status, headers: response.headers, json, text };
}
const control = data => request(controlUrl + 'control', data ? { method: 'POST', data } : {});
const lastMail = async () => (await request(controlUrl + 'last-mail')).json;
const lastHook = async () => (await request(controlUrl + 'last-hook')).json;
const stats = async () => (await control()).json;
async function ready() {
    const deadline = Date.now() + 150000;
    let attempts = 0;
    while (Date.now() < deadline) {
        const state = { auth: 0, n8n: 0, hook: 0 };
        let authReady = false;
        try {
            const r = await request(auth + '/health', { timeout: 2000 }); state.auth = r.status;
            authReady = r.status === 200 && r.json?.version === 'v2.171.0';
        } catch {}
        try { state.n8n = (await fetch('http://n8n:5678/healthz', { signal: AbortSignal.timeout(2000) })).status; } catch {}
        if (authReady && state.n8n === 200) {
            try { state.hook = (await request(hookUrl, { method: 'POST', data: {}, timeout: 2000 })).status; } catch {}
            if (state.hook === 401) return; // warm configured Code node; no sending/DB access
        }
        if (++attempts % 20 === 0) console.log(JSON.stringify({ fixtureReadinessHttpStatus: state }));
        await sleep(1000);
    }
    throw Error('fixture_runtime_not_ready');
}
async function signup(email) {
    return request(auth + '/signup?redirect_to=' + encodeURIComponent(callback), { method: 'POST', data: { email, password, data: { nickname: 'Ученик' } } });
}
function mailLink(mail) {
    const match = mail?.html?.match(/href="([^"]+)"/); check(match, 'mail_verify_link_missing');
    check(!match[1].includes('&amp;'), 'provider_href_contains_html_amp_entity');
    const link = new URL(match[1]);
    check(link.origin === 'https://sb.meetgu.ru' && link.pathname === '/auth/v1/verify', 'mail_verify_endpoint_changed');
    check(link.searchParams.get('type') === 'signup' && link.searchParams.get('redirect_to') === callback, 'mail_verify_contract_changed');
    check(/^(pkce_)?[0-9a-f]{56}$/.test(link.searchParams.get('token') || ''), 'native_sha224_token_hash_rejected');
    return link.href;
}
async function profiles(email) {
    const r = await request('https://sb.meetgu.ru/rest/v1/fixture_profiles?select=user_id,role&email=eq.' + encodeURIComponent(email), { headers: { authorization: 'Bearer ' + service } });
    check(r.status === 200 && Array.isArray(r.json), 'fixture_profile_read_failed'); return r.json;
}
async function nativeVerify(link, expectedId) {
    const response = await request(link);
    check(response.status === 302 || response.status === 303, 'native_verify_did_not_redirect');
    const target = new URL(response.headers.get('location'));
    const fragment = new URLSearchParams(target.hash.slice(1));
    check(target.origin === 'https://app.meetgu.ru' && target.pathname === '/login', 'native_callback_target_changed');
    const token = fragment.get('access_token'); check(token, 'native_verify_session_missing');
    const me = await request(auth + '/user', { headers: { authorization: 'Bearer ' + token } });
    check(me.status === 200 && me.json?.id === expectedId && me.json?.email_confirmed_at, 'native_verify_wrong_or_unconfirmed_user');
}
async function replay(snapshot, tamper = false) {
    const raw = Buffer.from(snapshot.raw, 'base64');
    const id = crypto.randomUUID(), timestamp = String(Math.floor(Date.now() / 1000));
    const key = Buffer.from(process.env.MG_AUTH_IT_HOOK_SECRET.slice('v1,whsec_'.length), 'base64');
    const mac = crypto.createHmac('sha256', key).update(id + '.' + timestamp + '.').update(raw).digest('base64');
    return request(hookUrl, { method: 'POST', raw: tamper ? Buffer.concat([raw, Buffer.from(' ')]) : raw,
        headers: { 'webhook-id': id, 'webhook-timestamp': timestamp, 'webhook-signature': 'v1,' + mac } });
}
async function scenario(name, task) {
    const started = Date.now(); await task(); const milliseconds = Date.now() - started;
    checks.push({ name, status: 'PASS', milliseconds }); console.log('PASS ' + name);
}
try {
    await ready();
    if (process.argv.includes('--wait-only')) { console.log('Fixture GoTrue v2.171.0 and n8n 1.90.2 ready.'); process.exit(0); }
    await scenario('native_signup_signature_json_reply_and_profile', async () => {
        await control({ reset: true }); const email = 'native-signup@example.test'; const result = await signup(email);
        check(result.status === 200 && result.json?.id && !result.json?.access_token, 'native_signup_did_not_wait_for_confirmation');
        const snapshot = await lastHook(); const event = JSON.parse(Buffer.from(snapshot.raw, 'base64'));
        check(!JSON.stringify(event).includes(password), 'password_present_in_hook');
        check(event.email_data.email_action_type === 'signup' && event.email_data.token_hash.length === 56, 'native_hook_payload_mismatch');
        const state = await stats(); check(state.nativeSignaturesValid === 1 && state.providerCalls === 1 && state.claimCalls === 1 && state.finishCalls === 1, 'native_chain_not_executed_once');
        check(state.lastHookReply?.status === 200 && state.lastHookReply?.emptyObject === true && state.lastHookReply.contentType.startsWith('application/json'), 'native_hook_success_response_mismatch');
        const rows = await profiles(email); check(rows.length === 1 && rows[0].user_id === result.json.id && rows[0].role === 'Ученик', 'native_profile_trigger_changed');
        const mail = await lastMail(); check(mail.subject === 'Подтвердите электронную почту — MeetGuru', 'native_mail_subject_changed');
        check(mail.html.includes('Подтвердить почту'), 'native_mail_button_missing');
        await nativeVerify(mailLink(mail), result.json.id);
        const duplicate = await replay(snapshot); check(duplicate.status === 200 && duplicate.text === '{}', 'native_duplicate_not_acknowledged');
        check((await stats()).providerCalls === 1, 'duplicate_provider_send');
        const forged = await replay(snapshot, true); check(forged.status === 401, 'original_body_tampering_not_rejected');
        check((await stats()).providerCalls === 1, 'forged_request_reached_provider');
    });
    await scenario('native_resend_rate_limit_uuid_and_token_rotation', async () => {
        await control({ reset: true }); const email = 'native-resend@example.test'; const result = await signup(email);
        check(result.status === 200 && result.json?.id, 'native_resend_signup_failed'); const old = mailLink(await lastMail());
        const limited = await request(auth + '/resend?redirect_to=' + encodeURIComponent(callback), { method: 'POST', data: { type: 'signup', email } });
        check(limited.status === 429, 'native_resend_rate_limit_missing');
        await sleep(5200);
        const resent = await request(auth + '/resend?redirect_to=' + encodeURIComponent(callback), { method: 'POST', data: { type: 'signup', email } });
        check(resent.status === 200, 'native_resend_failed'); const next = mailLink(await lastMail()); check(next !== old, 'native_resend_did_not_rotate_token');
        const rows = await profiles(email); check(rows.length === 1 && rows[0].user_id === result.json.id, 'native_resend_created_duplicate_profile');
        const invalid = await request(old); check((invalid.headers.get('location') || '').includes('otp_expired'), 'old_token_not_invalidated');
        await nativeVerify(next, result.json.id); check((await stats()).providerCalls === 2, 'native_resend_send_count_wrong');
    });
    // Let this token expire while the error scenarios run, rather than sleeping for each case.
    await control({ reset: true }); const expiring = await signup('native-expired@example.test');
    check(expiring.status === 200, 'expiry_fixture_signup_failed');
    const expiryLink = mailLink(await lastMail()), expiresAfter = Date.now() + 31000;
    for (const mode of ['legacy', 'provider_error', 'recipient_error', 'provider_html', 'slow_provider', 'claim_unavailable', 'finish_unavailable', 'tamper_hook', 'empty_hook_reply', 'slow_hook_reply']) {
        await scenario('native_' + mode, async () => {
            await control({ reset: true, mode }); const email = 'native-' + mode.replaceAll('_', '-') + '@example.test';
            const started = Date.now(), result = await signup(email), elapsed = Date.now() - started;
            const state = await stats();
            if (mode === 'legacy') { check(result.status === 200 && state.providerCalls === 1, 'observed_legacy_format_not_supported'); await nativeVerify(mailLink(await lastMail()), result.json.id); return; }
            check(result.status >= 400, 'transport_failure_falsely_reported_success');
            check((await profiles(email)).length === 0, 'failed_signup_transaction_left_profile');
            if (mode === 'slow_hook_reply') check(elapsed >= 4500 && elapsed < 6500, 'gotrue_five_second_deadline_changed');
            else check(elapsed < 4800, 'hook_transport_exceeded_budget');
            if (mode === 'claim_unavailable' || mode === 'tamper_hook') check(state.providerCalls === 0, 'invalid_claim_or_signature_reached_provider');
            else check(state.providerCalls === 1, 'failed_attempt_send_count_changed');
            if (mode === 'slow_provider' || mode === 'finish_unavailable') {
                const snapshot = await lastHook(); await control({ mode: 'success' });
                const retry = await replay(snapshot); check(retry.status === 503, 'uncertain_attempt_automatically_reclaimed');
                check((await stats()).providerCalls === 1, 'ambiguous_failure_sent_again');
            }
        });
    }
    await scenario('native_expired_verification_link', async () => {
        await sleep(Math.max(0, expiresAfter - Date.now()));
        const response = await request(expiryLink);
        check((response.headers.get('location') || '').includes('otp_expired'), 'expired_native_token_accepted');
    });
    await scenario('existing_vk_and_reset_admin_generate_link_bypass_hook', async () => {
        await control({ reset: true });
        for (const label of ['vk', 'reset']) {
            const email = 'native-' + label + '@example.test';
            const created = await request(auth + '/admin/users', { method: 'POST', headers: { authorization: 'Bearer ' + service }, data: { email, password, email_confirm: label === 'reset' } });
            check(created.status === 200 && created.json?.id, 'admin_user_fixture_failed');
            const link = await request(auth + '/admin/generate_link', { method: 'POST', headers: { authorization: 'Bearer ' + service }, data: { type: 'recovery', email, redirect_to: 'https://app.meetgu.ru/reset_pw' } });
            check(link.status === 200 && typeof link.json?.email_otp === 'string' && link.json?.hashed_token?.length === 56, 'existing_admin_recovery_contract_changed');
            const verified = await request(auth + '/verify', { method: 'POST', data: { type: 'email', email, token: link.json.email_otp } });
            check(verified.status === 200 && verified.json?.access_token && verified.json?.user?.id === created.json.id, 'existing_vk_reset_otp_contract_changed');
        }
        const state = await stats(); check(state.hookCalls === 0 && state.providerCalls === 0, 'admin_generate_link_triggered_new_hook');
    });
    fs.writeFileSync('/out/results.json', JSON.stringify({ gotrue: 'v2.171.0', n8n: '1.90.2', provider: 'closed-network Unisender contract mock', checks,
        production_requests: 0, real_emails: 0, token_or_secret_values_in_artifact: false }, null, 2));
    console.log('PASS integration: ' + checks.length + ' scenarios; no real email or production traffic.');
} catch (error) {
    // Error messages are internal fixed labels; never emit fetch URLs, responses or stack/locals.
    const label = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'fixture_request_or_runtime_failure';
    console.error('FAIL ' + label);
    try { console.error(JSON.stringify({ safeFixtureCounters: await stats() })); } catch {}
    process.exitCode = 1;
}
