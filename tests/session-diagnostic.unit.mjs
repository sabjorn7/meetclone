import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { createSessionDiagnostic, instrumentAuth, instrumentFetch, instrumentRouter, tracePage } from '../src/_front/chrome/sessionDiagnostic.js';
const require = createRequire(new URL('../package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const { createRouter, createMemoryHistory } = require('vue-router');
const pass = name => console.log(`PASS ${name}`);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const drain = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
globalThis.fetch = () => { throw new Error('Real networking forbidden'); };
let tick = 0;
const diagnostic = createSessionDiagnostic(() => ++tick);
const sensitive = 'PRIVATE_SENTINEL_DO_NOT_EXPORT';
const span = diagnostic.begin('page-load', sensitive, () => true);
span.end('error', Object.assign(new Error(sensitive), { name: sensitive }));
diagnostic.existingError('unhandled_rejection');
assert(!JSON.stringify(diagnostic.snapshot()).includes(sensitive));
assert.equal(diagnostic.snapshot().events.at(-2).errorType, 'other');
pass('unknown labels, messages and error names cannot leak into export');

let blocked = false, fetches = 0;
const gate = deferred();
const client = createClient('https://supabase.invalid', sensitive, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
        lock: async (_name, _timeout, fn) => { if (blocked) await gate.promise; return fn(); } },
    global: { fetch: async () => { fetches++; return new Response('[]'); } },
});
await client.auth.initialize(); await drain();
instrumentAuth(client, diagnostic); blocked = true;
const query = Promise.resolve(client.from('clubs').select('*'));
await drain();
assert(diagnostic.snapshot().pending.some(e => e.stage === 'auth' && e.label === 'getSession'));
assert.equal(fetches, 0);
gate.resolve(); await query;
assert(!diagnostic.snapshot().pending.some(e => e.stage === 'auth'));
assert(!JSON.stringify(diagnostic.snapshot()).includes(sensitive));
pass('real SDK pending getSession and completion are traced before fetch without secrets');

const headersGate = deferred(), bodyGate = deferred();
const response = new Response('unused');
response.text = () => bodyGate.promise;
const host = { location: { origin: 'https://app.meetgu.ru' }, fetch: async () => { await headersGate.promise; return response; } };
instrumentFetch(host, diagnostic);
const request = host.fetch(`https://app.meetgu.ru/sb/rest/v1/private_table?email=${sensitive}`, { headers: { Authorization: sensitive }, body: sensitive });
assert(diagnostic.snapshot().pending.some(e => e.stage === 'http'));
headersGate.resolve(); const received = await request;
assert.strictEqual(received, response);
const body = received.text();
assert(diagnostic.snapshot().pending.some(e => e.stage === 'body'));
assert(!diagnostic.snapshot().pending.some(e => e.stage === 'http'));
bodyGate.resolve(sensitive); assert.equal(await body, sensitive);
assert(!JSON.stringify(diagnostic.snapshot()).includes(sensitive));
pass('HTTP headers and body consumption have separate spans; response identity/content preserved');

const aborted = Object.assign(new Error(sensitive), { name: 'AbortError' });
const failedHost = { location: host.location, fetch: async () => { throw aborted; } };
instrumentFetch(failedHost, diagnostic);
await assert.rejects(failedHost.fetch('/api/sensitive'), error => error === aborted);
assert.equal(diagnostic.snapshot().events.at(-1).outcome, 'cancelled');
const untouched = () => Promise.resolve(17);
const unrelated = { location: host.location, fetch: untouched };
instrumentFetch(unrelated, diagnostic);
assert.equal(await unrelated.fetch('https://other.invalid/'), 17);
pass('abort object preserved; unrelated origins remain untraced');

let calls = 0;
assert.equal(await tracePage('ClubsPage', () => true, async mark => { calls++; mark.ready(); return 42; }), 42);
assert.equal(calls, 1);
pass('diagnostic disabled: page wrapper preserves return and invokes load once');

const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/clubs', name: 'clubs', component: {} }, { path: '/course/:id', name: 'course', component: {} },
] });
instrumentRouter(router, diagnostic);
const unloadGate = deferred();
router.beforeEach((to, from) => from.name && diagnostic.call('page-unload', '', () => unloadGate.promise));
await router.push('/clubs');
const navigation = router.push(`/course/${sensitive}`); await drain();
assert.equal(router.currentRoute.value.path, '/clubs');
assert(diagnostic.snapshot().pending.some(e => e.stage === 'route-transition'));
assert(diagnostic.snapshot().pending.some(e => e.stage === 'page-unload'));
unloadGate.resolve(); await navigation;
assert(!diagnostic.snapshot().pending.some(e => e.stage === 'route-transition'));
assert(!JSON.stringify(diagnostic.snapshot()).includes(sensitive));
pass('actual router: pending navigation/unload are separate; completion and route redaction verified');

// Execute patched, genuine ClubsPage.load with synthetic data; no application/plugin imports.
const root = new URL('../', import.meta.url).pathname;
const page = fs.readFileSync(`${root}/src/_front/views/ClubsPage.vue`, 'utf8');
const loadCode = page.slice(page.indexOf('async function load()'), page.indexOf('\nonMounted('));
const pageDiag = createSessionDiagnostic(() => ++tick);
const d = deferred();
const builder = new Proxy({}, { get(_target, name) { return name === 'then' ? d.promise.then.bind(d.promise) : () => builder; } });
const state = Object.fromEntries(['clubs', 'mySubs', 'ownersById', 'subCountById', 'ready', 'loading'].map(k => [k, { value: k === 'loading' ? true : [] }]));
const context = vm.createContext({ ...state, getSupabase: () => ({ from: () => builder }), readStoredSession: () => null,
    authCookieUser: () => null, nextTick: async () => {}, tracePage: (name, loading, fn) => pageDiag.page(name, loading, fn) });
const loading = vm.runInContext(`${loadCode}\nload()`, context);
assert.equal(pageDiag.snapshot().pending[0].loading, true);
d.resolve({ data: [] }); await loading;
assert.equal(state.loading.value, false);
assert(pageDiag.snapshot().events.some(e => e.event === 'loading-false'));
assert.equal(pageDiag.snapshot().events.at(-1).loading, false);
pass('patched real component: pending, loading=false marker and final state are visible');

const failedPageDiag = createSessionDiagnostic();
context.tracePage = (name, getLoading, fn) => failedPageDiag.page(name, getLoading, fn);
context.getSupabase = () => { throw aborted; }; state.loading.value = true;
await assert.rejects(vm.runInContext('load()', context), error => error === aborted);
assert.equal(failedPageDiag.snapshot().events.at(-1).loading, true);
assert.equal(failedPageDiag.snapshot().events.at(-1).outcome, 'cancelled');
pass('component error after load start preserves behavior and records still-loading state');

const processingError = new TypeError(sensitive);
const processingDiag = createSessionDiagnostic();
await assert.rejects(processingDiag.page('ClubsPage', () => true, async control => {
    await control.wait(1, () => Promise.resolve({ data: [] }));
    throw processingError;
}), error => error === processingError);
assert(processingDiag.snapshot().events.some(e => e.stage === 'processing' && e.outcome === 'error' && e.errorType === 'TypeError'));
assert.equal(processingDiag.snapshot().events.at(-1).loading, true);
pass('post-response processing exception is distinguished from pending auth/HTTP');

const apiDiag = createSessionDiagnostic();
const apiRequests = [];
let apiSource = stripTypeScriptTypes(fs.readFileSync(`${root}/src/_common/helpers/code/serverClient.ts`, 'utf8'))
    .replace(/^import .*;\n/gm, '').replace('export default wwServerClient;', '');
const api = vm.runInNewContext(`${apiSource}\nwwServerClient`, {
    sessionDiagnostic: apiDiag, traceCall: (stage, label, fn) => apiDiag.call(stage, label, fn),
    getServerUrl: () => '/', createFetch: () => () => { const item = deferred(); apiRequests.push(item); return item.promise; },
});
const apiPromises = Array.from({ length: 5 }, () => api('/private', { body: sensitive }));
await drain();
assert.equal(apiDiag.snapshot().pending.filter(e => e.stage === 'api-queue').length, 1);
assert.equal(apiDiag.snapshot().pending.filter(e => e.stage === 'api-call').length, 4);
apiRequests[0].resolve({}); await drain();
for (const item of apiRequests) item.resolve({});
await Promise.all(apiPromises);
assert.equal(apiDiag.snapshot().pending.length, 0);
assert(!JSON.stringify(apiDiag.snapshot()).includes(sensitive));
pass('patched /api client distinguishes queue wait from active calls and preserves slot release');

for (let i = 0; i < 1000; i++) diagnostic.begin('http', 'rest');
const limited = diagnostic.snapshot();
assert(limited.events.length <= 240 && limited.pending.length <= 64 && limited.dropped > 0);
pass('bounded trace records evictions explicitly');
await client.removeAllChannels();
