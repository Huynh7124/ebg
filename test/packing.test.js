import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {requestCode} from '../shared/operations.js';

test('packing daily requests and delegated warehouse roles retain approval and stock boundaries',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-packing-')),password=randomBytes(20).toString('hex'),base='http://127.0.0.1:3229/api/';let stderr='';
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,REQUIRE_PASSWORD:'1',DATA_DIR:join(root,'data'),PORT:'3229',INITIAL_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>stderr+=d);
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(stderr||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(stderr))})});
 function client(){let cookie='',csrf='';return {async req(path,body,expected=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();if(path==='session'||path==='login')csrf=data.csrf;assert.equal(r.status,expected,path+': '+JSON.stringify(data));return data},async login(username){await this.req('session');return this.req('login',{username,password})}}}
 const admin=client(),warehouse=client(),packer=client(),other=client(),peer=client();await admin.login('admin');await warehouse.login('kho');let packerId,otherId,peerId,id,before;
 const make=(extra={},who=packer,expected=200)=>who.req('ops/requests',{type:'delivery',purpose:'order',reference:'DON-SANG-01',destination:'Đội đóng gói',assigneeId:packerId,orderDate:'2026-10-25',dueDate:new Date(Date.now()+7200000).toISOString(),allowPartial:false,outputs:[{productId:1,quantity:2}],...extra},expected);
 const action=(rid,act,body={},who=warehouse,status=200)=>who.req(`ops/requests/${rid}/${act}`,body,status);
 const item=async()=>(await admin.req('data')).products.find(p=>p.id===1);
 await t.test('warehouse creates packing accounts and can delegate all employee roles, but not Admin',async()=>{
  for(const [username,role]of [['packing_a','packer'],['packing_b','packer'],['packing_peer','warehouse']])await warehouse.req('users',{name:username,username,role,password});
  const users=await warehouse.req('users');packerId=users.find(u=>u.username==='packing_a').id;otherId=users.find(u=>u.username==='packing_b').id;peerId=users.find(u=>u.username==='packing_peer').id;
  assert.equal((await packer.login('packing_a')).user.role,'packer');await other.login('packing_b');await peer.login('packing_peer');
  await warehouse.req('ops/access',{userId:peerId,role:'processor',team:'Gia công'});assert.equal((await peer.req('session')).user.role,'processor');await peer.req('ops/access',{userId:otherId,role:'warehouse'},403);
  await warehouse.req('ops/access',{userId:peerId,role:'packer',team:'Đóng gói'});assert.equal((await peer.req('session')).user.role,'packer');await warehouse.req('ops/access',{userId:peerId,role:'warehouse',team:'Kho'});assert.equal((await peer.req('ops')).access.manageRoles,true);
  await warehouse.req(`users/${peerId}`,{name:'Kho đồng nghiệp',username:'packing_peer',role:'processor'});assert.equal((await peer.req('session')).user.role,'processor');
  await warehouse.req('ops/access',{userId:packerId,role:'admin'},403);const owner=(await admin.req('users')).find(u=>u.role==='admin');await warehouse.req('ops/access',{userId:owner.id,role:'packer'},403);await warehouse.req(`users/${owner.id}`,{name:'No',username:'admin',role:'warehouse'},403);
 });
 await t.test('packing list keeps its business date and order reference without changing stock',async()=>{
  before=await item();id=(await make()).id;const r=(await warehouse.req('ops')).requests.find(r=>r.id===id);assert.equal(r.channel,'packing');assert.equal(r.orderDate,'2026-10-25');assert.equal(r.reference,'DON-SANG-01');assert.equal(requestCode(r),'DG-'+String(id).padStart(6,'0'));assert.equal(r.status,'pending');assert.equal((await item()).stock,before.stock);
  assert.ok((await packer.req('ops')).requests.some(r=>r.id===id));assert.ok(!(await other.req('ops')).requests.some(r=>r.id===id));
  await make({orderDate:'2026-02-30'},packer,400);await make({reference:''},packer,400);await make({assigneeId:otherId},packer,403);
 });
 await t.test('warehouse acknowledgement is separate from issue and neither step can be repeated',async()=>{
  await action(id,'approve',{},packer,403);await action(id,'issue',{},packer,403);await action(id,'issue',{},warehouse,400);assert.equal((await item()).stock,before.stock);
  await action(id,'approve');assert.equal((await item()).stock,before.stock);assert.equal((await warehouse.req('ops')).requests.find(r=>r.id===id).status,'approved');await action(id,'approve',{},warehouse,400);await action(id,'accept',{},packer,400);
  await action(id,'issue');assert.equal((await item()).stock,before.stock-2);assert.equal((await item()).inTransit,before.inTransit+2);await action(id,'issue',{},warehouse,400);
 });
 await t.test('only assigned packer confirms physical receipt; packing cannot mutate warehouse stock or processing',async()=>{
  await action(id,'accept',{},other,403);await action(id,'accept',{},packer);assert.equal((await item()).inTransit,before.inTransit);const delivered=(await packer.req('ops')).requests.find(r=>r.id===id);assert.equal(delivered.status,'completed');assert.equal(delivered.outputs[0].good,2);assert.equal(delivered.outputs[0].faulty,0);await action(id,'accept',{},packer,400);
  for(const type of ['production','repair','anode','carbon','supply'])await make({type},packer,403);
  for(const [path,body]of [['movements',{operation:'receive_stock',items:[{productId:1,quantity:1}]}],['products',{name:'Không cho'}],['ops/access',{userId:otherId,role:'warehouse'}],['users',{name:'Không cho'}]])await packer.req(path,body,403);
 });
 await t.test('approved packing request may be reassigned or cancelled before issue without inventing handoff',async()=>{
  const second=(await make({reference:'DON-SANG-02',outputs:[{productId:1,quantity:1}]})).id;const snapshot=(await item()).stock;await action(second,'approve');await action(second,'reassign',{assigneeId:otherId,reason:'Đổi ca đóng gói'});assert.equal((await warehouse.req('ops')).requests.find(r=>r.id===second).status,'approved');assert.equal((await item()).stock,snapshot);await action(second,'accept',{},other,400);await action(second,'issue');await action(second,'accept',{},other);
  const cancelled=(await make({reference:'DON-SANG-03'})).id;const stock=(await item()).stock;await action(cancelled,'approve');await action(cancelled,'cancel',{reason:'Đơn khách thay đổi'},packer);await action(cancelled,'issue',{},warehouse,400);assert.equal((await item()).stock,stock);
 });
});
