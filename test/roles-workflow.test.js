import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,randomUUID} from 'node:crypto';

test('three roles enforce account delegation and warehouse ↔ processing workflow',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ebg-roles-')),password=randomBytes(20).toString('hex'),base='http://127.0.0.1:3228/api/';let log='';
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:dir,env:{...process.env,DATA_DIR:join(dir,'data'),PORT:'3228',INITIAL_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>log+=d);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(log||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(log))})});
 function client(){let cookie='',csrf='';return {async req(path,body,expected=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();if(path==='session'||path==='login')csrf=d.csrf;assert.equal(r.status,expected,path+': '+JSON.stringify(d));return d},async login(username){await this.req('session');return this.req('login',{username,password})}}}
 const admin=client(),warehouse=client(),worker=client(),other=client();await admin.login('admin');assert.equal((await warehouse.login('kho')).user.role,'warehouse');
 let workerId,otherId,warehouseId,raw,finished,workId;
 const request=(body,who=warehouse,expected=200)=>who.req('ops/requests',{type:'production',purpose:'stock',reference:'',destination:'Tổ gia công',assigneeId:workerId,dueDate:new Date(Date.now()+86400000).toISOString(),allowPartial:true,note:'',...body},expected);
 const action=(id,name,body={},who=warehouse,status=200)=>who.req(`ops/requests/${id}/${name}`,body,status);
 const product=async id=>(await admin.req('data')).products.find(p=>p.id===id);
 await t.test('warehouse creates and manages employees but cannot grant Admin or alter Admin',async()=>{
  await warehouse.req('users',{name:'Gia công A',username:'processor_a',password});await warehouse.req('users',{name:'Gia công B',username:'processor_b',password});
  const staff=await warehouse.req('users');assert.ok(staff.every(u=>u.role!=='admin'&&!('password' in u)));workerId=staff.find(u=>u.username==='processor_a').id;otherId=staff.find(u=>u.username==='processor_b').id;warehouseId=staff.find(u=>u.username==='kho').id;
  await worker.login('processor_a');await other.login('processor_b');assert.equal((await worker.req('session')).user.role,'processor');
  await warehouse.req('users',{name:'Escalation',username:'cannot_admin',password,role:'admin'},403);
  await warehouse.req(`users/${workerId}`,{name:'Gia công A',username:'processor_a',role:'admin'},403);
  await warehouse.req('ops/access',{userId:warehouseId,role:'admin'},403);
  const adminAccount=(await admin.req('users')).find(u=>u.role==='admin');await warehouse.req(`users/${adminAccount.id}`,{name:'No',username:'admin'},403);await warehouse.req(`users/${adminAccount.id}/lock`,{},403);
  await warehouse.req(`users/${otherId}/lock`,{});await other.req('data',undefined,401);await warehouse.req(`users/${otherId}/lock`,{});await other.login('processor_b');
 });
 await t.test('warehouse manages categories and BOM; processor cannot modify stock or create workshop orders',async()=>{
  await warehouse.req('categories',{name:'Nhóm thử vai trò',type:'accessory'});
  for(const [code,kind]of [['ROLE-RAW','raw'],['ROLE-FG','finished']])await warehouse.req('products',{name:code,code,category:'Nhóm thử vai trò',vehicle:'',color:'',min:0,materialKind:kind,unit:'cái'});
  const products=(await admin.req('data')).products;raw=products.find(p=>p.code==='ROLE-RAW').id;finished=products.find(p=>p.code==='ROLE-FG').id;
  await warehouse.req('movements',{operation:'receive_stock',items:[{productId:raw,quantity:10}]});await warehouse.req('ops/boms',{productId:finished,lines:[{productId:raw,quantity:2}]});
  for(const [path,body]of [['categories',{name:'Không cho',type:'vehicle'}],['products',{name:'Không cho'}],['movements',{operation:'receive_stock',items:[{productId:raw,quantity:1}]}],['ops/boms',{productId:finished,lines:[{productId:raw,quantity:1}]}],['users',{name:'No'}],['receipts/1/print',{printData:{}}],['ops/import/preview',{mode:'create',rows:[]}],['ops/purchases',{productId:raw,quantity:1,reason:'Không cho'}]])await worker.req(path,body,403);
  for(const type of ['production','anode','carbon','repair'])await request({type,outputs:[{productId:finished,quantity:1}]},worker,403);
 });
 await t.test('processor sees own order and stock jobs and can request materials, but warehouse issues them',async()=>{
  workId=(await request({purpose:'order',reference:'DON-SX-01',outputs:[{productId:finished,quantity:2}]})).id;
  const stockId=(await request({outputs:[{productId:finished,quantity:1}]})).id;
  const hidden=(await request({assigneeId:otherId,outputs:[{productId:finished,quantity:1}]})).id;
  const ops=await worker.req('ops');assert.ok(ops.requests.some(r=>r.id===workId&&r.purpose==='order'));assert.ok(ops.requests.some(r=>r.id===stockId&&r.purpose==='stock'));assert.ok(!ops.requests.some(r=>r.id===hidden));
  await action(workId,'issue',{},worker,403);await action(workId,'issue');assert.equal((await product(raw)).stock,6);await action(workId,'accept',{},other,403);await action(workId,'accept',{},worker);
  const extra=(await request({type:'supply',purpose:'order',reference:'DON-SX-01',parentId:workId,inputs:[{productId:raw,quantity:1}],outputs:[]},worker)).id;assert.equal((await product(raw)).stock,6);await action(extra,'issue');await action(extra,'accept',{},worker);assert.equal((await product(raw)).stock,5);
 });
 await t.test('reporting finished work does not add stock until warehouse QC',async()=>{
  const token=randomUUID();await action(workId,'report',{token,items:[{productId:finished,quantity:2}],note:'Sẵn sàng giao 2 bộ'},worker);
  assert.equal((await worker.req('ops')).requests.find(r=>r.id===workId).status,'ready');assert.equal((await product(finished)).stock,0);assert.equal((await product(raw)).inProduction,5);
  await action(workId,'report',{token,items:[{productId:finished,quantity:2}]},worker,400);await action(workId,'receive',{token:randomUUID(),items:[{productId:finished,good:2,faulty:0}]},worker,403);
  await action(workId,'receive',{token:randomUUID(),items:[{productId:finished,good:1,faulty:1}],defectReason:'Một bộ cần sửa'});await action(workId,'return',{items:[{productId:raw,quantity:1}],reason:'Vật tư bổ sung chưa sử dụng'});await action(workId,'close',{reason:'Đã nhận đủ, phần lỗi theo dõi riêng'});assert.equal((await product(finished)).stock,1);assert.equal((await product(finished)).faulty,1);
 });
 await t.test('processor requests order dispatch; warehouse receives the request, issues, then processor confirms',async()=>{
  const result=await request({type:'delivery',purpose:'order',reference:'DON-GIAO-01',destination:'Đội đi đơn',outputs:[{productId:finished,quantity:1}]},worker),id=result.id;
  assert.equal((await product(finished)).stock,1);assert.equal((await warehouse.req('ops')).requests.find(r=>r.id===id).status,'pending');await action(id,'issue',{},worker,403);await action(id,'issue',{},warehouse,400);await action(id,'approve');await action(id,'issue');assert.equal((await product(finished)).stock,0);assert.equal((await product(finished)).inTransit,1);await action(id,'accept',{},worker);assert.equal((await product(finished)).inTransit,0);assert.equal((await worker.req('ops')).requests.find(r=>r.id===id).status,'completed');
 });
 await t.test('Admin can assign every role; effective permission changes on existing sessions and last Admin remains protected',async()=>{
  const root=(await admin.req('users')).find(u=>u.username==='admin');await admin.req('ops/access',{userId:root.id,role:'processor',team:''},400);await admin.req(`users/${root.id}/lock`,{},400);
  await admin.req('ops/access',{userId:otherId,role:'warehouse',team:'Kho phụ'});assert.equal((await other.req('session')).user.role,'warehouse');await other.req('categories',{name:'Quyền sau phân vai',type:'vehicle'});
  await admin.req('ops/access',{userId:otherId,role:'processor',team:'Gia công'});assert.equal((await other.req('ops')).access.warehouse,false);await other.req('categories',{name:'Không còn quyền',type:'vehicle'},403);
  await admin.req('ops/access',{userId:otherId,role:'admin',team:'Quản trị'});assert.equal((await other.req('session')).user.role,'admin');await other.req('ops/access',{userId:warehouseId,role:'warehouse',team:'Kho'});
  await other.req('ops/access',{userId:root.id,role:'processor',team:''});await other.req('ops/access',{userId:otherId,role:'processor'},400);await other.req('ops/access',{userId:root.id,role:'admin',team:''});assert.equal((await admin.req('session')).user.role,'admin');
 });
});
