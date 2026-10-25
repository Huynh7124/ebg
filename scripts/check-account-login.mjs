import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdtemp,cp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';

const root=await mkdtemp(join(tmpdir(),'ebg-account-login-ui-')),url='http://localhost:3232';
await cp('dist',join(root,'dist'),{recursive:true});
const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,DATA_DIR:join(root,'data'),PORT:'3232',REQUIRE_PASSWORD:'0'},stdio:['ignore','pipe','pipe']});
let browser,logs='';child.stderr.on('data',d=>logs+=d);
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(logs||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(logs))})});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.getByRole('button',{name:'Đăng nhập bằng admin',exact:true}).waitFor();assert.equal(await page.locator('[type=password]').count(),0);
 const search=page.getByRole('searchbox',{name:'Tìm tài khoản đăng nhập'});await search.fill('dong goi');await page.getByRole('button',{name:'Đăng nhập bằng donggoi',exact:true}).waitFor();assert.equal(await page.locator('.login-account').count(),1);await search.fill('khong-co');await page.getByText('Không tìm thấy tài khoản phù hợp.',{exact:true}).waitFor();await search.fill('');
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
 await page.screenshot({path:'/tmp/ebg-account-login-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/ebg-account-login-mobile.png'});
 for(const [username,role]of [['admin','admin'],['kho','warehouse'],['giacong','processor'],['donggoi','packer']]){
  await page.getByRole('button',{name:'Đăng nhập bằng '+username,exact:true}).click();await page.getByRole('heading',{name:'Điều phối kho',exact:true}).waitFor();
  assert.equal((await(await context.request.get(url+'/api/session')).json()).user.role,role);
  assert.equal(await page.locator('.top-nav').getByRole('button',{name:'Nhân viên',exact:true}).count(),['admin','warehouse'].includes(role)?1:0);
  await page.reload();await page.getByRole('heading',{name:'Điều phối kho',exact:true}).waitFor();assert.equal((await(await context.request.get(url+'/api/session')).json()).user.role,role);
  if(username==='admin'){
   await page.getByRole('button',{name:'Tài khoản & bảo mật',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Đổi mật khẩu',exact:true}).count(),0);await page.getByRole('button',{name:'Đóng',exact:true}).click();
   await page.locator('.top-nav').getByRole('button',{name:'Nhân viên',exact:true}).click();await page.getByRole('button',{name:'Thêm nhân viên',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Thêm nhân viên'});assert.equal(await dialog.locator('[name=password]').count(),0);await dialog.getByRole('textbox',{name:'Họ tên',exact:true}).fill('Đóng gói mới');await dialog.getByRole('textbox',{name:'Tên đăng nhập',exact:true}).fill('new_packing');await dialog.getByRole('combobox',{name:'Vai trò',exact:true}).selectOption('packer');await dialog.getByRole('button',{name:'Lưu nhân viên'}).click();await dialog.waitFor({state:'hidden'});
  }
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập bằng admin',exact:true}).waitFor();assert.equal(await page.locator('[type=password]').count(),0);
 }
 await page.getByRole('button',{name:'Đăng nhập bằng new_packing',exact:true}).click();await page.getByText('Lên đơn đóng gói đầu ngày.',{exact:true}).waitFor();assert.equal((await(await context.request.get(url+'/api/session')).json()).user.role,'packer');
 assert.deepEqual(errors,[]);
 console.log('PASS: password-free account selection, all four roles, persistent sessions, logout, employee creation without passwords, new employee login, accent-insensitive search and responsive layout.');
}finally{
 await browser?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve))}await rm(root,{recursive:true,force:true});
}
