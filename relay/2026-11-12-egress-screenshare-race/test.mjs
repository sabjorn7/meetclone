import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Element {
    children = []; parentNode = null; style = {}; className = '';
    appendChild(el) { el.remove(); this.children.push(el); el.parentNode = this; return el; }
    insertBefore(el, before) { el.remove(); const i = this.children.indexOf(before); this.children.splice(i < 0 ? this.children.length : i, 0, el); el.parentNode = this; }
    removeChild(el) { this.children.splice(this.children.indexOf(el), 1); el.parentNode = null; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    set innerHTML(value) { assert.equal(value, ''); for (const el of [...this.children]) el.remove(); }
    get firstChild() { return this.children[0] || null; }
    get childElementCount() { return this.children.length; }
}
function fixture(file) {
    const html = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    const callbacks = new Map(); const grid = new Element(); const body = new Element();
    const RoomEvent = Object.fromEntries(['TrackSubscribed', 'TrackUnsubscribed', 'ParticipantConnected', 'ParticipantDisconnected', 'Disconnected', 'ConnectionStateChanged'].map(x => [x,x]));
    const context = { URLSearchParams, location: { search: '?url=ws-fixture&token=fixture' }, __post() {}, console: { log() {} }, window: { addEventListener() {} }, document: { getElementById: () => grid, createElement: () => new Element(), body }, LivekitClient: { RoomEvent, Track: { Source: { ScreenShare: 'screen_share' } }, Room: class { on(e, f) { callbacks.set(e, f); } async connect() {} } } };
    vm.runInNewContext(script + '\nglobalThis.testTiles = tiles;', context);
    const pt = { sid: 'P', identity: 'fixture' };
    const track = (sid, source = 'screen_share', participant = pt) => {
        const el = new Element(); let attached = false;
        const t = { kind: 'video', detachCalls: 0, attach() { attached = true; return el; }, detach() { t.detachCalls++; if (!attached) return []; attached = false; return [el]; } };
        return { el, t, pub: { trackSid: sid, source }, pt: participant };
    };
    const emit = (event, v) => callbacks.get(event)(v.t, v.pub, v.pt);
    return { tiles: context.testTiles, grid, track, sub: v => emit('TrackSubscribed', v), unsub: v => emit('TrackUnsubscribed', v), leave: p => callbacks.get('ParticipantDisconnected')(p), pt };
}
const cases = [
    ['A → B → unsubscribe A', f => { const a=f.track('A'), b=f.track('B'); f.sub(a); f.sub(b); f.unsub(a); assert.equal(f.tiles.get('P:screen_share').publicationSid,'B'); assert.ok(b.el.parentNode); assert.equal(a.el.parentNode,null); assert.ok(a.t.detachCalls >= 1); assert.equal(f.tiles.get('P:screen_share').el.children.length,2); }],
    ['A → unsubscribe A → B', f => { const a=f.track('A'), b=f.track('B'); f.sub(a); f.unsub(a); assert.equal(f.tiles.size,0); f.sub(b); assert.equal(f.tiles.get('P:screen_share').publicationSid,'B'); assert.ok(b.el.parentNode); }],
    ['ScreenShare off', f => { const a=f.track('A'); f.sub(a); f.unsub(a); assert.equal(f.tiles.size,0); assert.equal(a.el.parentNode,null); assert.equal(f.grid.className,'gridmode'); }],
    ['ScreenShare on again', f => { const a=f.track('A'), b=f.track('B'); f.sub(a); f.unsub(a); f.sub(b); assert.equal(f.grid.className,'stage'); assert.ok(b.el.parentNode); f.unsub(b); assert.equal(f.tiles.size,0); }],
    ['camera independent of ScreenShare', f => { const c=f.track('C','camera'), a=f.track('A'), b=f.track('B'); f.sub(c); f.sub(a); f.sub(b); f.unsub(a); assert.ok(c.el.parentNode); assert.ok(b.el.parentNode); f.unsub(b); assert.equal(f.grid.className,'gridmode'); assert.ok(c.el.parentNode); f.unsub(c); assert.equal(f.tiles.size,0); }],
    ['camera replacement', f => { const a=f.track('C1','camera'), b=f.track('C2','camera'); f.sub(a); f.sub(b); assert.equal(a.el.parentNode,null); f.unsub(a); assert.ok(b.el.parentNode); f.unsub(b); assert.equal(f.tiles.size,0); }],
    ['participant leaves, other participant remains', f => { const a=f.track('A'), c=f.track('C','camera'), other=f.track('D','camera',{sid:'OTHER',identity:'other'}); f.sub(a); f.sub(c); f.sub(other); f.leave(f.pt); assert.equal(f.tiles.size,1); assert.ok(other.el.parentNode); assert.equal(a.el.parentNode.parentNode,null); assert.equal(c.el.parentNode.parentNode,null); f.unsub(a); assert.equal(f.tiles.size,1); }],
    ['same SID resubscription with new track object', f => { const a=f.track('A'), b=f.track('A'); f.sub(a); f.sub(b); assert.equal(a.el.parentNode,null); assert.ok(b.el.parentNode); f.unsub(b); assert.equal(f.tiles.size,0); }]
];
for (const [name, run] of cases) { run(fixture('./grid.html')); console.log('PASS',name); }
// Negative control: the original handlers must reproduce deletion of the replacement.
const before=fixture('./grid.before.html'); const a=before.track('A'), b=before.track('B'); before.sub(a); before.sub(b); before.unsub(a); assert.equal(before.tiles.size,0); assert.equal(b.el.parentNode?.parentNode,null); console.log('PASS baseline reproduces race');
console.log('9 checks passed; synthetic DOM/SDK only; no network or media capture.');
