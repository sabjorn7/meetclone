import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeVideoStats as summarize } from '../src/_front/streams/videoStats.js';
const encoding = [{rid:'q',active:true},{rid:'h',active:false},{rid:'f',active:true}];
function report({time=1000,bytes=1000,frames=10,active=true,remoteTime=time,...extra}={}) {
 return new Map([['out',{id:'out',type:'outbound-rtp',kind:'video',ssrc:1,rid:'f',active,timestamp:time,bytesSent:bytes,framesSent:frames,frameWidth:1280,frameHeight:720,framesPerSecond:99,qualityLimitationReason:'bandwidth',remoteId:'remote',...extra}],['remote',{id:'remote',type:'remote-inbound-rtp',kind:'video',localId:'out',ssrc:1,timestamp:remoteTime,jitter:.58,roundTripTime:.043,fractionLost:.02}]]);
}
const sample=(r,old,now=1000,encodings=[])=>summarize(r,old,{now,encodings});
test('RID maps sender encodings regardless of report order; absent encodings remain explicit',()=>{
 const s=sample(report(),undefined,1000,encoding);assert.deepEqual(s.layers.map(l=>l.label),['LOW (q)','MEDIUM (h)','HIGH (f)']);assert.equal(s.layers[1].state,'disabled');assert.equal(s.layers[2].id,'out');
});
test('FPS and bitrate require monotonic counters; browser instantaneous FPS is ignored',()=>{
 const a=sample(report());assert.equal(a.layers[0].fps,null);
 const b=sample(report({time:4000,bytes:1001000,frames:70}),a.previous,4000).layers[0];assert.equal(b.fps,20);assert.equal(b.bitrate,1000000*8/3);assert.equal(b.state,'sending');
});
test('disabled encoding never claims old frame size, FPS or bandwidth as active quality',()=>{
 const a=sample(report());const b=sample(report({time:4000,active:false}),a.previous,4000).layers[0];assert.equal(b.state,'disabled');assert.equal(b.fps,0);assert.equal(b.bitrate,0);assert.equal(b.width,null);assert.equal(b.limitation,null);assert.equal(b.jitterMs,null);
});
test('sender parameters can disable an encoding even if stats say active',()=>{
 assert.equal(sample(report(),undefined,1000,[{rid:'f',active:false}]).layers[0].state,'disabled');
});
test('zero frames with padding bytes is idle, not sending video',()=>{
 const a=sample(report());const b=sample(report({time:4000,bytes:2000}),a.previous,4000).layers[0];assert.equal(b.state,'idle');assert.equal(b.fps,0);assert.equal(b.width,null);
});
test('stale outbound sample suppresses all rates and remote values',()=>{
 const l=sample(report(),undefined,20000).layers[0];assert.equal(l.state,'stale');assert.equal(l.bitrate,null);assert.equal(l.jitterMs,null);
});
test('stale RTCP suppresses jitter, RTT and loss while local sending remains measurable',()=>{
 const a=sample(report({time:17000,remoteTime:1000}),undefined,17000);const b=sample(report({time:20000,bytes:2000,frames:20,remoteTime:1000}),a.previous,20000).layers[0];assert.equal(b.state,'sending');assert.equal(b.remoteFresh,false);assert.equal(b.jitterMs,null);assert.equal(b.rttMs,null);assert.equal(b.lossPercent,null);
});
test('fresh RTCP units and fractionLost are preserved, including real zero loss',()=>{
 const r=report();let l=sample(r).layers[0];assert.equal(l.jitterMs,580);assert.equal(l.rttMs,43);assert.equal(l.lossPercent,2);r.get('remote').fractionLost=0;assert.equal(sample(r).layers[0].lossPercent,0);
});
test('missing fractionLost is unavailable, not a fabricated zero from unchanged packetsLost',()=>{
 const r=report();delete r.get('remote').fractionLost;r.get('remote').packetsLost=0;assert.equal(sample(r).layers[0].lossPercent,null);
});
test('remote localId fallback works; wrong type/track cannot contaminate a layer',()=>{
 const r=report();delete r.get('out').remoteId;assert.equal(sample(r).layers[0].rttMs,43);r.get('remote').localId='other';assert.equal(sample(r).layers[0].rttMs,null);
});
test('one unrelated remote report cannot replace per-layer RTT',()=>{
 const r=report();r.set('other',{type:'remote-inbound-rtp',kind:'video',timestamp:1000,localId:'other',roundTripTime:10});assert.equal(sample(r).layers[0].rttMs,43);
});
test('counter reset, SSRC replacement and a sampling gap require a fresh baseline',()=>{
 const a=sample(report());for(const extra of [{time:4000,bytes:1,frames:1},{time:4000,bytes:1,frames:30},{time:4000,ssrc:2},{time:30000}]){const l=sample(report(extra),a.previous,extra.time).layers[0];assert.equal(l.fps,null);assert.equal(l.bitrate,null);assert.equal(l.state,'unknown');}
});
test('encodingIndex is used only when RID is absent; ambiguous mapping remains unknown',()=>{
 const r=report({rid:undefined,encodingIndex:2});assert.equal(sample(r,undefined,1000,encoding).layers.find(l=>l.id==='out').label,'HIGH (f)');delete r.get('out').encodingIndex;assert.equal(sample(r,undefined,1000,encoding).layers.find(l=>l.id==='out').rid,null);
});
test('RTX is excluded; missing counters and empty stats do not become zero',()=>{
 const r=report({bytesSent:undefined,framesSent:undefined});assert.equal(sample(r).layers[0].state,'unknown');assert.equal(sample(r).layers[0].bitrate,null);r.set('codec',{mimeType:'video/rtx'});r.get('out').codecId='codec';assert.equal(sample(r).layers.length,0);assert.deepEqual(sample(null).layers,[]);
});
test('only safe fields are retained, not arbitrary RTC content',()=>{
 const l=sample(report({address:'PRIVATE',token:'PRIVATE',sdp:'PRIVATE'})).layers;assert(!JSON.stringify(l).includes('PRIVATE'));
});
