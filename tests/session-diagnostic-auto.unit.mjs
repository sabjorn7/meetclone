import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createSessionDiagnostic} from '../src/_front/chrome/sessionDiagnostic.js';
import {createAutomaticDiagnostic,encodeSnapshot} from '../src/_front/chrome/sessionDiagnosticAuto.js';
const pass=s=>console.log('PASS '+s);
const drain=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const cfg=()=>({version:1,enabled:true,sampleRate:1,maxReports:3,thresholdMs:{auth:1000,http:1000,page:1000,route:1000}});
function fixture(draw=0){
 let time=0,hid=0,vis=true,net=true,next=0,c=cfg(),mode='ok';
 const timers=new Map(),calls=[];let auto;
 const recorder=createSessionDiagnostic(()=>time,{automatic:true,recording:()=>!auto||auto.recording(),onError:t=>auto?.error(t)});
 const schedule=(fn,ms)=>{const id=++next;timers.set(id,{fn,at:time+ms});return id;};
 auto=createAutomaticDiagnostic({recorder,release:'acb1496',now:()=>time,hiddenMs:()=>hid,visible:()=>vis,online:()=>net,random:()=>draw,schedule,cancel:id=>timers.delete(id),fetch:async(url,options)=>{
  calls.push({url,options});
  if(mode==='offline')throw Error('PRIVATE');
  if(mode==='pending')return new Promise(()=>{});
  if(url.includes('/_t/'))return {ok:true,text:()=>mode==='body-pending'?new Promise(()=>{}):Promise.resolve(JSON.stringify(c))};
  return {ok:mode!=='500',status:mode==='500'?500:204};
 }});
 return {auto,recorder,calls,timers,set(o){if('config'in o)c=o.config;if('mode'in o)mode=o.mode;if('visible'in o)vis=o.visible;if('hidden'in o)hid=o.hidden;if('online'in o)net=o.online;},async advance(ms){time+=ms;const ready=[...timers].filter(([,t])=>t.at<=time);for(const [id,t]of ready){timers.delete(id);t.fn();}await drain();},reports:()=>calls.filter(c=>c.url.includes('/_l/'))};
}
{
 const f=fixture();await f.auto.start();f.recorder.begin('auth','getSession').end();await f.advance(1000);assert.equal(f.reports().length,0);f.auto.stop();pass('success: no reports');
}
for(const type of ['window_error','vue_error','unhandled_rejection','resource_error']){
 const f=fixture();await f.auto.start();f.recorder.existingError(type);await drain();assert.equal(f.reports().length,1);assert.equal(f.reports()[0].options.credentials,'omit');assert.equal(f.reports()[0].options.referrerPolicy,'no-referrer');f.auto.stop();
}pass('four existing error categories use isolated credentialless transport');
{
 const f=fixture();await f.auto.start();for(let i=0;i<10000;i++)f.recorder.existingError('window_error');await drain();assert.equal(f.reports().length,1);
 for(let i=0;i<5;i++){await f.advance(10000);f.recorder.nextNavigation();f.recorder.existingError('window_error');await drain();}
 assert.equal(f.reports().length,3);assert.equal(f.auto.state().attempts,3);assert.equal(f.timers.size,0);pass('10000-error storm, dedup, three attempts, timer teardown');
}
for(const stage of ['auth','http','body','page-load','route-transition']){
 const f=fixture();await f.auto.start();f.recorder.begin(stage,'getSession',()=>true);for(let i=0;i<4;i++)await f.advance(1000);assert.equal(f.reports().length,1,stage);f.auto.stop();
}pass('pending Auth, HTTP headers/body, page and route thresholds');
{
 const f=fixture();await f.auto.start();f.recorder.begin('page-load','HomePage',()=>false).ready();f.recorder.begin('http','rest');for(let i=0;i<8;i++)await f.advance(1000);assert.equal(f.reports().length,0);f.auto.stop();pass('optional HTTP after page readiness is not a white-screen incident');
}
{
 const f=fixture();await f.auto.start();f.recorder.begin('auth','getSession');f.set({visible:false,hidden:60000});await f.advance(60000);assert.equal(f.reports().length,0);f.set({visible:true});await f.advance(1000);assert.equal(f.reports().length,0);await f.advance(60000);assert.equal(f.reports().length,0);f.auto.stop();pass('hidden tab, wake grace and unreported sleep do not trigger stale timeout');
}
{
 const f=fixture();await f.auto.start();f.set({online:false});f.recorder.existingError('window_error');await drain();assert.equal(f.auto.state().attempts,0);f.set({online:true});await f.advance(1000);assert.equal(f.reports().length,0);f.auto.stop();pass('offline: no queue or reconnect retry');
}
for(const mode of ['offline','500']){
 const f=fixture();await f.auto.start();f.set({mode});f.recorder.existingError('window_error');await drain();await f.advance(10000);assert(f.reports().length<=1);assert.equal(f.auto.state().attempts,1);f.auto.stop();
}pass('network/500 failure: bounded attempt without retries');
for(const mode of ['pending','body-pending']){
 const f=fixture();f.set({mode});const start=f.auto.start();await drain();await f.advance(3000);await start;assert.equal(f.auto.state().stopped,true);assert.equal(f.timers.size,0);
}pass('config headers/body deadline fails closed, even if abort ignored');
for(const config of [{...cfg(),enabled:false},{...cfg(),sampleRate:0},{...cfg(),thresholdMs:{}},{...cfg(),maxReports:99}]){
 const f=fixture();f.set({config});await f.auto.start();f.recorder.existingError('window_error');assert.equal(f.reports().length,0);assert.equal(f.recorder.snapshot().events.length,0);
}pass('disabled/malformed configuration stops recording and clears buffer');
{
 const f=fixture();await f.auto.start();f.set({config:{...cfg(),enabled:false}});f.recorder.existingError('window_error');await drain();assert.equal(f.reports().length,0);assert.equal(f.auto.state().stopped,true);pass('kill switch rechecked before delivery');
}
{
 const secret='test@example.invalid https://private.invalid/?token=SECRET Bearer SECRET';
 const d=createSessionDiagnostic();for(let i=0;i<300;i++)d.begin('http',secret).end('error',new Error(secret));d.begin('auth','getSession');
 const wire=encodeSnapshot(d.snapshot(),'acb1496',1);assert(wire.length<=1100);assert(!/SECRET|@|https|Bearer/.test(wire));
 const {pattern}=JSON.parse(fs.readFileSync(new URL('./fixtures/session-diagnostic-wire-v1.json',import.meta.url),'utf8'));assert(new RegExp('^'+pattern+'$').test('d='+wire));
 assert.equal(d.snapshot().events.length,240);assert(d.snapshot().pending.length<=64);pass('privacy allowlist, bounded ring and frozen receiver v1 wire grammar');
}
{
 const d=createSessionDiagnostic();const start=performance.now();for(let i=0;i<100000;i++)d.begin('http','rest').end();const ms=performance.now()-start;
 const bytes=Buffer.byteLength(JSON.stringify(d.snapshot()));assert(bytes<65536);console.log(JSON.stringify({benchmark:'100000 spans',ms,usPerSpan:ms*1000/100000,snapshotBytes:bytes}));pass('bounded retained snapshot after 100000 operations');
}

{
 const f=fixture();let loading=true;await f.auto.start();f.recorder.begin('page-load','HomePage',()=>loading).end();
 for(let i=0;i<4;i++)await f.advance(1000);assert.equal(f.reports().length,1);
 loading=false;assert.equal(f.recorder.snapshot().pending.length,0);f.auto.stop();pass('completed operation with loading=true remains observable; released when ready');
}
{
 const f=fixture();f.recorder.existingError('window_error');await f.auto.start();await drain();assert.equal(f.reports().length,1);f.auto.stop();pass('error during config initialization is retained and delivered after permission');
}
{
 const f=fixture();await f.auto.start();f.recorder.begin('auth','getSession');f.recorder.nextNavigation();assert.equal(f.recorder.snapshot().pending.length,0);f.auto.stop();pass('SPA transition releases old pending callbacks');
}

for(const [draw,selected] of [[0.005,true],[0.01,false],[0.5,false]]) {
 const f=fixture(draw);f.set({config:{...cfg(),sampleRate:0.01}});await f.auto.start();assert.equal(f.auto.state().selected,selected);f.auto.stop();
}pass('one-percent document sampling boundary');
