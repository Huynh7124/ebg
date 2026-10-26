import {managesWarehouse} from '../shared/roles.js';
export const stockStages=['raw','semi','finished','unclassified'];
export const stageNames={raw:'NVL',semi:'BTP',finished:'TP',unclassified:'Chưa phân loại'};
const fail=message=>{throw Object.assign(Error(message),{status:400})};
export function resolveStockStage(db,pid,delta,stage){
 if(stage!==undefined&&stage!==null&&stage!==''){if(!stockStages.includes(stage))fail('Giai đoạn tồn không hợp lệ');return stage}
 const p=db.prepare('SELECT materialKind FROM products WHERE id=?').get(pid);
 if(delta>=0)return stockStages.includes(p?.materialKind)?p.materialKind:'unclassified';
 const rows=db.prepare('SELECT stage FROM product_stage_stock WHERE productId=? AND quantity>0').all(pid);
 if(rows.length===1)return rows[0].stage;
 if(rows.length>1)fail('Sản phẩm có nhiều giai đoạn tồn; hãy chọn NVL, BTP hoặc TP để xuất');
 return 'unclassified';
}
export function changeStock(db,pid,delta,stage){
 const product=db.prepare('SELECT stock FROM products WHERE id=?').get(pid);if(!product||!Number.isSafeInteger(product.stock+delta)||product.stock+delta<0)fail('Tổng tồn không đủ hoặc vượt giới hạn');
 stage=resolveStockStage(db,pid,delta,stage);
 const balance=db.prepare('SELECT quantity FROM product_stage_stock WHERE productId=? AND stage=?').get(pid,stage)?.quantity||0;
 if(!Number.isSafeInteger(delta)||!Number.isSafeInteger(balance+delta)||balance+delta<0)fail('Không đủ tồn '+stageNames[stage]+' hoặc số lượng vượt giới hạn');
 db.prepare('INSERT INTO stock_stage_context(productId,stage) VALUES(?,?)').run(pid,stage);
 try{db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(delta,pid)}finally{db.prepare('DELETE FROM stock_stage_context WHERE productId=?').run(pid)}
 return stage;
}
export function setupStockStages(app,db,audit){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS product_stage_stock(productId INTEGER NOT NULL,stage TEXT NOT NULL CHECK(stage IN ('raw','semi','finished','unclassified')),quantity INTEGER NOT NULL DEFAULT 0 CHECK(typeof(quantity)='integer' AND quantity>=0),PRIMARY KEY(productId,stage));
 CREATE TABLE IF NOT EXISTS stock_stage_context(productId INTEGER PRIMARY KEY,stage TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS stage_transfers(id INTEGER PRIMARY KEY AUTOINCREMENT,productId INTEGER NOT NULL,source TEXT NOT NULL,destination TEXT NOT NULL,quantity INTEGER NOT NULL,actor TEXT NOT NULL,date TEXT NOT NULL,token TEXT NOT NULL UNIQUE);
 INSERT INTO product_stage_stock(productId,stage,quantity) SELECT p.id,CASE WHEN materialKind IN ('raw','semi','finished') THEN materialKind ELSE 'unclassified' END,p.stock FROM products p WHERE NOT EXISTS(SELECT 1 FROM product_stage_stock s WHERE s.productId=p.id);
 CREATE TRIGGER IF NOT EXISTS stage_stock_insert AFTER INSERT ON products BEGIN
 INSERT INTO product_stage_stock(productId,stage,quantity) VALUES(NEW.id,CASE WHEN NEW.materialKind IN ('raw','semi','finished') THEN NEW.materialKind ELSE 'unclassified' END,NEW.stock);
 END;
 CREATE TRIGGER IF NOT EXISTS stage_stock_update AFTER UPDATE OF stock ON products WHEN NEW.stock<>OLD.stock BEGIN
 SELECT CASE WHEN NEW.stock<OLD.stock AND NOT EXISTS(SELECT 1 FROM stock_stage_context WHERE productId=NEW.id) AND (SELECT COUNT(*) FROM product_stage_stock WHERE productId=NEW.id AND quantity>0)>1 THEN RAISE(ABORT,'STAGE_SELECTION_REQUIRED') END;
 INSERT INTO product_stage_stock(productId,stage,quantity) VALUES(NEW.id,COALESCE((SELECT stage FROM stock_stage_context WHERE productId=NEW.id),CASE WHEN NEW.stock<OLD.stock THEN (SELECT stage FROM product_stage_stock WHERE productId=NEW.id AND quantity>0 LIMIT 1) ELSE NEW.materialKind END,'unclassified'),0) ON CONFLICT DO NOTHING;
 UPDATE product_stage_stock SET quantity=quantity+NEW.stock-OLD.stock WHERE productId=NEW.id AND stage=COALESCE((SELECT stage FROM stock_stage_context WHERE productId=NEW.id),CASE WHEN NEW.stock<OLD.stock THEN (SELECT stage FROM product_stage_stock WHERE productId=NEW.id AND quantity>0 LIMIT 1) ELSE NEW.materialKind END,'unclassified');
 END;
 COMMIT;`);
 if(!db.prepare('PRAGMA table_info(movements)').all().some(c=>c.name==='stage'))db.exec('ALTER TABLE movements ADD COLUMN stage TEXT');
 app.post('/api/products/:id/stage-transfer',(req,res,next)=>{
  if(!managesWarehouse(req.session.user))return res.status(403).json({error:'Chỉ kho hoặc Admin được chuyển giai đoạn'});
  try{const {source,destination,quantity,token}=req.body,q=Number(quantity);
   if(!stockStages.includes(source)||!stockStages.includes(destination)||source===destination||!['string','number'].includes(typeof quantity)||!Number.isSafeInteger(q)||q<=0||q>1e9||typeof token!=='string'||!token||token.length>100)fail('Chọn hai giai đoạn khác nhau và số lượng nguyên dương hợp lệ');
   db.exec('BEGIN IMMEDIATE');const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);if(!p||p.locked)fail('Sản phẩm không tồn tại hoặc đã khóa');
   const prev=db.prepare('SELECT * FROM stage_transfers WHERE token=?').get(token);if(prev){if(prev.productId!==p.id||prev.source!==source||prev.destination!==destination||prev.quantity!==q)fail('Mã giao dịch đã dùng cho thao tác khác');db.exec('COMMIT');return res.json({ok:true})}
   const from=db.prepare('SELECT quantity FROM product_stage_stock WHERE productId=? AND stage=?').get(p.id,source)?.quantity||0;if(from<q)fail('Không đủ tồn '+stageNames[source]);
   db.prepare('UPDATE product_stage_stock SET quantity=quantity-? WHERE productId=? AND stage=?').run(q,p.id,source);
   db.prepare('INSERT INTO product_stage_stock(productId,stage,quantity) VALUES(?,?,?) ON CONFLICT(productId,stage) DO UPDATE SET quantity=quantity+excluded.quantity').run(p.id,destination,q);
   db.prepare('INSERT INTO stage_transfers(productId,source,destination,quantity,actor,date,token) VALUES(?,?,?,?,?,?,?)').run(p.id,source,destination,q,req.session.user.name,new Date().toISOString(),token);
   audit(req,`${p.code}: chuyển ${q} ${p.unit} từ ${stageNames[source]} sang ${stageNames[destination]}`);db.exec('COMMIT');res.json({ok:true});
  }catch(e){if(db.isTransaction)db.exec('ROLLBACK');if(e.status)res.status(e.status).json({error:e.message});else next(e)}
 });
}
export function productsWithStages(db){const stages=new Map();for(const row of db.prepare('SELECT * FROM product_stage_stock').all()){if(!stages.has(row.productId))stages.set(row.productId,{raw:0,semi:0,finished:0,unclassified:0});stages.get(row.productId)[row.stage]=row.quantity}return db.prepare('SELECT * FROM products ORDER BY id').all().map(p=>({...p,stages:stages.get(p.id)}))}
