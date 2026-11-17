// Requires separately installed Playwright passed as argv[2]; no project dependency changes.
import {pathToFileURL,fileURLToPath} from 'node:url';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import assert from 'node:assert/strict';
import {build} from 'vite';
const {webkit}=await import(pathToFileURL(process.argv[2]));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mg-webkit-diag-')));
fs.symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'dir');
fs.writeFileSync(path.join(work,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><header>MeetGuru</header><main>Загрузка…</main><footer>Footer</footer><script type="module" src="/main.js"></script>');
fs.writeFileSync(path.join(work,'main.js'),`
import {sessionDiagnostic} from ${JSON.stringify(path.join(root,'src/_front/chrome/sessionDiagnostic.js'))};
import {initErrorLogger} from ${JSON.stringify(path.join(root,'src/_front/chrome/errorLogger.js'))};
initErrorLogger();window.fixture={diag:sessionDiagnostic};
if(location.search.includes('wait=1')){sessionDiagnostic.begin('auth','getSession');sessionDiagnostic.begin('page-load','HomePage',()=>true);}
else sessionDiagnostic.begin('page-load','HomePage',()=>false).end();
window.fixtureReady=true;
`);
await build({root:work,configFile:false,define:{__MG_DIAGNOSTIC_RELEASE__:JSON.stringify('acb1496')},logLevel:'error',plugins:[{name:'isolate-backends',enforce:'pre',resolveId(id,importer){if(id.startsWith('.')&&importer)id=path.resolve(path.dirname(importer),id);if(id.endsWith('/chrome/headerAccount.js'))return '\0mock-account';},load(id){if(id==='\0mock-account')return 'export const getSupabase=()=>{window.legacyWrites=(window.legacyWrites||0)+1;return null},readStoredSession=()=>null,authCookieUser=()=>null;';}}],build:{outDir:'dist'}});
const reports=[],configRequests=[];
const server=http.createServer((req,res)=>{
 if(req.url==='/_t/session-diagnostic.json'){configRequests.push(1);res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({version:1,enabled:true,sampleRate:1,maxReports:3,thresholdMs:{auth:1000,http:1000,page:1000,route:1000}}));}
 if(req.url.startsWith('/_l/session-v1?')){reports.push({url:req.url,cookie:req.headers.cookie,referer:req.headers.referer});res.writeHead(204);return res.end();}
 if(req.url==='/assets/missing.js'){res.writeHead(404);return res.end();}
 const pathname=new URL(req.url,'http://localhost').pathname;
 const p=path.join(work,'dist',pathname.startsWith('/assets/')?pathname:'index.html');
 if(!p.startsWith(path.join(work,'dist')+path.sep)||!fs.existsSync(p)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await webkit.launch({headless:true});let context;const results=[],errors=[];
try{
 context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const open=async(query='')=>{await page.goto(origin+'/'+query);await page.waitForFunction(()=>window.fixtureReady);await page.waitForTimeout(200);};
 await open();assert.equal(reports.length,0);assert.equal(await page.locator('#mg-session-diagnostic').count(),0);results.push('ordinary successful load: no report/panel');
 await context.addCookies([{name:'private',value:'PRIVATE_SENTINEL',url:origin}]);
 await page.evaluate(()=>setTimeout(()=>{throw Error('PRIVATE_SENTINEL email@example.invalid https://secret.invalid/?token=SECRET');},0));
 await page.waitForTimeout(400);assert.equal(reports.length,1);assert.equal(reports[0].cookie,undefined);assert.equal(reports[0].referer,undefined);assert(!/PRIVATE|SECRET|@|https/.test(reports[0].url));assert.equal(await page.evaluate(()=>window.legacyWrites||0),0);results.push('actual JS error -> numeric report, no cookie/referrer or legacy write');
 await open();await page.evaluate(()=>{const s=document.createElement('script');s.src='/assets/missing.js';document.head.append(s);});await page.waitForTimeout(400);assert.equal(reports.length,2);assert(reports[1].url.includes('.2.'));results.push('critical resource 404 -> report');
 await open('?wait=1');await page.waitForTimeout(4200);assert.equal(reports.length,3);results.push('pending Auth/page -> automatic long-wait report');
 const count=reports.length,configs=configRequests.length;await open('?mg_loading_diag=1&wait=1&token=PRIVATE_SENTINEL');assert.equal(configRequests.length,configs);
 await context.setOffline(true);await page.locator('#mg-session-diagnostic button').first().tap();
 const exported=await page.locator('#mg-session-diagnostic textarea').inputValue();assert(JSON.parse(exported).pending.some(e=>e.stage==='auth'));assert(!/PRIVATE|token|https|@/.test(exported));
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true}));await page.locator('#mg-session-diagnostic button').nth(1).tap();
 assert(await page.locator('#mg-session-diagnostic textarea').evaluate(t=>t.selectionEnd-t.selectionStart===t.value.length));assert.equal(reports.length,count);results.push('manual panel: touch, offline export, clipboard fallback, no automatic requests');
 assert.equal(errors.length,1);assert(errors[0].includes('PRIVATE_SENTINEL'));results.push('no unexpected JavaScript errors');
 console.log(JSON.stringify({engine:browser.version(),pass:results.length,results,physicalIPhone:false}));
}finally{await context?.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
