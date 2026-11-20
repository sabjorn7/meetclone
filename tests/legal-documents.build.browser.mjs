import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.MG_PLAYWRIGHT || '/private/tmp/mg-browser-tools-kFSaYv/node_modules/playwright/index.mjs');
const root=path.resolve(new URL('../dist/',import.meta.url).pathname);
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.startsWith('/sb/')||u.pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');res.end('[]');return;}
 let f=path.join(root,decodeURIComponent(u.pathname));
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{const c=await b.newContext({serviceWorkers:'block'});await c.route('**/*',r=>r.request().method()==='GET'&&new URL(r.request().url()).origin===origin?r.continue():r.fulfill({status:200,contentType:'application/json',body:'[]'}));const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.name));
for(const route of ['speaker-agreement','speaker-agreement-appendix','documents','oferta','oferta?tab=kursy','oferta?tab=meropriyatiya','politica','rekvizity','soglashenie','podpiska','vozvrat','soglasie','soglasie-rasprostranenie','cookie']){
 const response=await p.goto(origin+'/'+route);assert.equal(response.status(),200);await p.locator(route==='documents'?'.dp-list':'.lp-prose').waitFor({timeout:30000});assert.equal(errors.length,0,errors.join(','));console.log('PASS full built app direct entry /'+route);
}
}finally{await b.close();await new Promise(r=>server.close(r));}
