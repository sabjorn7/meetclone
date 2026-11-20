// Actual Vue pages; deterministic Auth events and delayed API responses. No external network.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {build} from 'vite';import vue from '@vitejs/plugin-vue';
import {chromium,webkit} from '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),work=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mg-session-races-')));
fs.symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'dir');
const put=(n,t)=>{const p=path.join(work,n);fs.writeFileSync(p,t);return p};
put('before.vue',execFileSync('git',['show','2ff25ceb:src/_front/views/HomePage.vue'],{cwd:root,encoding:'utf8'}));
const aliases=Object.entries({
'chrome/headerAccount.js':`export const getSupabase=()=>fixture.client,readStoredSession=()=>({user:{id:'A'}}),authCookieUser=()=>({id:'A'}),waitForUid=async()=> 'A';`,
'chrome/errorLogger.js':`export const logClientEvent=()=>{},loadTimeout=()=>()=>{};`,
'streams/peertubeLive.js':`export const embedUrl=()=>'';`,
'streams/eventsApi.js':`export const listPublishedEvents=async()=>[];`,
'streams/streamsApi.js':`export const listAllStreams=async()=>[];`,
'course/coursesApi.js':`export const getBuyerRow=async(_s,id)=>{fixture.buyerReads++;await fixture.gates['buyer:'+id];return {id}},ownsCourse=async(_s,_c,id)=>{await fixture.gates['ownership:'+id];return id==='A'&&!fixture.noOwnership},courseInCart=async()=>false,enrollFree=async()=>{fixture.writes++},addToCart=enrollFree;`
}).map(([n,t])=>({find:'@/_front/'+n,replacement:put(n.replaceAll('/','-'),t)}));aliases.push({find:'@',replacement:path.join(root,'src')});
put('index.html','<html><div id="app"></div><script type="module" src="/main.js"></script></html>');
put('main.js',`
import {createApp} from 'vue';import Home from ${JSON.stringify(path.join(root,'src/_front/views/HomePage.vue'))};import Catalog from ${JSON.stringify(path.join(root,'src/_front/views/AllCoursesPage.vue'))};import Before from './before.vue';
const q=new URLSearchParams(location.search),mode=q.get('mode');
const f=window.fixture={calls:[],writes:0,buyerReads:0,sessionReads:0,callbacks:[],gates:{},releases:{},inAuth:false};
f.hold=k=>{f.gates[k]=new Promise(r=>f.releases[k]=()=>{delete f.gates[k];r()})};f.release=k=>f.releases[k]?.();
f.sessionFor=(id,seconds=3600)=>id?{user:{id},access_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+seconds}:null;
f.session=f.sessionFor(['null','late-initial'].includes(mode)?null:'A',mode==='expired'?-1:3600);
f.emit=(id,event='SIGNED_IN',seconds=3600)=>{f.session=f.sessionFor(id,seconds);f.inAuth=true;for(const cb of f.callbacks)cb(event,f.session);f.inAuth=false};
f.rawEvent=(id,event)=>{f.inAuth=true;for(const cb of f.callbacks)cb(event,f.sessionFor(id));f.inAuth=false};
if(mode==='slow-auth'||mode==='auth-race'||mode==='auth-logout'||mode==='auth-failure')f.hold('auth');
if(mode==='profile-race'||mode==='profile-delay'||mode==='retry-late-profile')f.hold('profile:A');
if(mode==='courses-race')f.hold('course:A');
f.noOwnership=['catalog-buy','catalog-buyer-race'].includes(mode);
if(mode==='catalog-owner-race')f.hold('ownership:A');
if(mode==='catalog-buyer-race')f.hold('buyer:A');
f.client={auth:{getSession:async()=>{if(f.inAuth)throw Error('SDK reentry inside Auth callback');f.sessionReads++;const snapshot=f.session;await f.gates.auth;return {data:{session:snapshot}}},onAuthStateChange:cb=>{f.callbacks.push(cb);return {data:{subscription:{unsubscribe(){f.callbacks=f.callbacks.filter(x=>x!==cb)}}}}}},from:table=>{
 const state={uid:f.session?.user.id||'A',tag:f.tag||''};const b=new Proxy({}, {get(_t,k){if(k==='then')return (resolve,reject)=>{f.calls.push({table,uid:state.uid});return (async()=>{await f.gates[(table==='users'?'profile':table)+':'+state.uid];if(mode==='profile-error'&&table==='users'&&!f.recovered)return {data:null,error:{message:'synthetic'}};return {data:table==='users'?[{Name:'Person'+state.uid+state.tag,last_open:'course-'+state.uid}]:table==='user_course'?[{id:'entry-'+state.uid,course:'course-'+state.uid,end_period:'2099-01-01'}]:table==='course'?[{id:'course-'+state.uid,Title:'Course'+state.uid,Price:3500,Free:false,ModStatus:'Опубликовано',Category:'Test',Less_Id:[]}]:[]}})().then(resolve,reject)};return (...args)=>{if(k==='eq'&&['id','user'].includes(args[0]))state.uid=args[1];return b}}});return b;
}};
const app=createApp(q.get('version')==='before'?Before:q.get('page')==='catalog'?Catalog:Home);app.mount('#app');f.unmount=()=>app.unmount();f.mounted=true;
`);
await build({root:work,configFile:false,logLevel:'silent',plugins:[vue({template:{transformAssetUrls:false}})],resolve:{alias:aliases},build:{outDir:'dist',assetsInlineLimit:0}});
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local');const p=path.join(work,'dist',u.pathname==='/'?'index.html':u.pathname);if(!p.startsWith(work+'/dist/')||!fs.existsSync(p)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p))});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,results=[];
const absent=async p=>{assert.equal(await p.locator('h1').innerText(),'Здравствуйте!');assert.equal(await p.locator('a[href^="/my_courses"]').count(),0);assert(!await p.getByText('CourseA',{exact:true}).count());};
try{for(const engine of ['Chrome','WebKit']){const browser=engine==='Chrome'?await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}):await webkit.launch({headless:true});
try{for(const mode of ['null','logout','null-after-profile','switch','profile-race','courses-race','auth-race','auth-logout','late-initial','slow-auth','expired','expiry','resume-expiry','profile-delay','retry-late-profile','profile-error','auth-failure','unmount']){
 const c=await browser.newContext({serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p=await c.newPage();await p.clock.install();
 try{await p.goto(origin+'/?mode='+mode);await p.waitForFunction(()=>window.fixture?.mounted);await p.clock.runFor(1000);assert.equal(await p.locator('h1').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
 if(['null','expired'].includes(mode)){await absent(p);assert.equal(await p.evaluate(()=>fixture.calls.filter(c=>['users','user_course','course'].includes(c.table)).length),0);}
 else if(mode==='late-initial'){await p.evaluate(()=>{fixture.emit('B');fixture.rawEvent('A','INITIAL_SESSION')});await p.clock.runFor(1000);await p.getByText('CourseB',{exact:true}).first().waitFor();assert(!await p.getByText('CourseA',{exact:true}).count());}
 else if(mode==='auth-logout'){await p.evaluate(()=>{fixture.emit(null,'SIGNED_OUT');fixture.release('auth')});await p.clock.runFor(1000);await absent(p);assert.equal(await p.evaluate(()=>fixture.calls.filter(c=>c.table==='users').length),0);}
 else if(mode==='auth-race'){await p.evaluate(()=>fixture.emit('B'));await p.clock.runFor(1000);await p.getByText('CourseB',{exact:true}).first().waitFor();await p.evaluate(()=>fixture.release('auth'));await p.clock.runFor(1000);assert((await p.locator('h1').innerText()).includes('PersonB'));}
 else if(mode==='slow-auth'){await absent(p);await p.clock.runFor(14000);await absent(p);await p.evaluate(()=>fixture.release('auth'));await p.clock.runFor(1000);await p.getByText('CourseA',{exact:true}).first().waitFor();}
 else if(mode==='auth-failure'){await p.clock.runFor(30000);await absent(p);assert(await p.getByRole('button',{name:'Повторить загрузку'}).count());const n=await p.evaluate(()=>fixture.sessionReads);await p.clock.runFor(60000);assert.equal(await p.evaluate(()=>fixture.sessionReads),n);await p.evaluate(()=>fixture.release('auth'));await p.getByRole('button',{name:'Повторить загрузку'}).click();await p.clock.runFor(1000);await p.getByText('CourseA',{exact:true}).first().waitFor();}
 else if(mode==='profile-error'){await p.getByRole('button',{name:'Повторить загрузку'}).waitFor();await absent(p);await p.evaluate(()=>fixture.recovered=true);await p.getByRole('button',{name:'Повторить загрузку'}).click();await p.clock.runFor(1000);await p.getByText('CourseA',{exact:true}).first().waitFor();}
 else if(['profile-race','courses-race'].includes(mode)){await absent(p);await p.evaluate(()=>fixture.emit('B'));await p.clock.runFor(1000);await p.getByText('CourseB',{exact:true}).first().waitFor();await p.evaluate(()=>{fixture.release('profile:A');fixture.release('course:A')});await p.clock.runFor(1000);assert((await p.locator('h1').innerText()).includes('PersonB'));assert(!await p.getByText('CourseA',{exact:true}).count());}
 else if(mode==='retry-late-profile'){await p.clock.runFor(30000);await p.getByRole('button',{name:'Повторить загрузку'}).waitFor();await p.evaluate(()=>{fixture.tag='New';delete fixture.gates['profile:A']});await p.getByRole('button',{name:'Повторить загрузку'}).click();await p.clock.runFor(1000);await p.getByText('CourseA',{exact:true}).first().waitFor();await p.evaluate(()=>fixture.release('profile:A'));await p.clock.runFor(1000);assert((await p.locator('h1').innerText()).includes('PersonANew'));}
 else if(mode==='profile-delay'){await p.clock.runFor(14000);await absent(p);await p.evaluate(()=>fixture.release('profile:A'));await p.clock.runFor(1000);await p.getByText('CourseA',{exact:true}).first().waitFor();}
 else{await p.getByText('CourseA',{exact:true}).first().waitFor();if(mode==='switch'){await p.evaluate(()=>fixture.emit('B'));await p.clock.runFor(1000);await p.getByText('CourseB',{exact:true}).first().waitFor();assert(!await p.getByText('CourseA',{exact:true}).count());}else if(mode==='resume-expiry'){await p.clock.setSystemTime(new Date(Date.now()+7200000));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await absent(p);}else if(mode==='expiry'){await p.evaluate(()=>fixture.emit('A','TOKEN_REFRESHED',2));await p.clock.runFor(3000);await absent(p);}else if(mode==='unmount'){await p.evaluate(()=>fixture.unmount());assert.equal(await p.evaluate(()=>fixture.callbacks.length),0);}else{await p.evaluate(mode==='logout'?()=>fixture.emit(null,'SIGNED_OUT'):()=>fixture.emit(null,'TOKEN_REFRESHED'));await p.clock.runFor(1000);await absent(p);}}
 results.push({engine,mode,pass:true});
 }finally{await c.close()}
 }
 for(const mode of ['null','catalog-owner-race','catalog-buyer-race','catalog-buy']){
 const c=await browser.newContext({serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p=await c.newPage();await p.clock.install();
 try{await p.goto(origin+'/?page=catalog&mode='+mode);await p.waitForFunction(()=>window.fixture?.mounted);await p.clock.runFor(1000);await p.locator('.pd-course').first().click();
 if(mode==='null'){await p.getByRole('button',{name:'Купить',exact:true}).click();await p.getByText('Войдите, чтобы продолжить',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>fixture.buyerReads),0);}
 else if(mode==='catalog-owner-race'){await p.evaluate(()=>fixture.emit('B'));await p.clock.runFor(1000);await p.locator('.pd-course').first().click();await p.evaluate(()=>fixture.release('ownership:A'));await p.clock.runFor(1000);assert.equal(await p.getByText('Уже в библиотеке',{exact:true}).count(),0);}
 else if(mode==='catalog-buyer-race'){await p.getByRole('button',{name:'Купить',exact:true}).click();await p.waitForFunction(()=>fixture.buyerReads===1);await p.evaluate(()=>{fixture.emit(null,'SIGNED_OUT');fixture.release('buyer:A')});await p.clock.runFor(1000);assert.equal(await p.evaluate(()=>fixture.writes),0);await p.evaluate(()=>fixture.emit('B'));await p.clock.runFor(1000);await p.locator('.pd-course').first().click();await p.getByRole('button',{name:'Купить',exact:true}).click();await p.waitForFunction(()=>fixture.writes===1);}
 else{await p.getByRole('button',{name:'Купить',exact:true}).click();await p.waitForFunction(()=>fixture.writes===1);assert.equal(await p.evaluate(()=>fixture.buyerReads),1);}
 results.push({engine,mode:'catalog/'+mode,pass:true});
 }finally{await c.close()}
 }
 // Before: saved UID + null real session + successful API populates personal content.
 const c=await browser.newContext({serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p=await c.newPage();await p.goto(origin+'/?mode=null&version=before');await p.getByText('CourseA',{exact:true}).first().waitFor();assert((await p.locator('h1').innerText()).includes('PersonA'));results.push({engine,mode:'before-null-leak-reproduced',pass:true});await c.close();
}finally{await browser.close()}}
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
const out=path.join(root,'reviews/2026-11-20-public-auth-resilience/session-race-results.json');fs.writeFileSync(out,JSON.stringify({results,fixture:work},null,2));console.log(JSON.stringify({pass:results.length,results,fixture:work}));
