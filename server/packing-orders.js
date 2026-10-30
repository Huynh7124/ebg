import {validatePackingPrint,packingPrintLabels} from '../shared/packing-print.js';
import {defaultOutboundPrint} from '../shared/outbound-print.js';
import {changeStock,resolveStockStage} from './stock-stages.js';
import {managesWarehouse} from '../shared/roles.js';
export function setupPackingOrders(app,db,audit){
 db.exec('CREATE TABLE IF NOT EXISTS packing_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,requesterId INTEGER NOT NULL,processorId INTEGER,status TEXT NOT NULL,payload TEXT NOT NULL)');
 if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='withPacking'))db.exec('ALTER TABLE products ADD COLUMN withPacking INTEGER NOT NULL DEFAULT 0');
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 const qty=(v,zero=false)=>{if(!['string','number'].includes(typeof v)||v===''||!Number.isSafeInteger(+v)||+v<(zero?0:1)||+v>1e9)fail('Số lượng không hợp lệ');return +v};
 const text=(v,required=false,max=500)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())fail('Thông tin thiếu hoặc quá dài');return v.trim()};
 const product=id=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(qty(id));if(!p||p.locked)fail('Mã hàng không tồn tại hoặc đã khóa');return p};
 const read=id=>{const r=db.prepare('SELECT * FROM packing_orders WHERE id=?').get(qty(id));if(!r)fail('Không tìm thấy đơn',404);const {payload,...row}=r;return {purpose:'order',...row,...JSON.parse(payload)}};
 const save=r=>{const {id,requesterId,processorId,status,...payload}=r;db.prepare('UPDATE packing_orders SET processorId=?,status=?,payload=? WHERE id=?').run(processorId,status,JSON.stringify(payload),id)};
 const change=(pid,bucket,q)=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(pid);if(!p||!Number.isSafeInteger(p[bucket]+q)||p[bucket]+q<0||p[bucket]+q>1e9)fail('Tồn không đủ hoặc vượt giới hạn: '+(p?.code||pid));db.prepare(`UPDATE products SET ${bucket}=${bucket}+? WHERE id=?`).run(q,pid)};
 const rows=(items)=>{if(!Array.isArray(items)||!items.length||items.length>100)fail('Cần 1–100 mặt hàng');const seen=new Set();return items.map(l=>{const p=product(l.productId);if(seen.has(p.id))fail('Trùng mã hàng');seen.add(p.id);return {productId:p.id,quantity:qty(l.quantity),...(l.stage?{stage:resolveStockStage(db,p.id,-1,l.stage)}:{})}})};
 const sameLines=(a,b)=>a.length===b.length&&a.every(l=>b.some(x=>x.productId===l.productId&&x.quantity===l.quantity));
 const event=(req,r,action,details={})=>{r.events.push({action,actor:req.session.user.name,date:new Date().toISOString(),...details});save(r);audit(req,`DGGC-${String(r.id).padStart(6,'0')} · ${action}`)};
 const receipt=(req,r,kind,bucket,operation,items)=>{if(!items.length)return;const date=new Date().toISOString(),note=(kind==='out'&&r.flowVersion===2?'Kho xuất cho đóng gói DGGC-':'Đơn đóng gói → gia công DGGC-')+String(r.id).padStart(6,'0');const rid=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES(?,?,?,?,?,?,?)').run(kind,operation,note,'completed',req.session.user.name,date,'packing:'+r.id).lastInsertRowid);for(const l of items)db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(l.productId,kind,bucket,l.quantity,note,'completed',req.session.user.name,date,operation,rid);return rid};
 const route=(fn,mutation=false)=>(req,res,next)=>{try{if(mutation)db.exec('BEGIN IMMEDIATE');const result=fn(req);if(mutation)db.exec('COMMIT');res.json(result??{ok:true})}catch(e){if(mutation&&db.isTransaction)db.exec('ROLLBACK');if(e.status)res.status(e.status).json({error:e.message});else next(e)}};
 const warehouse=req=>{if(!managesWarehouse(req.session.user))fail('Chỉ kho hoặc Admin được chuẩn bị và xuất vật tư',403)};
 const owner=(req,r)=>{if(req.session.user.role!=='admin'&&(req.session.user.role!=='packer'||req.session.user.id!==r.requesterId))fail('Chỉ nhân viên đóng gói tạo đơn được kiểm nhận và hoàn tất',403)};
 const worker=(req,r)=>{if(req.session.user.role!=='admin'&&(req.session.user.id!==r.processorId||req.session.user.role!=='processor'))fail('Chỉ nhân viên gia công được giao đơn được thực hiện',403)};
 const state=(r,expected)=>{if(r.status!==expected)fail('Đơn không ở trạng thái phù hợp; hãy tải lại dữ liệu')};
 app.get('/api/packing-orders',route(req=>db.prepare('SELECT id FROM packing_orders ORDER BY id DESC').all().map(x=>read(x.id)).filter(r=>managesWarehouse(req.session.user)||r.requesterId===req.session.user.id||(req.session.user.role==='processor'&&((r.flowVersion===2&&r.status==='issued'&&!r.processorId)||(r.processorId===req.session.user.id&&!['pending','prepared'].includes(r.status)))))));
 app.post('/api/packing-orders',route(req=>{
  if(req.session.user.role!=='packer')fail('Nhân viên đóng gói tạo đơn đầu ngày',403);
  const b=req.body,orderDate=text(b.orderDate,true,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)||!Number.isFinite(Date.parse(orderDate))||new Date(orderDate).toISOString().slice(0,10)!==orderDate)fail('Ngày đơn không hợp lệ');
  const dueDate=b.dueDate?text(b.dueDate,true,50):null;if(dueDate&&!Number.isFinite(Date.parse(dueDate)))fail('Hạn cần hàng không hợp lệ');
  const purpose=b.purpose??'order';if(!['order','stock'].includes(purpose))fail('Loại đơn không hợp lệ');
  const payload={...(b.pickupItems?{pickupItems:rows(b.pickupItems).map(({productId,quantity})=>({productId,quantity}))}:{}),flowVersion:2,purpose,reference:text(b.reference??'',false,100),orderDate,dueDate:dueDate?new Date(dueDate).toISOString():null,note:text(b.note||''),items:rows(b.items).map(l=>({...l,good:0,faulty:0})),inputs:[],snapshot:[],events:[],tokens:[],createdAt:new Date().toISOString()};
  const id=Number(db.prepare("INSERT INTO packing_orders(requesterId,status,payload) VALUES(?,'pending',?)").run(req.session.user.id,JSON.stringify(payload)).lastInsertRowid);const r=read(id);event(req,r,'Đóng gói tạo đơn');return {ok:true,id};
 },true));
 app.post('/api/packing-orders/:id/print-forms/:type',route(req=>{
  const r=read(req.params.id),type=req.params.type;
  if(!Object.hasOwn(packingPrintLabels,type))fail('Loại phiếu không hợp lệ');
  if(!managesWarehouse(req.session.user))owner(req,r);
  let form;try{form=validatePackingPrint(req.body,r,db.prepare('SELECT id,name,unit FROM products').all(),db.prepare('SELECT id,name FROM users').all(),type)}catch(e){fail(e.message)}
  const selected=form.lines.map(({productId,quantity})=>({productId,quantity}));
  const previous=type==='pickup'?(r.pickupItems||r.inputs):r.items;
  if(!sameLines(selected,previous)){
   const allowed=type==='pickup'?['pending','prepared']:['pending','prepared','warehouse_issued','packing_received'];
   if(!allowed.includes(r.status))fail(type==='pickup'?'Kho đã xuất: không thể đổi hàng trên phiếu lấy hàng':'Đã chuyển gia công: không thể đổi danh sách sản phẩm',409);
   for(const l of selected)product(l.productId);
   if(type==='pickup'){r.pickupItems=selected;r.inputs=[];if(r.status==='prepared')r.status='pending';}
   else r.items=selected.map(l=>({...l,good:0,faulty:0}));
  }else if(type==='pickup'&&!r.pickupItems)r.pickupItems=selected;
  r.printForms={...r.printForms,[type]:form};event(req,r,'Lưu mẫu '+packingPrintLabels[type]);return {ok:true,form};
 },true));
 app.post('/api/packing-orders/:id/prepare',route(req=>{
  warehouse(req);const r=read(req.params.id);state(r,'pending');
  const snapshot=[];for(const item of r.items)product(item.productId);r.inputs=rows(req.body.inputs);
  if(r.pickupItems&&!sameLines(r.inputs,r.pickupItems))fail('Hàng chuẩn bị phải đúng mặt hàng và số lượng trên phiếu lấy hàng');
  r.inputs=r.inputs.map(l=>({...l,issued:0,consumed:0}));r.snapshot=snapshot;r.flowVersion=2;r.processorId=null;r.status='prepared';event(req,r,'Kho chuẩn bị xong',{inputs:r.inputs});
 },true));
 app.post('/api/packing-orders/:id/issue',route(req=>{
  warehouse(req);const r=read(req.params.id);state(r,'prepared');r.flowVersion=2;
  const packer=db.prepare("SELECT id,name FROM users WHERE id=? AND role='packer' AND locked=0").get(r.requesterId);if(!packer)fail('Người đóng gói đã khóa hoặc đổi vai trò');
  if(!r.inputs.length)fail('Chưa có hàng chuẩn bị');
  if(r.pickupItems&&!sameLines(r.inputs,r.pickupItems))fail('Hàng xuất không khớp phiếu lấy hàng');
  for(const l of r.inputs){product(l.productId);l.stage=resolveStockStage(db,l.productId,-l.quantity,l.stage);changeStock(db,l.productId,-l.quantity,l.stage);change(l.productId,'withPacking',l.quantity);l.issued=l.quantity}
  r.issueReceipt=receipt(req,r,'out','stock','issue_stock',r.inputs);for(const l of r.inputs)db.prepare('UPDATE movements SET stage=? WHERE receiptId=? AND productId=?').run(l.stage,r.issueReceipt,l.productId);
  const header=db.prepare('SELECT * FROM receipts WHERE id=?').get(r.issueReceipt);const lines=db.prepare('SELECT * FROM movements WHERE receiptId=?').all(r.issueReceipt);
  const printData={...defaultOutboundPrint({...header,items:lines},db.prepare('SELECT * FROM products').all()),receiver:'Đóng gói (Bên nhận)',receiverName:packer.name};
  db.prepare('UPDATE receipts SET printData=? WHERE id=?').run(JSON.stringify(printData),r.issueReceipt);
  r.flowVersion=2;r.processorId=null;r.status='warehouse_issued';event(req,r,'Kho xuất cho đóng gói');return {ok:true,receiptId:r.issueReceipt};
 },true));
 app.post('/api/packing-orders/:id/receive-materials',route(req=>{
  const r=read(req.params.id);owner(req,r);state(r,'warehouse_issued');r.status='packing_received';event(req,r,'Đóng gói xác nhận nhận hàng từ kho');
 },true));
 app.post('/api/packing-orders/:id/send-processing',route(req=>{
  const r=read(req.params.id);owner(req,r);state(r,'packing_received');
  for(const l of r.inputs){product(l.productId);change(l.productId,'withPacking',-l.issued);change(l.productId,'inProduction',l.issued)}
  r.processorId=null;r.productionSlipCode='GC-DGGC-'+String(r.id).padStart(6,'0');r.status='issued';
  event(req,r,'Đóng gói xuất qua gia công',{productionSlipCode:r.productionSlipCode});return {ok:true,productionSlipCode:r.productionSlipCode};
 },true));
 app.post('/api/packing-orders/:id/accept',route(req=>{
  const r=read(req.params.id);
  if(r.flowVersion===2&&!r.processorId){if(req.session.user.role!=='processor')fail('Chỉ nhân viên gia công được nhận việc',403);state(r,'issued');r.processorId=req.session.user.id}
  else{worker(req,r);state(r,'issued')}
  r.status='working';event(req,r,'Gia công nhận việc');
 },true));
 app.post('/api/packing-orders/:id/finish',route(req=>{const r=read(req.params.id);worker(req,r);state(r,'working');for(const l of r.inputs){change(l.productId,'inProduction',-l.issued);l.consumed=l.issued}const bad=[];req.body.defects??=[];if(req.body.defects!==undefined){if(!Array.isArray(req.body.defects)||req.body.defects.length>100)fail('Danh sách hàng lỗi không hợp lệ');const seen=new Set();for(const row of req.body.defects){const pid=qty(row.productId),item=r.items.find(l=>l.productId===pid),faulty=qty(row.faulty,true);if(!item||seen.has(pid)||faulty>item.quantity)fail('Số hàng lỗi hoặc mã hàng không hợp lệ');seen.add(pid);if(faulty){item.faulty=faulty;item.defectReason=text(row.reason,true);bad.push({productId:pid,quantity:faulty})}}r.defectsReported=true;r.defectReview=bad.length?'pending':'none'}for(const l of r.items){product(l.productId);change(l.productId,'inTransit',l.quantity-l.faulty)}r.status=r.items.every(l=>l.faulty===l.quantity)?'received':'awaiting_packing';event(req,r,'Gia công hoàn thành, chuyển đóng gói',{items:r.items.map(l=>({productId:l.productId,good:l.quantity-l.faulty,faulty:l.faulty,reason:l.defectReason||''})),faultyReceipt:r.faultyReceipt});},true));
 app.post('/api/packing-orders/:id/confirm-defects',route(req=>{
  warehouse(req);const r=read(req.params.id);if(r.defectReview!=='pending')fail('Không có hàng lỗi chờ xác nhận hoặc đã được nhập kho',409);
  const bad=r.items.filter(l=>l.faulty>0).map(l=>({productId:l.productId,quantity:l.faulty}));if(!bad.length)fail('Không có hàng lỗi chờ nhận');
  for(const l of bad)change(l.productId,'faulty',l.quantity);
  r.faultyReceipt=receipt(req,r,'in','faulty','receive_faulty',bad);r.defectReview='confirmed';r.defectsConfirmedAt=new Date().toISOString();r.defectsConfirmedBy=req.session.user.name;
  event(req,r,'Kho xác nhận nhận hàng lỗi',{items:bad,faultyReceipt:r.faultyReceipt});return {ok:true,faultyReceiptId:r.faultyReceipt};
 },true));
 app.post('/api/packing-orders/:id/receive',route(req=>{
  const r=read(req.params.id);owner(req,r);state(r,'awaiting_packing');const token=text(req.body.token,true,100);if(r.tokens.includes(token))fail('Lần nhận này đã ghi nhận');if(!Array.isArray(req.body.items)||!req.body.items.length||req.body.items.length>100)fail('Cần nhập số nhận theo từng sản phẩm');const seen=new Set(),bad=[],goodStock=[],actual=[];
  for(const row of req.body.items){const pid=qty(row.productId),good=qty(row.good,true),faulty=qty(row.faulty,true),item=r.items.find(x=>x.productId===pid);if(r.defectsReported&&faulty)fail('Hàng lỗi đã được gia công khai báo');if(!item||seen.has(pid)||!good&&!faulty||good+faulty>item.quantity-item.good-item.faulty)fail('Số nhận vượt số chờ, sai mã hoặc bị trùng');seen.add(pid);product(pid);const reason=faulty?text(row.reason,true):'';change(pid,'inTransit',-good-faulty);if(good&&r.purpose==='stock'){changeStock(db,pid,good,'finished');goodStock.push({productId:pid,quantity:good})}if(faulty){change(pid,'faulty',faulty);bad.push({productId:pid,quantity:faulty})}item.good+=good;item.faulty+=faulty;actual.push({productId:pid,good,faulty,reason})}
  const goodReceipt=receipt(req,r,'in','stock','receive_stock',goodStock),faultyReceipt=receipt(req,r,'in','faulty','receive_faulty',bad);r.tokens.push(token);if(r.items.every(l=>l.good+l.faulty===l.quantity))r.status='received';event(req,r,'Đóng gói kiểm nhận',{items:actual,goodReceipt,faultyReceipt});return {ok:true,status:r.status};
 },true));
 app.post('/api/packing-orders/:id/complete',route(req=>{const r=read(req.params.id);owner(req,r);state(r,'received');if(r.defectReview==='pending')fail('Chờ kho xác nhận nhận hàng lỗi trước khi hoàn tất đơn');r.status='completed';event(req,r,r.purpose==='stock'?'Hoàn thành nhập stock về kho':'Đóng gói hoàn thành',{good:r.items.map(l=>({productId:l.productId,quantity:l.good})),faulty:r.items.map(l=>({productId:l.productId,quantity:l.faulty}))})},true));
}
