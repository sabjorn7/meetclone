// Pure logic shared by the generated n8n Code nodes and offline tests.
// Never log a hook payload, confirmation URL, provider request, or caught error.
export function hookFailure(status = 503, code = 'delivery_unavailable') {
    return { send: false, status, body: { error: { http_code: status, message: code } } };
}

export function confirmationEmail(url) {
    const href = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return {
        subject: 'Подтвердите электронную почту — MeetGuru',
        senderName: 'MeetGuru',
        senderEmail: 'adv@meetgu.ru',
        html: `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Подтвердите почту — MeetGuru</title></head><body style="margin:0;background:#f1f6fd;color:#091747;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px"><tr><td style="padding:32px"><p style="margin:0 0 28px;font-size:26px;font-weight:700;color:#091747">meet<span style="color:#2e6fd6">guru</span>.</p><h1 style="font-size:26px;line-height:1.25;margin:0 0 16px">Подтвердите электронную почту</h1><p style="font-size:16px;line-height:1.6;margin:0 0 24px">Вы зарегистрировались в MeetGuru. Нажмите кнопку, чтобы подтвердить адрес и завершить вход.</p><p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#2e6fd6;color:#fff;padding:14px 24px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:700">Подтвердить почту</a></p><p style="font-size:14px;line-height:1.6;color:#5b6472">Если ссылка истекла, запросите новое письмо на странице входа. Если вы не регистрировались, просто проигнорируйте это письмо.</p><p style="font-size:14px;line-height:1.6;color:#5b6472;margin-bottom:0">Команда MeetGuru</p></td></tr></table></td></tr></table></body></html>`,
    };
}

export function verifyAuthEmail(raw, headers, config, crypto, now = Date.now()) {
    try {
        // Fail closed before parsing input or contacting either server.
        if (!config.hookSecrets || !config.unisenderKey || !config.supabaseKey || !/^\d+$/.test(config.listId || '')) return hookFailure();
        if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > 204800) return hookFailure(400, 'invalid_request');
        const id = headers['webhook-id'];
        const timestamp = headers['webhook-timestamp'];
        const signatures = headers['webhook-signature'];
        if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)
            || typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp)
            || typeof signatures !== 'string' || signatures.length > 2048
            || Math.abs(now / 1000 - Number(timestamp)) > 300) return hookFailure(401, 'invalid_signature');
        const offered = [...signatures.matchAll(/(?:^|[\s,])v1,([A-Za-z0-9+/]+={0,2})(?=$|[\s,])/g)].map(m => Buffer.from(m[1], 'base64'));
        let authentic = false;
        for (const secret of config.hookSecrets.split('|')) {
            if (!/^v1,whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) return hookFailure();
            const key = Buffer.from(secret.slice('v1,whsec_'.length), 'base64');
            if (key.length !== 32) return hookFailure();
            const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.`).update(raw).digest();
            for (const signature of offered) if (signature.length === expected.length && crypto.timingSafeEqual(signature, expected)) authentic = true;
        }
        if (!authentic) return hookFailure(401, 'invalid_signature');
        const event = JSON.parse(raw.toString('utf8'));
        const data = event.email_data;
        // This is deliberately a signup-only transport. Never acknowledge another Auth email as sent.
        if (data?.email_action_type !== 'signup') return hookFailure(422, 'unsupported_email_action');
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.user?.id || '')
            || typeof event.user.email !== 'string' || event.user.email.length > 254
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.user.email)
            || !/^(pkce_)?[0-9a-f]{64}$/i.test(data.token_hash || '')) return hookFailure(400, 'invalid_request');
        const redirect = 'https://app.meetgu.ru/login?email_confirmation=1';
        if (data.redirect_to !== redirect) return hookFailure(400, 'invalid_redirect');
        // No extra generateLink: use the token already generated and stored by GoTrue.
        const url = 'https://sb.meetgu.ru/auth/v1/verify?token=' + encodeURIComponent(data.token_hash)
            + '&type=signup&redirect_to=' + encodeURIComponent(redirect);
        const mail = confirmationEmail(url);
        // An opaque high-entropy token hash is hashed again; no token/URL/email is persisted in the ledger.
        // Do not key on webhook-id: GoTrue v2.171.0 regenerates it for transport retries.
        const deliveryKey = crypto.createHash('sha256').update(`signup\n${event.user.id}\n${event.user.email}\n${data.token_hash}`).digest('hex');
        const deadline = Math.min(now + 3600, Number(timestamp) * 1000 + 4400);
        if (deadline - now < 800) return hookFailure(503, 'hook_deadline');
        return { send: true, deadline, deliveryKey, owner: crypto.randomUUID(), email: event.user.email, mail };
    } catch {
        return hookFailure(400, 'invalid_request');
    }
}

export function classifyClaim(response, verified, now = Date.now()) {
    if (!response || response.statusCode !== 200 || !Array.isArray(response.body) || response.body.length !== 1) return hookFailure();
    const decision = response.body[0].decision;
    if (decision === 'accepted') return { send: false, status: 200, body: {} };
    if (decision !== 'send') return hookFailure(503, 'delivery_in_progress');
    if (verified.deadline - now < 800) return hookFailure(503, 'hook_deadline');
    return { send: true };
}

export function classifyUnisender(response, email) {
    // A timeout or malformed reply may follow provider acceptance. Never retry it automatically.
    if (!response || response.error || !Number.isInteger(response.statusCode)) return { state: 'uncertain' };
    const body = response.body;
    if (response.statusCode < 200 || response.statusCode >= 300) return { state: 'uncertain' };
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { state: 'uncertain' };
    if (body.error || body.code) return { state: 'failed' };
    // Use the documented error_checking=1 contract, one recipient, no CC.
    const result = body.result;
    if (!Array.isArray(result) || result.length !== 1) return { state: 'uncertain' };
    const item = result[0];
    if (!item || (Array.isArray(item.errors) && item.errors.length)) return { state: 'failed' };
    if (item.index !== 0 || item.email !== email || (item.errors && !Array.isArray(item.errors))) return { state: 'uncertain' };
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)) return { state: 'uncertain' };
    return { state: 'accepted' };
}

export function finishAuthEmail(response, provider) {
    const saved = response?.statusCode === 200 && Array.isArray(response.body)
        && response.body.length === 1 && response.body[0].state === provider.state;
    return saved && provider.state === 'accepted' ? { status: 200, body: {} } : hookFailure();
}
