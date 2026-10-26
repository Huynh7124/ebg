import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {setupStockStages,changeStock} from '../server/stock-stages.js';

test('existing stock migrates once by type and stock triggers keep legacy writes balanced',()=>{
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE products(id INTEGER PRIMARY KEY,materialKind TEXT,stock INTEGER);CREATE TABLE movements(id INTEGER PRIMARY KEY);INSERT INTO products VALUES(1,'raw',10),(2,'semi',12),(3,'finished',14),(4,'unclassified',16)");const app={post(){}};setupStockStages(app,db,()=>{});
 const snapshot=()=>db.prepare('SELECT * FROM product_stage_stock ORDER BY productId,stage').all();assert.deepEqual(snapshot().map(x=>[x.stage,x.quantity]),[['raw',10],['semi',12],['finished',14],['unclassified',16]]);const original=snapshot();setupStockStages(app,db,()=>{});assert.deepEqual(snapshot(),original);
 db.exec('UPDATE products SET stock=stock-2 WHERE id=1');assert.equal(snapshot()[0].quantity,8);
 db.exec('BEGIN');changeStock(db,1,3,'finished');db.exec('COMMIT');assert.throws(()=>db.exec('UPDATE products SET stock=stock-1 WHERE id=1'),/STAGE_SELECTION_REQUIRED/);assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock,11);
 db.exec('BEGIN');assert.throws(()=>changeStock(db,1,-4,'finished'));db.exec('ROLLBACK');assert.equal(db.prepare('SELECT COUNT(*) n FROM stock_stage_context').get().n,0);db.close();
});
test('stage transfers, selected-stage movements, repair returns and permissions preserve totals',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-stages-')),base='http://127.0.0.1:3241/api/';let logs='';const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,REQUIRE_PASSWORD:'0',DATA_DIR:join(root,'data'),PORT:'3241'},stdio:['ignore','pipe','pipe']});child.stderr.on('data',x=>logs+=x);t.after(async()=>{child.kill();await new Promise(r=>child.once('exit',r));await rm(root,{recursive:true,force:true})});await new Promise((ok,fail)=>{const timeout=setTimeout(()=>fail(Error(logs)),15000);child.stdout.on('data',x=>{if(String(x).includes('server ready')){clearTimeout(timeout);ok()}})});
 function client(){let cookie='',csrf='';return {async req(path,body,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const d=await r.json();if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];if(d.csrf)csrf=d.csrf;assert.equal(r.status,status,JSON.stringify(d));return d},async login(name){await this.req('session');await this.req('login',{username:name})}}}
 const kho=client(),packer=client();await kho.login('kho');await packer.login('donggoi');
 const get=async()=>{const p=(await kho.req('data')).products[0];assert.equal(Object.values(p.stages).reduce((a,b)=>a+b,0),p.stock);return p};const initial=await get(),id=initial.id;
 const transfer=(source,destination,quantity,token)=>({source,destination,quantity,token});let body=transfer('unclassified','raw',5,'split');await packer.req('products/'+id+'/stage-transfer',body,403);await kho.req('products/'+id+'/stage-transfer',body);await kho.req('products/'+id+'/stage-transfer',body);assert.equal((await get()).stages.raw,5);assert.equal((await get()).stock,initial.stock);
 await kho.req('products/'+id+'/stage-transfer',transfer('raw','semi',6,'too-many'),400);await kho.req('products/'+id+'/stage-transfer',transfer('raw','semi',3,'semi'));await kho.req('products/'+id+'/stage-transfer',transfer('semi','finished',2,'tp'));assert.deepEqual((await get()).stages,{raw:2,semi:1,finished:2,unclassified:initial.stock-5});
 const move=(operation,quantity,stage)=>({operation,items:[{productId:id,quantity,stage}]});await kho.req('movements',move('issue_stock',1),400);await kho.req('movements',move('issue_stock',3,'finished'),400);await kho.req('movements',move('issue_stock',1,'finished'));assert.equal((await get()).stages.finished,1);
 await kho.req('movements',move('receive_stock',4,'semi'));const repair=await kho.req('movements',move('send_repair',2,'semi'));assert.equal((await get()).stages.semi,3);await kho.req('receipts/'+repair.receiptId+'/complete',{});assert.equal((await get()).stages.semi,5);
 const before=await get();await kho.req('movements',{operation:'issue_stock',items:[{productId:id,quantity:1,stage:'raw'},{productId:2,quantity:1000000,stage:'raw'}]},400);assert.deepEqual(await get(),before);await kho.req('products/'+id+'/stage-transfer',transfer('raw','raw',1,'same'),400);await kho.req('products/'+id+'/stage-transfer',transfer('raw','semi',1.5,'fraction'),400);await kho.req('products/'+id+'/stage-transfer',transfer('raw','semi',1,'split'),400);
 const exported=await kho.req('ops/export');assert.ok(exported.product_stage_stock.length);assert.equal(exported.stage_transfers.length,3);
 await kho.req('products/'+id+'/lock',{});await kho.req('products/'+id+'/stage-transfer',transfer('raw','semi',1,'locked'),400);
});
