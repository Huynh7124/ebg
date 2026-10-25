import {createHash} from 'node:crypto';
import {backup} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {workTypes,materialKinds,bucketFor} from '../shared/operations.js';

export function setupOperations(app,db,audit){
 const first=!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ops_access'").get();
 const add=(name,def)=>{if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name===name))db.exec(`ALTER TABLE products ADD COLUMN ${name} ${def}`)};
 add('materialKind',"TEXT NOT NULL DEFAULT 'unclassified'");add('unit',"TEXT NOT NULL DEFAULT 'cái'");add('rawProductId','INTEGER');add('location',"TEXT NOT NULL DEFAULT 'Kho chính'");add('inProduction','INTEGER NOT NULL DEFAULT 0');add('inTransit','INTEGER NOT NULL DEFAULT 0');
 db.exec(`CREATE TABLE IF NOT EXISTS ops_access(userId INTEGER PRIMARY KEY,warehouse INTEGER NOT NULL DEFAULT 0,buyer INTEGER NOT NULL DEFAULT 0,team TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS ops_boms(id INTEGER PRIMARY KEY AUTOINCREMENT,productId INTEGER NOT NULL,version INTEGER NOT NULL,lines TEXT NOT NULL,actor INTEGER,date TEXT,UNIQUE(productId,version));
 CREATE TABLE IF NOT EXISTS ops_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,purpose TEXT NOT NULL,reference TEXT NOT NULL DEFAULT '',destination TEXT NOT NULL,assigneeId INTEGER NOT NULL,requesterId INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',dueDate TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',outputs TEXT NOT NULL,inputs TEXT NOT NULL,snapshot TEXT NOT NULL,allowPartial INTEGER NOT NULL,parentId INTEGER,createdAt TEXT NOT NULL,issuedAt TEXT,acceptedAt TEXT);
 CREATE TABLE IF NOT EXISTS ops_events(id INTEGER PRIMARY KEY AUTOINCREMENT,requestId INTEGER,type TEXT NOT NULL,payload TEXT NOT NULL,actorId INTEGER,date TEXT NOT NULL,token TEXT UNIQUE);
 CREATE TABLE IF NOT EXISTS ops_suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,contact TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',quote TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS ops_purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,productId INTEGER NOT NULL,quantity INTEGER NOT NULL,received INTEGER NOT NULL DEFAULT 0,supplierId INTEGER,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',requesterId INTEGER,createdAt TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ops_imports(digest TEXT PRIMARY KEY,date TEXT NOT NULL,actorId INTEGER);`);
 if(first)db.prepare("INSERT INTO ops_access(userId,warehouse) SELECT id,1 FROM users WHERE role<>'admin'").run();
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 const text=(v,max=500,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())fail('Thông tin thiếu hoặc quá dài');return v.trim()};
 const qty=(v,zero=false)=>{if(!['number','string'].includes(typeof v)||v===''||!Number.isSafeInteger(+v)||+v<(zero?0:1)||+v>1000000000)fail('Số lượng phải là số nguyên hợp lệ, tối đa 1 tỷ theo đơn vị đã chọn');return +v};
 const id=v=>qty(v);
 const now=()=>new Date().toISOString();
 const person=v=>{const p=db.prepare('SELECT id,name,locked FROM users WHERE id=?').get(id(v));if(!p||p.locked)fail('Người nhận không tồn tại hoặc đã khóa');return p};
 const product=v=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(id(v));if(!p||p.locked)fail('Mặt hàng không tồn tại hoặc đã khóa');return p};
 const access=req=>{const a=db.prepare('SELECT * FROM ops_access WHERE userId=?').get(req.session.user.id)||{};return {warehouse:req.session.user.role==='admin'||!!a.warehouse,buyer:req.session.user.role==='admin'||!!a.buyer,admin:req.session.user.role==='admin',team:a.team||''}};
 const requireRight=(req,right)=>{if(!access(req)[right])fail(right==='warehouse'?'Chỉ người được giao quyền kho được xuất / nhận hàng':'Bạn không có quyền thực hiện thao tác này',403)};
 const route=(fn,mutation=false)=>(req,res,next)=>{
  try{if(mutation)db.exec('BEGIN IMMEDIATE');const result=fn(req,res);if(mutation)db.exec('COMMIT');if(!res.headersSent)res.json(result??{ok:true})}
  catch(e){if(mutation&&db.isTransaction)db.exec('ROLLBACK');if(e.status)res.status(e.status).json({error:e.message});else next(e)}
 };
 const event=(req,requestId,type,payload={},token=null)=>{db.prepare('INSERT INTO ops_events(requestId,type,payload,actorId,date,token) VALUES(?,?,?,?,?,?)').run(requestId,type,JSON.stringify(payload),req.session.user.id,now(),token);audit(req,`${requestId?'YC-'+String(requestId).padStart(6,'0'):'Điều phối'} · ${type}`)};
 const load=v=>{const r=db.prepare('SELECT * FROM ops_requests WHERE id=?').get(id(v));if(!r)fail('Không tìm thấy yêu cầu',404);return {...r,inputs:JSON.parse(r.inputs),outputs:JSON.parse(r.outputs),snapshot:JSON.parse(r.snapshot)}};
 const store=r=>db.prepare('UPDATE ops_requests SET status=?,inputs=?,outputs=? WHERE id=?').run(r.status,JSON.stringify(r.inputs),JSON.stringify(r.outputs),r.id);
 const date=v=>{if(typeof v!=='string'||!v.trim()||!Number.isFinite(Date.parse(v)))fail('Cần chọn hạn trả hợp lệ');return new Date(v).toISOString()};
 const lines=(rows,source=false)=>{
  if(!Array.isArray(rows)||!rows.length||rows.length>100)fail('Cần từ 1 đến 100 mặt hàng');
  const seen=new Set();return rows.map(l=>{const p=product(l.productId),q=qty(l.quantity);if(seen.has(p.id))fail('Mặt hàng bị trùng');seen.add(p.id);return {productId:p.id,quantity:q,...(source?{source:l.source==='faulty'?'faulty':'stock',issued:0,consumed:0,returned:0}:{good:0,faulty:0})}});
 };
 const change=(productId,bucket,delta)=>{
  if(!['stock','faulty','repair','anote','inProduction','inTransit'].includes(bucket))fail('Nhóm tồn không hợp lệ');
  const p=db.prepare('SELECT * FROM products WHERE id=?').get(productId);if(!p||!Number.isSafeInteger(p[bucket]+delta)||p[bucket]+delta<0||p[bucket]+delta>1000000000)fail(`${p?.code||productId}: tồn không đủ hoặc vượt giới hạn`);
  db.prepare(`UPDATE products SET ${bucket}=${bucket}+? WHERE id=?`).run(delta,productId);
 };
 const receipt=(req,kind,operation,items,reference,note='')=>{
  if(!items.length)return null;
  const d=now(),rid=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES(?,?,?,?,?,?,?)').run(kind,operation,note,'completed',req.session.user.name,d,reference).lastInsertRowid);
  for(const l of items)db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(l.productId,kind,l.bucket||'stock',l.quantity,note,'completed',req.session.user.name,d,operation,rid);
  return rid;
 };
 const authorizeWork=(req,r)=>{if(req.session.user.id!==r.assigneeId&&!access(req).admin)fail('Chỉ người nhận việc hoặc Admin được cập nhật công việc này',403)};
 const remaining=l=>l.issued-l.consumed-l.returned;
 const settle=r=>{
  const done=r.outputs.every(l=>l.good+l.faulty===l.quantity),left=r.inputs.some(l=>remaining(l)>0),bad=r.outputs.some(l=>l.faulty>0);
  r.status=done?(left||bad?'quality':'completed'):r.outputs.some(l=>l.good+l.faulty>0)?'partial':'working';store(r);
 };
 // Enforce stock responsibility on the existing APIs as well as the new screens.
 app.use('/api',(req,res,next)=>{
  if(req.method==='POST'&&(/^\/products(?:\/|$)/.test(req.path)||/^\/movements(?:\/|$)/.test(req.path)||/^\/receipts\/\d+\/complete$/.test(req.path))&&!access(req).warehouse)return res.status(403).json({error:'Chỉ người được giao quyền kho được thay đổi hàng hóa'});
  next();
 });
 app.get('/api/ops',route(req=>({
  access:access(req),userId:req.session.user.id,
  people:db.prepare("SELECT u.id,u.name,u.locked,COALESCE(a.team,'') team,COALESCE(a.warehouse,0) warehouse,COALESCE(a.buyer,0) buyer,u.role FROM users u LEFT JOIN ops_access a ON a.userId=u.id").all(),
  requests:db.prepare('SELECT id FROM ops_requests ORDER BY id DESC').all().map(r=>load(r.id)),
  boms:db.prepare('SELECT * FROM ops_boms ORDER BY id DESC').all().map(b=>({...b,lines:JSON.parse(b.lines)})),
  events:db.prepare('SELECT * FROM ops_events ORDER BY id DESC LIMIT 1000').all().map(e=>({...e,payload:JSON.parse(e.payload)})),
  suppliers:db.prepare('SELECT * FROM ops_suppliers ORDER BY name').all(),purchases:db.prepare('SELECT * FROM ops_purchases ORDER BY id DESC').all()
 })));
 app.post('/api/ops/access',route(req=>{requireRight(req,'admin');const p=person(req.body.userId);db.prepare('INSERT INTO ops_access(userId,warehouse,buyer,team) VALUES(?,?,?,?) ON CONFLICT(userId) DO UPDATE SET warehouse=excluded.warehouse,buyer=excluded.buyer,team=excluded.team').run(p.id,req.body.warehouse===true?1:0,req.body.buyer===true?1:0,text(req.body.team||'',80));event(req,null,'Phân quyền',{userId:p.id,warehouse:req.body.warehouse===true,buyer:req.body.buyer===true});},true));
 app.post('/api/ops/boms',route(req=>{
  requireRight(req,'admin');const p=product(req.body.productId);const ls=lines(req.body.lines);
  if(ls.some(l=>l.productId===p.id))fail('Một bộ không thể chứa chính nó');
  // A versioned graph must remain acyclic, including indirect assemblies.
  const graph=new Map();for(const b of db.prepare('SELECT * FROM ops_boms ORDER BY version').all())graph.set(b.productId,JSON.parse(b.lines).map(l=>l.productId));graph.set(p.id,ls.map(l=>l.productId));
  const visiting=new Set(),visited=new Set();const visit=n=>{if(visiting.has(n))fail('Định mức tạo vòng lặp giữa các cụm');if(visited.has(n))return;visiting.add(n);for(const c of graph.get(n)||[])visit(c);visiting.delete(n);visited.add(n)};visit(p.id);
  const version=(db.prepare('SELECT MAX(version) v FROM ops_boms WHERE productId=?').get(p.id).v||0)+1;
  db.prepare('INSERT INTO ops_boms(productId,version,lines,actor,date) VALUES(?,?,?,?,?)').run(p.id,version,JSON.stringify(ls.map(({productId,quantity})=>({productId,quantity}))),req.session.user.id,now());event(req,null,'Lưu định mức',{productId:p.id,version});return {ok:true,version};
 },true));
 app.post('/api/ops/requests',route(req=>{
  const b=req.body;if(!Object.hasOwn(workTypes,b.type))fail('Chọn loại yêu cầu');
  if(!['order','stock'].includes(b.purpose))fail('Chọn mục đích làm cho đơn hoặc bổ sung tồn');
  const assignee=person(b.assigneeId),due=date(b.dueDate),destination=text(b.destination,160,true),reference=text(b.reference||'',100);
  if(b.purpose==='order'&&!reference)fail('Cần mã đơn / tham chiếu cho công việc theo đơn');
  if(typeof b.allowPartial!=='boolean')fail('Cần chọn rõ có cho phép nhận nhiều đợt');
  let outputs=b.type==='supply'?[]:lines(b.outputs),inputs=[],snapshot=[];let parentId=null;
  if(b.type==='production'){
   const aggregate=new Map();for(const o of outputs){const bom=db.prepare('SELECT * FROM ops_boms WHERE productId=? ORDER BY version DESC LIMIT 1').get(o.productId);if(!bom)fail(`${product(o.productId).code}: chưa có định mức được Admin duyệt`);const ls=JSON.parse(bom.lines);snapshot.push({productId:o.productId,version:bom.version,lines:ls});for(const l of ls)aggregate.set(l.productId,(aggregate.get(l.productId)||0)+qty(l.quantity)*o.quantity)}
   inputs=lines([...aggregate].map(([productId,quantity])=>({productId,quantity})),true);
  }else if(b.type==='anode'){
   const aggregate=new Map();for(const o of outputs){const p=product(o.productId);if(!p.rawProductId)fail(`${p.code}: chưa liên kết mã thô`);const raw=product(p.rawProductId);if(raw.unit!==p.unit)fail('Mã thô và mã màu cần cùng đơn vị cho Anode 1:1');snapshot.push({productId:o.productId,rawProductId:raw.id});aggregate.set(raw.id,(aggregate.get(raw.id)||0)+o.quantity)}inputs=lines([...aggregate].map(([productId,quantity])=>({productId,quantity})),true);
  }else if(b.type==='carbon'){inputs=lines(b.inputs,true);if(inputs.some(l=>outputs.some(o=>o.productId===l.productId)))fail('Cần mã tấm đầu vào và mã chi tiết đầu ra riêng')}
  else if(b.type==='supply'){
   const parent=load(b.parentId);if(!['issued','working','partial','quality'].includes(parent.status)||['supply','delivery'].includes(parent.type))fail('Lệnh gốc không thể nhận cấp bổ sung');
   if(parent.assigneeId!==assignee.id)fail('Vật tư bổ sung phải giao người nhận của lệnh gốc');if(!access(req).warehouse&&req.session.user.id!==parent.assigneeId)fail('Chỉ người nhận việc được xin vật tư bổ sung cho lệnh này',403);
   parentId=parent.id;inputs=lines(b.inputs,true);if(inputs.some(l=>l.source!=='stock'))fail('Vật tư bổ sung phải từ kho đạt');
  }else inputs=lines(outputs.map(o=>({...o,source:b.type==='repair'?'faulty':'stock'})),true);
  if(b.type!=='repair'&&inputs.some(l=>l.source==='faulty'))fail('Chỉ lệnh sửa được lấy từ hàng lỗi');
  const rid=Number(db.prepare('INSERT INTO ops_requests(type,purpose,reference,destination,assigneeId,requesterId,dueDate,note,outputs,inputs,snapshot,allowPartial,parentId,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(b.type,b.purpose,reference,destination,assignee.id,req.session.user.id,due,text(b.note||'',1000),JSON.stringify(outputs),JSON.stringify(inputs),JSON.stringify(snapshot),b.allowPartial?1:0,parentId,now()).lastInsertRowid);
  event(req,rid,'Tạo yêu cầu',{type:b.type});return {ok:true,id:rid};
 },true));
 app.post('/api/ops/requests/:id/issue',route(req=>{
  requireRight(req,'warehouse');const r=load(req.params.id);if(r.status!=='pending')fail('Yêu cầu đã xuất hoặc không còn chờ duyệt');person(r.assigneeId);
  let parent=r.type==='supply'?load(r.parentId):null;if(parent&&(parent.assigneeId!==r.assigneeId||!['issued','working','partial','quality'].includes(parent.status)))fail('Lệnh gốc không còn mở');
  for(const l of r.inputs){product(l.productId);change(l.productId,l.source,-l.quantity);change(l.productId,bucketFor(parent?.type||r.type),l.quantity);l.issued=l.quantity;
   if(parent){let target=parent.inputs.find(x=>x.productId===l.productId&&x.source===l.source);if(!target){target={...l,quantity:0,issued:0};parent.inputs.push(target)}target.issued+=l.quantity;target.quantity+=l.quantity;}
  }
  const rid=receipt(req,'out','issue_stock',r.inputs.map(l=>({...l,bucket:l.source})),`ops:${r.id}`,`${workTypes[r.type]} YC-${r.id} → ${r.destination}`);
  r.status='issued';store(r);if(parent){store(parent);event(req,parent.id,'Cấp bổ sung',{requestId:r.id,items:r.inputs})}
  db.prepare('UPDATE ops_requests SET issuedAt=? WHERE id=?').run(now(),r.id);event(req,r.id,'Kho đã xuất',{receiptId:rid});return {ok:true,receiptId:rid};
 },true));
 app.post('/api/ops/requests/:id/accept',route(req=>{
  const r=load(req.params.id);authorizeWork(req,r);if(r.status!=='issued')fail('Chỉ nhận việc sau khi kho đã xuất');
  if(r.type==='delivery')for(const l of r.inputs){change(l.productId,'inTransit',-l.issued);l.consumed=l.issued}
  r.status=['delivery','supply'].includes(r.type)?'completed':r.outputs.some(l=>l.good+l.faulty>0)?'partial':'working';store(r);db.prepare('UPDATE ops_requests SET acceptedAt=? WHERE id=?').run(now(),r.id);event(req,r.id,'Đã nhận bàn giao',{destination:r.destination});
 },true));
 app.post('/api/ops/requests/:id/deadline',route(req=>{
  const r=load(req.params.id);authorizeWork(req,r);if(['completed','cancelled'].includes(r.status))fail('Công việc đã kết thúc');const due=date(req.body.dueDate),reason=text(req.body.reason,500,true);event(req,r.id,'Đổi hạn',{old:r.dueDate,new:due,reason});db.prepare('UPDATE ops_requests SET dueDate=? WHERE id=?').run(due,r.id);
 },true));
 app.post('/api/ops/requests/:id/reassign',route(req=>{
  requireRight(req,'warehouse');const r=load(req.params.id);if(['completed','cancelled'].includes(r.status)||r.type==='supply')fail('Chỉ đổi người ở lệnh gốc đang mở');const next=person(req.body.assigneeId),reason=text(req.body.reason,500,true);if(next.id===r.assigneeId)fail('Người nhận mới phải khác người hiện tại');const previous=r.assigneeId;
  db.prepare('UPDATE ops_requests SET assigneeId=?,status=?,acceptedAt=NULL WHERE id=?').run(next.id,r.status==='pending'?'pending':'issued',r.id);
  for(const child of db.prepare("SELECT id FROM ops_requests WHERE parentId=? AND status='pending'").all(r.id)){db.prepare('UPDATE ops_requests SET assigneeId=? WHERE id=?').run(next.id,child.id);event(req,child.id,'Đổi người nhận theo lệnh gốc',{old:previous,new:next.id,reason})}
  event(req,r.id,'Bàn giao đổi người',{old:previous,new:next.id,reason});
 },true));
 app.post('/api/ops/requests/:id/cancel',route(req=>{
  const r=load(req.params.id);if(r.requesterId!==req.session.user.id&&!access(req).warehouse)fail('Không có quyền hủy yêu cầu này',403);if(r.status!=='pending')fail('Đã xuất hàng: cần đối chiếu / trả vật tư, không thể hủy');const reason=text(req.body.reason,500,true);r.status='cancelled';store(r);event(req,r.id,'Hủy yêu cầu',{reason});
 },true));
 app.post('/api/ops/requests/:id/receive',route(req=>{
  requireRight(req,'warehouse');const r=load(req.params.id);if(!['working','partial','quality'].includes(r.status)||['delivery','supply'].includes(r.type))fail('Chưa nhận việc hoặc công việc đã kết thúc');
  const token=text(req.body.token,100,true);if(db.prepare('SELECT id FROM ops_events WHERE token=?').get(token))fail('Lần nhận này đã được ghi, hãy tải lại dữ liệu');
  const rows=req.body.items;if(!Array.isArray(rows)||!rows.length||rows.length>100)fail('Cần khai báo kết quả nhận');const seen=new Set(),actual=[];
  for(const row of rows){const productId=id(row.productId),good=qty(row.good,true),faulty=qty(row.faulty,true),o=r.outputs.find(x=>x.productId===productId);product(productId);if(!o||seen.has(productId)||!good&&!faulty||good+faulty>o.quantity-o.good-o.faulty)fail('Số nhận vượt số còn chờ, trùng hoặc sai mã đầu ra');seen.add(productId);actual.push({productId,good,faulty});}
  if(!r.allowPartial&&r.outputs.some(o=>(actual.find(x=>x.productId===o.productId)?.good||0)+(actual.find(x=>x.productId===o.productId)?.faulty||0)!==o.quantity-o.good-o.faulty))fail('Lệnh này yêu cầu nhận đủ một lần');
  const defectReason=actual.some(o=>o.faulty)?text(req.body.defectReason,500,true):'';
  const use=new Map();
  if(r.type==='production')for(const o of actual){const bom=r.snapshot.find(b=>b.productId===o.productId);for(const l of bom.lines)use.set(l.productId,(use.get(l.productId)||0)+l.quantity*(o.good+o.faulty))}
  else if(r.type==='anode')for(const o of actual){const raw=r.snapshot.find(l=>l.productId===o.productId).rawProductId;use.set(raw,(use.get(raw)||0)+o.good+o.faulty)}
  else if(r.type==='repair')for(const o of actual)use.set(o.productId,o.good+o.faulty);
  else if(r.type==='carbon'){
   if(!Array.isArray(req.body.consumed))fail('Carbon cần khai báo số tấm thực dùng của đợt nhận');
   for(const l of req.body.consumed){const pid=id(l.productId);if(use.has(pid))fail('Trùng dòng vật tư thực dùng');use.set(pid,qty(l.quantity,true))}
   if(![...use.values()].some(q=>q>0)&&!r.inputs.some(l=>l.consumed>0))fail('Cần ghi số tấm thực dùng, không tự quy đổi tấm thành bộ');
  }
  for(const [pid,q] of use){const l=r.inputs.find(x=>x.productId===pid);if(!l||q>remaining(l))fail('Vật tư thực dùng vượt số đã cấp còn ở công việc');change(pid,bucketFor(r.type),-q);l.consumed+=q}
  const goodLines=[],badLines=[];for(const o of actual){const target=r.outputs.find(x=>x.productId===o.productId);target.good+=o.good;target.faulty+=o.faulty;if(o.good){change(o.productId,'stock',o.good);goodLines.push({productId:o.productId,quantity:o.good})}if(o.faulty){change(o.productId,'faulty',o.faulty);badLines.push({productId:o.productId,quantity:o.faulty,bucket:'faulty'})}}
  const goodReceipt=receipt(req,'in','receive_stock',goodLines,`ops:${r.id}`,'Nhận đạt từ YC-'+r.id),faultyReceipt=receipt(req,'in','receive_faulty',badLines,`ops:${r.id}`,'Nhận lỗi từ YC-'+r.id+': '+defectReason);
  settle(r);event(req,r.id,'Kiểm nhận',{assigneeId:r.assigneeId,destination:r.destination,items:actual,consumed:[...use].map(([productId,quantity])=>({productId,quantity})),defectReason,goodReceipt,faultyReceipt},token);return {ok:true,status:r.status};
 },true));
 app.post('/api/ops/requests/:id/return',route(req=>{
  requireRight(req,'warehouse');const r=load(req.params.id);if(!['working','partial','quality'].includes(r.status))fail('Công việc không còn vật tư để trả');const ls=lines(req.body.items,true);
  for(const x of ls){const l=r.inputs.find(v=>v.productId===x.productId&&v.source===x.source);if(!l||x.quantity>remaining(l))fail('Trả vượt số vật tư còn ở công việc');change(l.productId,bucketFor(r.type),-x.quantity);change(l.productId,l.source,x.quantity);l.returned+=x.quantity}
  receipt(req,'in','receive_stock',ls.map(l=>({...l,bucket:l.source})),`ops:${r.id}`,'Trả vật tư thừa YC-'+r.id);settle(r);event(req,r.id,'Trả vật tư',{items:ls,reason:text(req.body.reason,500,true)});
 },true));
 app.post('/api/ops/requests/:id/close',route(req=>{
  requireRight(req,'warehouse');const r=load(req.params.id);if(!['working','partial','quality'].includes(r.status)||r.inputs.some(l=>remaining(l)>0))fail('Cần nhận / trả và đối chiếu hết vật tư đang giữ trước khi đóng');
  const reason=text(req.body.reason,500,true);r.status='completed';store(r);event(req,r.id,'Đóng sau đối chiếu',{reason,outputs:r.outputs});
 },true));
 app.post('/api/ops/suppliers',route(req=>{
  requireRight(req,'buyer');const b=req.body,values=[text(b.name,160,true),text(b.contact||'',160),text(b.phone||'',50),text(b.quote||'',2000),text(b.note||'',1000)];
  if(b.id){const exists=db.prepare('SELECT id FROM ops_suppliers WHERE id=?').get(id(b.id));if(!exists)fail('Nhà cung cấp không tồn tại');db.prepare('UPDATE ops_suppliers SET name=?,contact=?,phone=?,quote=?,note=? WHERE id=?').run(...values,+b.id)}else{if(db.prepare('SELECT id FROM ops_suppliers WHERE name=?').get(values[0]))fail('Nhà cung cấp đã tồn tại');db.prepare('INSERT INTO ops_suppliers(name,contact,phone,quote,note) VALUES(?,?,?,?,?)').run(...values)}event(req,null,'Cập nhật nhà cung cấp',{name:values[0]});
 },true));
 app.post('/api/ops/purchases',route(req=>{const b=req.body,p=product(b.productId);if(b.supplierId&&!db.prepare('SELECT id FROM ops_suppliers WHERE id=?').get(id(b.supplierId)))fail('Nhà cung cấp không hợp lệ');const rid=Number(db.prepare('INSERT INTO ops_purchases(productId,quantity,supplierId,reason,requesterId,createdAt) VALUES(?,?,?,?,?,?)').run(p.id,qty(b.quantity),b.supplierId?+b.supplierId:null,text(b.reason,500,true),req.session.user.id,now()).lastInsertRowid);event(req,null,'Đề nghị mua',{purchaseId:rid});return {ok:true,id:rid};},true));
 app.post('/api/ops/purchases/:id/state',route(req=>{requireRight(req,'buyer');const p=db.prepare('SELECT * FROM ops_purchases WHERE id=?').get(id(req.params.id));if(!p)fail('Không tìm thấy đề nghị');const target=req.body.status;if(!({pending:['approved','cancelled'],approved:['ordered','cancelled']}[p.status]||[]).includes(target))fail('Chuyển trạng thái mua không hợp lệ');if(target==='ordered'&&!p.supplierId&&!req.body.supplierId)fail('Cần chọn nhà cung cấp trước khi đặt');if(req.body.supplierId){if(!db.prepare('SELECT id FROM ops_suppliers WHERE id=?').get(id(req.body.supplierId)))fail('Nhà cung cấp không hợp lệ');db.prepare('UPDATE ops_purchases SET supplierId=? WHERE id=?').run(+req.body.supplierId,p.id)}db.prepare('UPDATE ops_purchases SET status=? WHERE id=?').run(target,p.id);event(req,null,'Cập nhật đề nghị mua',{purchaseId:p.id,status:target});},true));
 app.post('/api/ops/purchases/:id/receive',route(req=>{requireRight(req,'warehouse');const p=db.prepare('SELECT * FROM ops_purchases WHERE id=?').get(id(req.params.id));if(!p||p.status!=='ordered')fail('Đề nghị chưa đặt hoặc đã nhận đủ');product(p.productId);const good=qty(req.body.good,true),faulty=qty(req.body.faulty,true);if(!good&&!faulty||good+faulty>p.quantity-p.received)fail('Số nhận không hợp lệ');const token=text(req.body.token,100,true);if(db.prepare('SELECT id FROM ops_events WHERE token=?').get(token))fail('Đợt nhận đã được ghi');const reason=faulty?text(req.body.defectReason,500,true):'';if(good){change(p.productId,'stock',good);receipt(req,'in','receive_stock',[{productId:p.productId,quantity:good}],`purchase:${p.id}`,'Nhận mua')}if(faulty){change(p.productId,'faulty',faulty);receipt(req,'in','receive_faulty',[{productId:p.productId,quantity:faulty,bucket:'faulty'}],`purchase:${p.id}`,reason)}const received=p.received+good+faulty;db.prepare('UPDATE ops_purchases SET received=?,status=? WHERE id=?').run(received,received===p.quantity?'received':'ordered',p.id);event(req,null,'Nhận mua',{purchaseId:p.id,good,faulty,reason},token);},true));
 const importPlan=b=>{
  if(!['create','metadata'].includes(b.mode)||!Array.isArray(b.rows)||!b.rows.length||b.rows.length>1000)fail('Chọn chế độ và tối đa 1000 dòng nhập');
  const seen=new Set(),errors=[],clean=[];
  for(let i=0;i<b.rows.length;i++)try{
   const r=b.rows[i];if(Object.keys(r).some(k=>!['code','name','category','vehicle','color','unit','materialKind','min','stock','faulty'].includes(k)))fail('File có cột chưa hỗ trợ; dùng đúng tiêu đề mẫu');const code=text(r.code,80,true),name=text(r.name,180,true);if(seen.has(code))fail('Trùng mã trong file');seen.add(code);
   const existing=db.prepare('SELECT * FROM products WHERE code=?').get(code);
   if(b.mode==='create'&&existing)fail('Mã đã tồn tại; không được nạp lại số dư');if(b.mode==='metadata'&&!existing)fail('Chế độ cập nhật chỉ dùng mã đã tồn tại');
   const category=text(r.category,100,true),vehicle=text(r.vehicle??existing?.vehicle??'',100);if(!db.prepare("SELECT id FROM categories WHERE type='accessory' AND name=? AND locked=0").get(category))fail('Danh mục phụ kiện chưa tồn tại / bị khóa');if(vehicle&&!db.prepare("SELECT id FROM categories WHERE type='vehicle' AND name=? AND locked=0").get(vehicle))fail('Dòng xe chưa tồn tại / bị khóa');
   const unit=text(r.unit||existing?.unit||'cái',30,true),kind=r.materialKind||existing?.materialKind||'unclassified';if(!Object.hasOwn(materialKinds,kind))fail('Loại hàng không hợp lệ');
   if(existing&&unit!==existing.unit)fail('Không đổi đơn vị qua nhập file; cần đối chiếu số dư riêng');
   if(b.mode==='metadata'&&(r.stock!==undefined&&r.stock!==''||r.faulty!==undefined&&r.faulty!==''))fail('Cập nhật danh mục không được chứa cột số dư');
   clean.push({code,name,category,vehicle,color:text(r.color??existing?.color??'',40),unit,materialKind:kind,min:qty(r.min===''||r.min===undefined?(existing?.min??0):r.min,true),stock:b.mode==='create'?qty(r.stock||0,true):null,faulty:b.mode==='create'?qty(r.faulty||0,true):null,existingId:existing?.id||null});
  }catch(e){errors.push({row:i+2,error:e.message})}
  const digest=createHash('sha256').update(JSON.stringify({mode:b.mode,rows:b.rows})).digest('hex');return {rows:clean,errors,digest,mode:b.mode,count:clean.length};
 };
 app.post('/api/ops/import/preview',route(req=>{requireRight(req,'warehouse');return importPlan(req.body)}));
 app.post('/api/ops/import',route(req=>{
  requireRight(req,'warehouse');const plan=importPlan(req.body);if(plan.errors.length)fail('File còn lỗi; chưa cập nhật dòng nào');if(req.body.confirmation!==plan.digest)fail('Cần xem trước và xác nhận đúng file');if(db.prepare('SELECT digest FROM ops_imports WHERE digest=?').get(plan.digest))fail('File này đã được nhập, không ghi trùng');
  const good=[],bad=[];for(const r of plan.rows){if(r.existingId)db.prepare('UPDATE products SET name=?,category=?,vehicle=?,color=?,materialKind=?,min=? WHERE id=?').run(r.name,r.category,r.vehicle,r.color,r.materialKind,r.min,r.existingId);else{
   const pid=Number(db.prepare('INSERT INTO products(name,code,category,vehicle,color,unit,materialKind,min,stock,faulty,image) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(r.name,r.code,r.category,r.vehicle,r.color,r.unit,r.materialKind,r.min,r.stock,r.faulty,'gear').lastInsertRowid);
   if(r.stock)good.push({productId:pid,quantity:r.stock});if(r.faulty)bad.push({productId:pid,quantity:r.faulty,bucket:'faulty'});
  }}
  receipt(req,'in','receive_stock',good,'import:'+plan.digest,'Số dư đầu kỳ đã đối chiếu');receipt(req,'in','receive_faulty',bad,'import:'+plan.digest,'Số dư hàng lỗi đầu kỳ');db.prepare('INSERT INTO ops_imports(digest,date,actorId) VALUES(?,?,?)').run(plan.digest,now(),req.session.user.id);event(req,null,'Nạp danh mục',{mode:plan.mode,count:plan.count,digest:plan.digest});return {ok:true,count:plan.count};
 },true));
 app.get('/api/ops/export',route((req,res)=>{
  requireRight(req,'warehouse');const tables=['products','categories','receipts','movements','ops_boms','ops_requests','ops_events','ops_suppliers','ops_purchases'];const data={format:'ebg-inventory-export-v1',date:now()};for(const table of tables)data[table]=db.prepare(`SELECT * FROM ${table}`).all();res.set('Content-Disposition','attachment; filename="ebg-inventory.json"');res.json(data);
 }));
 app.get('/api/ops/backup',async(req,res,next)=>{
  let dir;try{requireRight(req,'admin');dir=await mkdtemp(join(tmpdir(),'ebg-backup-'));const path=join(dir,'ebg.db');await backup(db,path);res.download(path,'ebg-backup-'+now().slice(0,10)+'.db',async err=>{await rm(dir,{recursive:true,force:true});if(err&&!res.headersSent)next(err)});audit(req,'Tạo bản sao lưu SQLite nhất quán');}
  catch(e){if(dir)await rm(dir,{recursive:true,force:true});if(e.status)res.status(e.status).json({error:e.message});else next(e)}
 });
}

export function productMetadata(db,body,existing){
 const kind=body.materialKind??existing?.materialKind??'unclassified',unit=body.unit??existing?.unit??'cái',location=body.location??existing?.location??'Kho chính';
 if(!Object.hasOwn(materialKinds,kind)||typeof unit!=='string'||!unit.trim()||unit.length>30||typeof location!=='string'||!location.trim()||location.length>160)throw Error('Chọn loại hàng, đơn vị và nơi giữ hợp lệ');
 if(existing&&existing.unit!==unit&&(db.prepare('SELECT id FROM movements WHERE productId=? LIMIT 1').get(existing.id)||['stock','faulty','repair','anote','inProduction','inTransit'].some(k=>existing[k]>0)||db.prepare("SELECT id FROM ops_boms WHERE productId=? OR EXISTS(SELECT 1 FROM json_each(ops_boms.lines) WHERE json_extract(value,'$.productId')=?) LIMIT 1").get(existing.id,existing.id)||db.prepare("SELECT id FROM ops_requests WHERE EXISTS(SELECT 1 FROM json_each(inputs) WHERE json_extract(value,'$.productId')=?) OR EXISTS(SELECT 1 FROM json_each(outputs) WHERE json_extract(value,'$.productId')=?) LIMIT 1").get(existing.id,existing.id)))throw Error('Đã có tồn / lịch sử: không đổi đơn vị đếm để tránh sai số dư');
 const raw=body.rawProductId===undefined?existing?.rawProductId:body.rawProductId===''||body.rawProductId===null?null:Number(body.rawProductId);
 if(raw!==null&&raw!==undefined&&!Number.isSafeInteger(raw))throw Error('Mã thô không hợp lệ');
 if(raw){const p=db.prepare('SELECT * FROM products WHERE id=?').get(raw);if(!Number.isSafeInteger(raw)||!p||p.id===existing?.id||p.locked||p.materialKind!=='raw'||p.unit!==unit)throw Error('Mã thô phải là nguyên liệu đang dùng, khác mã hiện tại và cùng đơn vị')}
 if(existing&&kind!=='raw'&&db.prepare('SELECT id FROM products WHERE rawProductId=? LIMIT 1').get(existing.id))throw Error('Mã đang là nguồn của mã màu; giữ loại nguyên vật liệu');
 if(kind==='raw'&&raw)throw Error('Mã thô không thể có mã thô cha');
 return {materialKind:kind,unit:unit.trim(),location:location.trim(),rawProductId:raw||null};
}
