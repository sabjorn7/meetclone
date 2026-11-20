import assert from 'node:assert/strict';
import {createUploadQueue} from '../src/_front/streams/uploadQueue.js';
const tick = () => new Promise(r => setTimeout(r, 0));
const until = async f => { for(let i=0;i<100;i++){if(f())return;await tick();}throw Error('timeout'); };
let owner='speaker', view=[], pending=[], writes=[], removed=[], failSave=false, invalid=new Set();
const queue=createUploadQueue({user:()=>owner,changed:v=>view=v,token:async()=> 'fixture',
 validate:async j=>{if(invalid.has(j.id))throw Error('missing');},
 persist:async(j,v)=>{if(failSave&&v.video_id)throw Error('db');writes.push({id:j.id,table:j.table,values:v});},
 size:async()=>123,
 removeSession:async j=>removed.push(j.uploadId),removeResult:async j=>removed.push(j.newUUID),
 upload:async opts=>{await opts.onInit('session-'+opts.file.name);return new Promise((resolve,reject)=>{
 const job={opts,finish:()=>resolve({uuid:'video-'+opts.file.name}),fail:()=>reject(Error('408'))};pending.push(job);
 opts.signal.addEventListener('abort',()=>reject(new DOMException('cancel','AbortError')),{once:true});});}
});
const add=(id)=>queue.enqueue({table:'lessons',row:{id,video_id:'old-'+id},courseId:'course1',title:id,file:{name:id,size:10}});
const a=add('a'),b=add('b'),c=add('c');await until(()=>pending.length===1);assert.equal(view[1].state,'queued');assert.throws(()=>add('b'));
pending[0].finish();await until(()=>pending.length===2);assert(writes.some(w=>w.id==='a'&&w.values.video_id==='video-a'));
pending[1].fail();await until(()=>pending.length===3);assert.equal(view.find(j=>j.key===b).state,'error');pending[2].finish();await until(()=>view.find(j=>j.key===c).state==='complete');
queue.retry(b);await until(()=>pending.length===4);pending[3].finish();await until(()=>view.find(j=>j.key===b).state==='complete');
assert.deepEqual(writes.filter(w=>w.values.video_id).map(w=>[w.id,w.values.video_id]),[['a','video-a'],['c','video-c'],['b','video-b']]);console.log('PASS sequential tasks, fixed lesson IDs, duplicate guard, failure isolation and retry');
const d=add('d'),e=add('e');queue.cancel(e);await until(()=>pending.length===5);assert.equal(view.find(j=>j.key===e).state,'cancelled');assert(!writes.some(w=>w.id==='e'));queue.cancel(d);await until(()=>view.find(j=>j.key===d).state==='cancelled');assert(removed.includes('session-d'));console.log('PASS queued cancel does not upload; active cancel removes only its session');
failSave=true;const f=add('f');await until(()=>pending.length===6);pending[5].finish();await until(()=>view.find(j=>j.key===f).state==='error');failSave=false;queue.retry(f);await until(()=>view.find(j=>j.key===f).state==='complete');assert.equal(pending.length,6);console.log('PASS save retry reuses result without reupload');
invalid.add('g');const g=add('g'),h=add('h');await until(()=>pending.length===7);assert.equal(view.find(j=>j.key===g).state,'error');assert.equal(pending[6].opts.file.name,'h');
owner='other';queue.accountChanged();await tick();assert.equal(view.length,0);assert(!writes.some(w=>w.id==='h'&&w.values.video_id));assert(!removed.includes('session-h'));owner='speaker';queue.accountChanged();assert.equal(view.find(j=>j.key===h).state,'interrupted');queue.dismiss(h);assert(!view.some(j=>j.key===h));console.log('PASS missing target rejected; account change aborts without cross-account writes/cleanup');
assert(view.every(j=>!('file' in j)&&!('token' in j)));console.log('PASS snapshots exclude file handles and credentials');
