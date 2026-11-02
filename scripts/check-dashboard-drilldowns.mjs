import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const root=await mkdtemp(join(tmpdir(),'ebg-qr-browser-')),url='http://localhost:3233';
await cp('dist',join(root,'dist'),{recursive:true});
const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,DATA_DIR:join(root,'data'),PORT:'3233',REQUIRE_PASSWORD:'0'},stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',data=>logs+=data);
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(logs||'Startup timeout')),15000);child.stdout.on('data',data=>{if(String(data).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(logs))})});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url);await page.getByRole('button',{name:'Đăng nhập bằng admin',exact:true}).click();await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();const data=await(await context.request.get(url+'/api/data')).json();
 await page.getByRole('button',{name:'Xem Hết hàng',exact:true}).click();await page.getByRole('heading',{name:'Sản phẩm',exact:true}).waitFor();assert.equal(await page.getByLabel('Lọc trạng thái sản phẩm').inputValue(),'empty');await page.waitForFunction(expected=>document.querySelector('.table-footer')?.textContent.includes(expected),String(data.products.filter(p=>!p.locked&&p.stock===0).length));assert.equal(await page.getByRole('dialog').count(),0);
 const emptyRaw=data.products.filter(p=>!p.locked&&p.stock===0&&p.materialKind==='raw').length,anodeRaw=data.products.filter(p=>p.anote>0&&p.materialKind==='raw').length,rawKind=page.getByRole('button',{name:/Nguyên vật liệu/}),allKinds=page.getByRole('button',{name:/Tất cả sản phẩm/});assert.match(await rawKind.textContent(),new RegExp(String(emptyRaw)+'\\s*$'));await rawKind.click();assert.equal(await page.getByLabel('Lọc trạng thái sản phẩm').inputValue(),'empty');await page.waitForFunction(expected=>document.querySelector('.table-footer')?.textContent.includes(expected),String(emptyRaw));await allKinds.click();
 await page.getByLabel('Lọc trạng thái sản phẩm').selectOption('anode');assert.match(await rawKind.textContent(),new RegExp(String(anodeRaw)+'\\s*$'));await rawKind.click();assert.equal(await page.getByLabel('Lọc trạng thái sản phẩm').inputValue(),'anode');await allKinds.click();await page.getByLabel('Lọc trạng thái sản phẩm').selectOption('empty');await page.goBack();await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:'Xem Sắp hết hàng',exact:true}).click();assert.equal(await page.getByLabel('Lọc trạng thái sản phẩm').inputValue(),'low');await page.waitForFunction(expected=>document.querySelector('.table-footer')?.textContent.includes(expected),String(data.products.filter(p=>!p.locked&&p.stock>0&&p.stock<=p.min).length));
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:'Xem Có hàng lỗi',exact:true}).click();assert.equal(await page.getByLabel('Lọc trạng thái sản phẩm').inputValue(),'faulty');
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();
 await page.getByRole('button',{name:/Kho đã xuất.*trong kỳ/}).click();await page.getByRole('dialog',{name:'Kho đã xuất',exact:true}).waitFor();await page.getByRole('dialog').getByRole('button',{name:'Đóng',exact:true}).click();
 const csrf=(await(await context.request.get(url+'/api/session')).json()).csrf;
 const post=async(path,body)=>{const response=await context.request.post(url+'/api/'+path,{data:body,headers:{'x-csrf-token':csrf}});assert.equal(response.ok(),true,await response.text());return response.json()};
 const [raw,semi,finished]=data.products.slice(0,3);for(const [p,kind]of [[raw,'raw'],[semi,'semi'],[finished,'finished']])await post('products',{...p,materialKind:kind});await post('ops/boms',{productId:semi.id,lines:[{productId:raw.id,quantity:2}]});
 await page.reload();await page.getByRole('button',{name:'Sản phẩm',exact:true}).click();await page.locator('tr').filter({has:page.getByRole('button',{name:finished.name,exact:true})}).locator('.row-more').click();const detail=page.getByRole('dialog');await detail.getByText('Đối chiếu / cập nhật cấu tạo',{exact:true}).click();await detail.getByRole('button',{name:'Thêm thành phần',exact:true}).click();await detail.getByLabel('Thành phần 1',{exact:true}).selectOption(String(semi.id));await detail.getByLabel('Số lượng trong 1 '+finished.unit,{exact:true}).fill('3');await detail.getByRole('button',{name:'Xác nhận lưu cấu tạo',exact:true}).click();await detail.waitFor({state:'hidden'});
 const updated=await(await context.request.get(url+'/api/data')).json();const r=updated.products.find(p=>p.id===raw.id);assert.equal(r.stock,raw.stock);assert.equal(r.embedded.inSemi,semi.stock*2);assert.equal(r.embedded.inFinished,finished.stock*6);assert.deepEqual(errors,[]);console.log('PASS dashboard drilldowns and reviewed nested composition; stock unchanged.');
}finally{await browser?.close();if(child.exitCode===null){child.kill();await new Promise(done=>child.once('exit',done))}await rm(root,{recursive:true,force:true})}
