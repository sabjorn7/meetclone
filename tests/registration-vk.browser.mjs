// Actual Vue pages + actual Supabase SDK callback initialization. All auth/VK data is synthetic.
// Build an isolated fixture, deny external network, never start the MeetGuru application shell.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const work=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'meetguru-registration-vk-')));
fs.symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'dir');
fs.writeFileSync(path.join(work,'index.html'),'<html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="/main.js"></script></html>');
fs.writeFileSync(path.join(work,'header.js'),'export const getSupabase=()=>null,readStoredSession=()=>null,isLikelyLoggedIn=()=>false;');
fs.writeFileSync(path.join(work,'logger.js'),'export const logClientEvent=()=>{};');
fs.writeFileSync(path.join(work,'guard.js'),'export const guardedTimeout=async task=>task;');
fs.writeFileSync(path.join(work,'main.js'),`
import {createApp} from 'vue';import {createRouter,createWebHistory} from 'vue-router';import {createClient} from '@supabase/supabase-js';
import Registration from ${JSON.stringify(path.join(root,'src/_front/views/RegistrationPage.vue'))};
import Login from ${JSON.stringify(path.join(root,'src/_front/views/LoginPage.vue'))};
import AuthPlugin from ${JSON.stringify(path.join(root,'src/components/plugins/plugin-1fa0dd68-5069-436c-9a7d-3b54c340f1fa/src/wwPlugin.js'))};
const mode=new URLSearchParams(location.search).get('mode');
const calls=window.fixtureCalls=JSON.parse(sessionStorage.getItem('auth-fixture-calls')||'[]');const record=(type,data)=>{calls.push({type,data});sessionStorage.setItem('auth-fixture-calls',JSON.stringify(calls));};
const realFetch=window.fetch.bind(window);window.fetch=async(url,options={})=>{
 const target=new URL(typeof url==='string'?url:url.url,location.origin);
 if(target.origin===location.origin)return realFetch(url,options);
 if(target.origin==='https://n8n.meetgu.ru'){
  if(target.pathname==='/webhook/auth_vk'){record('vk-request',JSON.parse(options.body));const kind=window.vkResponseKind||'good';return {ok:kind!=='http',json:async()=>{if(kind==='html')throw Error('HTML');return kind==='missing'?{}:{email:'vk42@vk.meetgu.ru',otp:'123456'};}};}
  record('signup-hook',{email:target.searchParams.get('email')});return {ok:true};
 }
 throw Error('External network forbidden: '+target.origin);
};
const callbacks={};window.vkCallbacks=callbacks;window.VKIDSDK={Config:{init(){}},ConfigResponseMode:{Callback:1},ConfigSource:{LOWCODE:1},WidgetEvents:{ERROR:'error'},OneTapInternalEvents:{LOGIN_SUCCESS:'success'},OneTap:class{render(){return this;}on(event,callback){callbacks[event]=callback;return this;}}};
const callbackAuth=location.search.includes('email_confirmation=1')?createClient(location.origin+'/mock-sb','synthetic-anon-key',{auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:true},global:{fetch:window.fetch}}).auth:null;
const auth={...AuthPlugin,publicInstance:{auth:{
 signUp:async credentials=>{record('signup',credentials);if(window.signupError)return {error:{message:window.signupError}};return {data:{user:{id:'11111111-1111-4111-8111-111111111111'},session:mode==='session'?{user:{id:'11111111-1111-4111-8111-111111111111'}}:null},error:null};},
 getSession:()=>callbackAuth?callbackAuth.getSession():Promise.resolve({data:{session:null}})
}},verifyOTP:async value=>{record('verifyOTP',value);}};
window.wwLib={wwPlugins:{supabaseAuth:auth},wwLog:{error(){}},manager:false};
const router=createRouter({history:createWebHistory(),routes:[{path:'/registration',component:Registration},{path:'/login',component:Login},{path:'/welcome',component:{template:'<h1 id="welcome">Welcome fixture</h1>'}}]});
createApp({template:'<router-view />'}).use(router).mount('#app');window.fixtureReady=true;
`);
await build({root:work,configFile:false,plugins:[vue({template:{transformAssetUrls:false}})],logLevel:'error',build:{outDir:'dist'},resolve:{alias:[
    {find:'@/_front/chrome/headerAccount.js',replacement:path.join(work,'header.js')},
    {find:'@/_front/chrome/errorLogger.js',replacement:path.join(work,'logger.js')},
    {find:'@/_front/chrome/freezeGuard.js',replacement:path.join(work,'guard.js')},
    {find:'@',replacement:path.join(root,'src')},
    {find:/^vue$/,replacement:path.join(root,'node_modules/vue/dist/vue.esm-bundler.js')},
]}});
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'learner@example.test',email_confirmed_at:'2026-11-13T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:'2026-11-13T00:00:00Z'};
const network=[],errors=[],checks=[];
const server=http.createServer((req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'none'; font-src 'self'");
    if(req.url.startsWith('/mock-sb/auth/v1/user')){network.push({method:req.method,path:'/mock-sb/auth/v1/user'});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(user));return;}
    const name=path.join(work,'dist',req.url.split('?')[0]);
    if(req.url.startsWith('/assets/')&&name.startsWith(path.join(work,'dist')+path.sep)&&fs.existsSync(name)){res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/css');res.end(fs.readFileSync(name));return;}
    if(req.url.startsWith('/images/')){const image=path.join(root,'public',req.url);if(fs.existsSync(image)){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(image));}else res.writeHead(204).end();return;}
    res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(path.join(work,'dist/index.html')));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
let browser,ws;
try{
    browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0','--user-data-dir='+path.join(work,'chrome'),'about:blank'],{stdio:['ignore','ignore','pipe']});
    const address=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('Chrome timeout')),15000);browser.stderr.on('data',b=>{log+=b;const m=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});browser.on('exit',()=>reject(Error('Chrome unavailable')));});
    ws=new WebSocket(address);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));let id=0;const pending=new Map();
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});ws.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}));});
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const until=async(expression,timeout=10000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await sleep(80);}throw Error('Timeout: '+expression+'; browser errors: '+JSON.stringify(errors));};
    await send('Page.enable',{},sessionId);await send('Network.enable',{},sessionId);await send('Runtime.enable',{},sessionId);
    await send('Network.setBlockedURLs',{urls:['https://*','ws://*','wss://*']},sessionId);
    const open=async route=>{await evaluate('try{sessionStorage.clear()}catch{}');await send('Page.navigate',{url:origin+route},sessionId);await until('window.fixtureReady&&!!document.querySelector("h2,h1")');};
    const fill=async email=>evaluate(`(()=>{const put=(el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));};put(document.querySelector('input[type=email]'),${JSON.stringify(email)});document.querySelectorAll('input[type=password]').forEach(el=>put(el,'synthetic-password'));const s=document.querySelector('select');s.value='Специалист';s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('input[type=checkbox]').click();})()`);
    const submit=()=>evaluate('document.querySelector("form").requestSubmit()');
    for(const email of ['user@mail.ru','user@mail.ruy','user@unknown-company.education']){
        await open('/registration');await fill(email);
        const hint=await evaluate('document.querySelector("#registration-email-suggestion")?.textContent||null');assert.equal(!!hint,email.endsWith('ruy'));
        assert.equal(await evaluate('document.querySelector("input[type=email]").value'),email);
        await submit();await until('!!document.querySelector(".pd-auth__confirmation")');
        assert.equal(await evaluate('location.pathname'),'/registration');
        assert.equal(await evaluate('fixtureCalls.find(x=>x.type==="signup").data.email'),email);
        assert.equal(await evaluate('fixtureCalls.find(x=>x.type==="signup").data.options.emailRedirectTo'),origin+'/login?email_confirmation=1');
        assert.equal(await evaluate('fixtureCalls.filter(x=>x.type==="signup-hook").length'),0);
        checks.push({name:'no-session registration: '+email,status:'PASS'});
    }
    await open('/registration');await fill('user@mail.ruy');await evaluate('document.querySelector("#registration-email-suggestion button").click()');
    await until('document.querySelector("input[type=email]").value==="user@mail.ru"');await submit();await until('!!document.querySelector(".pd-auth__confirmation")');
    assert.equal(await evaluate('fixtureCalls.filter(x=>x.type==="signup").length'),1);checks.push({name:'suggestion changes email only on explicit click',status:'PASS'});
    await open('/registration?mode=session');await fill('learner@example.test');await submit();await until('location.pathname==="/welcome"');
    const calls=JSON.parse(await evaluate('sessionStorage.getItem("auth-fixture-calls")'));assert.equal(calls.filter(x=>x.type==='signup-hook').length,1);assert.equal(calls.find(x=>x.type==='signup').data.options.data.nickname,'Ученик');
    checks.push({name:'autoconfirm/session preserves welcome hook, role metadata and redirect',status:'PASS'});
    await open('/registration');await fill('invalid');await submit();assert.equal(await evaluate('fixtureCalls.filter(x=>x.type==="signup").length'),0);checks.push({name:'invalid email does not submit',status:'PASS'});
    const tokenPart=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const access=tokenPart({alg:'HS256',typ:'JWT'})+'.'+tokenPart({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.synthetic-signature';
    const hash='#access_token='+access+'&refresh_token=synthetic-refresh-token&expires_in=3600&token_type=bearer&type=signup';
    await open('/login?email_confirmation=1'+hash);await until('location.pathname==="/welcome"');assert(network.some(x=>x.path==='/mock-sb/auth/v1/user'));
    checks.push({name:'real Supabase SDK processes confirmation fragment before welcome redirect',status:'PASS'});
    await open('/login?email_confirmation=1#error=access_denied&error_code=otp_expired');await until('!!document.querySelector("[role=alert]")');assert.equal(await evaluate('location.pathname'),'/login');
    checks.push({name:'expired confirmation stays on login with error',status:'PASS'});
    for(const route of ['/login','/registration'])for(const kind of ['http','html','missing','good']){
        await open(route);await evaluate(`window.vkResponseKind=${JSON.stringify(kind)};document.cookie='vkid_sdk:codeVerifier=synthetic-verifier;path=/';vkCallbacks.success({code:'synthetic',device_id:'synthetic'});`);
        if(kind==='good'){await until('JSON.parse(sessionStorage.getItem("auth-fixture-calls")||"[]").some(x=>x.type==="verifyOTP")');}
        else{await until('!!document.querySelector(".pd-auth__vk .pd-auth__err")');assert.equal(await evaluate('fixtureCalls.filter(x=>x.type==="verifyOTP").length'),0);}
        checks.push({name:route+' VK '+kind+' response validation',status:'PASS'});
    }
    await open('/registration');await fill('very.long.email.local.part.for.layout@mail.ruy');
    for(const width of [390,1366]){
        await send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width===390},sessionId);
        assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
        const shot=await send('Page.captureScreenshot',{format:'png'},sessionId);fs.writeFileSync(path.join(work,'registration-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    checks.push({name:'mobile/desktop suggestion layout, no horizontal overflow',status:'PASS'});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(work,'results.json'),JSON.stringify({checks,network,errors},null,2));
    console.log(JSON.stringify({checks,artifacts:work}));
}finally{ws?.close();browser?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
