import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const template=fs.readFileSync(new URL('../template.html',import.meta.url),'utf8');
const baseline=execFileSync('git',['show','HEAD:template.html'],{encoding:'utf8'});
const script=s=>s.match(/<script>([\s\S]*?)<\/script>/)[1].replace('{{{earlySessionDiagnostic}}}','');
// Only the watchdog UI may change: timer, freeze accounting and beacon logic remain byte-identical.
assert.equal(script(template).split('                // Если уже показан')[0],script(baseline).split('                // Если уже показан')[0]);
assert.equal(script(template).split('                  var poll = setInterval')[1],script(baseline).split('                  var poll = setInterval')[1]);
const loader=template.match(/<div id="app">([\s\S]*?)\{\{\{scripts.body/)[1];
assert(!/src=|href=|url\(/.test(loader));
assert(template.includes('@media (prefers-reduced-motion:reduce)'));
assert(template.includes('role="status" aria-live="polite" aria-atomic="true"'));
function fixture(throws=false){
 let now=0,reloads=0,reports=0;const timers=[],intervals=[],nodes=new Map();
 const element=()=>({children:[],disabled:false,setAttribute(){},appendChild(el){this.children.push(el);el.parentNode=this;},removeChild(el){nodes.delete(el.id);}});
 const body=element();body.appendChild=el=>{nodes.set(el.id,el);el.parentNode=body;};
 const document={visibilityState:'visible',readyState:'interactive',body,addEventListener(){},querySelectorAll:()=>[],createElement:element,getElementById:id=>nodes.get(id)||null};
 const window={__mgSessionTransportV1:{boot:()=>reports++}};
 const context={window,document,navigator:{onLine:true},performance:{now:()=>now,getEntriesByType:()=>[]},Date:{now:()=>now},location:{reload(){reloads++;if(throws)throw Error('synthetic');}},setTimeout(fn,ms){timers.push({fn,ms});},setInterval(fn,ms){intervals.push({fn,ms});},clearInterval(){},Image:class{},encodeURIComponent};
 vm.runInNewContext(script(template),context);
 assert.deepEqual(timers.map(t=>t.ms),[5000,15000]);now=15000;timers[1].fn();
 assert.equal(reports,1);assert.equal(intervals.length,1);assert.equal(intervals[0].ms,500);
 const button=nodes.get('mg-boot-msg').children[0];assert.equal(button.textContent,'Повторить загрузку');
 button.onclick();button.onclick();assert.equal(reloads,throws?2:1);assert.equal(button.disabled,!throws);
 window.__mgMounted=true;intervals[0].fn();assert(!nodes.has('mg-boot-msg'));
}
fixture();fixture(true);
console.log('PASS unchanged watchdog/diagnostics/freeze window; inline accessible loader; click dedup; reload exception unlock; late-mount removal; no added timer');
