import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';

test('warehouse exports stock work without assignee and one processor claims it with a return time',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-stock-work-')),base='http://127.0.0.1:3242/api/';let errors='';
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,REQUIRE_PASSWORD:'0',DATA_DIR:join(root,'data'),PORT:'3242'},stdio:['ignore','pipe','pipe']});child.stderr.on('data',data=>errors+=data);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(done=>child.once('exit',done))}await rm(root,{recursive:true,force:true})});
 await new Promise((done,fail)=>{const timeout=setTimeout(()=>fail(Error(errors||'Startup timeout')),15000);child.stdout.on('data',data=>{if(String(data).includes('server ready')){clearTimeout(timeout);done()}})});
 function client(){let cookie='',csrf='';return {async req(path,body,status=200){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const data=await response.json();if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)csrf=data.csrf;assert.equal(response.status,status,path+': '+JSON.stringify(data));return data},async login(name){await this.req('session');await this.req('login',{username:name})}}}
 const admin=client(),warehouse=client(),worker=client(),other=client(),packer=client();await admin.login('admin');await warehouse.login('kho');await worker.login('giacong');await packer.login('donggoi');
 await admin.req('users',{name:'Gia công stock khác',username:'stock_worker_2',role:'processor'});await other.login('stock_worker_2');
 const before=(await warehouse.req('data')).products[0],stage=Object.entries(before.stages).find(([,quantity])=>quantity>0)[0];
 const issued=await warehouse.req('movements',{operation:'send_stock',items:[{productId:before.id,quantity:2,stage}],note:'Làm bổ sung stock'});
 const after=(await warehouse.req('data')).products[0];assert.equal(after.stock,before.stock-2);assert.equal(after.inProduction,before.inProduction+2);assert.equal(after.stages[stage],before.stages[stage]-2);
 const receipt=(await warehouse.req('data')).receipts.find(row=>row.id===issued.receiptId);assert.equal(receipt.operation,'send_stock');assert.equal(receipt.status,'completed');
 const warehouseOrders=await warehouse.req('stock-work-orders'),workerOrders=await worker.req('stock-work-orders'),otherOrders=await other.req('stock-work-orders');
 assert.equal(warehouseOrders.length,1);assert.equal(workerOrders.length,1);assert.equal(otherOrders.length,1);assert.equal(workerOrders[0].processorId,null);assert.equal(workerOrders[0].returnAt,null);assert.equal(workerOrders[0].items[0].quantity,2);
 await packer.req('stock-work-orders',undefined,403);await warehouse.req('stock-work-orders/1/claim',{returnAt:new Date(Date.now()+3600000).toISOString()},403);await worker.req('stock-work-orders/1/claim',{returnAt:new Date(Date.now()-1000).toISOString()},400);
 const returnAt=new Date(Date.now()+86400000).toISOString();await worker.req('stock-work-orders/1/claim',{returnAt});await other.req('stock-work-orders/1/claim',{returnAt},400);
 assert.equal((await other.req('stock-work-orders')).length,0);const claimed=(await worker.req('stock-work-orders'))[0];assert.equal(claimed.status,'planned');assert.equal(claimed.returnAt,returnAt);assert.ok(claimed.processorId);
 assert.equal((await warehouse.req('ops/export')).stock_work_orders.length,1);
});
