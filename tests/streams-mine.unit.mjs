// Focused stream-list/access regression; no push-worker or router changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateVisibility, isPublicStream, streamLinkKey, streamShareUrl, visibilityCapabilities, requireUnlistedSupport } from '../src/_front/streams/visibility.js';
import { videoProfile } from '../src/_front/streams/videoQuality.js';

// Import the real data helpers with ONLY the destructive PeerTube delete dependency stubbed.
// No browser, auth service, SDK or network is started.
let source = await readFile(new URL('../src/_front/streams/streamsApi.js', import.meta.url), 'utf8');
source = source.replace("from './videoQuality.js'", `from '${new URL('../src/_front/streams/videoQuality.js', import.meta.url).href}'`);
source = source.replace("from './visibility.js'", `from '${new URL('../src/_front/streams/visibility.js', import.meta.url).href}'`)
    .replace("import { deleteLive } from '@/_front/streams/peertubeLive.js';", 'const deleteLive = async () => { throw new Error("network forbidden"); };');
const api = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const key = 'a'.repeat(64);

function mock(rows = [], rpcResult = { data: null, error: null }) {
    const calls = [];
    const chain = new Proxy({}, { get: (_, method) => method === 'then'
        ? resolve => resolve({ data: rows, error: null })
        : (...args) => { calls.push([method, ...args]); return chain; } });
    return { calls, from: name => { calls.push(['from', name]); return chain; },
        rpc: async (name, args) => { calls.push(['rpc', name, args]); return rpcResult; } };
}
test('visibility defaults public and rejects paid/unlisted before any request', async () => {
    assert.equal(validateVisibility({}), 'public');
    assert.equal(validateVisibility({ visibility: 'unlisted', price: '0' }), 'unlisted');
    for (const fields of [{ price: 1 }, { price: NaN }, { backing_course_id: 'course' }, { recording_course_enabled: true }, { chat_enabled: true }]) {
        assert.throws(() => validateVisibility({ ...fields, visibility: 'unlisted' }));
        const sb = mock(); await assert.rejects(api.createStream(sb, { author: 'owner', title: 'Test', ...fields, visibility: 'unlisted' }));
        assert.deepEqual(sb.calls, []);
    }
    for (const visibility of ['', null, false, 'private']) assert.throws(() => validateVisibility({ visibility }));
});
test('capability never appears in HTTP query; invalid/missing keys fail closed', () => {
    const row = { id: 'synthetic-id', visibility: 'unlisted' };
    const url = new URL(streamShareUrl('https://example.invalid', row, key));
    assert.equal(url.search, '?stream=synthetic-id'); assert.equal(url.hash, '#access-' + key);
    assert.equal(streamLinkKey(url.hash), key);
    for (const value of ['', '#access-short', '#access-' + key + '-suffix', '#access-' + 'G'.repeat(64)]) assert.equal(streamLinkKey(value), null);
    assert.throws(() => streamShareUrl(url.origin, row));
    assert.equal(new URL(streamShareUrl(url.origin, { ...row, visibility: 'public' })).hash, '');
});
test('unlisted is gated by a server version and activation flag; no public fallback', async () => {
    for (const result of [{ data: null, error: { message: 'missing RPC' } }, { data: { version: 2, unlisted_enabled: false } }, { data: { version: 99, unlisted_enabled: true } }]) {
        const sb = mock([], result); assert.equal((await visibilityCapabilities(sb)).unlisted_enabled, false);
        await assert.rejects(requireUnlistedSupport(sb, 'unlisted'));
        await assert.rejects(api.createStream(sb, { author: 'owner', title: 'Test', visibility: 'unlisted' }));
        assert.ok(!sb.calls.some(c => c[0] === 'insert'));
    }
    const sb = mock([{ id: 'created', visibility: 'unlisted' }], { data: { version: 2, unlisted_enabled: true } });
    assert.equal((await api.createStream(sb, { author: 'owner', title: 'Test', visibility: 'unlisted' })).id, 'created');
    assert.equal(sb.calls.find(c => c[0] === 'insert')[1].visibility, 'unlisted');
});
test('catalog has explicit public/soft-delete filters; owner list retains hidden/unlisted', async () => {
    const sb = mock(); await api.listAllStreams(sb);
    assert.ok(sb.calls.some(c => c[0] === 'eq' && c[1] === 'visibility' && c[2] === 'public'));
    assert.ok(sb.calls.some(c => c[0] === 'eq' && c[1] === 'hidden' && c[2] === false));
    assert.equal(isPublicStream({ visibility: 'unlisted' }), false);
    assert.equal(isPublicStream({ visibility: 'public', hidden: true }), false);
    assert.equal(isPublicStream({ visibility: 'public', hidden: false }), true);
    const own = mock(); await api.listMyStreams(own, 'owner');
    assert.ok(own.calls.some(c => c[0] === 'eq' && c[1] === 'author' && c[2] === 'owner'));
    assert.ok(!own.calls.some(c => c[0] === 'eq' && ['visibility', 'hidden'].includes(c[1])));
});
test('guest/authenticated non-owner use only exact capability RPC after RLS returns no row', async () => {
    for (const identity of ['guest', 'authenticated-other']) {
        const sb = mock([], { data: [{ id: 's', visibility: 'unlisted', price: 0 }], error: null });
        assert.equal((await api.getStreamById(sb, 's', key)).id, 's', identity);
        assert.deepEqual(sb.calls.find(c => c[0] === 'rpc'), ['rpc', 'get_stream_by_link', { p_stream_id: 's', p_key: key }]);
        assert.ok(!sb.calls.some(c => c[0] === 'from' && c[1] === 'users'));
        const denied = mock(); assert.equal(await api.getStreamById(denied, 's'), null);
        assert.ok(!denied.calls.some(c => c[0] === 'rpc'));
    }
});
test('creator uses protected row reads and owner-only link RPC; no service/internal fields selected', async () => {
    const sb = mock([{ id: 's', visibility: 'unlisted' }]);
    assert.equal((await api.getStreamById(sb, 's')).id, 's');
    assert.ok(!sb.calls.some(c => c[0] === 'rpc'));
    for (const select of sb.calls.filter(c => c[0] === 'select')) assert.ok(!/\*|access_key|livekit_egress|livekit_room/.test(select[1]));
    const own = mock([], { data: key }); assert.equal(await api.getStreamLinkKey(own, 's'), key);
    await assert.rejects(api.getStreamLinkKey(mock(), 's'));
});
test('link RPC errors do not fall back to unprotected enumeration', async () => {
    const sb = mock([], { error: { message: 'no RPC' } });
    await assert.rejects(api.getStreamById(sb, 's', key));
    assert.equal(sb.calls.filter(c => c[0] === 'from').length, 1);
});

// Execute the actual Vue setup declarations/methods with synthetic dependencies.
// Unlike a copied implementation, these tests follow changes in StreamsPage.vue.
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { ref, computed } from 'vue';
const vueSource = await readFile(new URL('../src/_front/views/StreamsPage.vue', import.meta.url), 'utf8');
const { descriptor } = parse(vueSource);
const compiled = compileScript(descriptor, { id: 'streams-unit' });
function controller(overrides = {}) {
    const names = new Set(['form','canSubmit','cancelForm','createBroadcast','shareUrl','copyStreamLink','canDeleteMsg','createdStream','myVisibility']);
    const declarations = compiled.scriptSetupAst.filter(n =>
        n.type === 'FunctionDeclaration' ? names.has(n.id.name) :
        n.type === 'VariableDeclaration' && n.declarations.some(d => names.has(d.id.name)))
        .map(n => descriptor.scriptSetup.content.slice(n.start, n.end)).join('\n');
    const env = { ref, computed, validateVisibility, requireUnlistedSupport, isPublicStream, streamLinkKey, streamShareUrl, videoProfile,
        unlistedEnabled: ref(true), creating: ref(false), error: ref(''), showForm: ref(true), coverError: ref(''),
        isAuthor: ref(false), me: ref({ id: 'owner' }), myStreams: ref([]), listItems: ref([]), creds: ref(null), maskKey: ref(true),
        activeStreamId: ref(null), route: { hash: '' }, window: { location: { origin: 'https://example.invalid' } },
        navigator: { clipboard: { writeText: async () => {} } }, notice: ref(''), linkFallback: ref(''),
        getStreamLinkKey: async () => key, router: { push() {} }, supa: () => mock([], { data: { version: 2, unlisted_enabled: true } }),
        createLive: async () => ({ video: { uuid: 'synthetic-video' }, rtmpUrl: 'synthetic', streamKey: 'synthetic' }),
        createBackingCourse: async () => 'synthetic-course',
        createStream: async (_, fields) => ({ ...fields, id: 'created', status: 'scheduled', hidden: false }), ...overrides };
    return { ...env, ...new Function(...Object.keys(env), declarations + ';return {form,canSubmit,cancelForm,createBroadcast,copyStreamLink,canDeleteMsg,createdStream,myVisibility};')(...Object.values(env)) };
}
test('real Vue form: defaults, paid transition requires explicit public choice, cancellation resets', () => {
    const c = controller(); c.form.value.title = 'Synthetic test';
    assert.equal(c.form.value.visibility, 'public'); assert.equal(c.canSubmit.value, true);
    c.form.value.visibility = 'unlisted'; assert.equal(c.canSubmit.value, true);
    c.form.value.kind = 'paid'; c.form.value.price = 100; assert.equal(c.canSubmit.value, false);
    c.form.value.visibility = 'public'; assert.equal(c.canSubmit.value, true);
    c.cancelForm(); assert.equal(c.form.value.visibility, 'public'); assert.equal(c.showForm.value, false);
    const template = compileTemplate({ source: descriptor.template.content, filename: 'StreamsPage.vue', id: 'streams-unit' });
    assert.deepEqual(template.errors, []);
});
test('real Vue creation: public goes to both lists; unlisted to owner only, both solo and multi', async () => {
    for (const visibility of ['public', 'unlisted']) for (const format of ['solo', 'multi']) {
        const c = controller(); c.myVisibility.value = 'public'; Object.assign(c.form.value, { title: 'Synthetic test', visibility, format });
        await c.createBroadcast(); assert.equal(c.error.value, '');
        assert.equal(c.myStreams.value.length, 1); assert.equal(c.myStreams.value[0].visibility, visibility);
        assert.equal(c.createdStream.value.id, 'created'); assert.equal(c.myVisibility.value, 'all');
        assert.equal(c.listItems.value.length, visibility === 'public' ? 1 : 0);
    }
});
test('real Vue creation checks server readiness BEFORE any video or paid backing row is created', async () => {
    let sideEffects = 0;
    const c = controller({ supa: () => mock([], { data: { version: 2, unlisted_enabled: false } }),
        createLive: async () => { sideEffects++; }, createBackingCourse: async () => { sideEffects++; } });
    Object.assign(c.form.value, { title: 'Synthetic test', visibility: 'unlisted' });
    await c.createBroadcast(); assert.ok(c.error.value); assert.equal(sideEffects, 0);
});
test('real Vue copy: actual link is copied, Clipboard denial gives manual selection, RPC failure is not success', async () => {
    const row = { id: 'hidden', visibility: 'unlisted' }; let copied;
    const good = controller({ navigator: { clipboard: { writeText: async url => { copied = url; } } } });
    await good.copyStreamLink(row); assert.equal(streamLinkKey(new URL(copied).hash), key);
    assert.equal(good.notice.value, 'Ссылка скопирована');
    const denied = controller({ navigator: {} }); await denied.copyStreamLink(row);
    assert.ok(denied.linkFallback.value); assert.notEqual(denied.notice.value, 'Ссылка скопирована');
    const missing = controller({ getStreamLinkKey: async () => { throw Error('unavailable'); } });
    await missing.copyStreamLink(row); assert.equal(missing.error.value, 'unavailable'); assert.equal(missing.notice.value, '');
});
test('real public paid form passes the existing amount/duration/backing flow unchanged', async () => {
    let backing, inserted;
    const c = controller({ createBackingCourse: async (_, fields) => { backing = fields; return 'paid-backing'; },
        createStream: async (_, fields) => { inserted = fields; return { ...fields, id: 'paid' }; } });
    Object.assign(c.form.value, { title: 'Synthetic paid', kind: 'paid', price: 990, months: 6 });
    await c.createBroadcast(); assert.equal(c.error.value, '');
    assert.equal(backing.price, 990); assert.equal(backing.months, 6);
    assert.equal(inserted.price, 990); assert.equal(inserted.backing_course_id, 'paid-backing');
    assert.equal(inserted.visibility, 'public'); assert.equal(c.listItems.value.length, 1);
});

test('v1 backend cannot activate the new chat/notification contract', async () => {
    const sb = mock([], { data: { version: 1, unlisted_enabled: true } });
    assert.equal((await visibilityCapabilities(sb)).unlisted_enabled, false);
    await assert.rejects(requireUnlistedSupport(sb, 'unlisted'));
});
test('link chat reads use one bounded RPC and never enumerate users/messages directly', async () => {
    const sb = mock([], { data: [{ id: 'm1', text: 'Synthetic', is_mine: false, can_delete: false }, { id: 'm2', is_mine: true, can_delete: true }] });
    const rows = await api.listStreamMessages(sb, 's', { linkKey: key, limit: 20 });
    assert.deepEqual(sb.calls, [['rpc', 'get_stream_link_messages', { p_stream_id: 's', p_key: key, p_limit: 20 }]]);
    assert.equal(rows[0].authorUser.Name, 'Участник'); assert.equal(rows[1].authorUser.Name, 'Вы');
    assert.equal(rows[1].can_delete, true); assert.equal(rows[0].owner, undefined);
});
test('link chat writes never trust a caller-supplied owner; delete binds message to stream and proof', async () => {
    const sb = mock([], { data: 'synthetic-message' });
    assert.equal((await api.sendStreamMessage(sb, { stream: 's', owner: 'spoofed', text: '  Test  ', linkKey: key })).id, 'synthetic-message');
    const send = sb.calls[0]; assert.equal(send[1], 'send_stream_link_message');
    assert.deepEqual(send[2], { p_stream_id: 's', p_key: key, p_text: 'Test', p_img: [] });
    await api.deleteStreamMessage(sb, 'm', { streamId: 's', linkKey: key });
    assert.deepEqual(sb.calls[1], ['rpc', 'delete_stream_link_message', { p_stream_id: 's', p_key: key, p_message_id: 'm' }]);
    assert.ok(!sb.calls.some(c => c[0] === 'from'));
});
test('public chat retains direct read/insert/soft-delete contracts for authenticated UI', async () => {
    const read = mock(); await api.listStreamMessages(read, 'public-stream');
    assert.ok(read.calls.some(c => c[0] === 'from' && c[1] === 'stream_chat'));
    assert.ok(read.calls.some(c => c[0] === 'eq' && c[1] === 'stream' && c[2] === 'public-stream'));
    const send = mock(); await api.sendStreamMessage(send, { stream: 'public-stream', owner: 'current-user', text: 'Hello' });
    assert.deepEqual(send.calls.find(c => c[0] === 'insert')[1], { stream: 'public-stream', owner: 'current-user', text: 'Hello', img: [] });
    const del = mock(); await api.deleteStreamMessage(del, 'm');
    assert.deepEqual(del.calls.find(c => c[0] === 'update')[1], { deleted: true });
    for (const sb of [read,send,del]) assert.ok(!sb.calls.some(c => c[0] === 'rpc'));
});
test('denied link chat operations fail closed; no broad table fallback', async () => {
    const calls = [sb => api.listStreamMessages(sb, 's', { linkKey: key }),
        sb => api.sendStreamMessage(sb, { stream: 's', owner: 'u', text: 'Test', linkKey: key }),
        sb => api.deleteStreamMessage(sb, 'm', { streamId: 's', linkKey: key })];
    for (const run of calls) {
        const sb = mock([], { error: { message: 'denied' } }); await assert.rejects(run(sb));
        assert.equal(sb.calls.length, 1); assert.equal(sb.calls[0][0], 'rpc');
    }
});

test('real chat controls never give a guest moderation; authenticated owner/message rules remain', () => {
    const guest = controller({ me: ref(null) }); assert.equal(guest.canDeleteMsg({ can_delete: true }), false);
    const viewer = controller(); assert.equal(viewer.canDeleteMsg({ can_delete: false, owner: 'other' }), false);
    assert.equal(viewer.canDeleteMsg({ is_mine: true, can_delete: true }), true);
    assert.equal(viewer.canDeleteMsg({ owner: 'owner' }), true);
    viewer.isAuthor.value = true; assert.equal(viewer.canDeleteMsg({ owner: 'other' }), true);
});
