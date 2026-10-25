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
 await context.addInitScript(()=>{
  window.__qrTest={raw:'',mode:'ok',opened:0,stopped:0};
  window.BarcodeDetector=class{static async getSupportedFormats(){return ['qr_code']}async detect(){return window.__qrTest.raw?[{rawValue:window.__qrTest.raw}]:[]}};
  Object.defineProperty(HTMLMediaElement.prototype,'readyState',{configurable:true,get:()=>4});HTMLMediaElement.prototype.play=async()=>{};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
   const test=window.__qrTest;test.opened++;if(test.mode==='denied')throw new DOMException('Permission denied','NotAllowedError');
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;canvas.getContext('2d').fillRect(0,0,320,240);const stream=canvas.captureStream(10);
   for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{test.stopped++;stop()}}
   if(test.mode==='pending')await new Promise(resolve=>{test.release=resolve});return stream;
  }});
 });
 await page.goto(url);await page.getByRole('button',{name:'Đăng nhập bằng admin',exact:true}).click();await page.getByRole('heading',{name:'Quản trị hệ thống',exact:true}).waitFor();
 const before=(await(await context.request.get(url+'/api/data')).json()).products;
 const open=()=>page.locator('header').getByRole('button',{name:'Quét mã QR',exact:true}).click();
 const dialog=()=>page.getByRole('dialog',{name:'Quét mã QR',exact:true});
 await open();await dialog().getByText('Camera đang quét...',{exact:true}).waitFor();await page.evaluate(()=>{window.__qrTest.raw='UNKNOWN-PRODUCT'});await dialog().getByRole('alert').filter({hasText:'Không tìm thấy mã'}).waitFor();
 await page.evaluate(()=>{window.__qrTest.raw='EBG:1'});await page.getByRole('dialog').getByRole('heading',{name:before[0].name,exact:true}).waitFor();await page.waitForFunction(()=>window.__qrTest.stopped===1);await page.getByRole('button',{name:'Đóng',exact:true}).click();
 await page.evaluate(()=>{window.__qrTest.raw=''});await open();await dialog().getByText('Camera đang quét...',{exact:true}).waitFor();await page.getByRole('button',{name:'Đóng',exact:true}).click();await page.waitForFunction(()=>window.__qrTest.stopped===2);
 await page.evaluate(()=>{window.__qrTest.mode='pending'});await open();await page.waitForFunction(()=>!!window.__qrTest.release);await page.getByRole('button',{name:'Đóng',exact:true}).click();await page.evaluate(()=>{window.__qrTest.release()});await page.waitForFunction(()=>window.__qrTest.stopped===3);assert.equal(await dialog().count(),0);
 await page.evaluate(()=>{window.__qrTest.mode='denied'});await open();await dialog().getByRole('alert').filter({hasText:'Camera chưa được cấp quyền'}).waitFor();await dialog().getByRole('textbox',{name:'Mã QR / mã hàng',exact:true}).fill('brk-001');await dialog().getByRole('button',{name:'Tra cứu mã',exact:true}).click();await page.getByRole('dialog').getByRole('heading',{name:before[0].name,exact:true}).waitFor();await page.getByRole('button',{name:'Đóng',exact:true}).click();
 // The existing label screen uses the same camera lifecycle and scan mapping.
 await page.evaluate(()=>{window.__qrTest.mode='ok';window.__qrTest.raw=''});await page.getByRole('button',{name:'Tra / quét mã',exact:true}).click();await page.getByRole('button',{name:'Quét bằng camera',exact:true}).click();await page.getByText('Camera đang quét...',{exact:true}).waitFor();await page.evaluate(()=>{window.__qrTest.raw='EBG:2'});await page.getByRole('img',{name:'Mã QR '+before[1].code,exact:true}).waitFor();await page.waitForFunction(()=>window.__qrTest.stopped===4);assert.equal(await page.getByRole('region',{name:'Máy quét mã hàng'}).count(),0);
 // Unsupported cameras still accept keyboard scanners and manual codes for every role.
 await page.evaluate(()=>{window.BarcodeDetector=undefined;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:undefined})});
 for(const username of ['admin','kho','giacong','donggoi']){
  if(username!=='admin'){await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập bằng '+username,exact:true}).click()}
  await open();await dialog().getByRole('alert').filter({hasText:'Thiết bị chưa hỗ trợ'}).waitFor();
  if(username==='admin'){for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const search=await page.getByRole('searchbox',{name:'Tìm sản phẩm trên header',exact:true}).boundingBox();assert.ok(search.width>100,JSON.stringify({width,search}));const button=await page.locator('header').getByRole('button',{name:'Quét mã QR',exact:true}).boundingBox();assert.ok(button.width>=40&&button.x>=0&&button.x+button.width<=width)}await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/ebg-qr-mobile.png',fullPage:true})}
  await dialog().getByRole('textbox',{name:'Mã QR / mã hàng',exact:true}).fill('EBG:2');await dialog().getByRole('textbox',{name:'Mã QR / mã hàng',exact:true}).press('Enter');await page.getByRole('dialog').getByRole('heading',{name:before[1].name,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Chỉnh sửa sản phẩm',exact:true}).count(),['admin','kho'].includes(username)?1:0);await page.getByRole('button',{name:'Đóng',exact:true}).click();
 }
 assert.deepEqual((await(await context.request.get(url+'/api/data')).json()).products,before);assert.deepEqual(errors,[]);
 console.log('PASS: header QR button for four roles, simulated camera decode, unknown codes, denied/unsupported camera fallback, keyboard lookup, camera cleanup including late permission, label scanner reuse, responsive header and stock unchanged.');
}finally{await browser?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve))}await rm(root,{recursive:true,force:true})}
