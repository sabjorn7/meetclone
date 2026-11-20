import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import vue from '@vitejs/plugin-vue';
const {chromium,webkit}=await import(process.env.MG_PLAYWRIGHT || '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs');
const root=path.resolve(new URL('..',import.meta.url).pathname);
const temp=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'mg-legal-browser-')));
const pages={'speaker-agreement':'SpeakerAgreementPage','speaker-agreement-appendix':'SpeakerAgreementAppendixPage',documents:'DocumentsPage',oferta:'OfertaPage',politica:'PoliticaPage',rekvizity:'RekvizityPage',soglashenie:'SoglasheniePage',podpiska:'PodpiskaPage',vozvrat:'VozvratPage',soglasie:'SoglasiePage','soglasie-rasprostranenie':'SoglasieRasprostraneniePage',cookie:'CookiePage'};
const prefix='/@fs'+root;
fs.writeFileSync(path.join(temp,'index.html'),'<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style><div id="app"></div><script type="module" src="/fixture.js"></script></html>');
fs.writeFileSync(path.join(temp,'fixture.js'),`import {createApp,h} from 'vue';import {createRouter,createWebHistory,RouterView} from 'vue-router';import Footer from '${prefix}/src/_front/chrome/AppFooter.vue';${Object.entries(pages).map(([p,c])=>`import ${c} from '${prefix}/src/_front/views/legal/${c}.vue';`).join('')}const router=createRouter({history:createWebHistory(),routes:[${Object.entries(pages).map(([p,c])=>`{path:'/${p}',component:${c}}`).join(',')}]});window.testRouter=router;createApp({render:()=>h('div',[h(RouterView),h(Footer)])}).use(router).mount('#app');`);
const server=await createServer({configFile:false,root:temp,plugins:[vue()],resolve:{alias:{vue:path.join(root,'node_modules/vue/dist/vue.esm-bundler.js'),'vue-router':path.join(root,'node_modules/vue-router/dist/vue-router.esm-bundler.js')}},server:{host:'127.0.0.1',port:0,fs:{allow:[temp,root,fs.realpathSync(path.join(root,'node_modules'))]}}});
await server.listen();const origin=server.resolvedUrls.local[0];let count=0;
try{for(const engine of [chromium,webkit]){
 const browser=await engine.launch(engine===chromium?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{});
 try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900}});const errors=[];
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const name of Object.keys(pages)){
  await page.goto(origin+name);await page.locator(name==='documents'?'.dp-list':'.lp-prose').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');
  const links=await page.locator('main a').evaluateAll(as=>as.map(a=>a.getAttribute('href')));
  for(const href of links){assert(href&&!/^(javascript|data):/i.test(href));if(href.startsWith('/'))assert(pages[new URL(href,origin).pathname.slice(1)],href);}
  count++;
 }
 for(const tab of ['','?tab=dogovor','?tab=kursy','?tab=unknown','?tab=meropriyatiya']){
  await page.goto(origin+'oferta'+tab);await page.locator('.lp-prose').waitFor();
  const text=await page.locator('.lp-prose').innerText();assert(text.includes('05 октября 2026'));assert(text.includes(tab.includes('meropriyatiya')?'НА УЧАСТИЕ В ОЧНЫХ':'на приобретение цифровых'));count++;
 }
 await page.evaluate(()=>window.testRouter.push('/oferta?tab=kursy'));await page.waitForFunction(()=>document.querySelector('.lp-prose').textContent.includes('на приобретение цифровых'));
 await page.getByRole('tab',{name:'Очные мероприятия'}).click();await page.waitForURL('**tab=meropriyatiya');
 await page.getByRole('tab',{name:'Для покупателей'}).click();await page.waitForURL('**tab=dogovor');
 await page.evaluate(()=>window.testRouter.push('/oferta?tab=meropriyatiya'));await page.waitForFunction(()=>document.querySelector('.lp-prose').textContent.includes('НА УЧАСТИЕ В ОЧНЫХ'));
 await page.locator('footer a[href="/oferta"]').click();await page.waitForFunction(()=>document.querySelector('.lp-prose').textContent.includes('на приобретение цифровых'));
 assert.equal(errors.length,0,errors.join('\n'));count++;
 await page.evaluate(()=>window.scrollTo(0,0));
 if(width===390&&engine===chromium)await page.screenshot({path:path.join(root,'reviews/2026-11-19-legal/mobile.png'),fullPage:false});
 console.log('PASS',engine.name(),width,'12 pages, 5 deep links, SPA tabs/footer, no overflow/errors');await context.close();
 }}finally{await browser.close();}
}console.log('PASS total scenarios',count);}finally{await server.close();}
