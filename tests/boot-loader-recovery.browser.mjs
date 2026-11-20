// Actual built application + unmodified inline watchdog. Faults injected only in local browser.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium,webkit} from '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs';
const root=new URL('../dist/',import.meta.url).pathname;
const html=fs.readFileSync(path.join(root,'all_course/index.html'),'utf8');
const entry=[...html.matchAll(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/g)].map(m=>m[1]).find(s=>/\/main-[^/]+\.js$/.test(s));
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
fs.mkdirSync(new URL('../reviews/2026-11-20-boot-loader/',import.meta.url),{recursive:true});
try {
for(const kind of ['normal','aborted-main','pending-router','late-init','manual-retry']){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 localFixture={kind,configRequests:0,automaticReports:0};const obs=localFixture;let documents=0,allowMain=kind!=='manual-retry';
 await context.route('**/*',async route=>{const u=new URL(route.request().url());
  if(u.origin!==origin||route.request().method()!=='GET')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  if(route.request().isNavigationRequest()&&route.request().frame()===page.mainFrame())documents++;
  if(u.pathname===entry&&kind==='aborted-main')return route.abort('connectionreset');
  if(u.pathname===entry&&!allowMain)return route.fulfill({status:404,body:''});
  if(u.pathname.startsWith('/sb/')||u.pathname.startsWith('/api/'))return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  if(u.pathname==='/_l')return route.fulfill({status:204});return route.continue();
 });
 if(kind==='pending-router'||kind==='late-init')await context.addInitScript(({kind})=>{let value;Object.defineProperty(window,'wwLib',{configurable:true,get(){return value},set(v){value=v;const orig=v.initFront;v.initFront=async function(args){const result=await orig.call(this,args);if(kind==='pending-router')args.router.isReady=()=>{window.__fixtureRouterBlocked=true;return new Promise(()=>{})};else await new Promise(resolve=>window.__releaseInit=resolve);return result}}})},{kind});
 const page=await context.newPage();await page.goto(origin+'/all_course/',{waitUntil:'commit'});
 await page.waitForTimeout(16500);
 Object.assign(obs,await page.evaluate(()=>({mounted:!!window.__mgMounted,overlay:!!document.getElementById('mg-boot-msg'),placeholder:!!document.getElementById('mg-boot-loading'),routerBlocked:!!window.__fixtureRouterBlocked,phase:window.__mgSessionTransportV1?.state().phase})));
 if(kind==='normal'){assert(obs.mounted);assert(!obs.overlay);assert.equal(obs.automaticReports,0)}else{assert(obs.overlay);assert.equal(obs.automaticReports,1)}
 assert.equal(documents,1);
 if(kind==='late-init'){await page.evaluate(()=>window.__releaseInit());await page.waitForTimeout(1000);assert(await page.evaluate(()=>window.__mgMounted&&!document.getElementById('mg-boot-msg')));assert.equal(obs.automaticReports,1);obs.lateRecovery=true}
 if(kind==='manual-retry'){allowMain=true;await page.keyboard.press(isWebkit?'Alt+Tab':'Tab');assert(await page.locator('#mg-boot-msg button').evaluate(el=>el===document.activeElement));await page.keyboard.press('Enter');await page.waitForTimeout(2500);assert.equal(documents,2);assert(await page.evaluate(()=>window.__mgMounted&&!document.getElementById('mg-boot-msg')));assert.equal(obs.automaticReports,1);obs.manualRecovery=true}
 obs.documents=documents;results.push(obs);console.log(JSON.stringify(obs));await context.close();
}
fs.writeFileSync(new URL('../reviews/2026-11-20-boot-loader/extra-',import.meta.url).pathname+(isWebkit?'webkit':'chrome')+'.json',JSON.stringify(results,null,2));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
