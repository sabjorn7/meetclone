import assert from 'node:assert/strict';
import {removeUnfinishedUpload,removeCancelledResult} from '../src/_front/streams/uploadCancellation.js';
const original=globalThis.fetch;let calls=[],responses=[];
globalThis.fetch=async(url,options)=>{calls.push([url,options.method||'GET']);const r=responses.shift();if(r instanceof Error)throw r;return {status:r.status,ok:r.status>=200&&r.status<300,json:async()=>r.body};};
const opts={apiBaseUrl:'https://fixture.invalid',token:'fixture',uploadId:'session & one',previousVideoId:'old'};
try {
responses=[{status:204}];await removeUnfinishedUpload(opts);assert.equal(calls.length,1);assert(calls[0][0].includes('session%20%26%20one'));
calls=[];responses=[{status:404}];await removeUnfinishedUpload(opts);assert.equal(calls.length,1);
responses=[{status:404}];await assert.rejects(removeUnfinishedUpload({...opts,uncertainFinal:true}));
calls=[];responses=[{status:204}];await removeCancelledResult({...opts,uuid:'new'});assert(calls[0][0].endsWith('/new'));
for(const status of [401,403,500]){responses=[{status}];await assert.rejects(removeUnfinishedUpload(opts));}
responses=[new TypeError('offline')];await assert.rejects(removeUnfinishedUpload(opts));
await assert.rejects(removeCancelledResult({...opts,uuid:'old'}));

console.log('PASS cancel DELETE 204; absent 404; lost final response; old-video protection; auth/server/offline errors; uncertain final response; encoded session');
}finally{globalThis.fetch=original;}
