import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../src/_front/chrome/sessionDiagnostic.js', import.meta.url));
let autoMode=false; const reports=[];
const server = http.createServer((req, res) => {
    if (req.url === '/favicon.ico') {res.writeHead(204);return res.end();}
    if (req.url.startsWith('/_l/session-v1?')) { reports.push({url:req.url,cookie:req.headers.cookie,referer:req.headers.referer}); res.writeHead(204);return res.end(); }
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/html');
    if (['/sessionDiagnosticAuto.js','/freezeGuard.js'].includes(req.url)) return res.end(fs.readFileSync(new URL('../src/_front/chrome'+req.url, import.meta.url)));
    if (req.url === '/_t/session-diagnostic.json') return res.end(JSON.stringify({version:1,enabled:autoMode,sampleRate:1,maxReports:3,thresholdMs:{route:15000,auth:10000,http:20000,page:45000}}));
    if (req.url === '/module.js') return res.end(source);
    autoMode=req.url.includes('auto=1');
    res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><header>MeetGuru</header><main>Загрузка…</main><footer>Footer</footer>
      <script>window.originalFetch=window.fetch;window.__MG_DIAGNOSTIC_RELEASE__='acb1496';</script><script type="module">
      import {sessionDiagnostic,tracePage} from '/module.js';
      window.diagnostic=sessionDiagnostic;
      if(sessionDiagnostic) {
        const pending=sessionDiagnostic.call('auth','getSession',()=>new Promise(()=>{}));
        tracePage('ClubsPage',()=>true,()=>pending);
      }
      window.fixtureReady=true;</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port, temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-session-diag-browser-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${temp}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
    const address = await new Promise((resolve, reject) => {
        let output = ''; const timer = setTimeout(() => reject(Error('Chrome startup timeout')), 15000);
        chrome.stderr.on('data', value => { output += value; const match = output.match(/DevTools listening on (ws:\/\/\S+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
        chrome.on('error', reject);
    });
    socket = new WebSocket(address);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0; const pending = new Map();
    socket.onmessage = event => { const message = JSON.parse(event.data); const item = pending.get(message.id); if (item) { pending.delete(message.id); message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result); } };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
        if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
        return result.result.value;
    };
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
    await send('Network.enable', {}, sessionId);
    await send('Network.setBlockedURLs', { urls: ['https://*', 'http://app.meetgu.ru/*', 'http://sb.meetgu.ru/*'] }, sessionId);
    async function navigate(query) {
        await evaluate('window.fixtureReady=false');
        await send('Page.navigate', { url: `http://127.0.0.1:${port}/${query}` }, sessionId);
        for (let i = 0; i < 100; i++) { if (await evaluate('!!window.fixtureReady')) return; await new Promise(r => setTimeout(r, 30)); }
        throw Error('Fixture did not load');
    }
    await navigate('?mg_loading_diag=1&token=PRIVATE_BROWSER_SENTINEL');
    assert.equal(await evaluate("!!document.querySelector('#mg-session-diagnostic')"), true);
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
    const box = await evaluate("(()=>{const r=document.querySelector('#mg-session-diagnostic button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] }, sessionId);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId);
    const text = await evaluate("document.querySelector('#mg-session-diagnostic textarea').value");
    const captured = JSON.parse(text);
    assert(captured.pending.some(e => e.stage === 'auth'));
    assert(captured.pending.some(e => e.stage === 'page-load' && e.loading));
    assert(!text.includes('PRIVATE_BROWSER_SENTINEL') && !text.includes('127.0.0.1'));
    console.log('PASS mobile viewport: touch opens trace with main content pending and network offline');
    await evaluate("Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}); document.querySelectorAll('#mg-session-diagnostic button')[1].click()");
    const selected = await evaluate("(()=>{const t=document.querySelector('#mg-session-diagnostic textarea');return t.selectionEnd-t.selectionStart===t.value.length})()");
    assert.equal(selected, true);
    console.log('PASS clipboard unavailable: selected-text fallback works offline');
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, sessionId);
    await navigate('');
    assert.equal(await evaluate("!!window.diagnostic && !document.querySelector('#mg-session-diagnostic')"), true);
    console.log('PASS without opt-in: hidden recorder, no panel');
    await navigate('?auto=1');
    await new Promise(r=>setTimeout(r,150));
    assert.equal(reports.length,0);
    await evaluate("document.cookie='private=SECRET'; window.diagnostic.existingError('window_error')");
    for(let i=0;i<50 && !reports.length;i++)await new Promise(r=>setTimeout(r,20));
    assert.equal(reports.length,1);
    assert.equal(reports[0].cookie,undefined);assert.equal(reports[0].referer,undefined);
    assert(!/SECRET|email|https|token/.test(reports[0].url));
    assert.equal(await evaluate("!!document.querySelector('#mg-session-diagnostic')"),false);
    console.log('PASS automatic mode: one numeric report, no cookies/referrer/panel, no success report');
} finally {
    socket?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve));
}
