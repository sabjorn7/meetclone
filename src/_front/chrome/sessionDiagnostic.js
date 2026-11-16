// Opt-in, in-memory trace. No timers, storage, automatic uploads, raw URLs or error messages.
const PAGES = new Set(['HomePage', 'AllCoursesPage', 'CoursePage', 'MyCoursePage', 'ClubsPage',
    'ArticlesPage', 'UsersPage', 'ProfilePage', 'ProfileEditPage', 'ArticlePage', 'EventsPage']);
const STAGES = new Set(['route-transition', 'page-unload', 'auth', 'auth-init', 'http', 'body', 'page-load', 'page-await', 'processing', 'api-queue', 'api-call']);
const METHODS = ['getSession', 'getUser', 'refreshSession', 'setSession', 'signOut',
    'signInWithPassword', 'signUp', 'verifyOtp', 'exchangeCodeForSession'];
const ROUTES = new Set(['home', 'all_course', 'course', 'my_courses', 'clubs', 'articles', 'article', 'users',
    'profile', 'profile_page', 'events', 'streams', 'faq', 'login', 'registration', 'other']);
function errorType(error) {
    return ['AbortError', 'TypeError', 'SyntaxError', 'AuthRetryableFetchError', 'AuthApiError', 'Error']
        .includes(error?.name) ? error.name : 'other';
}
function routeKind(route) {
    const first = String(route?.path || '').split('/')[1];
    return ['', 'all_course', 'course', 'my_courses', 'clubs', 'articles', 'article', 'users',
        'profile', 'profile_page', 'events', 'streams', 'faq', 'login', 'registration'].includes(first)
        ? first || 'home' : 'other';
}
export function createSessionDiagnostic(now = () => performance.now()) {
    let sequence = 0, navigation = 0, dropped = 0;
    const events = [], active = new Map();
    function emit(event) { events.push(event); if (events.length > 240) { events.shift(); dropped++; } }
    function begin(stage, label = '', loading, point) {
        if (!STAGES.has(stage)) return { end() {}, ready() {} };
        const id = ++sequence, start = now(), nav = navigation;
        // Labels are constants/categories only, never arguments, route params or table names.
        const safeLabel = PAGES.has(label) || METHODS.includes(label) || ROUTES.has(label) || ['rest', 'auth', 'api'].includes(label) ? label : '';
        if (active.size >= 64) { active.delete(active.keys().next().value); dropped++; }
        const site = Number.isInteger(point) && point > 0 && point < 100 ? { point } : {};
        active.set(id, { id, stage, label: safeLabel, start, navigation: nav, loading, ...site });
        emit({ id, stage, label: safeLabel, navigation: nav, event: 'begin', at: start, ...site });
        let ended = false;
        return {
            ready() { emit({ id, stage, event: 'loading-false', navigation: nav, at: now(), ms: now() - start }); },
            end(outcome = 'ok', error, status) {
                if (ended) return;
                ended = true; active.delete(id);
                const event = { id, stage, navigation: nav, event: 'end', at: now(), ms: now() - start,
                    outcome: ['ok', 'error', 'cancelled', 'superseded'].includes(outcome) ? outcome : 'error' };
                if (error) event.errorType = errorType(error);
                if (Number.isInteger(status) && status >= 100 && status <= 599) event.status = status;
                if (loading) { try { event.loading = !!loading(); } catch (_) {} }
                emit(event);
            },
        };
    }
    function call(stage, label, fn, loading) {
        const span = begin(stage, label, loading);
        try {
            // Preserve both successful values and original rejection objects.
            return Promise.resolve(fn(span)).then(value => {
                span.end(value?.error ? 'error' : 'ok', value?.error); return value;
            }, error => { span.end(error?.name === 'AbortError' ? 'cancelled' : 'error', error); throw error; });
        } catch (error) { span.end('error', error); throw error; }
    }
    function snapshot() {
        return { diagnosticVersion: 1, sourceBaseline: '312ce95', capturedAtUTC: new Date().toISOString(), navigation, dropped,
            events: events.slice(), pending: [...active.values()].map(item => {
                const { loading, ...safe } = item;
                safe.ms = now() - item.start;
                if (loading) { try { safe.loading = !!loading(); } catch (_) {} }
                return safe;
            }) };
    }
    function page(label, loading, fn) {
        return call('page-load', label, span => {
            let processing = begin('processing', label);
            const control = {
                ready() { span.ready(); processing?.end(); processing = null; },
                wait(point, query) {
                    processing?.end(); processing = null;
                    const waiting = begin('page-await', label, undefined, point);
                    return Promise.resolve().then(query).then(value => {
                        waiting.end(value?.error ? 'error' : 'ok', value?.error);
                        processing = begin('processing', label, undefined, point);
                        return value;
                    }, error => { waiting.end(error?.name === 'AbortError' ? 'cancelled' : 'error', error); throw error; });
                },
            };
            return Promise.resolve().then(() => fn(control)).then(value => {
                processing?.end(); return value;
            }, error => { processing?.end('error', error); throw error; });
        }, loading);
    }
    return { begin, call, page, snapshot, nextNavigation() { navigation++; },
        existingError(type) {
            if (['vue_error', 'window_error', 'unhandled_rejection', 'resource_error'].includes(type))
                emit({ stage: 'existing-error', event: type, navigation, at: now() });
        } };
}

const enabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mg_loading_diag') === '1';
export const sessionDiagnostic = enabled ? createSessionDiagnostic() : null;
export function traceCall(stage, label, fn, loading) {
    return sessionDiagnostic ? sessionDiagnostic.call(stage, label, fn, loading) : fn({ ready() {} });
}
export function tracePage(label, loading, fn) {
    return sessionDiagnostic ? sessionDiagnostic.page(label, loading, fn) : fn({ ready() {}, wait(_point, query) { return query(); } });
}

export function instrumentAuth(client, diagnostic = sessionDiagnostic) {
    if (!diagnostic || !client?.auth || instrumented.has(client)) return;
    instrumented.add(client);
    for (const method of METHODS) {
        const original = client.auth[method];
        if (typeof original !== 'function') continue;
        client.auth[method] = function (...args) {
            return diagnostic.call('auth', method, () => original.apply(this, args));
        };
    }
    // Observe the existing initialization promise; never start another initialization/session read.
    if (client.auth.initializePromise?.then) {
        const span = diagnostic.begin('auth-init');
        client.auth.initializePromise.then(() => span.end(), error => span.end('error', error));
    }
}
const instrumented = new WeakSet();

export function instrumentRouter(router, diagnostic = sessionDiagnostic) {
    if (!diagnostic) return;
    let current;
    router.beforeEach((to) => {
        current?.end('superseded'); diagnostic.nextNavigation();
        current = { to, span: diagnostic.begin('route-transition', routeKind(to)) };
        // Keep exact route identity privately; never serialize paths/params.
        current.end = (...args) => current.span.end(...args);
    });
    router.afterEach((to, _from, failure) => {
        if (current?.to === to) current.end(failure ? 'cancelled' : 'ok');
    });
    router.onError((_error, to) => { if (current?.to === to) current.end('error'); });
}

export function instrumentFetch(host, diagnostic = sessionDiagnostic) {
    if (!diagnostic || typeof host.fetch !== 'function') return;
    const original = host.fetch;
    host.fetch = function (...args) {
        let kind;
        try {
            const url = new URL(typeof args[0] === 'string' || args[0] instanceof URL ? args[0] : args[0].url, host.location.origin);
            if (url.origin === host.location.origin && /^\/api(?:\/|$)/.test(url.pathname)) kind = 'api';
            else if ((url.origin === host.location.origin && url.pathname.startsWith('/sb/')) || url.origin === 'https://sb.meetgu.ru')
                kind = /\/auth\//.test(url.pathname) ? 'auth' : 'rest';
        } catch (_) { /* invalid input is handled by original fetch */ }
        if (!kind) return original.apply(this, args);
        const span = diagnostic.begin('http', kind);
        let result;
        try { result = original.apply(this, args); }
        catch (error) { span.end('error', error); throw error; }
        return Promise.resolve(result).then(response => {
            span.end(response.ok ? 'ok' : 'error', null, response.status);
            // fetch resolves at headers; trace actual consumption separately, without reading twice.
            for (const method of ['text', 'json', 'arrayBuffer', 'blob', 'formData']) {
                const consume = response[method];
                try { if (typeof consume === 'function') response[method] = function (...values) {
                    return diagnostic.call('body', kind, () => consume.apply(this, values));
                }; } catch (_) { /* frozen response: preserve request semantics */ }
            }
            return response;
        }, error => { span.end(error?.name === 'AbortError' ? 'cancelled' : 'error', error); throw error; });
    };
}

function installPanel() {
    if (!sessionDiagnostic) return;
    instrumentFetch(window);
    const mount = () => {
        const root = document.createElement('div');
        root.id = 'mg-session-diagnostic';
        root.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483647;background:white;color:black;padding:8px;border:2px solid #333;font:16px system-ui;max-width:90vw';
        const open = document.createElement('button'); open.textContent = 'Диагностика'; open.type = 'button';
        const panel = document.createElement('div'); panel.hidden = true;
        const text = document.createElement('textarea'); text.readOnly = true; text.setAttribute('aria-label', 'Диагностические данные без персональных данных');
        text.style.cssText = 'display:block;width:80vw;max-width:640px;height:35vh;color:black;background:white;font:14px monospace';
        const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Скопировать';
        const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Закрыть';
        for (const button of [open, copy, close]) button.style.cssText = 'font:16px system-ui;min-height:44px;color:black;background:#eee;border:1px solid black;padding:8px';
        const refresh = () => { text.value = JSON.stringify({ ...sessionDiagnostic.snapshot(),
            visible: document.visibilityState === 'visible' }, null, 2); };
        open.onclick = () => { refresh(); panel.hidden = false; };
        copy.onclick = async () => {
            try { await navigator.clipboard.writeText(text.value); copy.textContent = 'Скопировано'; }
            catch (_) { text.focus(); text.select(); copy.textContent = 'Выделено — скопируйте текст'; }
        };
        close.onclick = () => { panel.hidden = true; };
        panel.append(text, copy, close); root.append(open, panel); document.body.append(root);
    };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, { once: true });
}
installPanel();
