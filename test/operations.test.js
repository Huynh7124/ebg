import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {parseCSV} from '../shared/operations.js';

test('warehouse operations preserve quantities, snapshots, responsibility and durable history',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'ebg-ops-test-')),password=randomBytes(20).toString('hex'),base='http://127.0.0.1:3226/api/';
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:dir,env:{...process.env,DATA_DIR:join(dir,'data'),PORT:'3226',INITIAL_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
 let errors='';child.stderr.on('data',d=>errors+=d);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dir,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timeout=setTimeout(()=>fail(Error(errors||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timeout);ok()}});child.once('exit',()=>{clearTimeout(timeout);fail(Error(errors))})});
 function client(){let cookie='',csrf='';return {get cookie(){return cookie},async req(path,body,expected=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',cookie,'x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];const d=await r.json();if(path==='session'||path==='login')csrf=d.csrf;assert.equal(r.status,expected,path+': '+JSON.stringify(d));return d},async login(name){await this.req('session');await this.req('login',{username:name,password})}}}
 const admin=client(),worker=client(),other=client(),outsider=client();await admin.login('admin');await admin.req('users',{name:'Thợ lắp',username:'worker_ops',password,role:'staff'});await worker.login('worker_ops');await other.login('kho');await admin.req('users',{name:'Người khác',username:'other_processor',password,role:'processor'});await outsider.login('other_processor');
 const op=await admin.req('ops'),workerId=op.people.find(p=>p.name==='Thợ lắp').id;
 const create=async(code,kind='raw',unit='cái',rawProductId=null)=>{await admin.req('products',{name:code,code,category:'Hệ thống phanh',vehicle:'',color:'',min:0,materialKind:kind,unit,rawProductId});return (await admin.req('data')).products.find(p=>p.code===code).id};
 const stock=async(pid,q,operation='receive_stock')=>admin.req('movements',{operation,items:[{productId:pid,quantity:q}]});
 const item=async pid=>(await admin.req('data')).products.find(p=>p.id===pid);
 const request=async(body,who=admin)=>who.req('ops/requests',{type:'production',purpose:'stock',reference:'',destination:'Tổ lắp',assigneeId:workerId,dueDate:new Date(Date.now()+86400000).toISOString(),note:'Kiểm thử',allowPartial:true,...body});
 const act=(rid,action,body={},who=admin,status=200)=>who.req(`ops/requests/${rid}/${action}`,body,status);
 let a,b,fg,r;
 await t.test('requests do not move stock; API permissions cover legacy routes',async()=>{
  a=await create('OPS-A');b=await create('OPS-B');fg=await create('OPS-FG','finished');await stock(a,100);await stock(b,100);
  await worker.req('movements',{operation:'issue_stock',items:[{productId:a,quantity:1}]},403);
  await worker.req('ops/boms',{productId:fg,lines:[{productId:a,quantity:1}]},403);
  await admin.req('ops/boms',{productId:fg,lines:[{productId:a,quantity:2},{productId:b,quantity:3}]});
  r=(await request({outputs:[{productId:fg,quantity:10}]})).id;assert.equal((await item(a)).stock,100);
  await act(r,'issue',{},worker,403);await act(r,'accept',{},worker,400);
  await act(r,'issue');assert.equal((await item(a)).stock,80);assert.equal((await item(a)).inProduction,20);await act(r,'issue',{},admin,400);await act(r,'accept',{},outsider,403);await act(r,'accept',{},worker);
 });
 await t.test('BOM snapshots, QC 10=8+2, retry protection and no double component deduction',async()=>{
  await admin.req('ops/boms',{productId:fg,lines:[{productId:a,quantity:99}]});
  await admin.req('ops/boms',{productId:a,lines:[{productId:fg,quantity:1}]},400);
  const token=randomUUID();await act(r,'receive',{token,items:[{productId:fg,good:8,faulty:2}],defectReason:'Lỗi gia công'});
  assert.equal((await item(a)).stock,80);assert.equal((await item(a)).inProduction,0);assert.equal((await item(b)).stock,70);assert.equal((await item(fg)).stock,8);assert.equal((await item(fg)).faulty,2);
  await act(r,'receive',{token,items:[{productId:fg,good:8,faulty:2}],defectReason:'Lặp'},admin,400);
  assert.equal((await admin.req('ops')).requests.find(x=>x.id===r).status,'quality');await act(r,'close',{reason:'2 lỗi chuyển yêu cầu sửa riêng'});
  await stock(fg,1,'issue_stock');assert.equal((await item(a)).stock,80);
 });
 await t.test('repair consumes faulty stock and returns good stock',async()=>{
  const id=(await request({type:'repair',outputs:[{productId:fg,quantity:2}]})).id;await act(id,'issue');assert.equal((await item(fg)).faulty,0);assert.equal((await item(fg)).repair,2);await act(id,'accept',{},worker);await act(id,'receive',{token:randomUUID(),items:[{productId:fg,good:2,faulty:0}]});assert.equal((await item(fg)).stock,9);assert.equal((await item(fg)).repair,0);
 });
 await t.test('multi-colour Anode keeps original mapping and supports partial receipt',async()=>{
  const raw=await create('OPS-RAW'),raw2=await create('OPS-RAW2'),black=await create('OPS-BLACK','finished','cái',raw),red=await create('OPS-RED','finished','cái',raw);await stock(raw,20);
  const id=(await request({type:'anode',outputs:[{productId:black,quantity:4},{productId:red,quantity:6}]})).id;await act(id,'issue');await act(id,'accept',{},worker);
  const blackItem=await item(black);await admin.req('products',{...blackItem,rawProductId:raw2});
  await act(id,'receive',{token:randomUUID(),items:[{productId:black,good:4,faulty:0}]});assert.equal((await item(raw)).anote,6);assert.equal((await item(raw2)).anote,0);
  await act(id,'receive',{token:randomUUID(),items:[{productId:red,good:7,faulty:0}]},admin,400);assert.equal((await item(raw)).anote,6);
  await act(id,'receive',{token:randomUUID(),items:[{productId:red,good:6,faulty:0}]});assert.equal((await item(raw)).anote,0);assert.equal((await item(black)).stock,4);assert.equal((await item(red)).stock,6);
 });
 await t.test('Carbon records actual sheet consumption and returns leftovers without invented yield',async()=>{
  const sheet=await create('OPS-SHEET','raw','tấm'),part=await create('OPS-CUT');await stock(sheet,5);
  const id=(await request({type:'carbon',inputs:[{productId:sheet,quantity:2}],outputs:[{productId:part,quantity:10}]})).id;await act(id,'issue');await act(id,'accept',{},worker);
  await act(id,'receive',{token:randomUUID(),items:[{productId:part,good:5,faulty:0}],consumed:[{productId:sheet,quantity:1}]});
  await act(id,'receive',{token:randomUUID(),items:[{productId:part,good:5,faulty:0}],consumed:[{productId:sheet,quantity:2}]},admin,400);assert.equal((await item(part)).stock,5);
  await act(id,'receive',{token:randomUUID(),items:[{productId:part,good:5,faulty:0}],consumed:[{productId:sheet,quantity:0}]});await act(id,'close',{reason:'Còn vật tư'},admin,400);
  await act(id,'return',{items:[{productId:sheet,quantity:1}],reason:'Tấm chưa dùng'});assert.equal((await item(sheet)).stock,4);assert.equal((await item(sheet)).inProduction,0);assert.equal((await admin.req('ops')).requests.find(x=>x.id===id).status,'completed');
 });
 await t.test('supplemental materials belong to parent; deadlines and strict full receipt are enforced',async()=>{
  const fg2=await create('OPS-FG2','finished');await admin.req('ops/boms',{productId:fg2,lines:[{productId:a,quantity:1}]});
  const id=(await request({outputs:[{productId:fg2,quantity:2}],allowPartial:false})).id;await act(id,'issue');await act(id,'accept',{},worker);
  const extra=(await request({type:'supply',parentId:id,inputs:[{productId:a,quantity:3}],outputs:[]})).id;await act(extra,'issue');await act(extra,'accept',{},worker);
  await act(id,'receive',{token:randomUUID(),items:[{productId:fg2,good:1,faulty:0}]},admin,400);assert.equal((await item(fg2)).stock,0);
  const due=new Date(Date.now()+172800000).toISOString();await act(id,'deadline',{dueDate:due,reason:''},worker,400);await act(id,'deadline',{dueDate:due,reason:'Ưu tiên đơn khách'},worker);assert.ok((await admin.req('ops')).events.some(e=>e.requestId===id&&e.type==='Đổi hạn'&&e.payload.old&&e.payload.reason));
  await act(id,'receive',{token:randomUUID(),items:[{productId:fg2,good:2,faulty:0}]});await act(id,'return',{items:[{productId:a,quantity:3}],reason:'Cấp bổ sung chưa sử dụng'});assert.equal((await item(fg2)).stock,2);assert.equal((await item(a)).inProduction,0);
 });
 await t.test('insufficient multi-line issue rolls back every item and delivery handoff is explicit',async()=>{
  const low=await create('OPS-LOW'),end=await create('OPS-END','finished');await admin.req('ops/boms',{productId:end,lines:[{productId:a,quantity:1},{productId:low,quantity:1}]});const before=(await item(a)).stock;
  const id=(await request({outputs:[{productId:end,quantity:1}]})).id;await act(id,'issue',{},admin,400);assert.equal((await item(a)).stock,before);assert.equal((await item(a)).inProduction,0);await act(id,'cancel',{reason:'Thiếu vật tư'});
  const delivery=(await request({type:'delivery',purpose:'order',reference:'DON-01',outputs:[{productId:fg,quantity:1}]})).id;await act(delivery,'issue');assert.equal((await item(fg)).inTransit,1);await act(delivery,'cancel',{reason:'Không được hủy sau xuất'},worker,403);await act(delivery,'accept',{},worker);assert.equal((await item(fg)).inTransit,0);
 });
 await t.test('handover to another person preserves custody and requires acceptance again',async()=>{
  const id=(await request({type:'repair',outputs:[{productId:a,quantity:1}]})).id;
  const before=(await item(a)).stock; // Supply one faulty unit without changing usable stock.
  await stock(a,1,'receive_faulty');await act(id,'issue');await act(id,'accept',{},worker);
  const next=(await admin.req('ops')).people.find(p=>p.role==='admin').id;
  await act(id,'reassign',{assigneeId:next,reason:'Nhận thay ca'});await act(id,'deadline',{dueDate:new Date().toISOString(),reason:'Người cũ không còn nhận'},worker,403);
  assert.equal((await item(a)).repair,1);assert.equal((await item(a)).stock,before);await act(id,'accept');await act(id,'receive',{token:randomUUID(),items:[{productId:a,good:1,faulty:0}]});assert.equal((await item(a)).stock,before+1);
 });
 await t.test('import preview is atomic and cannot reset existing balances or duplicate an opening import',async()=>{
  const rows=[{code:'OPS-IMPORT',name:'Ốc nhập',category:'Hệ thống phanh',vehicle:'',unit:'cái',materialKind:'raw',stock:'7',faulty:'2',min:'1'}];
  let preview=await admin.req('ops/import/preview',{mode:'create',rows:[...rows,{...rows[0],code:'OPS-BAD',category:'Không có'}]});assert.equal(preview.errors.length,1);
  await admin.req('ops/import',{mode:'create',rows:[...rows,{...rows[0],code:'OPS-BAD',category:'Không có'}],confirmation:preview.digest},400);assert.equal((await admin.req('data')).products.some(p=>p.code==='OPS-IMPORT'),false);
  preview=await admin.req('ops/import/preview',{mode:'create',rows});await admin.req('ops/import',{mode:'create',rows,confirmation:preview.digest});await admin.req('ops/import',{mode:'create',rows,confirmation:preview.digest},400);
  const imported=(await admin.req('data')).products.find(p=>p.code==='OPS-IMPORT');assert.equal(imported.stock,7);assert.equal(imported.faulty,2);
  assert.equal((await admin.req('ops/import/preview',{mode:'metadata',rows})).errors.length,1);
  const metadata=rows.map(({stock,faulty,...r})=>({...r,name:'Ốc cập nhật'}));preview=await admin.req('ops/import/preview',{mode:'metadata',rows:metadata});await admin.req('ops/import',{mode:'metadata',rows:metadata,confirmation:preview.digest});assert.equal((await item(imported.id)).stock,7);
 });
 await t.test('warehouse can purchase and receive; processors cannot perform warehouse actions',async()=>{
  await worker.req('ops/suppliers',{name:'NCC test'},403);await admin.req('ops/access',{userId:workerId,role:'warehouse',team:'Kho'});await worker.req('ops/suppliers',{name:'NCC test',contact:'Đầu mối'});
  const supplier=(await admin.req('ops')).suppliers[0],id=(await worker.req('ops/purchases',{productId:a,quantity:5,reason:'Bổ sung'})).id;
  await worker.req(`ops/purchases/${id}/state`,{status:'approved'});await worker.req(`ops/purchases/${id}/state`,{status:'ordered',supplierId:supplier.id});
  await outsider.req(`ops/purchases/${id}/receive`,{good:1,faulty:0,token:randomUUID()},403);
  const before=(await item(a)).stock;await admin.req(`ops/purchases/${id}/receive`,{good:3,faulty:1,defectReason:'Hỏng',token:randomUUID()});await admin.req(`ops/purchases/${id}/receive`,{good:2,faulty:0,token:randomUUID()},400);await admin.req(`ops/purchases/${id}/receive`,{good:1,faulty:0,token:randomUUID()});assert.equal((await item(a)).stock,before+4);assert.equal((await item(a)).faulty,1);
 });
 await t.test('private modules stay private and SQLite backup is consistent and restorable',async()=>{
  await worker.req('ops/backup',undefined,403);
  for(const path of ['/server/operations.js','/server/operations.js?raw'])assert.equal((await fetch('http://127.0.0.1:3226'+path)).status,404);
  const response=await fetch(base+'ops/backup',{headers:{cookie:admin.cookie}});assert.equal(response.status,200);const file=join(dir,'backup.db');await writeFile(file,Buffer.from(await response.arrayBuffer()));const copy=new DatabaseSync(file,{readOnly:true});assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.ok(copy.prepare('SELECT count(*) n FROM ops_requests').get().n>5);assert.ok(copy.prepare('SELECT * FROM products WHERE code=?').get('OPS-A').stock>=0);copy.close();
  const restore=spawnSync(process.execPath,[resolve('scripts/restore-backup.mjs'),file,join(dir,'restored')],{encoding:'utf8'});assert.equal(restore.status,0,restore.stderr);const restored=new DatabaseSync(join(dir,'restored','ebg.db'),{readOnly:true});assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(restored.prepare('SELECT COUNT(*) n FROM ops_requests').get().n,(await admin.req('ops')).requests.length);restored.close();assert.notEqual(spawnSync(process.execPath,[resolve('scripts/restore-backup.mjs'),file,join(dir,'restored')]).status,0);
  const exportData=await admin.req('ops/export');assert.ok(!('users' in exportData));assert.ok(!('sessions' in exportData));
 });
});

test('CSV preserves commas, quotes, Vietnamese and multiline notes, rejects malformed rows',()=>{
 assert.deepEqual(parseCSV('\uFEFFcode,name\r\nA,"Ốc, đầu ""A"""\r\n'),[{code:'A',name:'Ốc, đầu "A"'}]);
 assert.deepEqual(parseCSV('code,name\nA,"Dây\nđầu"'),[{code:'A',name:'Dây\nđầu'}]);
 assert.throws(()=>parseCSV('code,name\nA,"missing'));assert.throws(()=>parseCSV('code,name\nA,"ok"bad'));assert.throws(()=>parseCSV('code,name\nA,B,C'));assert.throws(()=>parseCSV('code,code\nA,B'));
});
