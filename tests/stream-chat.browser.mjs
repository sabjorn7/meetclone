// Actual chat templates/styles/functions extracted from both Vue pages; no video/auth/API startup.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { functionsFrom, messages, mockDatabase, streamId } from './stream-chat.fixture.mjs';

const root = process.cwd();
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mg-chat-ui-')));
fs.symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), 'dir');
const helper = path.join(root, 'src/_front/streams/streamChat.js');
const api = path.join(root, 'src/_front/streams/streamsApi.js');
fs.writeFileSync(path.join(work, 'fixture.js'), `import {createClient} from '@supabase/supabase-js';
export const streamId=${JSON.stringify(streamId)};
export const messages=${messages.toString()};
const mockDatabase=${mockDatabase.toString()};
export const db=mockDatabase(messages(200)); window.db=db;window.makeMessages=messages;
export const supa=()=>({from(table){const query=db.client.from(table);query.insert=async()=>({error:db.state.failSend?{message:'fixture send failed'}:null});return query;}});
const jobs=new Map();let id=0;window.setInterval=(fn,ms)=>{if(ms!==7000)throw Error('Unexpected interval');jobs.set(++id,fn);return id};window.clearInterval=id=>jobs.delete(id);
window.tick=()=>Promise.all([...jobs.values()].map(fn=>fn()));
`);

for (const kind of ['speaker', 'viewer']) {
    const file = path.join(root, 'src/_front/views', kind === 'speaker' ? 'StreamCallPage.vue' : 'StreamsPage.vue');
    const source = fs.readFileSync(file, 'utf8');
    let template, script;
    if (kind === 'speaker') {
        template = source.slice(source.indexOf('<div v-if="chatOpen" class="lkc-chat">'), source.indexOf('<!-- Presenter-only slide navigation -->'));
        script = `const myUid='fixture-owner';const chatOpen=ref(true),chatMessages=ref([]),chatText=ref(''),chatSending=ref(false),chatLoading=ref(false),chatRefreshError=ref(false),chatSendError=ref(false),chatUnread=ref(0),chatFeedEl=ref(null);
let chatTimer=null,chatRequest=null,chatEpoch=0,chatRefreshQueued=false;
${functionsFrom(file, ['fetchChatAuthors', 'fetchChatMessages', 'postChatMessage', 'msgTime', 'scrollChat', 'loadStreamChat', 'sendStreamChat', 'startChatPoll', 'stopChatPoll', 'onChatVisibility'])}
onMounted(()=>{document.addEventListener('visibilitychange',onChatVisibility);startChatPoll()});
onBeforeUnmount(()=>{document.removeEventListener('visibilitychange',onChatVisibility);stopChatPoll()});
window.chat={load:loadStreamChat,send:sendStreamChat,setText:v=>chatText.value=v,setClosed:()=>chatOpen.value=false,state:()=>({count:chatMessages.value.length,last:chatMessages.value.at(-1)?.id,refreshError:chatRefreshError.value,sendError:chatSendError.value,unread:chatUnread.value,text:chatText.value})};`;
    } else {
        template = '<p v-if="error" class="sp-error">{{ error }}</p>' + source.slice(source.indexOf('<section v-if="hasAccess" class="sp-chat">'), source.indexOf('<!-- Access still resolving:'));
        script = `const messages=ref([]),chatText=ref(''),chatLoading=ref(false),chatRefreshError=ref(false),sending=ref(false),feedEl=ref(null),error=ref('');
const detail=ref({id:streamId,status:'live',visibility:'public'}),displayState=ref('live'),accessResolved=ref(true),hasAccess=ref(true),me=ref({id:'fixture-owner'}),isAuthor=ref(false);
const route={hash:''};const streamLinkKey=()=>null;const deleteStreamMessage=async()=>{};const sendStreamMessage=async()=>{if(db.state.failSend)throw Error('Не удалось отправить сообщение. Попробуйте ещё раз.')};
let chatTimer=null,chatRequest=null,chatEpoch=0,chatRefreshQueued=false;
${functionsFrom(api, ['attachMessageAuthors', 'listStreamMessages'])}
${functionsFrom(file, ['msgTime', 'canDeleteMsg', 'scrollFeed', 'loadChat', 'sendChat', 'removeMessage', 'startChatPoll', 'stopChatPoll', 'onChatVisibility'])}
onMounted(()=>{document.addEventListener('visibilitychange',onChatVisibility);startChatPoll(streamId);loadChat(streamId)});
onBeforeUnmount(()=>{document.removeEventListener('visibilitychange',onChatVisibility);stopChatPoll()});
window.chat={load:()=>loadChat(streamId),send:sendChat,setText:v=>chatText.value=v,ended:()=>{detail.value.status='ended';displayState.value='ended'},state:()=>({count:messages.value.length,last:messages.value.at(-1)?.id,refreshError:chatRefreshError.value,text:chatText.value})};`;
    }
    const style = source.match(/<style scoped>([\s\S]*?)<\/style>/)[1];
    fs.writeFileSync(path.join(work, kind + '.vue'), `<template>${template}</template><script setup>
import {ref,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {fetchStreamChatRows,countNewChatMessages} from ${JSON.stringify(helper)};
import {streamId,db,supa} from './fixture.js';
${script}
</script><style scoped>${style}</style>`);
}
fs.writeFileSync(path.join(work, 'index.html'), '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;font-family:Arial"><div id="app"></div><script type="module" src="/main.js"></script></body></html>');
fs.writeFileSync(path.join(work, 'main.js'), `import {createApp} from 'vue';import Speaker from './speaker.vue';import Viewer from './viewer.vue';
const kind=new URLSearchParams(location.search).get('kind');document.body.style.background=kind==='speaker'?'#091747':'#f5f6f8';
const app=createApp(kind==='speaker'?Speaker:Viewer);app.mount('#app');window.unmountChat=()=>app.unmount();`);
await build({ root: work, configFile: false, plugins: [vue()], logLevel: 'error', resolve: { alias: { vue: path.join(root, 'node_modules/vue/dist/vue.esm-bundler.js') } }, build: { outDir: 'dist' } });
const server = http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; frame-src 'none'");
    const pathname = new URL(req.url, 'http://fixture').pathname;
    const file = path.join(work, 'dist', pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(path.join(work, 'dist') + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser, ws;
const results = [], exceptions = [];
try {
    browser = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + path.join(work, 'profile'), 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    const address = await new Promise((resolve, reject) => {
        let s = ''; const timer = setTimeout(() => reject(Error('Chrome timeout')), 15000);
        browser.stderr.on('data', b => { s += b; const m = s.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) { clearTimeout(timer); resolve(m[1]); } });
        browser.on('exit', () => reject(Error('Chrome exited')));
    });
    ws = new WebSocket(address); await new Promise(r => ws.addEventListener('open', r, { once: true }));
    let id = 0; const pending = new Map();
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(Error(m.error.message)) : p.resolve(m.result); }
        if (m.method === 'Runtime.exceptionThrown') exceptions.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) })); });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const ev = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await ev(expression)) return; await new Promise(r => setTimeout(r, 50)); } throw Error('Timeout: ' + expression + ' ' + exceptions.join(' ')); };
    await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId); await send('Network.enable', {}, sessionId);
    await send('Network.setBlockedURLs', { urls: ['https://*', 'wss://*', 'ws://*'] }, sessionId);
    for (const kind of ['speaker', 'viewer']) {
        await send('Page.navigate', { url: origin + '/?kind=' + kind }, sessionId);
        await until('window.chat?.state().count===200');
        await ev('db.state.rows=makeMessages(201);tick()');
        await until('chat.state().last.endsWith("000000000201")');
        assert.equal(await ev('chat.state().count'), 200); results.push(kind + ': latest message replaces window entry');
        await ev('db.state.fail=true;chat.load()'); await until('document.querySelector("[role=status]")?.textContent.includes("Не удалось обновить чат")');
        assert.equal(await ev('chat.state().count'), 200); results.push(kind + ': refresh status preserves messages');
        await ev('db.state.fail=false;chat.load()'); await until('!document.querySelector("[role=status]")'); results.push(kind + ': recovery clears status');
        await ev('db.state.failSend=true;chat.setText("Черновик");chat.send()');
        await until(kind === 'speaker' ? '!!document.querySelector("[role=alert]")' : 'document.querySelector(".sp-error")?.textContent.includes("Не удалось отправить")');
        assert.equal(await ev('document.querySelector("textarea").value'), 'Черновик'); results.push(kind + ': send error visible, draft retained');
        // One batched desktop/mobile inspection for both existing chat surfaces.
        await ev('db.state.fail=true;chat.load()');
        for (const width of [390, 1366]) {
            await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 390 }, sessionId);
            assert.ok(await ev('document.documentElement.scrollWidth<=innerWidth'));
            const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
            fs.writeFileSync(path.join(work, kind + '-' + width + '.png'), Buffer.from(shot.data, 'base64'));
            results.push(kind + ': error state fits ' + width);
        }
        await ev('db.state.fail=false;db.state.rows=makeMessages(202);document.dispatchEvent(new Event("visibilitychange"))');
        await until('chat.state().last.endsWith("000000000202")'); results.push(kind + ': visibility return refreshes immediately');
        if (kind === 'viewer') {
            await ev('db.state.rows=makeMessages(1000);chat.ended();chat.load()'); await until('chat.state().count===1000');
            assert.equal(await ev('document.querySelectorAll(".sp-chat-row").length'), 1000); results.push('viewer: ended history renders all 1000');
        }
        await ev('unmountChat();undefined');
        const calls = await ev('db.state.calls.length'); await ev('tick();document.dispatchEvent(new Event("visibilitychange"))');
        assert.equal(await ev('db.state.calls.length'), calls); results.push(kind + ': unmount removes polling/listener');
    }
    assert.deepEqual(exceptions, []);
    console.log(JSON.stringify({ pass: results.length, fail: 0, results, artifacts: work }, null, 2));
} finally {
    ws?.close(); browser?.kill(); server.closeAllConnections(); await new Promise(r => server.close(r));
}
