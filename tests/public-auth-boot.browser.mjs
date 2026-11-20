// Actual built application + unmodified inline watchdog. Faults injected only in local browser.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs';
// Capture the independent system-font loader without waiting for unrelated application fonts.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY='1';
const root=new URL('../dist/',import.meta.url).pathname;
const html=fs.readFileSync(path.join(root,'all_course/index.html'),'utf8');
const entry=[...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)].map(m=>m[1]).find(src=>/\/main-[^/]+\.js$/.test(src));
const css=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
assert(entry.includes('/assets/'));assert(css.length);
let localFixture;
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/_t/session-diagnostic.json'){localFixture.configRequests++;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({version:1,enabled:localFixture.kind!=='disabled-server',sampleRate:localFixture.kind==='disabled-server'?0:1,maxReports:3,thresholdMs:{route:15000,auth:10000,http:20000,page:45000}}));}
 if(u.pathname==='/_l/session-v1'){localFixture.automaticReports++;assert.equal(u.searchParams.get('d').split('.')[2],'7');assert(!/https|token|@|PRIVATE/.test(u.searchParams.get('d')));assert(!req.headers.cookie);assert(!req.headers.referer);res.writeHead(204);return res.end();}
 let p=path.join(root,u.pathname);if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');
 if(!p.startsWith(root)||!fs.existsSync(p)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const isWebkit=process.argv.includes('--webkit');
const browser=isWebkit?await webkit.launch({headless:true}):await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});

const results=[];
try{
for(const routeName of ['/','/all_course/']){
 localFixture={kind:'disabled-server',configRequests:0,automaticReports:0};
 const c=await browser.newContext({serviceWorkers:'block'});
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin||r.request().method()!=='GET'||u.pathname.startsWith('/sb/')||u.pathname.startsWith('/api/'))return r.fulfill({status:200,contentType:'application/json',body:'[]'});return r.continue()});
 await c.addInitScript(()=>{
  localStorage.setItem('synthetic-ui-fixture',JSON.stringify({user:{id:'10000000-0000-4000-8000-000000000001'},access_token:'synthetic',refresh_token:'synthetic'}));
  let release;const gate=new Promise(r=>release=r),original=navigator.locks.request.bind(navigator.locks);
  window.__testLockCalls=0;window.__releaseAuthLock=release;navigator.locks.request=(...args)=>{window.__testLockCalls++;return gate.then(()=>original(...args));};
 });
 const p=await c.newPage();await p.goto(origin+routeName,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__mgMounted===true,{},{timeout:10000});await p.waitForTimeout(1000);
 const state=await p.evaluate(()=>({lockCalls:window.__testLockCalls,mounted:window.__mgMounted,opacity:Number(getComputedStyle(document.querySelector('h1')).opacity),placeholder:!!document.getElementById('mg-boot-loading')}));
 assert(state.lockCalls>0);assert.equal(state.opacity,1);assert(!state.placeholder);await p.evaluate(()=>window.__releaseAuthLock());await p.waitForTimeout(1000);results.push({route:routeName,...state});await c.close();
}
console.log(JSON.stringify({engine:isWebkit?'WebKit':'Chrome',results,network:'local-only',fullApp:true}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
