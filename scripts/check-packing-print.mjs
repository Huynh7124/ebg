const stockFlow=false;
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'ebg-packing-ui-')),url='http://localhost:3235';await cp('dist',join(root,'dist'),{recursive:true});
const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,REQUIRE_PASSWORD:'0',DATA_DIR:join(root,'data'),PORT:'3235'},stdio:['ignore','pipe','pipe']});let browser,logs='';child.stderr.on('data',d=>logs+=d);
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(logs||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(logs))})});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 const login=async name=>{if(await page.getByRole('button',{name:'Đăng xuất',exact:true}).count())await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập bằng '+name,exact:true}).click();await page.getByRole('region',{name:'Đơn đóng gói qua gia công',exact:true}).waitFor()};
 await login('donggoi');const before=(await(await context.request.get(url+'/api/data')).json()).products;
 await page.getByRole('button',{name:'Lên đơn đóng gói',exact:true}).click();await page.getByRole('dialog',{name:'Tạo đơn hàng đầu ngày',exact:true}).waitFor();await page.getByRole('button',{name:'Đóng tạo đơn hàng',exact:true}).click();await page.getByRole('button',{name:'Lên đơn đóng gói',exact:true}).click();await page.getByRole('dialog',{name:'Tạo đơn hàng đầu ngày',exact:true}).waitFor();const flow=page.getByRole('region',{name:'Đơn đóng gói qua gia công',exact:true});for(const name of ['purpose','reference','dueDate','note'])assert.equal(await flow.locator('[name='+name+']').count(),0);const picker=flow.getByRole('group',{name:'Nguyên vật liệu lấy từ kho',exact:true});await picker.getByRole('button',{name:/Bộ lọc chi tiết/}).click();assert.equal(await picker.getByLabel('Lọc thương hiệu',{exact:true}).locator('option').count(),11);await picker.getByLabel('Lọc thương hiệu',{exact:true}).selectOption('Ventus One');assert.deepEqual(await picker.getByLabel('Lọc dòng sản phẩm',{exact:true}).locator('option').allTextContents(),['Tất cả dòng sản phẩm','Ventus One','Ventus One Plus','Ventus V1+ Evo']);await picker.getByLabel('Lọc dòng sản phẩm',{exact:true}).selectOption('Ventus One Plus');await picker.getByLabel('Lọc thương hiệu',{exact:true}).selectOption('Surron');assert.equal(await picker.getByLabel('Lọc dòng sản phẩm',{exact:true}).inputValue(),'');await picker.getByLabel('Tìm tên hoặc mã sản phẩm trong phiếu').fill(before[0].name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d'));await picker.getByRole('button',{name:'Thêm '+before[0].name,exact:true}).click();assert.equal(await picker.getByRole('button',{name:'Đã chọn '+before[0].name,exact:true}).isDisabled(),true);assert.equal(await picker.getByRole('combobox',{name:'Nguyên vật liệu lấy từ kho 1',exact:true}).inputValue(),'1');await flow.getByRole('spinbutton',{name:'Nguyên vật liệu lấy từ kho số lượng 1',exact:true}).fill('10');await flow.getByRole('combobox',{name:'Sản phẩm cần làm 1',exact:true}).selectOption('2');await flow.getByRole('spinbutton',{name:'Sản phẩm cần làm số lượng 1',exact:true}).fill('10');await flow.getByRole('button',{name:'Gửi đơn cho kho chuẩn bị',exact:true}).click();await flow.getByRole('button',{name:'DGGC-000001',exact:true}).waitFor();

 for(const type of ['pickup','production']){
  await flow.getByRole('button',{name:type==='pickup'?'Phiếu lấy hàng / In':'Phiếu gia công / In',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:type==='pickup'?'Phiếu lấy hàng':'Phiếu gia công',exact:true});
  await dialog.getByLabel('Người đề nghị',{exact:true}).fill('Đóng gói kiểm thử');
  await dialog.getByText('Ghi chú trên phiếu',{exact:true}).click();await dialog.getByLabel('Ghi chú mặt hàng 1').fill('Kiểm đủ hàng trước khi giao');
  await dialog.getByRole('button',{name:'Lưu phiếu',exact:true}).click();await dialog.getByRole('status').waitFor();
  const frame=page.frameLocator('iframe');await frame.getByRole('heading',{name:type==='pickup'?'PHIẾU LẤY HÀNG Ở KHO':'PHIẾU GIA CÔNG',exact:true}).waitFor();
  assert.equal(await frame.locator('tbody tr').count(),type==='pickup'?15:12);
  assert.equal(await frame.locator('tbody tr').first().locator('td').nth(1).innerText(),before[type==='pickup'?0:1].name);
  const picker=dialog.locator('.packing-line-picker');await picker.getByRole('button',{name:/Bộ lọc chi tiết/}).click();assert.equal(await picker.getByLabel('Lọc thương hiệu',{exact:true}).locator('option').count(),11);await picker.getByLabel('Tìm tên hoặc mã sản phẩm trong phiếu').fill('KHONG_CO_SAN_PHAM_NAY');assert.equal(await picker.locator('.ops-line select').first().inputValue(),String(before[type==='pickup'?0:1].id));await picker.getByRole('button',{name:'Xóa lọc',exact:true}).click();
  assert.ok((await frame.locator('body').innerText()).includes('Kiểm đủ hàng trước khi giao'));
  await frame.locator('body').evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true}});
  await dialog.getByRole('button',{name:'Lưu và in phiếu',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.packing-print-preview iframe').contentWindow.__printed===true);
  const printPage=await context.newPage();await printPage.setContent(await dialog.locator('iframe').getAttribute('srcdoc'));await printPage.pdf({path:'/tmp/packing-'+type+'.pdf',preferCSSPageSize:true,printBackground:true});await printPage.close();
  await page.screenshot({path:'/tmp/packing-'+type+'-mobile.png',fullPage:true});
  await dialog.getByRole('button',{name:'Đóng mẫu phiếu',exact:true}).click();
 }
 await login('kho');await page.locator('.top-nav').getByRole('button',{name:'Sản phẩm',exact:true}).click();const warehouseBrands=await page.getByLabel('Lọc thương hiệu',{exact:true}).locator('option').allTextContents();const warehouseModels=await page.getByLabel('Lọc dòng sản phẩm',{exact:true}).locator('option').allTextContents();await page.locator('header').getByRole('button',{name:'Xuất kho',exact:true}).click();
 await flow.getByRole('button',{name:'Phiếu lấy hàng / In',exact:true}).click();
 assert.deepEqual(await page.getByRole('dialog',{name:'Phiếu lấy hàng',exact:true}).getByLabel('Lọc thương hiệu',{exact:true}).locator('option').allTextContents(),warehouseBrands);assert.deepEqual(await page.getByRole('dialog',{name:'Phiếu lấy hàng',exact:true}).getByLabel('Lọc dòng sản phẩm',{exact:true}).locator('option').allTextContents(),warehouseModels);
 assert.equal(await page.getByRole('dialog',{name:'Phiếu lấy hàng',exact:true}).getByLabel('Người đề nghị',{exact:true}).inputValue(),'Đóng gói kiểm thử');
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);console.log('PASS: packing saves both forms, warehouse sees saved data, correct preview rows, PDFs and mobile layout');
}finally{await browser?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true})}
