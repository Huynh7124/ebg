import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {qrMatrix} from '../shared/qr.js';
const root=await mkdtemp(join(tmpdir(),'ebg-webcam-')),url='http://localhost:3236';await cp('dist',join(root,'dist'),{recursive:true});
const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,REQUIRE_PASSWORD:'0',DATA_DIR:join(root,'data'),PORT:'3236'},stdio:['ignore','pipe','pipe']});let browser,logs='';child.stderr.on('data',d=>logs+=d);
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(logs||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(logs))})});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
  window.BarcodeDetector=undefined;window.__webcam={stopped:0};
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
   const canvas=document.createElement('canvas');canvas.width=396;canvas.height=396;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,396,396);const stream=canvas.captureStream(15);
   window.__webcam.emit=matrix=>{ctx.fillStyle='white';ctx.fillRect(0,0,396,396);ctx.fillStyle='black';for(let y=0;y<matrix.length;y++)for(let x=0;x<matrix.length;x++)if(matrix[y][x])ctx.fillRect((x+4)*12,(y+4)*12,12,12);stream.getVideoTracks()[0].requestFrame?.()};
   const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);track.stop=()=>{window.__webcam.stopped++;stop()};ctx.fillRect(0,0,1,1);track.requestFrame?.();return stream;
  }});
 });
 await page.goto(url);await page.getByRole('button',{name:'Đăng nhập bằng admin',exact:true}).click();await page.getByRole('heading',{name:'Quản trị hệ thống',exact:true}).waitFor();const before=(await(await context.request.get(url+'/api/data')).json()).products;
 const header=page.locator('header');await header.getByRole('button',{name:'Nhập kho',exact:true}).click();await page.locator('.inbound-entry').waitFor();await header.getByRole('button',{name:'Xuất kho',exact:true}).click();await page.getByRole('heading',{name:'Xuất kho',exact:true}).waitFor();
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'width '+width);for(const name of ['Nhập kho','Xuất kho']){const box=await header.getByRole('button',{name,exact:true}).boundingBox();assert.ok(box.width>40&&box.x>=0&&box.x+box.width<=width,JSON.stringify({width,name,box}))}const box=await page.getByRole('searchbox',{name:'Tìm sản phẩm trên header',exact:true}).boundingBox();assert.ok(box.width>100)}
 for(const [width,pid]of [[1440,2],[390,1]]){
  await page.setViewportSize({width,height:900});if(width===390)await page.evaluate(()=>{window.BarcodeDetector=class{static async getSupportedFormats(){return ['qr_code']}async detect(){throw Error('Native decoder unavailable')}}});await header.getByRole('button',{name:'Quét mã QR',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Quét mã QR',exact:true});await dialog.getByText('Camera đang quét...',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>typeof window.jsQR),'function');await page.evaluate(matrix=>window.__webcam.emit(matrix),qrMatrix('EBG:'+pid));await page.getByRole('dialog').getByRole('heading',{name:before.find(p=>p.id===pid).name,exact:true}).waitFor({timeout:15000});await page.getByRole('button',{name:'Đóng',exact:true}).click();
 }
 assert.equal(await page.evaluate(()=>window.__webcam.stopped),2);assert.deepEqual((await(await context.request.get(url+'/api/data')).json()).products,before);await page.screenshot({path:'/tmp/ebg-header-stock-mobile.png'});
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập bằng giacong',exact:true}).click();await page.getByRole('heading',{name:'Gia công của tôi',exact:true}).waitFor();assert.equal(await header.getByRole('button',{name:'Nhập kho',exact:true}).count(),0);assert.equal(await header.getByRole('button',{name:'Xuất kho',exact:true}).count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: header intake/outbound actions, permissions, responsive widths, real JS QR decoder reading generated QR pixels from a video stream without BarcodeDetector at desktop/mobile widths, camera stopped and inventory unchanged.');
}finally{await browser?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true})}
