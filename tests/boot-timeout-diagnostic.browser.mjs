// Actual built application + unmodified inline watchdog. Faults injected only in local browser.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs';
const root=new URL('../dist/',import.meta.url).pathname;
const html=fs.readFileSync(path.join(root,'all_course/index.html'),'utf8');
const entry=html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)[1];
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
 for(const kind of ['slow-main-js','failed-main-js','slow-css','pending-init-front','disabled-server','manual-mode'].filter(x=>!process.argv.some(a=>a.startsWith('--case='))||process.argv.includes('--case='+x))){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const observations={kind,configRequests:0,automaticReports:0,legacyBoot:0,legacyLate:0};let release;localFixture=observations;
  const gate=new Promise(r=>release=r);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin!==origin || req.method()!=='GET')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
   if(u.pathname==='/_t/session-diagnostic.json'||u.pathname==='/_l/session-v1')return route.continue();
   if(u.pathname==='/_l'){if(u.searchParams.get('t')==='boot_timeout')observations.legacyBoot++;if(u.searchParams.get('t')==='boot_late')observations.legacyLate++;return route.fulfill({status:204});}
   if(u.pathname.startsWith('/sb/')||u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
   if(u.pathname===entry && ['failed-main-js','disabled-server','manual-mode'].includes(kind))return route.fulfill({status:404,body:''});
   if((u.pathname===entry && kind==='slow-main-js') || (css.includes(u.pathname) && kind==='slow-css')){
    await gate;try{return await route.continue();}catch{return;}
   }
   return route.continue();
  });
  if(kind==='pending-init-front')await context.addInitScript(()=>{
   let value;Object.defineProperty(window,'wwLib',{configurable:true,get(){return value;},set(v){value=v;v.initFront=()=>{window.__fixtureInitBlocked=true;return new Promise(()=>{});};}});
  });
  const page=await context.newPage();
  await page.goto(origin+'/all_course/'+(kind==='manual-mode'?'?mg_loading_diag=1':''),{waitUntil:'commit',timeout:10000});
  await page.waitForTimeout(16500);
  Object.assign(observations,await page.evaluate(()=>({mounted:window.__mgMounted,fired:window.__mgBootFired,overlay:!!document.getElementById('mg-boot-msg'),message:document.getElementById('mg-boot-msg')?.textContent,readyState:document.readyState,visibility:document.visibilityState,initBlocked:!!window.__fixtureInitBlocked,reattachedCSS:document.querySelectorAll('[data-mg-reattached]').length,transportState:window.__mgSessionTransportV1?(({selected,stopped,attempts,phase,bootObserved,busy})=>({selected,stopped,attempts,phase,bootObserved,busy}))(window.__mgSessionTransportV1.state()):null})));
  console.log(JSON.stringify({checkpoint:observations}));
  if(kind!=='slow-css'){assert(observations.overlay);assert(observations.message.includes('Сайт загружается дольше обычного'));assert.equal(observations.legacyBoot,kind==='manual-mode'?1:0);}
  if(kind==='slow-main-js'||kind==='failed-main-js'){assert.equal(observations.configRequests,2);assert.equal(observations.automaticReports,1);}
  if(kind==='pending-init-front'){assert(observations.initBlocked);assert(observations.configRequests>0);assert.equal(observations.automaticReports,1);}
  if(kind==='disabled-server'||kind==='manual-mode')assert.equal(observations.automaticReports,0);
  if(kind==='slow-css')assert(observations.reattachedCSS>0);
  if(kind==='failed-main-js'){await page.evaluate(()=>{for(let i=0;i<1000;i++)window.__mgSessionTransportV1.boot(true);});await page.waitForTimeout(200);assert.equal(observations.automaticReports,1);}
  delete observations.message;results.push(observations);console.log(JSON.stringify(observations));
  release();if(kind==='slow-main-js'){await page.waitForTimeout(2000);assert.equal(await page.evaluate(()=>window.__mgMounted),true);assert.equal(observations.automaticReports,1);assert.equal(observations.legacyLate,0);assert.equal(await page.evaluate(()=>window.__mgSessionTransportV1.state().attempts),1);console.log(JSON.stringify({kind:'late-js',mounted:true,automaticReports:observations.automaticReports,sharedAttempts:1}));}
  await context.close();
 }
 for (const mode of ['hidden-resume','sleep-jump']) {
  const context=await browser.newContext();localFixture={kind:mode,configRequests:0,automaticReports:0};
  await context.addInitScript(()=>{window.__testHidden=false;Object.defineProperty(document,'visibilityState',{get:()=>window.__testHidden?'hidden':'visible'});});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname===entry)return route.fulfill({status:404,body:''});
   if(u.pathname==='/_t/session-diagnostic.json'||u.pathname==='/_l/session-v1')return route.continue();
   if(u.origin!==origin)return route.fulfill({status:200,body:''});return route.continue();
  });
  const page=await context.newPage();await page.clock.install();await page.goto(origin+'/all_course/',{waitUntil:'domcontentloaded'});await new Promise(r=>setTimeout(r,100));
  if(mode==='hidden-resume'){
   await page.evaluate(()=>{window.__testHidden=true;document.dispatchEvent(new Event('visibilitychange'));});await page.clock.runFor(15000);
   assert.equal(localFixture.automaticReports,0);await page.evaluate(()=>{window.__testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  }else{await page.clock.fastForward(30000);assert.equal(localFixture.automaticReports,0);}
  await page.clock.runFor(15000);await new Promise(r=>setTimeout(r,200));assert.equal(localFixture.automaticReports,1);
  console.log(JSON.stringify({kind:mode,reportsAfterFreshWindow:localFixture.automaticReports,virtualClock:true}));await context.close();
 }
 console.log(JSON.stringify({engine:isWebkit?'WebKit':'Chrome',scenarios:results.length+2,timeoutChanged:false,network:'local only'}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
