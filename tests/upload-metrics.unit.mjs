import assert from 'node:assert/strict';
import {createUploadMetrics,uploadMetricView} from '../src/_front/streams/uploadMetrics.js';
let t=0,m;const tracker=createUploadMetrics(1000,100,v=>m=v,()=>t);
assert.equal(m.confirmedBytes,100);tracker.begin();t=2000;tracker.confirm(300);assert.equal(m.bytesPerSecond,null);
tracker.begin();t=6000;tracker.confirm(500);assert(Math.abs(m.bytesPerSecond-400/6)<.001);
tracker.begin();t=7000;tracker.confirm(600);tracker.begin();t=8000;tracker.confirm(700);
assert(Math.abs(m.bytesPerSecond-400/6)<.001); // last 3: 200+100+100 bytes over 4+1+1 seconds
assert(uploadMetricView(m,t).eta);assert.equal(uploadMetricView(m,t+10000).eta,'');
assert.equal(uploadMetricView(m,t,7001).eta,'');assert.equal(uploadMetricView(m,t,-Infinity,true).eta,'');
tracker.confirm(2000);assert.equal(m.confirmedBytes,700);tracker.state('error');assert.equal(m.bytesPerSecond,null);
const resume=createUploadMetrics(1000,700,v=>m=v,()=>t);resume.begin();t+=1000;resume.confirm(800);assert.equal(m.bytesPerSecond,null);
assert.doesNotThrow(()=>{const x=createUploadMetrics(100,0,()=>{throw Error('observer')},()=>t);x.begin();x.confirm(10);x.state('error');});
console.log('PASS weighted last-three rate; resume baseline; stale/offline invalidation; invalid confirmation; error; observer isolation');
