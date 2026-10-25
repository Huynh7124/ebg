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
 const api=async(path,body)=>{const session=await(await context.request.get(url+'/api/session')).json(),response=body?await context.request.post(url+'/api/'+path,{headers:{'x-csrf-token':session.csrf},data:body}):await context.request.get(url+'/api/'+path);const data=await response.json();assert.equal(response.status(),200,path+': '+JSON.stringify(data));return data};
 let ownDispatch,otherDispatch;
 for(const [username,role,title]of [['admin','admin','Quản trị hệ thống'],['kho','warehouse','Điều hành kho'],['giacong','processor','Gia công của tôi'],['donggoi','packer','Đóng gói của tôi']]){
  await page.getByRole('button',{name:'Đăng nhập bằng '+username,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal((await(await context.request.get(url+'/api/session')).json()).user.role,role);
  assert.equal(await page.locator('.top-nav').getByRole('button',{name:'Nhân viên',exact:true}).count(),['admin','warehouse'].includes(role)?1:0);
  const expectedNav=['admin','warehouse'].includes(role)?[title,'Sản phẩm','Danh mục','Nhân viên','Lịch sử hoạt động']:[title,role==='processor'?'Tra cứu vật tư':'Tra cứu hàng'];
  assert.deepEqual(await page.locator('.top-nav button').allTextContents(),expectedNav);
  const dashboard={admin:'Đội ngũ theo vai trò',warehouse:'Yêu cầu cần kho xử lý',processor:'Việc mới kho giao',packer:'Hàng kho đã xuất, chờ tôi nhận'};
  await page.getByRole('heading',{name:dashboard[role],exact:true}).waitFor();
  if(['processor','packer'].includes(role)){assert.equal(await page.getByRole('button',{name:'Xuất báo cáo',exact:true}).count(),0);assert.equal(await page.getByRole('heading',{name:'Mặt hàng cần bổ sung',exact:true}).count(),0)}
  if(role==='processor'){await page.getByRole('button',{name:ownDispatch,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:otherDispatch,exact:true}).count(),0);await page.getByRole('button',{name:'Chờ tôi nhận việc',exact:false}).click();await page.getByRole('button',{name:ownDispatch,exact:true}).waitFor();await page.getByRole('button',{name:'Tổng quan',exact:true}).click()}
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,role+' at '+width)}
  await page.screenshot({path:'/tmp/ebg-workspace-'+role+'-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/ebg-workspace-'+role+'-mobile.png',fullPage:true});
  await page.reload();await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.equal((await(await context.request.get(url+'/api/session')).json()).user.role,role);
  if(username==='admin'){
   await page.getByRole('button',{name:'Tài khoản & bảo mật',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Đổi mật khẩu',exact:true}).count(),0);await page.getByRole('button',{name:'Đóng',exact:true}).click();
   await page.locator('.top-nav').getByRole('button',{name:'Nhân viên',exact:true}).click();await page.getByRole('button',{name:'Thêm nhân viên',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Thêm nhân viên'});assert.equal(await dialog.locator('[name=password]').count(),0);await dialog.getByRole('textbox',{name:'Họ tên',exact:true}).fill('Đóng gói mới');await dialog.getByRole('textbox',{name:'Tên đăng nhập',exact:true}).fill('new_packing');await dialog.getByRole('combobox',{name:'Vai trò',exact:true}).selectOption('packer');await dialog.getByRole('button',{name:'Lưu nhân viên'}).click();await dialog.waitFor({state:'hidden'});
   await api('users',{name:'Gia công khác',username:'other_processor',role:'processor'});const users=await api('users');
   for(const assignee of ['giacong','other_processor']){const request=await api('ops/requests',{type:'delivery',purpose:'order',allowPartial:false,reference:'ORDER-'+assignee,destination:'Bộ phận '+assignee,assigneeId:users.find(u=>u.username===assignee).id,dueDate:new Date(Date.now()+3600000).toISOString(),outputs:[{productId:1,quantity:1}]});await api('ops/requests/'+request.id+'/approve',{});await api('ops/requests/'+request.id+'/issue',{});const code='YC-'+String(request.id).padStart(6,'0');if(assignee==='giacong')ownDispatch=code;else otherDispatch=code}
  }
  await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập bằng admin',exact:true}).waitFor();assert.equal(await page.locator('[type=password]').count(),0);
 }
 await page.getByRole('button',{name:'Đăng nhập bằng new_packing',exact:true}).click();await page.getByText('Lên đơn đóng gói đầu ngày.',{exact:true}).waitFor();assert.equal((await(await context.request.get(url+'/api/session')).json()).user.role,'packer');
 const manager=await browser.newContext();const session=await(await manager.request.get(url+'/api/session')).json();assert.equal((await manager.request.post(url+'/api/login',{headers:{'x-csrf-token':session.csrf},data:{username:'admin'}})).status(),200);const managerSession=await(await manager.request.get(url+'/api/session')).json(),users=await(await manager.request.get(url+'/api/users')).json();assert.equal((await manager.request.post(url+'/api/ops/access',{headers:{'x-csrf-token':managerSession.csrf},data:{userId:users.find(u=>u.username==='new_packing').id,role:'processor'}})).status(),200);
 await page.getByRole('button',{name:'Tải lại công việc'}).click();await page.getByRole('heading',{name:'Gia công của tôi',exact:true}).waitFor();await page.getByRole('button',{name:'Việc được giao',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Lên đơn đóng gói',exact:true}).count(),0);assert.deepEqual(await page.locator('.top-nav button').allTextContents(),['Gia công của tôi','Tra cứu vật tư']);await manager.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: four distinct role dashboards and navigation, personal work isolation, live role changes, password-free account selection, persistent sessions, employee creation and responsive layouts.');
}finally{
 await browser?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve))}await rm(root,{recursive:true,force:true});
}
