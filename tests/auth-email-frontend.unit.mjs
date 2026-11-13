import assert from 'node:assert/strict';
import test from 'node:test';
import { isRegistrationEmail, suggestRegistrationEmail, confirmationSession, confirmationError, resendConfirmation } from '../src/_front/auth/registration.js';

test('email suggestions preserve unknown valid domains and never change the submitted address', () => {
    assert(isRegistrationEmail('user@mail.ruy')); assert.equal(suggestRegistrationEmail('user@mail.ruy'), 'user@mail.ru');
    assert(isRegistrationEmail('user@unknown-company.education')); assert.equal(suggestRegistrationEmail('user@unknown-company.education'), null);
    for (const v of ['bad', 'two@@example.test', 'a b@example.test']) assert.equal(isRegistrationEmail(v), false);
});
test('resend uses the same public SDK with signup type and the approved callback; no password/token', async () => {
    let request;
    await resendConfirmation({ resend: async p => { request = p; return { error: null }; } }, ' user@example.test ', 'https://app.meetgu.ru');
    assert.deepEqual(request, { type: 'signup', email: 'user@example.test', options: { emailRedirectTo: 'https://app.meetgu.ru/login?email_confirmation=1' } });
});
test('invalid resend addresses do not call the SDK; errors are not mistaken for success', async () => {
    let calls = 0;
    await assert.rejects(resendConfirmation({ resend: () => { calls++; } }, 'bad', 'https://app.meetgu.ru'));
    assert.equal(calls, 0);
    await assert.rejects(resendConfirmation({ resend: async () => ({ error: { status: 429, code: 'over_email_send_rate_limit' } }) }, 'user@example.test', 'https://app.meetgu.ru'));
});
test('confirmation callback waits for SDK session and rejects expired/missing sessions', async () => {
    const session = { user: { id: 'synthetic-user' } };
    assert.equal(await confirmationSession({ getSession: async () => ({ data: { session } }) }), session);
    await assert.rejects(confirmationSession({ getSession: async () => ({ data: { session: null } }) }));
    await assert.rejects(confirmationSession({ getSession: () => { throw Error('must not read session'); } }, '#error=access_denied&error_code=otp_expired'));
});
test('safe Russian errors cover direct SDK errors and plugin cause-wrapped rate limits', () => {
    assert(confirmationError({ status: 429 }).includes('минуту'));
    assert(confirmationError({ cause: { code: 'over_email_send_rate_limit' } }).includes('минуту'));
    assert(!confirmationError({ message: 'sensitive-provider-body' }).includes('sensitive'));
});
test('resend timeout releases the UI without persisting passwords or assuming delivery', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = resendConfirmation({ resend: () => new Promise(() => {}) }, 'user@example.test', 'https://app.meetgu.ru');
    const rejected = assert.rejects(pending, /resend_timeout/);
    t.mock.timers.tick(12000); await rejected;
});
