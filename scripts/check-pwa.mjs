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
const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,DATA_DIR:join(root,'data'),PORT:'3195',INITIAL_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.on('exit',()=>{clearTimeout(timer);fail(Error('Server exited'))});child.stderr.resume()});
 browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3195');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready});
 await page.reload();
 assert.equal(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),true);
 await page.getByRole('heading',{name:'Chào mừng trở lại'}).waitFor();
 const brand=page.locator('.brand img').first();assert.equal(await brand.getAttribute('src'),'/brand/ebg-logo.webp');assert.ok(await brand.evaluate(img=>img.complete&&img.naturalWidth>0));
 const logoResponse=await context.request.get('http://localhost:3195/brand/ebg-logo.webp');assert.equal(logoResponse.status(),200);assert.equal(logoResponse.headers()['content-type'],'image/webp');
 const favicon=page.locator('link[rel="icon"]');assert.equal(await favicon.getAttribute('href'),'/icons/favicon-32.png');assert.equal((await context.request.get('http://localhost:3195/icons/favicon-32.png')).status(),200);
 const manifest=await(await context.request.get('http://localhost:3195/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const r=await context.request.get('http://localhost:3195'+icon.src);assert.equal(r.status(),200);assert.equal(r.headers()['content-type'],'image/png')}
 await page.getByRole('button',{name:'Cài ứng dụng EBG'}).click();await page.getByRole('dialog',{name:'Cài EBG lên thiết bị'}).waitFor();await page.getByRole('button',{name:'Đã hiểu'}).click();
 await page.locator('[name=username]').fill('admin');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('heading',{name:'Tổng quan kho.'}).waitFor();

 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:'Nhân viên',exact:true}).click();
 await page.getByRole('button',{name:'Thêm nhân viên',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Thêm nhân viên'});await dialog.locator('[name=name]').fill('Nhân viên kiểm thử');await dialog.locator('[name=username]').fill('ui_staff');await dialog.locator('[name=password]').fill(password);await dialog.getByRole('button',{name:'Lưu nhân viên'}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Sửa nhân viên ui_staff',exact:true}).click();dialog=page.getByRole('dialog',{name:'Sửa nhân viên'});await dialog.locator('[name=name]').fill('Nhân viên đã sửa');await dialog.getByRole('button',{name:'Lưu nhân viên'}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Nhân viên đã sửa',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Khóa nhân viên ui_staff',exact:true}).click();await page.getByRole('button',{name:'Mở khóa nhân viên ui_staff',exact:true}).waitFor();
 await page.getByRole('button',{name:'Mở khóa nhân viên ui_staff',exact:true}).click();await page.getByRole('button',{name:'Khóa nhân viên ui_staff',exact:true}).waitFor();
 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:'Danh mục',exact:true}).click();
 await page.getByRole('button',{name:'Sửa danh mục Hệ thống phanh',exact:true}).click();dialog=page.getByRole('dialog');await dialog.locator('[name=name]').fill('Phanh đã sửa');await dialog.getByRole('button',{name:'Lưu danh mục'}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Khóa danh mục Phanh đã sửa',exact:true}).click();await page.getByRole('button',{name:'Mở khóa danh mục Phanh đã sửa',exact:true}).waitFor();
 await page.getByRole('button',{name:'Mở khóa danh mục Phanh đã sửa',exact:true}).click();await page.getByRole('button',{name:'Khóa danh mục Phanh đã sửa',exact:true}).waitFor();
 await page.locator('.mobile-menu').click();await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();
 await page.locator('[name=username]').fill('ui_staff');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('heading',{name:'Tổng quan kho.'}).waitFor();
 assert.equal(await page.locator('nav').getByRole('button',{name:'Nhân viên',exact:true}).count(),0);
 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:'Danh mục',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Thêm danh mục',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Sửa danh mục Phanh đã sửa',exact:true}).count(),0);
 const cached=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys())for(const req of await(await caches.open(name)).keys())result.push(new URL(req.url).pathname);return result});
 assert.ok(cached.includes('/index.html'));assert.ok(cached.some(p=>p.endsWith('.js')));assert.ok(cached.every(p=>!p.startsWith('/api')&&!p.includes('/data/')));
 await context.setOffline(true);await page.getByRole('status').filter({hasText:'Bạn đang ngoại tuyến'}).waitFor();await page.reload();await page.getByRole('heading',{name:'Chào mừng trở lại'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Tổng quan kho.'}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: admin employee/category create/edit/lock, staff controls hidden, production brand logo/favicon/manifest/icons, active service worker, install help, authenticated API stays out of cache, offline shell without inventory, mobile layout.');
}finally{
 await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true});
}
