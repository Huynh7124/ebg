import {movementTypes,receiptCode} from './shared/movements.js';
import express from 'express';
import {createServer as createHttpServer} from 'node:http';
import session from 'express-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
if(process.argv.includes('--production'))process.env.NODE_ENV='production';
const dataDir=process.env.DATA_DIR||'data';
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(join(dataDir,'ebg.db'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,username TEXT UNIQUE,password TEXT,role TEXT); CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE,type TEXT); CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,code TEXT UNIQUE,category TEXT,vehicle TEXT,color TEXT,stock INTEGER DEFAULT 0,repair INTEGER DEFAULT 0,anote INTEGER DEFAULT 0,min INTEGER DEFAULT 5,locked INTEGER DEFAULT 0,image TEXT); CREATE TABLE IF NOT EXISTS movements(id INTEGER PRIMARY KEY,productId INTEGER,kind TEXT,bucket TEXT,quantity INTEGER,note TEXT,status TEXT,user TEXT,date TEXT); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user TEXT,action TEXT,date TEXT);`);
for(const table of ['users','categories'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='locked'))db.exec(`ALTER TABLE ${table} ADD COLUMN locked INTEGER NOT NULL DEFAULT 0`);
db.prepare("UPDATE users SET role='staff' WHERE role IN ('it','warehouse')").run();
if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='email'))db.exec('ALTER TABLE users ADD COLUMN email TEXT');
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE) WHERE email IS NOT NULL AND email<>''");
const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='faulty'))db.exec('ALTER TABLE products ADD COLUMN faulty INTEGER NOT NULL DEFAULT 0');
if(!db.prepare('PRAGMA table_info(movements)').all().some(c=>c.name==='operation'))db.exec('ALTER TABLE movements ADD COLUMN operation TEXT');
db.exec('CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,operation TEXT,note TEXT,status TEXT,user TEXT,date TEXT,sourceReference TEXT)');
if(!db.prepare('PRAGMA table_info(movements)').all().some(c=>c.name==='receiptId'))db.exec('ALTER TABLE movements ADD COLUMN receiptId INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS movements_receipt_idx ON movements(receiptId)');
const initialPassword=process.env.INITIAL_ADMIN_PASSWORD||randomBytes(12).toString('base64url');
if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
for(const [name,username,role] of [['Nguyễn Minh','admin','admin'],['Nhân viên kho','kho','staff']])db.prepare('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)').run(name,username,bcrypt.hashSync(initialPassword,12),role);
console.log(`Tài khoản mẫu admin / kho — mật khẩu khởi tạo: ${initialPassword}`);
for(const name of ['Hệ thống phanh','Hệ thống truyền động','Phuộc & giảm xóc','Bánh xe & lốp','Điện & pin','Phụ kiện bảo vệ'])db.prepare('INSERT INTO categories(name,type) VALUES(?,?)').run(name,'accessory');
for(const name of ['Sur-Ron Light Bee','Talaria Sting','E Ride Pro','Sur-Ron Ultra Bee'])db.prepare('INSERT INTO categories(name,type) VALUES(?,?)').run(name,'vehicle');
const rows=[['Bộ phanh đĩa Hope Tech 4','BRK-001','Hệ thống phanh','Sur-Ron Light Bee','Đen',24,2,0,5,'brake'],['Nhông sau CNC 58T','DRV-002','Hệ thống truyền động','Talaria Sting','Đỏ',3,0,2,5,'gear'],['Phuộc trước FastAce ALX13RC','SUS-003','Phuộc & giảm xóc','Sur-Ron Light Bee','Đen',12,3,0,4,'fork'],['Lốp địa hình Shinko 241','WHL-004','Bánh xe & lốp','E Ride Pro','Đen',18,0,0,5,'tire'],['Tay thắng nhôm CNC','BRK-005','Hệ thống phanh','Talaria Sting','Bạc',4,1,3,5,'lever'],['Pin lithium 72V 40Ah','ELE-006','Điện & pin','Sur-Ron Ultra Bee','Đen',8,2,0,3,'battery'],['Ốp bảo vệ gầm nhôm','PRO-007','Phụ kiện bảo vệ','Sur-Ron Light Bee','Bạc',0,0,2,3,'guard'],['Xích tải DID 420','DRV-008','Hệ thống truyền động','E Ride Pro','Vàng',32,0,0,8,'chain']];
for(const row of rows)db.prepare('INSERT INTO products(name,code,category,vehicle,color,stock,repair,anote,min,image) VALUES(?,?,?,?,?,?,?,?,?,?)').run(...row);
db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Hệ thống','Khởi tạo dữ liệu mẫu',new Date().toISOString());
const seedMoves=[['in','stock',12,'Bổ sung phụ kiện cho kho', 'completed',1],['out','stock',2,'Xuất phụ kiện bảo dưỡng','completed',2],['in','repair',2,'Chờ kiểm tra tình trạng phuộc','pending',3],['in','anote',3,'Chờ xử lý Anote','pending',5]];
seedMoves.forEach(([kind,bucket,quantity,note,status,productId],i)=>{const date=new Date(Date.now()-(4-i)*3600000).toISOString();db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date) VALUES(?,?,?,?,?,?,?,?)').run(productId,kind,bucket,quantity,note,status,'Nguyễn Minh',date);db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Nguyễn Minh',`${kind==='in'?'Nhập':'Xuất'} ${quantity} × ${rows[productId-1][1]}${status==='pending'?' (chờ xử lý)':''}`,date)});

}
db.exec('CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,data TEXT,expires INTEGER)');
class SQLiteStore extends session.Store {
 get(sid,cb){try{const row=db.prepare('SELECT data,expires FROM sessions WHERE sid=?').get(sid);if(!row||row.expires<Date.now())return cb(null,null);cb(null,JSON.parse(row.data))}catch(e){cb(e)}}
 set(sid,value,cb){try{db.prepare('INSERT OR REPLACE INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify(value),value.cookie.expires?new Date(value.cookie.expires).getTime():Date.now()+8*3600000);db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());cb?.()}catch(e){cb?.(e)}}
 destroy(sid,cb){try{db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);cb?.()}catch(e){cb?.(e)}}
}
const app=express();if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:process.env.NODE_ENV==='production'?undefined:false}));app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next()});app.use(express.json({limit:'100kb'}));app.use(session({store:new SQLiteStore(),secret:process.env.SESSION_SECRET||randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'strict',secure:process.env.COOKIE_SECURE==='true',maxAge:8*3600000}}));
const publicUser=user=>user?{name:user.name,role:user.role}:null;
const audit=(req,action)=>db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run(req.session.user.name,action,new Date().toISOString());
app.use('/api',(req,res,next)=>{if(req.session.user){const current=db.prepare('SELECT id,name,role,locked FROM users WHERE id=?').get(req.session.user.id);if(!current||current.locked)delete req.session.user;else req.session.user={id:current.id,name:current.name,role:current.role}}next()});
const adminOnly=(req,res,next)=>req.session.user?.role==='admin'?next():res.status(403).json({error:'Chỉ Admin có quyền thực hiện thao tác này'});
const staffList=()=>db.prepare("SELECT id,name,username,email,role,locked FROM users WHERE role='staff' ORDER BY id").all();
app.get('/api/session',(req,res)=>{if(!req.session.csrf)req.session.csrf=randomBytes(24).toString('hex');res.json({user:publicUser(req.session.user),csrf:req.session.csrf})});
app.use('/api',(req,res,next)=>{if(req.method!=='GET'&&(!req.session.csrf||req.get('x-csrf-token')!==req.session.csrf))return res.status(403).json({error:'Phiên không hợp lệ. Vui lòng tải lại trang.'});next()});
app.post('/api/login',rateLimit({windowMs:15*60000,limit:10}), (req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=? OR email=? COLLATE NOCASE').get(String(req.body.username||'').trim(),normalizeEmail(req.body.username));if(!u||u.locked||!bcrypt.compareSync(String(req.body.password||''),u.password))return res.status(401).json({error:'Tên đăng nhập hoặc mật khẩu không đúng'});req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Không thể tạo phiên'});req.session.user={id:u.id,name:u.name,role:u.role};req.session.csrf=randomBytes(24).toString('hex');res.json({user:publicUser(req.session.user),csrf:req.session.csrf})})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.use('/api',(req,res,next)=>req.session.user?next():res.status(401).json({error:'Vui lòng đăng nhập'}));
app.post('/api/password',(req,res)=>{const {currentPassword,newPassword}=req.body;const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)return res.status(400).json({error:'Mật khẩu mới phải có từ 12 đến 128 ký tự'});if(!bcrypt.compareSync(String(currentPassword||''),u.password))return res.status(400).json({error:'Mật khẩu hiện tại không đúng'});db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(newPassword,12),u.id);audit(req,'Đổi mật khẩu tài khoản');res.json({ok:true})});
app.get('/api/users',adminOnly,(req,res)=>res.json(staffList()));
app.post('/api/users',adminOnly,(req,res)=>{const {name,username,password,role='staff'}=req.body;const email=normalizeEmail(req.body.email);if(email&&!validEmail(email))return res.status(400).json({error:'Email không hợp lệ'});if(typeof name!=='string'||!name.trim()||typeof username!=='string'||!/^[a-zA-Z0-9_.-]{1,40}$/.test(username)||typeof password!=='string'||password.length<12||password.length>128||role!=='staff')return res.status(400).json({error:'Thông tin nhân viên không hợp lệ; mật khẩu cần 12–128 ký tự'});try{db.prepare('INSERT INTO users(name,username,email,password,role) VALUES(?,?,?,?,?)').run(name.trim().slice(0,100),username,email||null,bcrypt.hashSync(password,12),'staff');audit(req,`Thêm nhân viên ${username}`);res.json({ok:true})}catch{res.status(400).json({error:'Tên đăng nhập hoặc email đã tồn tại'})}});
app.post('/api/users/:id',adminOnly,(req,res)=>{const u=db.prepare("SELECT * FROM users WHERE id=? AND role='staff'").get(req.params.id);if(!u)return res.status(404).json({error:'Không tìm thấy nhân viên'});const {name,username,password}=req.body;const email=req.body.email===undefined?u.email:normalizeEmail(req.body.email);if(email&&!validEmail(email))return res.status(400).json({error:'Email không hợp lệ'});if(typeof name!=='string'||!name.trim()||typeof username!=='string'||!/^[a-zA-Z0-9_.-]{1,40}$/.test(username)||req.body.role&&req.body.role!=='staff'||password&&(typeof password!=='string'||password.length<12||password.length>128))return res.status(400).json({error:'Thông tin nhân viên không hợp lệ'});try{db.prepare('UPDATE users SET name=?,username=?,email=?,password=? WHERE id=?').run(name.trim().slice(0,100),username,email||null,password?bcrypt.hashSync(password,12):u.password,u.id);if(password)db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.user.id')=?").run(u.id);audit(req,`Sửa nhân viên ${u.username}`);res.json({ok:true})}catch{res.status(400).json({error:'Tên đăng nhập hoặc email đã tồn tại'})}});
app.post('/api/users/:id/lock',adminOnly,(req,res)=>{const u=db.prepare("SELECT * FROM users WHERE id=? AND role='staff'").get(req.params.id);if(!u)return res.status(404).json({error:'Không tìm thấy nhân viên'});db.prepare('UPDATE users SET locked=? WHERE id=?').run(u.locked?0:1,u.id);if(!u.locked)db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.user.id')=?").run(u.id);audit(req,`${u.locked?'Mở khóa':'Khóa'} nhân viên ${u.username}`);res.json({ok:true})});
app.get('/api/data',(req,res)=>res.json({receipts:db.prepare('SELECT * FROM receipts ORDER BY id DESC').all(),users:req.session.user.role==='admin'?staffList():[],products:db.prepare('SELECT * FROM products ORDER BY id').all(),categories:db.prepare('SELECT * FROM categories').all(),movements:db.prepare('SELECT * FROM movements ORDER BY id DESC').all(),audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all()}));
app.post('/api/categories',adminOnly,(req,res)=>{const {name,type}=req.body;if(typeof name!=='string'||!name.trim()||name.trim().length>100||!['accessory','vehicle'].includes(type))return res.status(400).json({error:'Danh mục không hợp lệ'});try{db.prepare('INSERT INTO categories(name,type) VALUES(?,?)').run(name.trim(),type);audit(req,`Thêm danh mục ${name.trim()}`);res.json({ok:true})}catch{res.status(400).json({error:'Danh mục đã tồn tại'})}});
app.post('/api/categories/:id',adminOnly,(req,res)=>{const c=db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Không tìm thấy danh mục'});const {name}=req.body;if(typeof name!=='string'||!name.trim()||name.trim().length>100||req.body.type&&req.body.type!==c.type)return res.status(400).json({error:'Tên danh mục không hợp lệ; không thể đổi loại danh mục'});db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE categories SET name=? WHERE id=?').run(name.trim(),c.id);const field=c.type==='accessory'?'category':'vehicle';db.prepare(`UPDATE products SET ${field}=? WHERE ${field}=?`).run(name.trim(),c.name);audit(req,`Sửa danh mục ${c.name} thành ${name.trim()}`);db.exec('COMMIT');res.json({ok:true})}catch{db.exec('ROLLBACK');res.status(400).json({error:'Tên danh mục đã tồn tại'})}});
app.post('/api/categories/:id/lock',adminOnly,(req,res)=>{const c=db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Không tìm thấy danh mục'});db.prepare('UPDATE categories SET locked=? WHERE id=?').run(c.locked?0:1,c.id);audit(req,`${c.locked?'Mở khóa':'Khóa'} danh mục ${c.name}`);res.json({ok:true})});
app.post('/api/products',(req,res)=>{const p=req.body;const existing=p.id?db.prepare('SELECT * FROM products WHERE id=?').get(p.id):null;if(p.id&&!existing)return res.status(404).json({error:'Không tìm thấy sản phẩm'});if(!p.name?.trim()||!p.code?.trim()||!Number.isInteger(+p.min)||+p.min<0||!(existing?.category===p.category||db.prepare('SELECT id FROM categories WHERE name=? AND type=? AND locked=0').get(p.category,'accessory'))||!(existing?.vehicle===p.vehicle||db.prepare('SELECT id FROM categories WHERE name=? AND type=? AND locked=0').get(p.vehicle,'vehicle')))return res.status(400).json({error:'Vui lòng nhập đủ thông tin và chọn danh mục có sẵn'});try{if(existing)db.prepare('UPDATE products SET name=?,code=?,category=?,vehicle=?,color=?,min=? WHERE id=?').run(p.name,p.code,p.category,p.vehicle,p.color,+p.min,p.id);else db.prepare('INSERT INTO products(name,code,category,vehicle,color,min,image) VALUES(?,?,?,?,?,?,?)').run(p.name,p.code,p.category,p.vehicle,p.color,+p.min,'gear');audit(req,`${existing?'Sửa':'Thêm'} sản phẩm ${p.code}`);res.json({ok:true})}catch{res.status(400).json({error:'Mã sản phẩm đã tồn tại'})}});
app.post('/api/products/:id/lock',(req,res)=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);db.prepare('UPDATE products SET locked=? WHERE id=?').run(p.locked?0:1,p.id);audit(req,`${p.locked?'Mở khóa':'Khóa'} sản phẩm ${p.code}`);res.json({ok:true})});
app.post('/api/movements',(req,res)=>{
 const {operation,note}=req.body,type=movementTypes[operation];
 const items=req.body.items===undefined?[{productId:req.body.productId,quantity:req.body.quantity}]:req.body.items;
 if(!type||!Object.hasOwn(movementTypes,operation)||req.body.kind&&req.body.kind!==type.kind||!Array.isArray(items)||items.length<1||items.length>100)return res.status(400).json({error:'Chọn loại phiếu và thêm từ 1 đến 100 sản phẩm'});
 const seen=new Set(),lines=[];
 for(const item of items){
  if(!item||!['number','string'].includes(typeof item.productId)||!['number','string'].includes(typeof item.quantity)||!Number.isSafeInteger(+item.productId)||+item.productId<=0||!Number.isSafeInteger(+item.quantity)||+item.quantity<=0||seen.has(+item.productId))return res.status(400).json({error:'Mỗi sản phẩm chỉ chọn một lần, số lượng phải là số nguyên dương'});
  seen.add(+item.productId);lines.push({productId:+item.productId,quantity:+item.quantity});
 }
 if(!Number.isSafeInteger(lines.reduce((sum,line)=>sum+line.quantity,0)))return res.status(400).json({error:'Tổng số lượng vượt giới hạn'});
 const waiting=['send_anode','send_repair'].includes(operation),status=waiting?'pending':'completed';
 if(req.body.status&&req.body.status!==status||req.body.bucket&&req.body.bucket!==type.bucket)return res.status(400).json({error:'Trạng thái hoặc nhóm hàng không khớp loại phiếu'});
 db.exec('BEGIN IMMEDIATE');
 try{
  const products=[];
  for(const line of lines){
   const p=db.prepare('SELECT * FROM products WHERE id=?').get(line.productId);
   if(!p||p.locked){db.exec('ROLLBACK');return res.status(400).json({error:`Sản phẩm #${line.productId} không tồn tại hoặc đã khóa`})}
   if(type.kind==='out'&&p.stock<line.quantity){db.exec('ROLLBACK');return res.status(400).json({error:`${p.code}: chỉ còn ${p.stock}, không đủ xuất ${line.quantity}`})}
   if((type.kind==='in'||waiting)&&!Number.isSafeInteger(p[type.bucket]+line.quantity)){db.exec('ROLLBACK');return res.status(400).json({error:`${p.code}: số lượng vượt giới hạn`})}
   products.push(p);
  }
  const date=new Date().toISOString(),cleanNote=String(note||'').slice(0,500);
  const id=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date) VALUES(?,?,?,?,?,?)').run(type.kind,operation,cleanNote,status,req.session.user.name,date).lastInsertRowid);
  lines.forEach((line,i)=>{
   const q=line.quantity,p=products[i];
   if(type.kind==='in')db.prepare(`UPDATE products SET ${type.bucket}=${type.bucket}+? WHERE id=?`).run(q,p.id);
   else if(waiting)db.prepare(`UPDATE products SET stock=stock-?,${type.bucket}=${type.bucket}+? WHERE id=?`).run(q,q,p.id);
   else db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(q,p.id);
   db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(p.id,type.kind,type.bucket,q,cleanNote,status,req.session.user.name,date,operation,id);
  });
  const code=receiptCode({id,kind:type.kind});audit(req,`${type.label} ${code}: ${lines.map((l,i)=>`${l.quantity} × ${products[i].code}`).join(', ')}${waiting?' (chờ nhận về kho)':''}`);
  db.exec('COMMIT');res.json({ok:true,receiptId:id,code});
 }catch(e){db.exec('ROLLBACK');throw e}
});
app.post(['/api/receipts/:id/complete','/api/movements/:id/complete'],(req,res)=>{
 db.exec('BEGIN IMMEDIATE');
 try{
  let header,lines;
  if(req.path.startsWith('/api/receipts/')){header=db.prepare('SELECT * FROM receipts WHERE id=?').get(req.params.id);lines=header?db.prepare('SELECT * FROM movements WHERE receiptId=? ORDER BY id').all(header.id):[]}
  else{const m=db.prepare('SELECT * FROM movements WHERE id=?').get(req.params.id);header=m?.receiptId?db.prepare('SELECT * FROM receipts WHERE id=?').get(m.receiptId):null;lines=m?(header?db.prepare('SELECT * FROM movements WHERE receiptId=? ORDER BY id').all(header.id):[m]):[]}
  if(!lines.length||header&&header.status!=='pending'||lines.some(m=>m.status!=='pending')){db.exec('ROLLBACK');return res.status(400).json({error:'Phiếu không ở trạng thái chờ'})}
  const isReturn=lines.every(m=>['send_anode','send_repair'].includes(m.operation)),products=[];
  for(const m of lines){
   const p=db.prepare('SELECT * FROM products WHERE id=?').get(m.productId);
   if(!p||p.locked){db.exec('ROLLBACK');return res.status(400).json({error:`Sản phẩm #${m.productId} không tồn tại hoặc đã khóa`})}
   const delta=m.kind==='in'?m.quantity:-m.quantity;
   if(isReturn?(p[m.bucket]<m.quantity||!Number.isSafeInteger(p.stock+m.quantity)):p[m.bucket]+delta<0){db.exec('ROLLBACK');return res.status(400).json({error:`${p.code}: số lượng không đủ hoặc vượt giới hạn; chưa cập nhật phiếu`})}
   products.push(p);
  }
  const source=header?receiptCode(header):`#${lines[0].id}`,sourceReference=header?`receipt:${header.id}`:`movement:${lines[0].id}`;
  let returnedId=null;const date=new Date().toISOString(),returnNote=`Nhận về từ phiếu ${source}`;
  if(isReturn)returnedId=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES(?,?,?,?,?,?,?)').run('in','receive_stock',returnNote,'completed',req.session.user.name,date,sourceReference).lastInsertRowid);
  for(const m of lines){
   if(isReturn){
    db.prepare(`UPDATE products SET stock=stock+?,${m.bucket}=${m.bucket}-? WHERE id=?`).run(m.quantity,m.quantity,m.productId);
    db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(m.productId,'in','stock',m.quantity,returnNote,'completed',req.session.user.name,date,'receive_stock',returnedId);
   }else{const delta=m.kind==='in'?m.quantity:-m.quantity;db.prepare(`UPDATE products SET ${m.bucket}=${m.bucket}+? WHERE id=?`).run(delta,m.productId)}
   db.prepare('UPDATE movements SET status=? WHERE id=?').run('completed',m.id);
  }
  if(header)db.prepare('UPDATE receipts SET status=? WHERE id=?').run('completed',header.id);
  audit(req,`${isReturn?'Nhận về kho':'Hoàn tất phiếu cũ'} ${source}: ${lines.map((m,i)=>`${m.quantity} × ${products[i].code}`).join(', ')}`);
  db.exec('COMMIT');res.json({ok:true,receiptId:returnedId});
 }catch(e){db.exec('ROLLBACK');throw e}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Không tìm thấy API'}));
app.use((req,res,next)=>{let path;try{path=decodeURIComponent(req.path).replaceAll('\\','/')}catch{return res.sendStatus(400)}const publicViteDependency=process.env.NODE_ENV!=='production'&&/^\/node_modules\/\.vite\/deps\/[^/]+\.(?:js|css|map)$/.test(path);if(path.split('/').some(segment=>segment.startsWith('.')&&segment!=='.well-known'&&!(segment==='.vite'&&publicViteDependency))||/(?:^|\/)(?:data|test)(?:\/|$)|(?:^|\/)(?:server\.js|package(?:-lock)?\.json)$|\.(?:db|sqlite|sqlite3|db-wal|db-shm|log|pem|key|crt)$/i.test(path))return res.sendStatus(404);next()});
const httpServer=createHttpServer(app);
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile(process.cwd()+'/dist/index.html'))}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,hmr:{server:httpServer},fs:{strict:true,deny:['.env','.env.*','*.{crt,pem,key}','**/.git/**','**/data/**','**/*.{db,sqlite,sqlite3,db-wal,db-shm,log}','**/server.js','**/test/**','**/package.json','**/package-lock.json']}},appType:'spa'});app.use(vite.middlewares)}
app.use((err,req,res,next)=>{console.error(err.message);res.status(500).json({error:'Không thể xử lý yêu cầu'})});
httpServer.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('EBG server ready on port '+(process.env.PORT||3000)));
