import { hookFailure, confirmationEmail, verifyAuthEmail, classifyClaim, classifyUnisender, finishAuthEmail } from './auth-email-hook.mjs';

// Export contains secret references only. No production credentials, tokens or pinned events.
export function authEmailWorkflow() {
    const nodes = [];
    const add = (id, name, type, typeVersion, parameters, x, y = 0, extra = {}) => {
        nodes.push({ id, name, type: 'n8n-nodes-base.' + type, typeVersion, parameters, position: [x, y], ...extra });
    };
    const code = (functions, body) => functions.map(f => f.toString()).join('\n') + '\n' + body;
    add('auth-mail-webhook', 'GoTrue Auth email', 'webhook', 2, {
        httpMethod: 'POST', path: 'supabase-auth-email-meetguru', responseMode: 'responseNode', options: { rawBody: true },
    }, 0);
    add('auth-mail-verify', 'Verify signature', 'code', 2, {
        jsCode: code([hookFailure, confirmationEmail, verifyAuthEmail], `
let result;
try {
    const config = {
        hookSecrets: $env.MEETGURU_AUTH_HOOK_SECRETS,
        unisenderKey: $env.MEETGURU_UNISENDER_API_KEY,
        supabaseKey: $env.MEETGURU_AUTH_SUPABASE_SERVICE_KEY,
        listId: $env.MEETGURU_AUTH_UNISENDER_LIST_ID,
    };
    const raw = await this.helpers.getBinaryDataBuffer(0, 'data');
    result = verifyAuthEmail(raw, $input.first().json.headers || {}, config, require('crypto'));
} catch { result = hookFailure(); }
return [{json: result}];`),
    }, 240);
    const condition = id => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id, leftValue: '={{ $json.send === true }}', rightValue: true, operator: { type: 'boolean', operation: 'equals' } }], combinator: 'and' }, options: {} });
    add('auth-mail-verified-if', 'Authenticated signup?', 'if', 2.2, condition('auth-mail-valid'), 480);
    const verified = "$('Verify signature').first().json";
    const httpOptions = max => ({
        timeout: `={{ Math.max(1, Math.min(${max}, ${verified}.deadline - Date.now() - 200)) }}`,
        redirect: { redirect: { followRedirects: false } },
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } },
    });
    const rpc = (name, body) => ({ method: 'POST', url: 'https://sb.meetgu.ru/rest/v1/rpc/' + name,
        sendHeaders: true, headerParameters: { parameters: [
            { name: 'apikey', value: '={{ $env.MEETGURU_AUTH_SUPABASE_SERVICE_KEY }}' },
            { name: 'Authorization', value: "={{ 'Bearer ' + $env.MEETGURU_AUTH_SUPABASE_SERVICE_KEY }}" },
        ] }, sendBody: true, specifyBody: 'json', jsonBody: body, options: httpOptions(600) });
    add('auth-mail-claim', 'Claim delivery', 'httpRequest', 4.2,
        rpc('claim_auth_email_delivery', `={{ {p_key:${verified}.deliveryKey,p_owner:${verified}.owner} }}`), 720, -100, { onError: 'continueRegularOutput' });
    add('auth-mail-claim-result', 'Inspect claim', 'code', 2, {
        jsCode: code([hookFailure, classifyClaim], `return [{json:classifyClaim($input.first().json, ${verified})}];`),
    }, 960, -100);
    add('auth-mail-send-if', 'Send once?', 'if', 2.2, condition('auth-mail-send'), 1200, -100);
    add('auth-mail-provider', 'Unisender API', 'httpRequest', 4.2, {
        method: 'POST', url: 'https://api.unisender.com/ru/api/sendEmail',
        sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [
            { name: 'format', value: 'json' }, { name: 'error_checking', value: '1' },
            { name: 'api_key', value: '={{ $env.MEETGURU_UNISENDER_API_KEY }}' },
            { name: 'email', value: `={{ ${verified}.email }}` },
            { name: 'sender_email', value: 'adv@meetgu.ru' }, { name: 'sender_name', value: 'MeetGuru' },
            { name: 'subject', value: `={{ ${verified}.mail.subject }}` },
            { name: 'body', value: `={{ ${verified}.mail.html }}` },
            { name: 'list_id', value: '={{ $env.MEETGURU_AUTH_UNISENDER_LIST_ID }}' },
        ] }, options: httpOptions(2000),
    }, 1440, -200, { onError: 'continueRegularOutput' });
    add('auth-mail-assess', 'Assess delivery', 'code', 2, {
        jsCode: code([classifyUnisender], `return [{json:classifyUnisender($input.first().json, ${verified}.email)}];`),
    }, 1680, -200);
    add('auth-mail-finish', 'Record delivery result', 'httpRequest', 4.2,
        rpc('finish_auth_email_delivery', `={{ {p_key:${verified}.deliveryKey,p_owner:${verified}.owner,p_state:$json.state} }}`),
        1920, -200, { onError: 'continueRegularOutput' });
    add('auth-mail-result', 'Sanitized result', 'code', 2, {
        jsCode: code([hookFailure, finishAuthEmail], "return [{json:finishAuthEmail($input.first().json, $('Assess delivery').first().json)}];"),
    }, 2160, -200);
    add('auth-mail-response', 'Reply to GoTrue', 'respondToWebhook', 1.4, {
        respondWith: 'json', responseBody: '={{ JSON.stringify($json.body) }}',
        options: { responseCode: '={{ $json.status }}', responseHeaders: { entries: [
            { name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' },
        ] } },
    }, 2400);
    const edge = name => ({ node: name, type: 'main', index: 0 });
    const single = name => ({ main: [[edge(name)]] });
    return {
        name: 'MeetGuru — Supabase Auth email — PREPARED INACTIVE', nodes,
        connections: {
            'GoTrue Auth email': single('Verify signature'), 'Verify signature': single('Authenticated signup?'),
            'Authenticated signup?': { main: [[edge('Claim delivery')], [edge('Reply to GoTrue')]] },
            'Claim delivery': single('Inspect claim'), 'Inspect claim': single('Send once?'),
            'Send once?': { main: [[edge('Unisender API')], [edge('Reply to GoTrue')]] },
            'Unisender API': single('Assess delivery'), 'Assess delivery': single('Record delivery result'),
            'Record delivery result': single('Sanitized result'), 'Sanitized result': single('Reply to GoTrue'),
        },
        settings: { executionOrder: 'v1', executionTimeout: 5, saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveExecutionProgress: false, saveManualExecutions: false },
    };
}
