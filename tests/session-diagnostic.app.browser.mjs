import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = new URL('../dist/', import.meta.url).pathname;
const mime = {'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((req,res)=>{
 const parsed=new URL(req.url,'http://localhost');
 if(parsed.pathname.startsWith('/sb/') || parsed.pathname.startsWith('/api/')) {res.setHeader('Content-Type','application/json');res.end('[]');return;}
 let file=path.join(root,decodeURIComponent(parsed.pathname));
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file))file=path.join(root,'index.html');
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
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
    const targetOrigin=process.env.MG_SMOKE_ORIGIN||`http://127.0.0.1:${port}`;
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
    await send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sessionId);
    const originalMessage=socket.onmessage;
    socket.onmessage=event=>{
      const msg=JSON.parse(event.data);
      if(msg.method==='Fetch.requestPaused'){
        const {requestId,request}=msg.params; const u=new URL(request.url);
        const allow=request.method==='GET' && (u.origin===targetOrigin || (process.env.MG_SMOKE_ORIGIN && u.origin==='https://sb.meetgu.ru'));
        const method=allow?'Fetch.continueRequest':'Fetch.fulfillRequest';
        const params=allow?{requestId}:{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from('[]').toString('base64')};
        send(method,params,sessionId).catch(()=>{});
      } else originalMessage(event);
    };
    async function navigate(query) {
        await send('Page.navigate', { url: `${targetOrigin}/all_course/${query}` }, sessionId);
        for (let i = 0; i < 400; i++) { if (await evaluate("!!window.__mgMounted && !!document.querySelector('header') && !!document.querySelector('footer')")) return; await new Promise(r => setTimeout(r, 30)); }
        throw Error('Fixture did not load');
    }
    await navigate('');
    assert.equal(await evaluate("!document.querySelector('#mg-session-diagnostic')"),true);
    console.log('PASS full application normal mode: mounted, header/footer, no diagnostic panel');
    await navigate('?mg_loading_diag=1');
    assert.equal(await evaluate("!!document.querySelector('#mg-session-diagnostic')"),true);
    await evaluate("document.querySelector('#mg-session-diagnostic button').click()");
    const json=await evaluate("document.querySelector('#mg-session-diagnostic textarea').value");
    const data=JSON.parse(json);
    assert(data.events.some(e=>e.stage==='auth-init'));
    assert(data.events.some(e=>e.stage==='page-load'));
    assert(!/https?:|access_token|refresh_token|Authorization|@/.test(json));
    console.log('PASS full application opt-in: Auth/page events and privacy-safe export');
    await evaluate("window.wwLib.front.router.push('/faq')");
    assert.equal(await evaluate("window.wwLib.front.router.currentRoute.value.path"),'/faq');
    assert.equal(await evaluate("!!document.querySelector('#mg-session-diagnostic')"),true);
    console.log('PASS full application SPA transition: route completes, diagnostic control persists');

} finally {
    socket?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve));
}
