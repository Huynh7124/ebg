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
 await page.getByRole('heading',{name:'Đăng nhập',exact:true}).waitFor();
 assert.equal(await page.getByRole('dialog',{name:'Đăng nhập',exact:true}).count(),1);assert.equal(await page.locator('.login-art,.login-form').count(),0);assert.equal(await page.getByRole('button',{name:'Cài ứng dụng EBG'}).count(),0);assert.equal(await page.getByRole('textbox',{name:'Gmail',exact:true}).count(),1);await page.screenshot({path:'/tmp/ebg-simple-login-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/ebg-simple-login-desktop.png'});await page.setViewportSize({width:390,height:844});
 const brand=page.locator('.brand img').first();assert.equal(await brand.getAttribute('src'),'/brand/Asset-4.png.webp');assert.ok(await brand.evaluate(img=>img.complete&&img.naturalWidth>0));
 const logoResponse=await context.request.get('http://localhost:3195/brand/Asset-4.png.webp');assert.equal(logoResponse.status(),200);assert.equal(logoResponse.headers()['content-type'],'image/webp');
 const original=await readFile('public/brand/Asset-4.png.webp');assert.deepEqual(Buffer.from(await logoResponse.body()),original);const favicon=page.locator('link[rel="icon"][type="image/webp"]');assert.equal(await favicon.getAttribute('href'),'/brand/Asset-4.png.webp');assert.equal((await context.request.get('http://localhost:3195/icons/ebg-favicon-32.png')).status(),200);
 const manifest=await(await context.request.get('http://localhost:3195/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons){const r=await context.request.get('http://localhost:3195'+icon.src);assert.equal(r.status(),200);assert.equal(r.headers()['content-type'],'image/png')}
 await page.locator('[name=username]').fill('admin');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('heading',{name:'Tổng quan kho'}).waitFor();

 await page.getByRole('button',{name:'Cài ứng dụng EBG'}).click();await page.getByRole('dialog',{name:'Cài EBG lên thiết bị'}).waitFor();await page.getByRole('button',{name:'Đã hiểu'}).click();
 assert.equal(await page.locator('header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(194, 53, 56)');assert.equal(await page.locator('.header-logo').isVisible(),true);
 await page.setViewportSize({width:1440,height:1000});const band=await page.locator('header').boundingBox(),logoBand=await page.locator('.sidebar-brand').boundingBox();assert.equal(band.y,logoBand.y);assert.equal(band.height,logoBand.height);assert.ok(Math.abs(band.x-(logoBand.x+logoBand.width))<=1);await page.screenshot({path:'/tmp/ebg-red-header-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/ebg-red-header-mobile.png',fullPage:true});
 assert.equal(await page.locator('.page-heading h1 + p,.heading-dot').count(),0);
 assert.equal(await page.locator('.workspace,.welcome-banner,.help,.eyebrow,.live-dot,.live-label').count(),0);assert.equal(await page.locator('.sidebar-brand img').count(),1);

 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:/^Sản phẩm/}).click();
 for(const [name,unitType]of [['Bộ phanh đĩa Hope Tech 4','single'],['Nhông sau CNC 58T','double']]){await page.getByRole('button',{name,exact:true}).click();const productDialog=page.getByRole('dialog');await productDialog.locator('[name=unitType]').selectOption(unitType);await productDialog.getByRole('button',{name:'Lưu sản phẩm',exact:true}).click();await productDialog.waitFor({state:'hidden'})}
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
 await page.locator('[name=username]').fill('ui_staff');await page.locator('[name=password]').fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('heading',{name:'Tổng quan kho'}).waitFor();
 assert.equal(await page.locator('nav').getByRole('button',{name:'Nhân viên',exact:true}).count(),0);
 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:'Danh mục',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Thêm danh mục',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Sửa danh mục Phanh đã sửa',exact:true}).count(),0);

 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:'Nhập kho',exact:true}).click();await page.getByRole('button',{name:'Tạo phiếu nhập',exact:true}).click();dialog=page.getByRole('dialog');
 await page.setViewportSize({width:1440,height:1000});assert.ok((await dialog.boundingBox()).width>=1000);await page.setViewportSize({width:390,height:844});const formBox=await dialog.boundingBox();assert.ok(formBox.width>=370&&formBox.x>=0&&formBox.x+formBox.width<=390);
 assert.deepEqual(await dialog.locator('[name=operation] option').allTextContents(),['Nhập kho','Nhập lỗi']);assert.equal(await dialog.locator('[name=bucket],[name=status]').count(),0);
 await dialog.locator('[name=operation]').selectOption('receive_faulty');await dialog.getByRole('combobox',{name:'Lọc dòng xe trong phiếu',exact:true}).selectOption('Sur-Ron Light Bee');await dialog.getByRole('combobox',{name:'Lọc màu sắc trong phiếu',exact:true}).selectOption('Đen');await dialog.getByRole('combobox',{name:'Lọc Đơn Đôi trong phiếu',exact:true}).selectOption('single');assert.equal(await dialog.locator('[name=productId] option[value="1"]').count(),1);assert.equal(await dialog.locator('[name=productId] option[value="2"]').count(),0);await dialog.getByRole('combobox',{name:'Sản phẩm dòng 1',exact:true}).selectOption('1');await dialog.getByRole('spinbutton',{name:'Số lượng dòng 1',exact:true}).fill('2');await dialog.getByRole('combobox',{name:'Lọc dòng xe trong phiếu',exact:true}).selectOption('Talaria Sting');await dialog.getByRole('combobox',{name:'Lọc màu sắc trong phiếu',exact:true}).selectOption('Đỏ');await dialog.getByRole('combobox',{name:'Lọc Đơn Đôi trong phiếu',exact:true}).selectOption('double');assert.equal(await dialog.getByRole('combobox',{name:'Sản phẩm dòng 1',exact:true}).inputValue(),'1');
 await dialog.getByRole('button',{name:'Thêm sản phẩm',exact:true}).click();await dialog.getByRole('combobox',{name:'Sản phẩm dòng 2',exact:true}).selectOption('2');await dialog.getByRole('spinbutton',{name:'Số lượng dòng 2',exact:true}).fill('3');await dialog.getByRole('button',{name:'Thêm sản phẩm',exact:true}).click();await dialog.getByRole('button',{name:'Xóa dòng 3',exact:true}).click();assert.equal(await dialog.locator('.receipt-line').count(),2);
 await dialog.getByRole('button',{name:'Tạo phiếu nhập',exact:true}).click();dialog=page.getByRole('dialog',{name:/Chi tiết phiếu PN-/});await dialog.waitFor();
 const batchReceipt=page.locator('tbody tr').filter({has:page.getByRole('cell',{name:'Nhập lỗi',exact:true})});assert.equal(await batchReceipt.count(),1);await batchReceipt.getByText('2 loại sản phẩm',{exact:true}).waitFor();await page.screenshot({path:'/tmp/ebg-auto-receipt-mobile.png'});assert.equal(await dialog.locator('tbody tr').count(),2);await dialog.getByText('Tổng số lượng: 5',{exact:true}).waitFor();
 const csvDownload=page.waitForEvent('download');await dialog.getByRole('button',{name:'Xuất CSV phiếu',exact:true}).click();const downloaded=await csvDownload;const csv=await readFile(await downloaded.path(),'utf8');const codes=csv.split('\r\n').slice(1).map(row=>row.split(',')[0]);assert.equal(codes.length,2);assert.equal(new Set(codes).size,1);assert.ok(downloaded.suggestedFilename().startsWith('PN-'));
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.main').isVisible(),false);assert.equal(await dialog.isVisible(),true);await page.pdf({path:'/tmp/ebg-batch-receipt.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});await dialog.getByRole('button',{name:'Đóng',exact:true}).click();

 await page.getByRole('combobox',{name:'Lọc dòng xe trong phiếu',exact:true}).selectOption('Sur-Ron Light Bee');await page.getByRole('combobox',{name:'Lọc màu sắc trong phiếu',exact:true}).selectOption('Đỏ');await page.getByRole('heading',{name:'Không tìm thấy phiếu',exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Lọc dòng xe trong phiếu',exact:true}).selectOption('Talaria Sting');await page.getByRole('combobox',{name:'Lọc Đơn Đôi trong phiếu',exact:true}).selectOption('double');assert.equal(await batchReceipt.count(),1);await batchReceipt.getByText('2 loại sản phẩm',{exact:true}).waitFor();
 const filteredCsvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất phiếu CSV',exact:true}).click();const filteredFile=await filteredCsvDownload;const filteredCsv=await readFile(await filteredFile.path(),'utf8');assert.equal(filteredCsv.split('\r\n').length,3);assert.ok(filteredCsv.includes('Đơn/Đôi'));assert.ok(filteredCsv.includes('BRK-001')&&filteredCsv.includes('DRV-002'));
 await page.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();
 await page.locator('.mobile-menu').click();await page.locator('nav').getByRole('button',{name:'Xuất kho',exact:true}).click();await page.getByRole('button',{name:'Tạo phiếu xuất',exact:true}).click();dialog=page.getByRole('dialog');assert.deepEqual(await dialog.locator('[name=operation] option').allTextContents(),['Xuất kho','Xuất kho đi Anode','Xuất kho đi sửa']);
 await dialog.locator('[name=operation]').selectOption('send_anode');await dialog.getByRole('combobox',{name:'Sản phẩm dòng 1',exact:true}).selectOption('1');await dialog.getByRole('spinbutton',{name:'Số lượng dòng 1',exact:true}).fill('1');await dialog.getByRole('button',{name:'Thêm sản phẩm',exact:true}).click();await dialog.getByRole('combobox',{name:'Sản phẩm dòng 2',exact:true}).selectOption('2');await dialog.getByRole('spinbutton',{name:'Số lượng dòng 2',exact:true}).fill('1');await dialog.getByRole('button',{name:'Tạo phiếu xuất',exact:true}).click();dialog=page.getByRole('dialog',{name:/Chi tiết phiếu PX-/});await dialog.waitFor();assert.equal(await dialog.locator('tbody tr').count(),2);await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
 const dispatch=page.locator('tbody tr').filter({has:page.getByRole('cell',{name:'Xuất kho đi Anode',exact:true})});await dispatch.getByRole('button',{name:'Nhận về kho',exact:true}).click();dialog=page.getByRole('dialog',{name:/Chi tiết phiếu PN-/});await dialog.waitFor();assert.equal(await dialog.locator('tbody tr').count(),2);await dialog.getByRole('button',{name:'Đóng',exact:true}).click();await dispatch.getByText('Hoàn tất',{exact:true}).waitFor();
 const cached=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys())for(const req of await(await caches.open(name)).keys())result.push(new URL(req.url).pathname);return result});
 assert.ok(cached.includes('/index.html'));assert.ok(cached.some(p=>p.endsWith('.js')));assert.ok(cached.every(p=>!p.startsWith('/api')&&!p.includes('/data/')));
 await context.setOffline(true);await page.getByRole('status').filter({hasText:'Bạn đang ngoại tuyến'}).waitFor();await page.reload();await page.getByRole('heading',{name:'Đăng nhập',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Tổng quan kho'}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: simple centered login dialog and authentication, vehicle/color/single-double filters, selection preserved and filtered full-receipt CSV, automatically opened receipts after inbound/outbound/return, multi-product receipt add/remove/grouping/detail/CSV/print/Anode return, admin employee/category create/edit/lock, staff controls hidden, production brand logo/favicon/manifest/icons, active service worker, install help, authenticated API stays out of cache, offline shell without inventory, mobile layout.');
}finally{
 await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true});
}
