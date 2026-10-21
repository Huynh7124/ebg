import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const root=await mkdtemp(join(tmpdir(),'ebg-pwa-'));
const password=randomBytes(16).toString('hex');
await cp('dist',join(root,'dist'),{recursive:true});
const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,PORT:'3195',INITIAL_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.on('exit',()=>{clearTimeout(timer);fail(Error('Server exited'))});child.stderr.resume()});
 browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3195');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await page.reload();
 assert.equal(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),true);
 const manifest=await(await context.request.get('http://localhost:3195/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const r=await context.request.get('http://localhost:3195'+icon.src);assert.equal(r.status(),200);assert.equal(r.headers()['content-type'],'image/png')}
 await page.getByRole('button',{name:'Cài ứng dụng EBG'}).click();await page.getByRole('dialog',{name:'Cài EBG lên thiết bị'}).waitFor();await page.getByRole('button',{name:'Đã hiểu'}).click();
 await page.locator('[name=username]').fill('admin');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('heading',{name:'Tổng quan kho.'}).waitFor();
 const cached=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys())for(const req of await(await caches.open(name)).keys())result.push(new URL(req.url).pathname);return result});
 assert.ok(cached.includes('/index.html'));assert.ok(cached.some(p=>p.endsWith('.js')));assert.ok(cached.every(p=>!p.startsWith('/api')&&!p.includes('/data/')));
 await context.setOffline(true);await page.getByRole('status').filter({hasText:'Bạn đang ngoại tuyến'}).waitFor();await page.reload();await page.getByRole('heading',{name:'Chào mừng trở lại'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Tổng quan kho.'}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: production manifest/icons, active service worker, install help, authenticated API stays out of cache, offline shell without inventory, mobile layout.');
}finally{
 await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true});
}
