import {managesWarehouse} from '../shared/roles.js';

const code=id=>'STOCK-'+String(id).padStart(6,'0');

export function createStockWorkOrder(db,receiptId,createdBy,date){
 const result=db.prepare("INSERT INTO stock_work_orders(receiptId,status,createdBy,createdAt) VALUES(?,'open',?,?)").run(receiptId,createdBy,date);
 return Number(result.lastInsertRowid);
}

export function setupStockWorkOrders(app,db,audit){
 db.exec(`CREATE TABLE IF NOT EXISTS stock_work_orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receiptId INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','planned')),
  processorId INTEGER,
  returnAt TEXT,
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL
 )`);
 if(!db.prepare('PRAGMA table_info(stock_work_orders)').all().some(c=>c.name==='completedAt'))db.exec('ALTER TABLE stock_work_orders ADD COLUMN completedAt TEXT');
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 const read=id=>{
  const order=db.prepare('SELECT * FROM stock_work_orders WHERE id=?').get(id);
  if(!order)fail('Không tìm thấy yêu cầu stock',404);
  return {...order,status:order.completedAt?'completed':order.status,code:code(order.id),items:db.prepare('SELECT productId,quantity,stage FROM movements WHERE receiptId=? ORDER BY id').all(order.receiptId)};
 };
 const visible=(req,order)=>managesWarehouse(req.session.user)||order.status==='open'||order.processorId===req.session.user.id;
 app.get('/api/stock-work-orders',(req,res)=>{
  if(req.session.user.role!=='processor'&&!managesWarehouse(req.session.user))return res.status(403).json({error:'Chỉ gia công, kho hoặc Admin được xem yêu cầu stock'});
  res.json(db.prepare('SELECT id FROM stock_work_orders ORDER BY id DESC').all().map(row=>read(row.id)).filter(order=>visible(req,order)));
 });
 app.post('/api/stock-work-orders/:id/complete',(req,res,next)=>{
  try{
   db.exec('BEGIN IMMEDIATE');const order=read(req.params.id);
   if(req.session.user.role!=='processor'||order.processorId!==req.session.user.id)fail('Chỉ người nhận gia công được hoàn thành đơn stock',403);
   if(order.status!=='planned')fail('Đơn chưa nhận hoặc đã hoàn thành');
   db.prepare('UPDATE stock_work_orders SET completedAt=? WHERE id=?').run(new Date().toISOString(),order.id);
   audit(req,`${code(order.id)} · gia công hoàn thành hàng stock`);
   db.exec('COMMIT');res.json({ok:true});
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');if(error.status)res.status(error.status).json({error:error.message});else next(error)}
 });
 app.post('/api/stock-work-orders/:id/claim',(req,res,next)=>{
  try{
   if(req.session.user.role!=='processor')fail('Chỉ nhân viên gia công được nhận yêu cầu stock',403);
   const value=String(req.body.returnAt||''),time=Date.parse(value);
   if(!Number.isFinite(time)||time<=Date.now())fail('Chọn ngày giờ trả hàng stock ở tương lai');
   db.exec('BEGIN IMMEDIATE');
   const order=read(req.params.id);if(order.status!=='open'||order.processorId)fail('Yêu cầu stock đã có nhân viên gia công nhận');
   db.prepare("UPDATE stock_work_orders SET status='planned',processorId=?,returnAt=? WHERE id=?").run(req.session.user.id,new Date(time).toISOString(),order.id);
   audit(req,`${code(order.id)} · nhận gia công, hẹn trả ${new Date(time).toISOString()}`);
   db.exec('COMMIT');res.json({ok:true});
  }catch(error){if(db.isTransaction)db.exec('ROLLBACK');if(error.status)res.status(error.status).json({error:error.message});else next(error)}
 });
}
