// Closed-network TLS router + Unisender contract mock. No requests leave the Docker network.
// Tokens and raw hook/mail payloads are kept in fixture memory ONLY, never console/artifacts.
import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
let mode = 'success';
let stats, lastHook, lastMail;
function reset() { stats = { hookCalls: 0, providerCalls: 0, claimCalls: 0, finishCalls: 0, nativeSignaturesValid: 0, lastHookReply: null }; lastHook = null; lastMail = null; }
reset();
function json(res, status, value) { if (!res.destroyed) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); } }
async function body(req) { const buffers = []; let size = 0; for await (const b of req) { size += b.length; if (size > 204800) throw Error('fixture request too large'); buffers.push(b); } return Buffer.concat(buffers); }
function validSignature(raw, headers) {
    try {
        const key = Buffer.from(process.env.MG_AUTH_IT_HOOK_SECRET.slice('v1,whsec_'.length), 'base64');
        const expected = crypto.createHmac('sha256', key).update(headers['webhook-id'] + '.' + headers['webhook-timestamp'] + '.').update(raw).digest();
        return String(headers['webhook-signature']).split(/\s+/).some(s => { const value = Buffer.from(s.replace(/^v1,/, ''), 'base64'); return value.length === expected.length && crypto.timingSafeEqual(value, expected); });
    } catch { return false; }
}
function forward(req, res, target, raw, hook = false) {
    const request = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host, 'content-length': raw.length } }, incoming => {
        const chunks = [];
        incoming.on('data', b => chunks.push(b));
        incoming.on('end', () => {
            const data = Buffer.concat(chunks);
            if (hook) {
                let emptyObject = false; try { const value = JSON.parse(data); emptyObject = value && !Array.isArray(value) && Object.keys(value).length === 0; } catch {}
                stats.lastHookReply = { status: incoming.statusCode, contentType: incoming.headers['content-type'], emptyObject };
            }
            const respond = () => {
                if (res.destroyed) return;
                if (hook && mode === 'empty_hook_reply') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(); return; }
                res.writeHead(incoming.statusCode, incoming.headers); res.end(data);
            };
            if (hook && mode === 'slow_hook_reply') setTimeout(respond, 5600); else respond();
        });
    });
    request.on('error', () => json(res, 503, { error: 'fixture_upstream_unavailable' }));
    request.end(raw);
}
https.createServer({ cert: fs.readFileSync('/fixture.crt'), key: fs.readFileSync('/fixture.key') }, async (req, res) => {
    try {
        const host = String(req.headers.host || '').split(':')[0];
        const path = new URL(req.url, 'https://' + host).pathname;
        if (path === '/__test/control') {
            if (req.method === 'POST') { const data = JSON.parse((await body(req)).toString()); if (data.reset) reset(); mode = data.mode || 'success'; }
            json(res, 200, { mode, ...stats }); return;
        }
        // Test driver reads these via the internal TLS network; neither route is logged/exported.
        if (path === '/__test/last-hook') { json(res, 200, lastHook); return; }
        if (path === '/__test/last-mail') { json(res, 200, lastMail); return; }
        const raw = await body(req);
        if (host === 'api.unisender.com' && path === '/ru/api/sendEmail') {
            stats.providerCalls++;
            const form = new URLSearchParams(raw.toString());
            if (form.get('api_key') !== process.env.MG_AUTH_IT_PROVIDER_KEY) { json(res, 403, { error: 'invalid_api_key' }); return; }
            if (form.get('sender_email') !== 'adv@meetgu.ru' || form.get('sender_name') !== 'MeetGuru' || !form.get('body') || form.get('list_id') !== '123' || form.get('track_links') !== '0') { json(res, 400, { error: 'invalid_provider_contract' }); return; }
            lastMail = { html: form.get('body'), email: form.get('email'), subject: form.get('subject') };
            if (mode === 'provider_error') { json(res, 200, { error: 'mock_rejection', code: 'retry_later' }); return; }
            if (mode === 'recipient_error') { json(res, 200, { result: [{ index: 0, email: form.get('email'), errors: [{ code: 'unchecked_sender_email' }] }] }); return; }
            if (mode === 'provider_html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>mock upstream error</html>'); return; }
            const result = mode === 'legacy' ? { result: { email_id: 'fixture1234' } } : { result: [{ index: 0, email: form.get('email'), id: 'fixture1234' }] };
            if (mode === 'slow_provider') setTimeout(() => json(res, 200, result), 3000); else json(res, 200, result);
            return;
        }
        if (host === 'n8n.meetgu.ru') {
            stats.hookCalls++;
            if (validSignature(raw, req.headers)) stats.nativeSignaturesValid++;
            lastHook = { raw: raw.toString('base64'), headers: Object.fromEntries(['webhook-id', 'webhook-timestamp', 'webhook-signature'].map(k => [k, req.headers[k]])) };
            forward(req, res, new URL(req.url, 'http://n8n:5678'), mode === 'tamper_hook' ? Buffer.concat([raw, Buffer.from(' ')]) : raw, true); return;
        }
        if (host === 'sb.meetgu.ru' && path.startsWith('/auth/v1/')) { forward(req, res, new URL(req.url.replace(/^\/auth\/v1/, ''), 'http://auth:9999'), raw); return; }
        if (host === 'sb.meetgu.ru' && path.startsWith('/rest/v1/')) {
            if (path.endsWith('/claim_auth_email_delivery')) stats.claimCalls++;
            if (path.endsWith('/finish_auth_email_delivery')) stats.finishCalls++;
            if ((mode === 'claim_unavailable' && path.endsWith('/claim_auth_email_delivery')) || (mode === 'finish_unavailable' && path.endsWith('/finish_auth_email_delivery'))) { json(res, 503, { error: 'mock_ledger_unavailable' }); return; }
            forward(req, res, new URL(req.url.replace(/^\/rest\/v1/, ''), 'http://rest:3000'), raw); return;
        }
        json(res, 404, { error: 'fixture_route_not_allowed' });
    } catch { json(res, 500, { error: 'fixture_error' }); }
}).listen(443, '0.0.0.0');
