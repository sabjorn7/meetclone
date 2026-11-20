// Actual App shell + course editor + queue runtime; all API and video traffic is mocked.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {build} from 'vite';
import vue from '@vitejs/plugin-vue';
const {chromium,webkit}=await import(process.env.MG_PLAYWRIGHT||'/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs');
const root=process.cwd(), temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mg-queue-browser-')));
fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'));
fs.writeFileSync(path.join(temp,'index.html'),'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="/main.js"></script>');
const mocks={
 'headerAccount.js':`export const getSupabase=()=>window.fixture.sb,readStoredSession=()=>({user:{id:window.fixture.uid}}),authCookieUser=()=>null,loadUser=async()=>({id:window.fixture.uid,role:'Спикер'}),isLikelyLoggedIn=()=>true;`,
 'peertubeUpload.js':`export const getUploadToken=async()=> 'fixture',fetchVideoSize=async()=>100,PEERTUBE_ORIGIN='https://video.invalid';export async function uploadVideo(opts){await opts.onInit('session-'+opts.file.name);return new Promise((resolve,reject)=>{const task={opts,finish:()=>resolve({uuid:'uuid-'+opts.file.name}),fail:()=>reject(Error('408'))};window.fixture.started.push(task);window.fixture.peak=Math.max(window.fixture.peak,++window.fixture.active);const done=()=>window.fixture.active--;const originalFinish=task.finish,originalFail=task.fail;task.finish=()=>{done();originalFinish();};task.fail=()=>{done();originalFail();};opts.signal.addEventListener('abort',()=>{done();reject(new DOMException('Cancelled','AbortError'));},{once:true});task.pause=()=>opts.pause.wait(opts.signal,()=>opts.onMetrics({phase:'paused',confirmedBytes:5,totalBytes:10})).catch(reject);opts.onProgress(50);opts.onMetrics({phase:'uploading',confirmedBytes:5,totalBytes:10,bytesPerSecond:null,updatedAt:performance.now()});});}`,
 'peertubeLive.js':`export const embedUrl=()=> 'about:blank',deleteLive=()=>{throw Error('unexpected delete');};`,
};
for(const name of ['AppHeader.vue','AppFooter.vue','AuthBanner.vue','InstallPrompt.vue'])mocks[name]='export default {template:"<div></div>"}';
fs.writeFileSync(path.join(temp,'main.js'),`
import {createApp} from 'vue';import {createRouter,createMemoryHistory} from 'vue-router';
import App from '${root}/src/_front/App.vue';import Editor from '${root}/src/_front/views/CoursesManagePage.vue';
const f=window.fixture={uid:'speaker',started:[],active:0,peak:0,deletes:[],writes:[],failSave:false,db:{course:[{id:'course1',Title:'Курс',owner:'speaker',ModStatus:'Черновик',Category:'Онлайн-курс',Less_Id:[],video_id:null}],lessons:[]}};
window.wwLib={$store:{getters:{}}};
const nativeFetch=window.fetch;window.fetch=(url,opts)=>{if(opts?.method==='DELETE'){f.deletes.push(String(url));return Promise.resolve({status:204});}return nativeFetch(url,opts);};
f.sb={auth:{onAuthStateChange:cb=>{f.auth=cb;return {data:{subscription:{unsubscribe(){}}}};}},from(table){let op='select',payload,filters=[];const q=new Proxy({}, {get(_,key){if(key==='then')return resolve=>{
 let rows=table==='users'?[{id:f.uid,courses:['course1']}]:f.db[table]||[];
 rows=rows.filter(r=>filters.every(([kind,k,v])=>kind==='in'?v.includes(r[k]):kind==='is'?(r[k]??null)===v:r[k]===v));
 if(op==='insert'){const row={...payload,id:'lesson'+(f.db.lessons.length+1),video_id:null};f.db[table].push(row);rows=[row];}
 if(op==='update'){if(f.failSave&&payload.video_id)return resolve({error:{message:'db'},data:null});rows.forEach(r=>Object.assign(r,payload));f.writes.push({table,ids:rows.map(r=>r.id),values:payload});}
 if(op==='delete'){f.db[table]=f.db[table].filter(r=>!rows.includes(r));}
 resolve({data:rows.map(r=>({...r})),error:null});};return (...args)=>{if(['insert','update','delete'].includes(key)){op=key;payload=args[0];}if(['eq','in','is'].includes(key))filters.push([key,...args]);return q;};}});return q;}};
const router=createRouter({history:createMemoryHistory(),routes:[{path:'/courses_manage',component:Editor},{path:'/catalog',component:{template:'<main><h1>Каталог</h1></main>'}}]});f.router=router;
await router.push('/catalog');await router.isReady();createApp(App).use(router).mount('#app');
`);
await build({configFile:false,root:temp,logLevel:'error',resolve:{alias:{'@':path.join(root,'src'),vue:path.join(root,'node_modules/vue/dist/vue.esm-bundler.js')}},plugins:[{name:'fixture',enforce:'pre',resolveId(id){const name=Object.keys(mocks).find(n=>id.endsWith(n));if(name)return '\0mock:'+name;},load(id){if(id.startsWith('\0mock:'))return mocks[id.slice(6)];}},vue()],build:{outDir:'dist'}});
const requests=[];
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');requests.push(u.pathname);const file=path.join(temp,'dist',u.pathname.startsWith('/assets/')?u.pathname:'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{for(const engine of [chromium,webkit]){
 const b=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 try{
 const c=await b.newContext({viewport:{width:1280,height:900}});await c.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.name));requests.length=0;
 await p.goto(origin);await p.getByRole('heading',{name:'Каталог'}).waitFor();assert(!requests.some(r=>/uploadQueueRuntime|UploadQueuePanel/.test(r)));assert.equal(await p.locator('.upload-queue').count(),0);console.log('PASS',engine.name(),'ordinary page does not load queue runtime/panel');
 await p.evaluate(()=>fixture.router.push('/courses_manage'));await p.locator('.pd-card--btn').first().click();
 for(let n=1;n<=3;n++){
  await p.getByRole('button',{name:'Добавить урок',exact:true}).click();await p.getByPlaceholder('Название урока').waitFor();
  await p.locator('.pd-modal--top input[accept="video/*"]').setInputFiles({name:'lesson'+n+'.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(10)});
  await p.locator('.upload-queue li').nth(n-1).waitFor();
  await p.locator('.pd-modal--top').getByRole('button',{name:'Закрыть',exact:true}).first().click();
 }
 await p.waitForFunction(()=>fixture.started.length===1);assert.equal(await p.evaluate(()=>fixture.peak),1);assert.equal(await p.getByText('В очереди',{exact:true}).count(),2);
 await p.getByRole('button',{name:'Отправить на модерацию',exact:true}).click();await p.getByText('Дождитесь загрузок этого курса',{exact:false}).waitFor();
 await p.evaluate(()=>fixture.router.push('/catalog'));await p.getByRole('heading',{name:'Каталог'}).waitFor();assert.equal(await p.locator('.upload-queue li').count(),3);console.log('PASS three lessons enqueued, editor closes, SPA navigation keeps queue; moderation guarded');
 const first=p.locator('.upload-queue li').nth(0);
 await first.getByRole('button',{name:'Пауза',exact:true}).click();await p.evaluate(()=>{void fixture.started[0].pause();});await first.getByText('На паузе — очередь ждёт продолжения').waitFor();assert.equal(await p.evaluate(()=>fixture.started.length),1);
 for(const width of [390,1280]){await p.setViewportSize({width,height:900});const panel=p.locator('.upload-queue');assert.equal(await panel.evaluate(el=>el.scrollWidth>el.clientWidth),false);await panel.screenshot({path:path.join(temp,engine.name()+'-'+width+'.png')});}
 await first.getByRole('button',{name:'Продолжить',exact:true}).click();await p.evaluate(()=>fixture.started[0].finish());await p.waitForFunction(()=>fixture.started.length===2);
 assert.equal(await p.evaluate(()=>fixture.db.lessons[0].video_id),'uuid-lesson1.mp4');await p.evaluate(()=>fixture.started[1].fail());await p.waitForFunction(()=>fixture.started.length===3);await p.evaluate(()=>fixture.started[2].finish());await p.waitForFunction(()=>fixture.db.lessons[2].video_id==='uuid-lesson3.mp4');
 assert.equal(await p.evaluate(()=>fixture.db.lessons[1].video_id),null);assert.equal(await p.evaluate(()=>fixture.peak),1);console.log('PASS pause/resume, sequential transfer, error skips to next lesson, IDs remain correct');
 await p.locator('.upload-queue li').nth(1).getByRole('button',{name:'Повторить',exact:true}).click();await p.waitForFunction(()=>fixture.started.length===4);await p.evaluate(()=>fixture.started[3].finish());await p.waitForFunction(()=>fixture.db.lessons[1].video_id==='uuid-lesson2.mp4');
 await p.evaluate(()=>fixture.router.push('/courses_manage'));await p.locator('.pd-card--btn').first().click();await p.locator('.pd-lessons .pd-iconbtn[aria-label="Изменить"]').nth(1).click();await p.locator('.pd-modal--top iframe').waitFor();console.log('PASS retry and reopened editor show saved lesson video');
 await p.locator('.pd-modal--top').getByRole('button',{name:'Закрыть',exact:true}).first().click();
 await p.getByRole('button',{name:'Добавить урок',exact:true}).click();await p.locator('.pd-modal--top input[accept="video/*"]').setInputFiles({name:'cancel.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(10)});await p.waitForFunction(()=>fixture.started.length===5);await p.evaluate(()=>fixture.router.push('/catalog'));p.on('dialog',d=>d.accept());await p.locator('.upload-queue li').last().getByRole('button',{name:'Отменить загрузку',exact:true}).click();await p.waitForFunction(()=>fixture.db.lessons[3].resume_video_id===null);assert.equal(await p.evaluate(()=>fixture.db.lessons[3].video_id),null);assert((await p.evaluate(()=>fixture.deletes.at(-1))).includes('session-cancel.mp4'));console.log('PASS cancellation from global panel after editor unmount');
 await p.evaluate(()=>fixture.router.push('/courses_manage'));await p.locator('.pd-card--btn').first().click();await p.getByRole('button',{name:'Добавить урок',exact:true}).click();await p.locator('.pd-modal--top input[accept="video/*"]').setInputFiles({name:'conflict.mp4',mimeType:'video/mp4',buffer:Buffer.alloc(10)});await p.waitForFunction(()=>fixture.started.length===6);await p.evaluate(()=>{fixture.db.lessons[4].video_id='other-tab-video';fixture.started[5].finish();});await p.locator('.upload-queue li').last().getByText('Нужна повторная попытка',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>fixture.db.lessons[4].video_id),'other-tab-video');const deletes=await p.evaluate(()=>fixture.deletes.length);await p.evaluate(()=>fixture.router.push('/catalog'));await p.locator('.upload-queue li').last().getByRole('button',{name:'Отменить загрузку',exact:true}).click();await p.locator('.upload-queue li').last().getByText('Не удалось удалить',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>fixture.deletes.length),deletes);console.log('PASS another-tab replacement is neither overwritten nor deleted');
 await p.evaluate(()=>{fixture.uid='other';fixture.auth('SIGNED_IN',{user:{id:'other'}});});await p.waitForFunction(()=>!document.querySelector('.upload-queue'));console.log('PASS account switch hides previous owner tasks');
 assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
 }finally{await b.close();}
}console.log('SCREENSHOTS',temp);}finally{await new Promise(r=>server.close(r));}
