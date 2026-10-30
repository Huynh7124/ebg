import {defaultPackingPrint,packingPrintHtml} from '../shared/packing-print.js';
import {DatabaseSync} from 'node:sqlite';
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
 function client(){let cookie='',csrf='';return {async req(path,body,status=200){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const data=await response.json();if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)csrf=data.csrf;if(Array.isArray(status)){assert.ok(status.includes(response.status));return {status:response.status,data}}assert.equal(response.status,status,path+': '+JSON.stringify(data));return data},async login(name){await this.req('session');await this.req('login',{username:name})}}}
 const admin=client(),warehouse=client(),worker=client(),packer=client(),other=client(),worker2=client();await admin.login('admin');await warehouse.login('kho');await worker.login('giacong');await packer.login('donggoi');
 await admin.req('users',{name:'Đóng gói khác',username:'other_packer',role:'packer'});await other.login('other_packer');await admin.req('users',{name:'Gia công B',username:'worker_b',role:'processor'});await worker2.login('worker_b');const users=await admin.req('users'),processorId=users.find(u=>u.username==='giacong').id;
 const before=(await admin.req('data')).products,raw=before[0],output=before[1];let id;
 const action=(actor,step,body={},status=200)=>actor.req('packing-orders/'+id+'/'+step,body,status);
 await t.test('morning order is private and neither creation nor preparation moves inventory',async()=>{
  const order={reference:'ORDER-TEST',orderDate:'2026-10-26',dueDate:new Date(Date.now()+3600000).toISOString(),items:[{productId:output.id,quantity:10}]};
  await worker.req('packing-orders',order,403);await packer.req('packing-orders',{...order,orderDate:'2026-02-30'},400);id=(await packer.req('packing-orders',order)).id;
  assert.equal((await other.req('packing-orders')).length,0);assert.equal((await worker.req('packing-orders')).length,0);
  await action(packer,'prepare',{processorId},403);await action(warehouse,'prepare',{processorId},400);
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:10}]});assert.deepEqual((await admin.req('data')).products,before);assert.equal((await worker.req('packing-orders')).length,0);
 });
 await t.test('packing print forms persist for warehouse without changing stock or assigning workers',async()=>{
  const original=(await packer.req('packing-orders')).find(r=>r.id===id);
  for(const type of ['pickup','production']){
   const draft=defaultPackingPrint(original,before,users,type);draft.receiver='Tên trên giấy';draft.lines[0].note='<script>test</script>';
   await action(other,'print-forms/'+type,draft,403);await action(worker,'print-forms/'+type,draft,403);
   await action(packer,'print-forms/'+type,{...draft,date:'2026-02-30'},400);
   await action(packer,'print-forms/'+type,{...draft,lines:[]},400);
   const saved=(await action(packer,'print-forms/'+type,{...draft,lines:draft.lines.map(l=>({...l,name:'Fake'}))})).form;
   assert.equal(saved.lines[0].quantity,10);assert.equal(saved.lines[0].name,type==='pickup'?raw.name:output.name);
   const warehouseOrder=(await warehouse.req('packing-orders')).find(r=>r.id===id);
   assert.deepEqual(warehouseOrder.printForms[type],saved);assert.equal(warehouseOrder.status,original.status);assert.equal(warehouseOrder.processorId,null);
   const html=packingPrintHtml(saved,type);assert.ok(html.includes('&lt;script&gt;test&lt;/script&gt;'));assert.ok(!html.includes(output.code));
   await action(warehouse,'print-forms/'+type,{...saved,receiver:'Kho cập nhật'});
   assert.equal((await packer.req('packing-orders')).find(r=>r.id===id).printForms[type].receiver,'Kho cập nhật');
  }
  const current=(await packer.req('packing-orders')).find(r=>r.id===id);
  const pickup=current.printForms.pickup,production=current.printForms.production;
  await action(packer,'print-forms/pickup',{...pickup,lines:pickup.lines.map(l=>({...l,quantity:8}))});
  let changed=(await warehouse.req('packing-orders')).find(r=>r.id===id);assert.equal(changed.status,'pending');assert.equal(changed.inputs.length,0);assert.equal(changed.pickupItems[0].quantity,8);
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:10}]},400);
  await action(warehouse,'prepare',{inputs:[{productId:output.id,quantity:8}]},400);
  await action(packer,'print-forms/production',{...production,lines:production.lines.map(l=>({...l,quantity:12}))});
  changed=(await warehouse.req('packing-orders')).find(r=>r.id===id);assert.equal(changed.items[0].quantity,12);assert.equal(changed.pickupItems[0].quantity,8);
  await action(packer,'print-forms/production',production);await action(packer,'print-forms/pickup',pickup);
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:10}]});
  assert.deepEqual((await admin.req('data')).products,before);
 });
 await t.test('warehouse issues to packing; owner dispatches once and a processor claims the shared queue',async()=>{
  await action(worker,'finish',{},403);await action(packer,'issue',{},403);await action(warehouse,'issue');await action(warehouse,'issue',{},400);
  const issued=(await packer.req('packing-orders')).find(r=>r.id===id);
  await action(packer,'print-forms/pickup',{...issued.printForms.pickup,lines:issued.printForms.pickup.lines.map(l=>({...l,quantity:1}))},409);
  assert.equal((await warehouse.req('packing-orders')).find(r=>r.id===id).inputs[0].quantity,issued.pickupItems[0].quantity);
  let products=(await admin.req('data')).products;assert.equal(products.find(p=>p.id===raw.id).stock,raw.stock-10);assert.equal(products.find(p=>p.id===raw.id).inProduction,raw.inProduction);assert.equal(products.find(p=>p.id===raw.id).withPacking,raw.withPacking+10);
  assert.equal((await worker.req('packing-orders')).length,0);
  await action(worker,'accept',{},400);await action(packer,'send-processing',{},400);
  await action(other,'receive-materials',{},403);await action(warehouse,'receive-materials',{},403);
  await action(packer,'receive-materials');await action(packer,'receive-materials',{},400);
  await action(other,'send-processing',{},403);await action(worker,'send-processing',{},403);
  const transferred=await action(packer,'send-processing');assert.match(transferred.productionSlipCode,/GC-DGGC-/);await action(packer,'send-processing',{},400);
  await action(packer,'print-forms/production',{...issued.printForms.production,lines:issued.printForms.production.lines.map(l=>({...l,quantity:1}))},409);
  const ready=(await worker.req('packing-orders')).find(r=>r.id===id);assert.equal(ready.processorId,null);assert.equal(ready.status,'issued');
  assert.ok((await worker2.req('packing-orders')).some(r=>r.id===id));
  products=(await admin.req('data')).products;assert.equal(products.find(p=>p.id===raw.id).stock,raw.stock-10);assert.equal(products.find(p=>p.id===raw.id).withPacking,raw.withPacking);assert.equal(products.find(p=>p.id===raw.id).inProduction,raw.inProduction+10);
  await action(packer,'accept',{},403);await action(worker,'accept');await action(worker2,'accept',{},403);await action(worker,'accept',{},400);
  assert.ok(!(await worker2.req('packing-orders')).some(r=>r.id===id));await action(worker,'finish',{defects:[{productId:output.id,faulty:3,reason:'Lỗi'}]});await action(worker,'finish',{},400);
  products=(await admin.req('data')).products;assert.equal(products.find(p=>p.id===raw.id).inProduction,raw.inProduction);assert.equal(products.find(p=>p.id===output.id).inTransit,output.inTransit+7);assert.equal(products.find(p=>p.id===output.id).stock,output.stock);
 });
 await t.test('packing records partial good/faulty per SKU, rejecting excess, missing defect reason and other receivers',async()=>{
  const receive={token:'receive-1',items:[{productId:output.id,good:6,faulty:0}]};
  await action(other,'receive',receive,403);await action(worker,'receive',receive,403);await action(packer,'complete',{},400);
  await action(packer,'receive',{...receive,items:[{productId:output.id,good:11,faulty:0}]},400);await action(packer,'receive',{...receive,items:[{productId:output.id,good:6,faulty:2}]},400);
  await action(packer,'receive',receive);await action(packer,'receive',receive,400);await action(packer,'complete',{},400);
  let p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.stock,output.stock);assert.equal(p.faulty,output.faulty);assert.equal(p.inTransit,output.inTransit+1);
  await action(packer,'receive',{token:'receive-2',items:[{productId:output.id,good:1,faulty:0}]});const order=(await packer.req('packing-orders')).find(r=>r.id===id);assert.equal(order.status,'received');assert.equal(order.items[0].good,7);assert.equal(order.items[0].faulty,3);assert.equal(order.payload,undefined);await action(packer,'complete',{},400);await action(warehouse,'confirm-defects');
  await action(packer,'complete');await action(packer,'complete',{},400);p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.inTransit,output.inTransit);assert.equal(p.faulty,output.faulty+3);assert.equal(p.stock,output.stock);assert.equal((await packer.req('packing-orders'))[0].status,'completed');
 });
 await t.test('insufficient materials roll back the whole issue and do not expose another packer order',async()=>{
  id=(await packer.req('packing-orders',{reference:'SHORTAGE',orderDate:'2026-10-26',dueDate:new Date().toISOString(),items:[{productId:output.id,quantity:1}]})).id;
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:100000}]});const snapshot=(await admin.req('data')).products;
  await action(warehouse,'issue',{},400);assert.deepEqual((await admin.req('data')).products,snapshot);assert.equal((await packer.req('packing-orders')).find(r=>r.id===id).status,'prepared');assert.equal((await other.req('packing-orders')).length,0);
  assert.ok((await admin.req('ops/export')).packing_orders.some(row=>row.id===id));
 });

 await t.test('stock returns good products to warehouse once, with separate faulty receipts',async()=>{
  const snapshot=(await admin.req('data')).products.find(p=>p.id===output.id);
  const body={purpose:'stock',reference:'STOCK-TEST',orderDate:'2026-10-26',dueDate:new Date().toISOString(),items:[{productId:output.id,quantity:5}]};
  await packer.req('packing-orders',{...body,purpose:'invalid'},400);
  id=(await packer.req('packing-orders',body)).id;
  assert.equal((await warehouse.req('packing-orders')).find(r=>r.id===id).purpose,'stock');
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:5}]});
  await action(warehouse,'issue');await action(packer,'receive-materials');await action(packer,'send-processing');await action(worker,'accept');await action(worker,'finish',{defects:[{productId:output.id,faulty:1,reason:'Xước'}]});
  assert.equal((await admin.req('data')).products.find(p=>p.id===output.id).faulty,snapshot.faulty);await action(warehouse,'confirm-defects');
  const receive={token:'stock-partial',items:[{productId:output.id,good:2,faulty:0}]};
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

 await t.test('production declares faults and warehouse issue returns a printable receipt',async()=>{
  const before=(await admin.req('data')).products.find(p=>p.id===output.id);
  id=(await packer.req('packing-orders',{orderDate:'2026-10-26',items:[{productId:output.id,quantity:5}]})).id;
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:5}]});const issued=await action(warehouse,'issue');assert.ok(issued.receiptId);
  await action(packer,'receive-materials');await action(packer,'send-processing');await action(worker,'accept');await action(worker,'finish',{defects:[{productId:output.id,faulty:6,reason:'Lỗi'}]},400);
  await action(worker,'finish',{defects:[{productId:output.id,faulty:2}]},400);
  await action(worker,'finish',{defects:[{productId:output.id,faulty:2,reason:'Xước'}]});
  await action(worker,'finish',{defects:[]},400);
  let p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.faulty,before.faulty);
  assert.equal((await warehouse.req('packing-orders')).find(r=>r.id===id).defectReview,'pending');
  await action(packer,'confirm-defects',{},403);await action(worker,'confirm-defects',{},403);
  const confirmation=await action(warehouse,'confirm-defects');assert.ok(confirmation.faultyReceiptId);
  await action(warehouse,'confirm-defects',{},409);
  p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.faulty,before.faulty+2);assert.equal(p.inTransit,before.inTransit+3);
  await action(packer,'receive',{token:'bad',items:[{productId:output.id,good:0,faulty:1,reason:'Lỗi'}]},400);
  await action(packer,'receive',{token:'good',items:[{productId:output.id,good:3,faulty:0}]});await action(packer,'complete');
  p=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(p.faulty,before.faulty+2);assert.equal(p.inTransit,before.inTransit);
 });

 await t.test('two processors cannot claim the same unassigned job concurrently',async()=>{
  id=(await packer.req('packing-orders',{orderDate:'2026-10-26',items:[{productId:output.id,quantity:1}]})).id;
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:1}]});const issued=await action(warehouse,'issue');
  const data=await admin.req('data'),header=data.receipts.find(r=>r.id===issued.receiptId);assert.equal(JSON.parse(header.printData).receiver,'Đóng gói (Bên nhận)');
  await action(packer,'receive-materials');await action(packer,'send-processing');
  const results=await Promise.all([action(worker,'accept',{},[200,403]),action(worker2,'accept',{},[200,403])]);assert.deepEqual(results.map(r=>r.status).sort(),[200,403]);
  const order=(await admin.req('packing-orders')).find(r=>r.id===id);assert.equal(order.status,'working');assert.equal(order.events.filter(e=>e.action==='Gia công nhận việc').length,1);
 });
 await t.test('already issued legacy jobs remain with their assigned processor',async()=>{
  id=(await packer.req('packing-orders',{orderDate:'2026-10-26',items:[{productId:output.id,quantity:1}]})).id;
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:1}]});await action(warehouse,'issue');
  // Model a pre-upgrade issued row: inventory already belongs to production.
  const db=new DatabaseSync(join(root,'data','ebg.db'));
  try{db.exec('BEGIN IMMEDIATE');const payload=JSON.parse(db.prepare('SELECT payload FROM packing_orders WHERE id=?').get(id).payload);delete payload.flowVersion;
   db.prepare("UPDATE packing_orders SET status='issued',processorId=?,payload=? WHERE id=?").run(processorId,JSON.stringify(payload),id);
   db.prepare('UPDATE products SET withPacking=withPacking-1,inProduction=inProduction+1 WHERE id=?').run(raw.id);db.exec('COMMIT');
  }finally{db.close()}
  assert.ok((await worker.req('packing-orders')).some(r=>r.id===id));assert.ok(!(await worker2.req('packing-orders')).some(r=>r.id===id));
  await action(packer,'receive-materials',{},400);await action(worker2,'accept',{},403);
  await action(worker,'accept');await action(worker,'finish');await action(packer,'receive',{token:'legacy-return',items:[{productId:output.id,good:1,faulty:0}]});await action(packer,'complete');
  assert.equal((await packer.req('packing-orders')).find(r=>r.id===id).status,'completed');
 });

 await t.test('all-faulty job waits for warehouse and concurrent confirmations only credit once',async()=>{
  const before=(await admin.req('data')).products.find(p=>p.id===output.id);
  id=(await packer.req('packing-orders',{orderDate:'2026-10-30',items:[{productId:output.id,quantity:1}]})).id;
  await action(warehouse,'prepare',{inputs:[{productId:raw.id,quantity:1}]});await action(warehouse,'issue');await action(packer,'receive-materials');await action(packer,'send-processing');await action(worker,'accept');await action(worker,'finish',{defects:[{productId:output.id,faulty:1,reason:'Hỏng'}]});
  await action(packer,'complete',{},400);assert.equal((await admin.req('data')).products.find(p=>p.id===output.id).faulty,before.faulty);
  const outcomes=await Promise.all([action(warehouse,'confirm-defects',{},[200,409]),action(admin,'confirm-defects',{},[200,409])]);assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
  assert.equal((await admin.req('data')).products.find(p=>p.id===output.id).faulty,before.faulty+1);await action(packer,'complete');
  const repair=await warehouse.req('movements',{operation:'send_repair',source:'faulty',items:[{productId:output.id,quantity:1}]});assert.ok(repair.receiptId);
  const after=(await admin.req('data')).products.find(p=>p.id===output.id);assert.equal(after.faulty,before.faulty);assert.equal(after.stock,before.stock);assert.equal(after.repair,before.repair+1);
 });

});
