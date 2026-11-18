import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import {performance} from 'node:perf_hooks';
import {createDiagnosticTransport} from '../src/_front/chrome/sessionDiagnosticTransport.js';
import {createAutomaticDiagnostic} from '../src/_front/chrome/sessionDiagnosticAuto.js';
import {createSessionDiagnostic} from '../src/_front/chrome/sessionDiagnostic.js';
const drain=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};const pass=s=>console.log('PASS '+s);
function fixture(draw=0){
 let time=0,visible=true,online=true,cfg={version:1,enabled:true,sampleRate:1,maxReports:3,thresholdMs:{auth:10000,http:20000,page:45000,route:15000}},mode='ok',seq=0,draws=0;
 const timers=new Map(),calls=[];
 const schedule=(fn,ms)=>{const id=++seq;timers.set(id,{fn,at:time+ms});return id;},cancel=id=>timers.delete(id);
 const opts={bootEnabled:true,release:'deb369b',now:()=>time,visible:()=>visible,online:()=>online,random:()=>{draws++;return draw;},schedule,cancel,fetch:async(url,options)=>{
  calls.push({url,options});if(mode==='network')throw Error('PRIVATE');if(mode==='pending')return new Promise(()=>{});
  if(url.includes('/_t/'))return {ok:true,text:()=>mode==='body-pending'?new Promise(()=>{}):Promise.resolve(JSON.stringify(cfg))};
  return {ok:mode!=='500'};
 }};const transport=createDiagnosticTransport(opts);
 return {transport,opts,calls,timers,draws:()=>draws,reports:()=>calls.filter(c=>c.url.includes('/_l/')),set(o){if('visible'in o)visible=o.visible;if('online'in o)online=o.online;if('mode'in o)mode=o.mode;if('config'in o)cfg=o.config;},async advance(ms){time+=ms;for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.fn();}await drain();}};
}
{
 const f=fixture();await Promise.all([f.transport.start(),f.transport.start()]);assert.equal(f.calls.length,1);assert.equal(f.draws(),1);await f.advance(15000);
 await Promise.all(Array.from({length:1000},()=>f.transport.boot(true)));assert.equal(f.reports().length,1);assert.equal(f.transport.state().attempts,1);
 const wire=f.reports()[0].url.split('?d=')[1];const {pattern}=JSON.parse(fs.readFileSync(new URL('./fixtures/session-diagnostic-wire-v1.json',import.meta.url)));assert(new RegExp('^'+pattern+'$').test('d='+wire));assert(wire.startsWith('1.deb369b.7.'));pass('one shared draw/start; 1000 watchdog calls yield one valid reason-7 report');
}
{
 const f=fixture();await f.transport.start();await f.advance(15000);await f.transport.boot(true);f.transport.mark(7);
 const d=createSessionDiagnostic();const a=createAutomaticDiagnostic({...f.opts,recorder:d,transport:f.transport});await a.start();assert.equal(f.draws(),1);
 for(let i=0;i<5;i++){await f.advance(10000);d.nextNavigation();a.error('window_error');await drain();}
 assert.equal(f.reports().length,3);assert.equal(f.transport.state().attempts,3);assert.equal(f.timers.size,0);pass('late module shares boot budget; total <=3 and no timer remains');
}
{
 const f=fixture();await f.transport.start();await f.advance(15000);await f.transport.boot(true);f.transport.mark(1);f.transport.mark(2);f.transport.mark(7);await f.transport.boot(true);assert.equal(f.reports().length,1);pass('late mount neither clears budget nor generates a second boot report');
}
{
 const f=fixture();await f.transport.start();f.transport.mark(1);f.transport.mark(3);f.transport.mark('https://SECRET');f.transport.mark(999);
 await f.advance(15000);await f.transport.boot(true);const report=f.reports()[0];assert(report.url.includes('13-0-0-3-'));assert(!/SECRET|@|https|token/.test(report.url));assert.equal(report.options.credentials,'omit');assert.equal(report.options.referrerPolicy,'no-referrer');pass('only numeric stage marks, no URL/text/credentials/referrer');
}
{
 const f=fixture();f.set({config:{version:1,enabled:false,sampleRate:0}});await f.transport.start();await f.transport.boot(true);assert.equal(f.reports().length,0);assert.equal(f.transport.state().attempts,0);pass('disabled config suppresses boot delivery');
}
{
 const f=fixture();await f.transport.start();f.set({config:{version:1,enabled:false,sampleRate:0}});await f.transport.boot(true);assert.equal(f.reports().length,0);assert(f.transport.state().stopped);pass('kill switch rechecked at boot send');
}
{
 const f=fixture();await f.transport.start();f.set({visible:false});await f.transport.boot(true);f.set({visible:true});await f.transport.boot(false);assert.equal(f.reports().length,0);await f.transport.boot(true);assert.equal(f.reports().length,1);pass('hidden/frozen timeout ignored; later qualified foreground timeout allowed');
}
{
 const f=fixture();await f.transport.start();f.set({online:false});await f.transport.boot(true);assert.equal(f.reports().length,0);assert.equal(f.transport.state().attempts,0);pass('offline boot does not queue reconnect retries');
}
for(const mode of ['network','pending','body-pending']){
 const f=fixture();f.set({mode});const p=f.transport.start();await drain();await f.advance(3000);await p;assert(f.transport.state().stopped);assert.equal(f.timers.size,0);
}pass('network failure / pending headers and body fail closed within deadline');
{
 const f=fixture();await f.transport.start();f.set({mode:'500'});await f.transport.boot(true);await f.advance(20000);await f.transport.boot(true);assert.equal(f.reports().length,1);assert.equal(f.transport.state().attempts,1);pass('500 consumes one attempt, no repeated boot sends');
}
{
 const f=fixture();await f.transport.start();await f.transport.send(1,'1.deb369b.1.0.0.13-0-0-0-1-0-0-0-0-0','early-error');assert.equal(f.reports().length,0);await f.transport.boot(true);assert.equal(f.reports().length,1);pass('pre-mount module errors deduplicated into watchdog-owned boot incident');
}
{
 const f=fixture();await f.transport.start();f.transport.mark(7);await f.transport.send(1,'PRIVATE_EMAIL@example.invalid','unsafe');assert.equal(f.transport.state().attempts,0);pass('transport rejects arbitrary payload before reserving budget');
}
{
 const source=fs.readFileSync(new URL('../template.html',import.meta.url),'utf8');assert(source.includes('}, 15000);'));assert(source.includes('}, 5000);'));assert.equal((source.match(/function __mgArmBoot/g)||[]).length,1);
 const code=createDiagnosticTransport.toString();const t=performance.now();for(let i=0;i<1000;i++)createDiagnosticTransport({fetch:()=>{},release:'deb369b'});
 console.log(JSON.stringify({transportBytes:Buffer.byteLength(code),gzipBytes:zlib.gzipSync(code).length,initMicroseconds:(performance.now()-t)*1000/1000}));pass('single original watchdog, unchanged timeout; bounded eight stage records');
}
