// Suggestions are deliberately limited to known typos. Unknown domains remain valid.
const DOMAIN_TYPOS = Object.freeze({
    'mail.ruy': 'mail.ru', 'mail.r': 'mail.ru', 'mail.ry': 'mail.ru', 'mai.ru': 'mail.ru',
    'gmail.con': 'gmail.com', 'gmail.cmo': 'gmail.com', 'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.comu': 'gmail.com',
    'yandex.ry': 'yandex.ru', 'yandex.r': 'yandex.ru', 'yandx.ru': 'yandex.ru',
    'yandex.ruy': 'yandex.ru', 'ya.ry': 'ya.ru', 'ya.r': 'ya.ru',
    'outlook.con': 'outlook.com', 'hotmail.con': 'hotmail.com', 'yahoo.con': 'yahoo.com',
});

export function isRegistrationEmail(value) {
    const email = String(value || '').trim();
    const parts = email.split('@');
    return email.length <= 254 && parts.length === 2 && parts[0].length <= 64
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function suggestRegistrationEmail(value) {
    const email = String(value || '').trim();
    if (!isRegistrationEmail(email)) return null;
    const index = email.lastIndexOf('@');
    const corrected = DOMAIN_TYPOS[email.slice(index + 1).toLowerCase()];
    return corrected ? email.slice(0, index + 1) + corrected : null;
}

export function confirmationRedirect(origin) {
    // Reuse /login: it waits for the existing Auth client's URL/session initialization.
    return new URL('/login?email_confirmation=1', origin).href;
}

export async function confirmationSession(auth, hash = '') {
    if (new URLSearchParams(hash.replace(/^#/, '')).has('error')) throw new Error('Confirmation link failed');
    if (!auth?.getSession) throw new Error('Auth is not ready');
    const { data, error } = await auth.getSession();
    if (error || !data?.session?.user?.id) throw new Error('Confirmation session missing');
    return data.session;
}

export const CONFIRMATION_RESEND_DELAY = 60000;

export function confirmationError(error) {
    const detail = error?.cause || error;
    const code = detail?.code || '';
    if (Number(detail?.status) === 429 || /rate_limit|over_email_send/.test(code)) {
        return 'Слишком много запросов. Подождите минуту и попробуйте ещё раз.';
    }
    return 'Не удалось отправить письмо. Проверьте соединение и попробуйте ещё раз через минуту.';
}

export async function resendConfirmation(auth, email, origin) {
    const address = String(email || '').trim();
    if (!isRegistrationEmail(address)) throw new Error('invalid_email');
    if (!auth?.resend) throw new Error('auth_unavailable');
    let timer;
    try {
        const result = await Promise.race([
            auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: confirmationRedirect(origin) } }),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('resend_timeout')), 12000); }),
        ]);
        if (result?.error) throw result.error;
    } finally { clearTimeout(timer); }
}
