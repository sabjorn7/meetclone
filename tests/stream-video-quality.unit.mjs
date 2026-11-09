import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { videoProfile, roomVideoOptions, enableProfileCamera, captureWarning, availableResolutions } from '../src/_front/streams/videoQuality.js';
import { summarizeVideoStats } from '../src/_front/streams/videoStats.js';
import { connectPeerTubeQuality } from '../src/_front/streams/peerTubeQuality.js';

test('legacy defaults to HD, unknown saved/requested profiles fail closed', () => {
    assert.equal(videoProfile(null).id,'hd'); assert.equal(videoProfile(undefined).height,720);
    for(const bad of ['4k','1080p','__proto__','',0]) assert.throws(()=>videoProfile(bad));
});
test('capture, primary encoding and Egress profile agree; VP8 and adaptation retained', () => {
    for(const id of ['hd','full_hd']) {
        const p=videoProfile(id),r=roomVideoOptions(id);
        assert.equal(r.videoCaptureDefaults.resolution.height,p.height);
        assert.equal(r.publishDefaults.videoEncoding.maxFramerate,30);
        assert.equal(r.publishDefaults.videoEncoding.maxBitrate,p.cameraBitrate);
        assert.equal(r.publishDefaults.videoCodec,'vp8');assert(r.adaptiveStream&&r.dynacast&&r.publishDefaults.simulcast);
        const layers=r.publishDefaults.videoSimulcastLayers;
        assert(layers[0].height<layers[1].height&&layers[1].height<p.height);
    }
    assert.equal(videoProfile('full_hd').egressPreset,'H264_1080P_30');
    assert.equal(videoProfile('full_hd').egressBitrate,4500000);
});
test('unsupported camera resolution falls back without re-requesting denied permissions', async () => {
    const calls=[];const participant={async setCameraEnabled(enabled,options){calls.push(options);if(calls.length===1)throw Object.assign(new Error(),{name:'OverconstrainedError'});return 'working';}};
    assert.equal(await enableProfileCamera(participant,'full_hd'),'working');assert.equal(calls[1].resolution.height,360);
    await assert.rejects(enableProfileCamera({setCameraEnabled:async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});}},'full_hd'),{name:'NotAllowedError'});
    assert.match(captureWarning({width:1280,height:720},'full_hd'),/ниже/);
    assert.equal(captureWarning({width:1920,height:1080},'full_hd'),'');
});
test('actual available resolutions only, including conditional Auto; no fictional 1080p', () => {
    assert.deepEqual(availableResolutions([{id:-1},{id:3,height:'720',active:true},{id:4,height:360},{id:3,height:720}]),[{id:-1,label:'Авто',active:false},{id:3,label:'720p',active:true}]);
    assert.deepEqual(availableResolutions(null),[]);
});
const report=(time,bytes,packets=100,lost=2)=>new Map([
    ['video',{id:'video',type:'outbound-rtp',kind:'video',timestamp:time,framesSent:time/100,bytesSent:bytes,packetsSent:packets,frameWidth:1920,frameHeight:1080,framesPerSecond:29,remoteId:'remote',qualityLimitationReason:'bandwidth',address:'PRIVATE-IP',token:'PRIVATE-TOKEN'}],
    ['remote',{type:'remote-inbound-rtp',kind:'video',timestamp:time,localId:'video',fractionLost:lost===4?0.02:undefined,packetsLost:lost,roundTripTime:.08,jitter:.004}],
]);
test('bitrate needs two monotonic samples; RTT, losses and unavailable metrics stay distinct', () => {
    const a=summarizeVideoStats(report(1000,1000),undefined,{now:1000});assert.equal(a.layers[0].bitrate,null);assert.equal(a.layers[0].lossPercent,null);
    const b=summarizeVideoStats(report(3000,1001000,200,4),a.previous,{now:3000});assert.equal(b.layers[0].bitrate,4000000);assert.equal(b.layers[0].lossPercent,2);assert.equal(b.layers[0].rttMs,80);assert.equal(b.layers[0].jitterMs,4);
    assert.equal(summarizeVideoStats(report(100,10),b.previous).layers[0].bitrate,null);
    assert(!JSON.stringify(b.layers).includes('PRIVATE'));assert.equal(summarizeVideoStats(null).layers.length,0);
});
test('disabled quality controller cannot register listeners or post a handshake', () => {
    const host={addEventListener(){assert.fail('must not listen')},removeEventListener(){}};
    const iframe={get src(){assert.fail('must not read iframe')},get contentWindow(){assert.fail('must not contact player')}};
    assert.throws(()=>connectPeerTubeQuality(iframe,{window:host}),/disabled/);
});
test('repeat ready messages have no external quality listener to respond to', () => {
    const listeners=new Set(),calls=[];
    const host={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
    const target={postMessage:m=>calls.push(m)};
    assert.throws(()=>connectPeerTubeQuality({src:'https://player.invalid/embed',contentWindow:target},{window:host}),/disabled/);
    for(let i=0;i<2;i++)for(const fn of listeners)fn({origin:'https://player.invalid',source:target,data:JSON.stringify({method:'peertube::__ready',params:'ping'})});
    assert.equal(listeners.size,0);assert.equal(calls.length,0);
});
test('reopening an iframe never reinitializes a custom quality channel', () => {
    for(let i=0;i<3;i++)assert.throws(()=>connectPeerTubeQuality({src:'https://player.invalid/embed',contentWindow:{postMessage(){assert.fail('unexpected message')}}}),/disabled/);
    const s=fs.readFileSync(new URL('../src/_front/components/StreamViewer.vue',import.meta.url),'utf8');
    assert.match(s,/:src="src"/);assert(!s.includes('connectPeerTubeQuality'));assert(!s.includes('@load'));assert(!s.includes("searchParams.set('api'"));
});
test('backend profile contract is exactly the same module; admission precedes resource allocation', () => {
    const root=new URL('../reviews/2026-11-09-stream-quality/orchestrator/src/',import.meta.url);
    assert.equal(fs.readFileSync(new URL('videoQuality.mjs',root),'utf8'),fs.readFileSync(new URL('../src/_front/streams/videoQuality.js',import.meta.url),'utf8'));
    const s=fs.readFileSync(new URL('server.mjs',root),'utf8');
    assert(s.indexOf('const reservation = await reserveVideoStart')<s.indexOf('live = await createLive'));
    assert.match(s,/stream\.livekit_egress_id \? \(await getVideoRun\(stream\)\)\?\.profile \|\| 'hd'/);
});
