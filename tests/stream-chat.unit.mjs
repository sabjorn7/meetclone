import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { fetchStreamChatRows, countNewChatMessages } from '../src/_front/streams/streamChat.js';
import { messages, mockDatabase, functionsFrom, streamId } from './stream-chat.fixture.mjs';

let passed = 0;
async function check(name, fn) { await fn(); console.log('PASS', name); passed++; }
const api = 'src/_front/streams/streamsApi.js';
const speaker = 'src/_front/views/StreamCallPage.vue';
const viewer = 'src/_front/views/StreamsPage.vue';
function apiFunction(client) {
    return new Function('fetchStreamChatRows', functionsFrom(api, ['attachMessageAuthors', 'listStreamMessages']) + ';return listStreamMessages;')(fetchStreamChatRows).bind(null, client);
}
function speakerFunction(client) {
    return new Function('supa', 'fetchStreamChatRows', functionsFrom(speaker, ['fetchChatAuthors', 'fetchChatMessages']) + ';return fetchChatMessages;')(() => client, fetchStreamChatRows);
}
for (const count of [0, 50, 199, 200, 201, 245, 300, 1000, 1201]) {
    await check(`live ${count}: speaker/viewer match latest 200`, async () => {
        const rows = messages(count); const { client } = mockDatabase([...rows].reverse());
        const a = await apiFunction(client)(streamId);
        const b = await speakerFunction(client)(streamId);
        assert.deepEqual(a.map(x => x.id), rows.slice(-200).map(x => x.id));
        assert.deepEqual(a, b);
    });
    await check(`history ${count}: all rows, tie ordering, no duplicates`, async () => {
        const rows = messages(count); const { client, state } = mockDatabase([...rows].reverse());
        const all = await apiFunction(client)(streamId, { history: true });
        assert.deepEqual(all.map(x => x.id), rows.map(x => x.id));
        assert.equal(new Set(all.map(x => x.id)).size, count);
        assert.ok(state.calls.length >= Math.ceil(count / 200) + 1);
        assert.ok(state.calls.every(q => !q.offset));
    });
}
await check('history respects server page cap; deleted and other-stream rows excluded', async () => {
    const rows = messages(1000); rows[199].deleted = true; rows[244].deleted = true; rows[399].stream = 'other';
    const { client } = mockDatabase(rows, { cap: 73 });
    const all = await fetchStreamChatRows(client, streamId, { history: true });
    assert.deepEqual(all.map(x => x.id), rows.filter(x => !x.deleted && x.stream === streamId).map(x => x.id));
});
await check('245 stored / 2 deleted: replay displays all 243 visible messages', async () => {
    const rows = messages(245); rows[19].deleted = true; rows[200].deleted = true;
    const { client } = mockDatabase(rows);
    const all = await apiFunction(client)(streamId, { history: true });
    assert.equal(all.length, 243);
    assert.deepEqual(all.map(x => x.id), rows.filter(x => !x.deleted).map(x => x.id));
    assert.equal(all.at(-1).id, rows.at(-1).id);
});
await check('history page failure rejects entire refresh, no partial result', async () => {
    const { client, state } = mockDatabase(messages(245)); state.failOn = 2;
    await assert.rejects(fetchStreamChatRows(client, streamId, { history: true }), /fixture offline/);
});
await check('full window detects new IDs despite unchanged length', async () => {
    const db = mockDatabase(messages(200)); const before = await fetchStreamChatRows(db.client, streamId);
    db.state.rows = messages(201); const after = await fetchStreamChatRows(db.client, streamId);
    assert.equal(before.length, after.length); assert.equal(countNewChatMessages(before, after), 1);
    assert.equal(countNewChatMessages(after, after), 0);
});
await check('link RPC still uses capability and never falls back to table', async () => {
    const client = { async rpc(name, args) { assert.equal(name, 'get_stream_link_messages'); assert.equal(args.p_key, 'capability'); return { data: [{ id: 'm', is_mine: true }], error: null }; }, from() { throw Error('must not bypass link RLS'); } };
    const rows = await apiFunction(client)(streamId, { linkKey: 'capability', history: true });
    assert.equal(rows[0].authorUser.Name, 'Вы');
});

function controller(kind, db) {
    const ref = value => ({ value }); const fns = kind === 'speaker'
        ? ['fetchChatAuthors', 'fetchChatMessages', 'postChatMessage', 'loadStreamChat', 'sendStreamChat', 'startChatPoll', 'stopChatPoll', 'onChatVisibility']
        : ['loadChat', 'sendChat', 'startChatPoll', 'stopChatPoll', 'onChatVisibility'];
    let scrolls = 0; const intervals = new Map(); let next = 0;
    const ctx = { fetchStreamChatRows, countNewChatMessages, supa: () => db.client, listStreamMessages: (client, id, options) => apiFunction(client)(id, options),
        streamId, chatMessages: ref([]), messages: ref([]), chatText: ref('draft'), chatSending: ref(false), sending: ref(false),
        chatRefreshError: ref(false), chatSendError: ref(false), chatOpen: ref(false), chatUnread: ref(0), chatLoading: ref(false),
        detail: ref({ id: streamId, status: 'live', visibility: 'public' }), displayState: ref('live'), accessResolved: ref(true), hasAccess: ref(true),
        myUid: 'fixture-owner', me: ref({ id: 'fixture-owner' }), error: ref(''), document: { visibilityState: 'visible' },
        route: { hash: '' }, streamLinkKey: () => null, scrollChat: () => scrolls++, scrollFeed: () => scrolls++,
        setInterval(fn, ms) { assert.equal(ms, 7000); intervals.set(++next, fn); return next; }, clearInterval(id) { intervals.delete(id); },
        sendStreamMessage: async () => { if (db.state.failSend) throw Error('fixture send failed'); },
    };
    // Real send path for speaker, with an isolated insert stub (no database writes).
    const supa = ctx.supa;
    ctx.supa = () => ({ from(table) { const query = supa().from(table); query.insert = async () => ({ error: db.state.failSend ? { message: 'fixture send failed' } : null }); return query; } });
    vm.createContext(ctx);
    vm.runInContext('let chatTimer=null, chatRequest=null, chatEpoch=0, chatRefreshQueued=false;\n' + functionsFrom(kind === 'speaker' ? speaker : viewer, fns) + `\nglobalThis.actions={load:()=>${kind === 'speaker' ? 'loadStreamChat()' : 'loadChat(streamId)'},send:${kind === 'speaker' ? 'sendStreamChat' : 'sendChat'},start:()=>startChatPoll(streamId),stop:stopChatPoll,focus:onChatVisibility};`, ctx);
    return { ctx, actions: ctx.actions, rows: kind === 'speaker' ? ctx.chatMessages : ctx.messages, scrolls: () => scrolls, intervals };
}
const settle = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };
for (const kind of ['speaker', 'viewer']) {
    await check(`${kind}: full window refresh updates IDs and scroll/unread`, async () => {
        const db = mockDatabase(messages(200)); const c = controller(kind, db); await c.actions.load();
        const before = c.scrolls(); if (kind === 'speaker') c.ctx.chatUnread.value = 0;
        db.state.rows = messages(201); await c.actions.load();
        assert.equal(c.rows.value.length, 200); assert.equal(c.rows.value.at(-1).id, messages(201).at(-1).id);
        assert.equal(c.scrolls(), before + 1); if (kind === 'speaker') assert.equal(c.ctx.chatUnread.value, 1);
    });
    await check(`${kind}: load failure preserves feed, recovery clears error`, async () => {
        const db = mockDatabase(messages(50)); const c = controller(kind, db); await c.actions.load();
        db.state.fail = true; await c.actions.load(); assert.equal(c.rows.value.length, 50); assert.equal(c.ctx.chatRefreshError.value, true);
        db.state.fail = false; db.state.rows = messages(51); await c.actions.load();
        assert.equal(c.rows.value.length, 51); assert.equal(c.ctx.chatRefreshError.value, false);
    });
    await check(`${kind}: send failure visible and draft preserved; retry succeeds`, async () => {
        const db = mockDatabase(messages(50)); const c = controller(kind, db); db.state.failSend = true;
        await c.actions.send(); assert.equal(c.ctx.chatText.value, 'draft');
        assert.ok(kind === 'speaker' ? c.ctx.chatSendError.value : c.ctx.error.value);
        db.state.failSend = false; await c.actions.send(); assert.equal(c.ctx.chatText.value, '');
        if (kind === 'speaker') assert.equal(c.ctx.chatSendError.value, false);
    });
    await check(`${kind}: 7s polling, focus refresh, hidden tab no extra request, stop cleanup`, async () => {
        const db = mockDatabase(messages(50)); const c = controller(kind, db); c.actions.start(); await settle();
        assert.equal(c.intervals.size, 1); db.state.rows = messages(51); c.actions.focus(); await settle(); assert.equal(c.rows.value.length, 51);
        const calls = db.state.calls.length; c.ctx.document.visibilityState = 'hidden'; c.actions.focus(); await settle(); assert.equal(db.state.calls.length, calls);
        c.actions.stop(); assert.equal(c.intervals.size, 0); c.actions.focus(); await settle(); assert.equal(db.state.calls.length, calls);
    });
    await check(`${kind}: slow refresh serialized, queued refresh catches new messages`, async () => {
        const db = mockDatabase(messages(50)); const c = controller(kind, db);
        let release; db.state.hold = new Promise(r => { release = r; });
        const first = c.actions.load(); c.actions.load(); c.actions.load(); release(); db.state.hold = null;
        await first; await settle(); assert.equal(db.state.maxActive, 1); assert.equal(c.rows.value.length, 50);
    });
    await check(`${kind}: late response after stop cannot restore old feed`, async () => {
        const db = mockDatabase(messages(50)); const c = controller(kind, db);
        let release; db.state.hold = new Promise(r => { release = r; }); const pending = c.actions.load();
        c.actions.stop(); c.rows.value = []; release(); await pending; assert.equal(c.rows.value.length, 0);
    });
}
await check('viewer ended mode fetches complete history and live→ended transition', async () => {
    const db = mockDatabase(messages(1000)); const c = controller('viewer', db); await c.actions.load(); assert.equal(c.rows.value.length, 200);
    c.ctx.detail.value.status = 'ended'; c.ctx.displayState.value = 'ended'; await c.actions.load(); assert.equal(c.rows.value.length, 1000);
});
await check('viewer history page error keeps entire previous feed and recovers', async () => {
    const db = mockDatabase(messages(245)); const c = controller('viewer', db); c.ctx.detail.value.status = 'ended';
    await c.actions.load(); db.state.failOn = db.state.calls.length + 2; await c.actions.load();
    assert.equal(c.rows.value.length, 245); assert.equal(c.ctx.chatRefreshError.value, true);
    db.state.failOn = 0; await c.actions.load(); assert.equal(c.ctx.chatRefreshError.value, false);
});
await check('viewer privacy guard discards result after access revoked', async () => {
    const db = mockDatabase(messages(50)); const c = controller('viewer', db);
    let release; db.state.hold = new Promise(r => { release = r; }); const pending = c.actions.load();
    c.ctx.hasAccess.value = false; release(); await pending; assert.equal(c.rows.value.length, 0);
});
await check('visibility listeners registered and removed in both components', async () => {
    for (const file of [speaker, viewer]) {
        const source = fs.readFileSync(file, 'utf8');
        assert.ok(source.includes("document.addEventListener('visibilitychange', onChatVisibility)"));
        assert.ok(source.includes("document.removeEventListener('visibilitychange', onChatVisibility)"));
    }
});
console.log(`${passed} checks passed; synthetic data only; no production requests.`);
