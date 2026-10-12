// Verify (timer A): every client_error_log insert + beacon carries vs/wh/hm. Chromium, built bundle.
import { chromium } from 'playwright';
const b=await chromium.launch(); const c=await b.newContext({userAgent:'MG-TEST-vistag'}); const p=await c.newPage();
let inserted=null, beaconM=null;
await p.route('**/sb/rest/v1/client_error_log*', r=>{ try{inserted=JSON.parse(r.request().postData()||'{}');}catch(e){} r.fulfill({status:201,body:'[]'}); });
await p.route('**/_l*', r=>{ try{beaconM=new URL(r.request().url()).searchParams.get('m');}catch(e){} r.fulfill({status:204,body:''}); });
await p.goto('http://localhost:4173/feedback/',{waitUntil:'commit'}).catch(()=>{});
for(let i=0;i<80;i++){ if(await p.evaluate(()=>!!window.__mgMounted).catch(()=>false))break; await p.waitForTimeout(100); }
// (1) non-beacon event: unhandledrejection → unhandled_rejection insert
await p.evaluate(()=>{ Promise.reject(new Error('vistag test boom')); });
await p.waitForTimeout(800);
// (2) beacon event: dispatch a window error (window_error ∈ BEACON_TYPES) → beacon m= carries vs
await p.evaluate(()=>{ window.dispatchEvent(new ErrorEvent('error',{error:new Error('be boom'),message:'be boom'})); });
await p.waitForTimeout(800);
const msg = inserted && inserted.message || '';
const out = {
  insertMessage: msg,
  insert_has_vs: / vs=(visible|hidden|prerender)/.test(msg),
  insert_has_wh: / wh=[01]/.test(msg),
  insert_has_hm: / hm=\d+/.test(msg),
  beaconM, beacon_has_vs: / vs=/.test(beaconM||''),
};
out.pass = out.insert_has_vs && out.insert_has_wh && out.insert_has_hm && out.beacon_has_vs;
console.log(JSON.stringify(out,null,2));
await b.close();
