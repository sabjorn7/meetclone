// Real Vue pages, real Supabase SDK/lock, real retry helper; all data and transports are local.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {build} from 'vite';import vue from '@vitejs/plugin-vue';
import {chromium,webkit} from '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs';
const root=path.resolve(new URL('..',import.meta.url).pathname),work=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mg-public-auth-fixture-')));
fs.symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'dir');
const put=(name,text)=>{const p=path.join(work,name);fs.writeFileSync(p,text);return p;};
for(const version of ['before','after'])for(const name of ['HomePage','AllCoursesPage'])put(`${version}-${name}.vue`,version==='before'?execFileSync('git',['show',`2ff25ceb:src/_front/views/${name}.vue`],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,`src/_front/views/${name}.vue`),'utf8'));
const mocks={
 'chrome/headerAccount.js':`export const getSupabase=()=>window.fixture.client,readStoredSession=()=>window.fixture.guest?null:({user:{id:'10000000-0000-4000-8000-000000000001'}}),authCookieUser=()=>null,waitForUid=async()=>readStoredSession().user.id;`,
 'chrome/errorLogger.js':`export const logClientEvent=(type)=>window.fixture.logs.push(type),loadTimeout=()=>()=>{};`,
 'chrome/sessionDiagnostic.js':`export const tracePage=(label,loading,fn)=>window.fixture.diagnostic.page(label,loading,fn);`,
 'course/certificate.js':`export const certNumber=()=>'',certDate=()=>'',certFilename=()=>'',downloadCertificatePdf=()=>{throw Error('No downloads')};`,
 'streams/peertubeLive.js':`export const embedUrl=()=>'';`,
 'streams/eventsApi.js':`export const listPublishedEvents=async()=>[];`,
 'streams/streamsApi.js':`export const listAllStreams=async()=>[];`,
 'course/coursesApi.js':`export const getBuyerRow=async()=>null,ownsCourse=async()=>false,enrollFree=()=>{throw Error('No writes')},addToCart=enrollFree,courseInCart=async()=>false;`
};
const aliases=Object.entries(mocks).map(([key,body])=>({find:'@/_front/'+key,replacement:put(key.replaceAll('/','-'),body)}));aliases.push({find:'@',replacement:path.join(root,'src')});
put('index.html','<html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="/main.js"></script></html>');
put('main.js',`
import {createApp} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import MyCourse from ${JSON.stringify(path.join(root,'src/_front/views/MyCoursePage.vue'))};import {createClient} from '@supabase/supabase-js';
import {createSessionDiagnostic,instrumentAuth} from ${JSON.stringify(path.join(root,'src/_front/chrome/sessionDiagnostic.js'))};
import BH from './before-HomePage.vue';import AH from './after-HomePage.vue';import BC from './before-AllCoursesPage.vue';import AC from './after-AllCoursesPage.vue';
const q=new URLSearchParams(location.search),mode=q.get('mode');
const f=window.fixture={logs:[],requests:[],sessions:0,lockCalls:0,guest:mode==='access-guest'};let hold=false,release;
const gate=new Promise(r=>release=r);f.release=()=>{hold=false;release()};
f.client=createClient('https://synthetic.invalid','synthetic-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,lock:async(_name,_timeout,fn)=>{f.lockCalls++;if(hold&&mode==='lock')await gate;return fn();}},global:{fetch:async(url)=>{
 const table=new URL(url).pathname.split('/').pop();f.requests.push(table);sessionStorage.setItem('requests',JSON.stringify(f.requests));
 if(mode==='access-pending'&&table==='user_course')await gate;
 if(mode==='offline'&&!f.recovered)throw new TypeError('synthetic offline');
 if(mode==='profile'&&table==='users'&&!f.recovered)await gate;
 if(mode==='api-error'&&!f.recovered)return new Response(JSON.stringify({message:'synthetic failure'}),{status:503,headers:{'Content-Type':'application/json'}});
 const data=table==='users'?[{Name:'Synthetic',last_open:null}]:table==='user_course'?(mode==='access-denied'||mode==='access-pending'?[]:[{id:'entry-1',course:'course-1',end_period:mode==='access-expired'?'2001-02-01':'2099-01-01',created_at:'2000-01-01'}]):table==='course'?[{id:'course-1',Title:'Synthetic paid course',Price:3500,Free:false,Category:'Test',DurationLong:30,ModStatus:'Опубликовано',Less_Id:['lesson-1']}]:table==='lessons'?[{id:'lesson-1',Title:'Synthetic lesson',ban_list:[]}]:[];
 return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
}}});
await f.client.auth.initialize();await f.client.auth._saveSession({access_token:'synthetic',refresh_token:'synthetic',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'10000000-0000-4000-8000-000000000001'}});hold=['lock','session'].includes(mode);
const original=f.client.auth.getSession.bind(f.client.auth);f.client.auth.getSession=async()=>{f.sessions++;if(hold&&mode==='session')await gate;return original()};
f.diagnostic=createSessionDiagnostic();instrumentAuth(f.client,f.diagnostic);
f.fanout=()=>{f.extra=Array.from({length:19},()=>Promise.resolve(f.client.from('users').select('id')));};
f.recover=()=>{f.recovered=true;f.release()};
const router=createRouter({history:createWebHistory(),routes:[{path:'/:pathMatch(.*)*',component:{template:'<div/>'}}]});await router.push(location.pathname+location.search);await router.isReady();createApp(q.get('page')==='protected'?MyCourse:q.get('page')==='home'?(q.get('version')==='before'?BH:AH):(q.get('version')==='before'?BC:AC)).use(router).mount('#app');f.mounted=performance.now();
`);
await build({root:work,configFile:false,plugins:[vue({template:{transformAssetUrls:false}})],resolve:{alias:aliases},build:{outDir:path.join(work,'dist'),target:'esnext'},logLevel:'error'});
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');if(u.pathname==='/login'||u.pathname.startsWith('/course/')){res.setHeader('Content-Type','text/html');return res.end('<p>synthetic destination</p>');}const p=path.join(work,'dist',u.pathname==='/'?'index.html':u.pathname);if(!p.startsWith(path.join(work,'dist')+'/')||!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const results=[];
async function open(browser,version,pageName,mode,clock=false){
 const c=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
 await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const p=await c.newPage();if(clock)await p.clock.install();await p.goto(origin+`/?version=${version}&page=${pageName}&mode=${mode}&course=course-1`);await p.waitForFunction(()=>!!window.fixture?.mounted);return {c,p};
}
const inspect=p=>p.evaluate(()=>({opacity:Number(getComputedStyle(document.querySelector('h1')).opacity),sessions:fixture.sessions,requests:fixture.requests.length,loading:!!document.querySelector('.pd-state'),error:!!document.querySelector('.pd-empty[role=status]'),pendingAuth:fixture.diagnostic.snapshot().pending.filter(x=>x.stage==='auth').length}));
try{
for(const engine of ['Chrome','WebKit']){
 const b=engine==='Chrome'?await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}):await webkit.launch();
 try{
 // Real wall-time reproduction, including the 21-call fan-out at ~12s (19 parallel + original + retry).
 await Promise.all(['before','after'].flatMap(version=>['home','catalog'].map(async pageName=>{
  const {c,p}=await open(b,version,pageName,'lock');try{
   await p.evaluate(()=>fixture.fanout());await p.waitForTimeout(1000);const first=await inspect(p);assert.equal(first.opacity,version==='after'?1:0);
   await p.waitForTimeout(11000);const delayed=await inspect(p);assert.equal(delayed.requests,0);assert(delayed.sessions>=21);assert(delayed.pendingAuth>=21);assert.equal(delayed.opacity,version==='after'?1:0);
   if(version==='after'&&pageName==='home')assert(await p.getByRole('link',{name:'Перейти в каталог',exact:true}).isVisible());
   await p.waitForTimeout(3000);await p.evaluate(()=>fixture.recover());await p.waitForFunction(()=>!document.querySelector('.pd-state'));await p.waitForTimeout(700);assert.equal((await inspect(p)).opacity,1);assert(await p.getByText('Synthetic paid course',{exact:true}).count()>0);
   results.push({engine,version,page:pageName,mode:'lock',at1s:first,at12s:delayed,releasedAtSeconds:15,recovered:true});
  }finally{await c.close()}
 })));
 for(const pageName of ['home','catalog'])for(const mode of ['session','profile','offline','api-error','normal']){
  const {c,p}=await open(b,'after',pageName,mode,true);try{
   await p.clock.runFor(1000);assert.equal((await inspect(p)).opacity,1);
   if(['session','profile'].includes(mode)){
    await p.clock.runFor(20000);const during=await inspect(p);assert.equal(during.opacity,1);assert(during.loading||pageName==='catalog'&&mode==='profile');
    if(mode==='session'){
     await p.clock.runFor(10000);await p.waitForFunction(()=>!!document.querySelector('.pd-empty[role=status]'));assert(!(await inspect(p)).loading);assert.equal(await p.locator('a[href^="/my_courses"]').count(),0);
     await p.evaluate(()=>fixture.recover());await p.getByRole('button',{name:'Повторить загрузку'}).click();
    }else await p.evaluate(()=>fixture.recover());
   }else if(['offline','api-error'].includes(mode)){
    await p.clock.runFor(30000);await p.waitForFunction(()=>!!document.querySelector('.pd-empty[role=status]'));assert(!(await inspect(p)).loading);
    const calls=await p.evaluate(()=>fixture.sessions);await p.clock.runFor(60000);assert.equal(await p.evaluate(()=>fixture.sessions),calls);
    await p.evaluate(()=>fixture.recover());await p.getByRole('button',{name:'Повторить загрузку'}).click();
   }
   await p.clock.runFor(2000);await p.waitForFunction(()=>!document.querySelector('.pd-state'));assert(!(await inspect(p)).error);assert(await p.getByText('Synthetic paid course',{exact:true}).count()>0);
   results.push({engine,page:pageName,mode,pass:true,clock:'virtual after initial mount'});
  }finally{await c.close()}
 }
 for(const mode of ['access-guest','access-denied','access-expired','access-pending','access-granted']){
  const c=await b.newContext({serviceWorkers:'block'});await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const p=await c.newPage();
  try{
   await p.goto(origin+'/?version=after&page=protected&mode='+mode+'&course=course-1');
   if(mode==='access-pending'){await p.waitForFunction(()=>!!window.fixture?.mounted);await p.waitForTimeout(1000);assert(!await p.evaluate(()=>fixture.requests.includes('lessons')));assert(await p.locator('.pd-load').count()>0);await p.evaluate(()=>fixture.recover());}
   if(mode==='access-granted'){await p.waitForFunction(()=>window.fixture?.requests.includes('lessons'));}
   else {await p.waitForURL(mode==='access-guest'?'**/login':'**/course/**');assert(!JSON.parse(await p.evaluate(()=>sessionStorage.getItem('requests')||'[]')).includes('lessons'));}
   results.push({engine,mode,paidAccessPreserved:true});
  }finally{await c.close()}
 }
 }finally{await b.close()}
}
const out=path.join(root,'reviews/2026-11-20-public-auth-resilience');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({results,fixture:work},null,2));console.log(JSON.stringify({pass:results.length,results,fixture:work}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
