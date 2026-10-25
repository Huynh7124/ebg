import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

test('packing order passes through warehouse and production, then packing separates faulty inventory',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-packing-production-')),base='http://127.0.0.1:3234/api/';let errors='';
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,REQUIRE_PASSWORD:'0',DATA_DIR:join(root,'data'),PORT:'3234'},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>errors+=d);
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(errors||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(errors))})});
 function client(){let cookie='',csrf='';return {async req(path,body,status=200){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const data=await response.json();if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)csrf=data.csrf;assert.equal(response.status,status,path+': '+JSON.stringify(data));return data},async login(name){await this.req('session');await this.req('login',{username:name})}}}
 const admin=client(),warehouse=client(),worker=client(),packer=client(),other=client();await admin.login('admin');await warehouse.login('kho');await worker.login('giacong');await packer.login('donggoi');
 await admin.req('users',{name:'Đóng gói khác',username:'other_packer',role:'packer'});await other.login('other_packer');const users=await admin.req('users'),processorId=users.find(u=>u.username==='giacong').id;
 const before=(await admin.req('data')).products,raw=before[0],output=before[1];let id;
 const action=(actor,step,body={},status=200)=>actor.req('packing-orders/'+id+'/'+step,body,status);
 await t.test('morning order is private and neither creation nor preparation moves inventory',async()=>{
  const order={reference:'ORDER-TEST',orderDate:'2026-10-26',dueDate:new Date(Date.now()+3600000).toISOString(),items:[{productId:output.id,quantity:10}]};
  await worker.req('packing-orders',order,403);await packer.req('packing-orders',{...order,orderDate:'2026-02-30'},400);id=(await packer.req('packing-orders',order)).id;
  assert.equal((await other.req('packing-orders')).length,0);assert.equal((await worker.req('packing-orders')).length,0);
  await action(packer,'prepare',{processorId},403);await action(warehouse,'prepare',{processorId},400);
  await action(warehouse,'prepare',{processorId,inputs:[{productId:raw.id,quantity:10}]});assert.deepEqual((await admin.req('data')).products,before);assert.equal((await worker.req('packing-orders')).length,0);
 });
 await t.test('warehouse alone issues, assigned production alone accepts and finishes',async()=>{
  await action(worker,'finish',{},400);await action(packer,'issue',{},403);await action(warehouse,'issue');await action(warehouse,'issue',{},400);
  let products=(await admin.req('data')).products;assert.equal(products.find(p=>p.id===raw.id).stock,raw.stock-10);assert.equal(products.find(p=>p.id===raw.id).inProduction,raw.inProduction+10);
  assert.equal((await worker.req('packing-orders')).length,1);await action(packer,'accept',{},403);await action(worker,'accept');await action(worker,'finish');await action(worker,'finish',{},400);
  products=(await admin.req('data')).products;assert.equal(products.find(p=>p.id===raw.id).inProduction,raw.inProduction);assert.equal(products.find(p=>p.id===output.id).inTransit,output.inTransit+10);assert.equal(products.find(p=>p.id===output.id).stock,output.stock);
 });
 await t.test('packing records partial good/faulty per SKU, rejecting excess, missing defect reason and other receivers',async()=>{
  const receive={token:'receive-1',items:[{productId:output.id,good:6,faulty:2,reason:'Trầy bề mặt'}]};
  await action(other,'receive',receive,403);await action(worker,'receive',receive,403);await action(packer,'complete',{},400);
  await action(packer,'receive',{...receive,items:[{productId:output.id,good:11,faulty:0}]},400);await action(packer,'receive',{...receive,items:[{productId:output.id,good:6,faulty:2}]},400);
  await action(packer,'receive',receive);await action(packer,'receive',receive,400);await action(packer,'complete',{},400);
  let p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.stock,output.stock);assert.equal(p.faulty,output.faulty+2);assert.equal(p.inTransit,output.inTransit+2);
  await action(packer,'receive',{token:'receive-2',items:[{productId:output.id,good:1,faulty:1,reason:'Sai kích thước'}]});const order=(await packer.req('packing-orders')).find(r=>r.id===id);assert.equal(order.status,'received');assert.equal(order.items[0].good,7);assert.equal(order.items[0].faulty,3);assert.equal(order.payload,undefined);
  await action(packer,'complete');await action(packer,'complete',{},400);p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.inTransit,output.inTransit);assert.equal(p.faulty,output.faulty+3);assert.equal(p.stock,output.stock);assert.equal((await packer.req('packing-orders'))[0].status,'completed');
 });
 await t.test('insufficient materials roll back the whole issue and do not expose another packer order',async()=>{
  id=(await packer.req('packing-orders',{reference:'SHORTAGE',orderDate:'2026-10-26',dueDate:new Date().toISOString(),items:[{productId:output.id,quantity:1}]})).id;
  await action(warehouse,'prepare',{processorId,inputs:[{productId:raw.id,quantity:100000}]});const snapshot=(await admin.req('data')).products;
  await action(warehouse,'issue',{},400);assert.deepEqual((await admin.req('data')).products,snapshot);assert.equal((await packer.req('packing-orders')).find(r=>r.id===id).status,'prepared');assert.equal((await other.req('packing-orders')).length,0);
  assert.ok((await admin.req('ops/export')).packing_orders.some(row=>row.id===id));
 });

 await t.test('stock returns good products to warehouse once, with separate faulty receipts',async()=>{
  const snapshot=(await admin.req('data')).products.find(p=>p.id===output.id);
  const body={purpose:'stock',reference:'STOCK-TEST',orderDate:'2026-10-26',dueDate:new Date().toISOString(),items:[{productId:output.id,quantity:5}]};
  await packer.req('packing-orders',{...body,purpose:'invalid'},400);
  id=(await packer.req('packing-orders',body)).id;
  assert.equal((await warehouse.req('packing-orders')).find(r=>r.id===id).purpose,'stock');
  await action(warehouse,'prepare',{processorId,inputs:[{productId:raw.id,quantity:5}]});
  await action(warehouse,'issue');await action(worker,'accept');await action(worker,'finish');
  const receive={token:'stock-partial',items:[{productId:output.id,good:2,faulty:1,reason:'Xước'}]};
  await action(worker,'receive',receive,403);await action(packer,'receive',receive);await action(packer,'receive',receive,400);
  await action(packer,'complete',{},400);
  let p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.stock,snapshot.stock+2);assert.equal(p.faulty,snapshot.faulty+1);assert.equal(p.inTransit,snapshot.inTransit+2);
  await action(packer,'receive',{token:'stock-rest',items:[{productId:output.id,good:2,faulty:0}]});
  await action(packer,'complete');await action(packer,'complete',{},400);
  const data=await admin.req('data');p=data.products.find(p=>p.id===output.id);assert.equal(p.stock,snapshot.stock+4);assert.equal(p.faulty,snapshot.faulty+1);assert.equal(p.inTransit,snapshot.inTransit);
  const receipts=data.receipts.filter(r=>r.sourceReference==='packing:'+id);assert.equal(receipts.filter(r=>r.operation==='receive_stock').length,2);assert.equal(receipts.filter(r=>r.operation==='receive_faulty').length,1);
 });

 await t.test('packing creates an order with only date and products',async()=>{
  const created=await packer.req('packing-orders',{orderDate:'2026-10-26',items:[{productId:output.id,quantity:2}]});
  const order=(await warehouse.req('packing-orders')).find(r=>r.id===created.id);
  assert.equal(order.purpose,'order');assert.equal(order.dueDate,null);assert.equal(order.reference,'');assert.equal(order.note,'');assert.equal(order.status,'pending');
 });

});
