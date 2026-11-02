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
 await page.goto(url);await page.getByRole('button',{name:'Đăng nhập bằng kho',exact:true}).click();await page.getByRole('button',{name:'Tra / quét mã',exact:true}).click();
 const before=await(await context.request.get(url+'/api/data')).json();
 const select=page.getByLabel('Chọn mã để xem / in nhãn');
 for(const p of before.products.slice(0,2)){await select.selectOption(String(p.id));await page.getByRole('button',{name:'Thêm vào danh sách in',exact:true}).click()}
 const first=before.products[0],second=before.products[1];
 await page.getByLabel('Số tem '+first.name,{exact:true}).fill('2');
 await page.evaluate(()=>{const original=document.createElement.bind(document);document.createElement=function(...args){const el=original(...args);if(args[0]==='iframe'){const append=document.body.append.bind(document.body);document.body.append=function(...nodes){append(...nodes);for(const n of nodes)if(n===el)n.contentWindow.print=()=>{window.printedSheets=[...n.contentDocument.querySelectorAll('.label-sheet')].map(s=>s.children.length);window.printedLabels=[...n.contentDocument.querySelectorAll('.label')].map(l=>({code:l.querySelector('b').textContent,name:l.querySelector('p').textContent,qr:l.querySelector('svg').outerHTML}));};};}return el;};});
 await page.getByRole('button',{name:'In tất cả tem',exact:true}).click();await page.waitForFunction(()=>window.printedLabels?.length===3);
 const printed=await page.evaluate(()=>window.printedLabels);assert.deepEqual(printed.map(l=>l.code),[first.code,first.code,second.code]);assert.equal(printed[0].qr,printed[1].qr);assert.notEqual(printed[0].qr,printed[2].qr);
 assert.deepEqual(await page.evaluate(()=>window.printedSheets),[3]);
 for(const count of [19,20,40]){await page.getByLabel('Số tem '+first.name,{exact:true}).fill(String(count));await page.getByRole('button',{name:'In tất cả tem',exact:true}).click();await page.waitForFunction(n=>window.printedLabels.length===n,count+1);assert.deepEqual(await page.evaluate(()=>window.printedSheets),count===19?[20]:count===20?[20,1]:[20,20,1])}
 await page.getByLabel('Bố cục in tem').selectOption('roll');await page.getByRole('button',{name:'In tất cả tem',exact:true}).click();await page.waitForFunction(()=>window.printedSheets.length===0);assert.equal(await page.evaluate(()=>window.printedLabels.length),41);
 await page.getByLabel('Số tem '+first.name,{exact:true}).fill('500');assert.equal(await page.getByRole('button',{name:'In tất cả tem',exact:true}).isDisabled(),true);
 await page.getByLabel('Số tem '+first.name,{exact:true}).fill('0');assert.equal(await page.getByRole('button',{name:'In tất cả tem',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Xóa danh sách',exact:true}).click();assert.equal(await page.getByRole('button',{name:'In tất cả tem',exact:true}).isDisabled(),true);
 assert.deepEqual((await(await context.request.get(url+'/api/data')).json()).products,before.products);assert.deepEqual(errors,[]);
 console.log('PASS: multiple products, quantities, distinct QR, limits, clear list; inventory unchanged.');
}finally{await browser?.close();if(child.exitCode===null){child.kill();await new Promise(done=>child.once('exit',done))}await rm(root,{recursive:true,force:true})}
