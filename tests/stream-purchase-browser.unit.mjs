import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let source=await readFile(new URL('../src/_front/streams/streamsApi.js',import.meta.url),'utf8');
source=source.replace("from './videoQuality.js'",`from '${new URL('../src/_front/streams/videoQuality.js',import.meta.url).href}'`).replace("from './visibility.js'",`from '${new URL('../src/_front/streams/visibility.js',import.meta.url).href}'`).replace("import { deleteLive } from '@/_front/streams/peertubeLive.js';",'const deleteLive=()=>{throw Error("network forbidden")};');
globalThis.window={__mgGuestAuth:false};
const {purchaseStream}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const stream={id:'synthetic-stream',title:'Synthetic seminar',price:1000,backing_course_id:'synthetic-course'};
function fixture({promoValid=true,link='https://payform.ru/synthetic/',http=200,failStore=false}={}){
 const calls=[];const sb={functions:{invoke(){throw Error('Edge path must not be used')}},from(table){
  const q={table,operation:'select',body:null};let chain;
  chain=new Proxy({}, {get(_,key){if(key==='then')return resolve=>{calls.push(q);let response={data:[],error:null};
   if(q.operation==='select')response.count=0;
   if(q.operation==='insert')response.data=[{id:table==='shop'?'synthetic-shop':'synthetic-order'}];
   if(failStore&&table==='order'&&q.operation==='update')response.error={message:'synthetic denial'};
   resolve(response);};
   return (...args)=>{if(['insert','update','delete'].includes(key)){q.operation=key;q.body=args[0];}return chain;};}});return chain;
 },async rpc(name,args){calls.push({rpc:name,args});assert.equal(name,'preview_promo');return {data:{valid:promoValid,new_total:800,promo_id:'synthetic-promo',discount:200}};}};
 const run=async(code=null)=>{const previous=globalThis.fetch;globalThis.fetch=async(url,init)=>{calls.push({provider:new URL(url),init});return new Response(link,{status:http});};try{return await purchaseStream(sb,{buyer:'synthetic-buyer',stream,promoCode:code});}finally{globalThis.fetch=previous;}};
 return {calls,run};
}
test('stream payment uses browser merchant fetch, backing course and legacy order',async()=>{
 const f=fixture();assert.equal(await f.run(),'https://payform.ru/synthetic/');
 const p=f.calls.find(c=>c.provider);assert.equal(p.provider.origin,'https://meetguru.payform.ru');assert.equal(p.provider.searchParams.get('products[0][price]'),'1000');assert.equal(p.provider.searchParams.get('order_id'),'synthetic-order');assert(!p.init?.headers);
 const shop=f.calls.find(c=>c.table==='shop'&&c.operation==='insert');assert.equal(shop.body.course_id,stream.backing_course_id);assert.equal(shop.body.owner,'synthetic-buyer');
 const order=f.calls.find(c=>c.table==='order'&&c.operation==='insert');assert.deepEqual(order.body.course_positions,['synthetic-shop']);assert.equal(order.body.summ,1000);assert(!('paid' in order.body));
 assert(f.calls.some(c=>c.table==='order'&&c.operation==='update'&&c.body.pageUrl==='https://payform.ru/synthetic/'));
 assert(!f.calls.some(c=>['user_course','sales','users'].includes(c.table)));
});
test('stream promo uses existing server preview and persists matching discounted amounts',async()=>{
 const f=fixture();await f.run('SYNTHETIC');assert.equal(f.calls.find(c=>c.provider).provider.searchParams.get('products[0][price]'),'800');assert.equal(f.calls.find(c=>c.table==='order'&&c.operation==='insert').body.summ,800);assert(f.calls.some(c=>c.table==='shop'&&c.operation==='update'&&c.body.price===800));
});
test('invalid promo stops before order and provider',async()=>{const f=fixture({promoValid:false});await assert.rejects(f.run('INVALID'));assert(!f.calls.some(c=>c.provider||c.table==='order'));});
test('provider failure has no automatic retries or access grants',async()=>{const f=fixture({http:503});await assert.rejects(f.run());assert.equal(f.calls.filter(c=>c.provider).length,1);assert(!f.calls.some(c=>c.table==='order'&&c.operation==='update'));});
test('untrusted payment URLs are never saved',async()=>{for(const link of ['https://evil.invalid/','http://payform.ru/','https://payform.ru.evil.invalid/','https://user:pass@payform.ru/']){const f=fixture({link});await assert.rejects(f.run());assert(!f.calls.some(c=>c.table==='order'&&c.operation==='update'));}});
test('link save failure is surfaced rather than claiming checkout success',async()=>{await assert.rejects(fixture({failStore:true}).run(),/сохранить/);});
