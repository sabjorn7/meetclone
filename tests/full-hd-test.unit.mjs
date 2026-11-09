import test from 'node:test';
import assert from 'node:assert/strict';
import { fullHdAvailable } from '../src/_front/streams/streamQualityAccess.js';
test('global capability request has no stream, owner or grant identifier',async()=>{
 const calls=[];assert.equal(await fullHdAvailable({rpc:async(...args)=>{calls.push(args);return {data:{version:1,full_hd_enabled:true}};}}),true);
 assert.deepEqual(calls,[['stream_video_quality_capabilities']]);
});
test('only explicit global flag enables Full HD; personal grants cannot override it',async()=>{
 for(const data of [null,{version:1,full_hd_enabled:false},{version:2,full_hd_allowed:true},{version:1,full_hd_enabled:'true'}])assert.equal(await fullHdAvailable({rpc:async()=>({data})}),false);
});
test('RPC/transport failures fail closed without writes',async()=>{
 assert.equal(await fullHdAvailable({rpc:async()=>({data:{version:1,full_hd_enabled:true},error:{code:'offline'}})}),false);
 assert.equal(await fullHdAvailable({rpc:async()=>{throw Error('offline');}}),false);
});
