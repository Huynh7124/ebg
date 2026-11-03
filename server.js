import {importBundledCatalog} from './server/bundled-catalog.js';
import {initializeBrands,registerBrands} from './server/brands.js';
import {registerDashboardActivity} from './server/dashboard-activity.js';
import {setupStockStages,productsWithStages,changeStock,resolveStockStage} from './server/stock-stages.js';
import {createStockWorkOrder,setupStockWorkOrders} from './server/stock-work-orders.js';
import {setupPackingOrders} from './server/packing-orders.js';
import {migrateRoles,registerPeople} from './server/roles.js';
import {setupAccounts} from './scripts/setup-accounts.mjs';
import {managesWarehouse} from './shared/roles.js';
import {setupOperations,productMetadata} from './server/operations.js';
import {withCompositionSummary} from './server/composition-summary.js';
import {validateOutboundPrint} from './shared/outbound-print.js';
import {movementTypes,receiptCode} from './shared/movements.js';
import {matchesProduct} from './shared/product-filters.js';
import {googleAuthConfig,registerGoogleAuth} from './server/google-auth.js';
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
const passwordRequired=process.env.REQUIRE_PASSWORD==='1';
const googleAuth=googleAuthConfig();
mkdirSync(dataDir,{recursive:true});
const db=new DatabaseSync(join(dataDir,'ebg.db'));
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,username TEXT UNIQUE,password TEXT,role TEXT); CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE,type TEXT); CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT,code TEXT UNIQUE,category TEXT,vehicle TEXT,color TEXT,stock INTEGER DEFAULT 0,repair INTEGER DEFAULT 0,anote INTEGER DEFAULT 0,min INTEGER DEFAULT 5,locked INTEGER DEFAULT 0,image TEXT); CREATE TABLE IF NOT EXISTS movements(id INTEGER PRIMARY KEY,productId INTEGER,kind TEXT,bucket TEXT,quantity INTEGER,note TEXT,status TEXT,user TEXT,date TEXT); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user TEXT,action TEXT,date TEXT);`);
if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='version'))db.exec("ALTER TABLE products ADD COLUMN version TEXT NOT NULL DEFAULT ''");
if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='size'))db.exec("ALTER TABLE products ADD COLUMN size TEXT NOT NULL DEFAULT ''");
for(const table of ['users','categories'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='locked'))db.exec(`ALTER TABLE ${table} ADD COLUMN locked INTEGER NOT NULL DEFAULT 0`);

if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='email'))db.exec('ALTER TABLE users ADD COLUMN email TEXT');
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE) WHERE email IS NOT NULL AND email<>''");
const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='faulty'))db.exec('ALTER TABLE products ADD COLUMN faulty INTEGER NOT NULL DEFAULT 0');
if(!db.prepare('PRAGMA table_info(movements)').all().some(c=>c.name==='operation'))db.exec('ALTER TABLE movements ADD COLUMN operation TEXT');
db.exec('CREATE TABLE IF NOT EXISTS receipts(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT,operation TEXT,note TEXT,status TEXT,user TEXT,date TEXT,sourceReference TEXT)');
if(!db.prepare('PRAGMA table_info(movements)').all().some(c=>c.name==='receiptId'))db.exec('ALTER TABLE movements ADD COLUMN receiptId INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS movements_receipt_idx ON movements(receiptId)');
if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='unitType'))db.exec("ALTER TABLE products ADD COLUMN unitType TEXT NOT NULL DEFAULT ''");
if(!db.prepare('PRAGMA table_info(receipts)').all().some(c=>c.name==='anodeVendor'))db.exec('ALTER TABLE receipts ADD COLUMN anodeVendor TEXT');
for(const table of ['receipts','movements'])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name==='printData'))db.exec(`ALTER TABLE ${table} ADD COLUMN printData TEXT`);
const initialPassword=process.env.INITIAL_ADMIN_PASSWORD||randomBytes(12).toString('base64url');
if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
for(const [name,username,role] of [['Nguyễn Minh','admin','admin'],['Nhân viên kho','kho','warehouse']])db.prepare('INSERT INTO users(name,username,password,role) VALUES(?,?,?,?)').run(name,username,bcrypt.hashSync(initialPassword,12),role);
if(passwordRequired)console.log(`Tài khoản mẫu admin / kho — mật khẩu khởi tạo: ${initialPassword}`);
for(const name of ['Hệ thống phanh','Hệ thống truyền động','Phuộc & giảm xóc','Bánh xe & lốp','Điện & pin','Phụ kiện bảo vệ'])db.prepare('INSERT INTO categories(name,type) VALUES(?,?)').run(name,'accessory');
for(const name of ['Sur-Ron Light Bee','Talaria Sting','E Ride Pro','Sur-Ron Ultra Bee'])db.prepare('INSERT INTO categories(name,type) VALUES(?,?)').run(name,'vehicle');
if(!process.argv.includes('--bundled-catalog')){
const rows=[['Bộ phanh đĩa Hope Tech 4','BRK-001','Hệ thống phanh','Sur-Ron Light Bee','Đen',24,2,0,5,'brake'],['Nhông sau CNC 58T','DRV-002','Hệ thống truyền động','Talaria Sting','Đỏ',3,0,2,5,'gear'],['Phuộc trước FastAce ALX13RC','SUS-003','Phuộc & giảm xóc','Sur-Ron Light Bee','Đen',12,3,0,4,'fork'],['Lốp địa hình Shinko 241','WHL-004','Bánh xe & lốp','E Ride Pro','Đen',18,0,0,5,'tire'],['Tay thắng nhôm CNC','BRK-005','Hệ thống phanh','Talaria Sting','Bạc',4,1,3,5,'lever'],['Pin lithium 72V 40Ah','ELE-006','Điện & pin','Sur-Ron Ultra Bee','Đen',8,2,0,3,'battery'],['Ốp bảo vệ gầm nhôm','PRO-007','Phụ kiện bảo vệ','Sur-Ron Light Bee','Bạc',0,0,2,3,'guard'],['Xích tải DID 420','DRV-008','Hệ thống truyền động','E Ride Pro','Vàng',32,0,0,8,'chain']];
for(const row of rows)db.prepare('INSERT INTO products(name,code,category,vehicle,color,stock,repair,anote,min,image) VALUES(?,?,?,?,?,?,?,?,?,?)').run(...row);
db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Hệ thống','Khởi tạo dữ liệu mẫu',new Date().toISOString());
const seedMoves=[['in','stock',12,'Bổ sung phụ kiện cho kho', 'completed',1],['out','stock',2,'Xuất phụ kiện bảo dưỡng','completed',2],['in','repair',2,'Chờ kiểm tra tình trạng phuộc','pending',3],['in','anote',3,'Chờ xử lý Anote','pending',5]];
seedMoves.forEach(([kind,bucket,quantity,note,status,productId],i)=>{const date=new Date(Date.now()-(4-i)*3600000).toISOString();db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date) VALUES(?,?,?,?,?,?,?,?)').run(productId,kind,bucket,quantity,note,status,'Nguyễn Minh',date);db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Nguyễn Minh',`${kind==='in'?'Nhập':'Xuất'} ${quantity} × ${rows[productId-1][1]}${status==='pending'?' (chờ xử lý)':''}`,date)});
}

}
initializeBrands(db);
migrateRoles(db);
if(!passwordRequired)setupAccounts(join(dataDir,'ebg.db'),{keepLockedRoles:true});
db.exec('CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY,data TEXT,expires INTEGER)');
class SQLiteStore extends session.Store {
 get(sid,cb){try{const row=db.prepare('SELECT data,expires FROM sessions WHERE sid=?').get(sid);if(!row||row.expires<Date.now())return cb(null,null);cb(null,JSON.parse(row.data))}catch(e){cb(e)}}
 set(sid,value,cb){try{db.prepare('INSERT OR REPLACE INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify(value),value.cookie.expires?new Date(value.cookie.expires).getTime():Date.now()+8*3600000);db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());cb?.()}catch(e){cb?.(e)}}
 destroy(sid,cb){try{db.prepare('DELETE FROM sessions WHERE sid=?').run(sid);cb?.()}catch(e){cb?.(e)}}
}
const app=express();if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:process.env.NODE_ENV==='production'?undefined:false}));app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');next()});app.use(express.json({limit:'2mb'}));app.use(session({store:new SQLiteStore(),secret:process.env.SESSION_SECRET||randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='true',maxAge:8*3600000}}));
const publicUser=user=>user?{name:user.name,role:user.role}:null;
const audit=(req,action)=>db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run(req.session.user.name,action,new Date().toISOString());
app.use('/api',(req,res,next)=>{if(req.session.user){const current=db.prepare('SELECT id,name,role,locked FROM users WHERE id=?').get(req.session.user.id);if(!current||current.locked)delete req.session.user;else req.session.user={id:current.id,name:current.name,role:current.role}}next()});
const warehouseOnly=(req,res,next)=>managesWarehouse(req.session.user)?next():res.status(403).json({error:'Chỉ Admin hoặc nhân viên kho có quyền thực hiện thao tác này'});
db.exec('CREATE TABLE IF NOT EXISTS password_reset_requests(userId INTEGER PRIMARY KEY,requestedAt TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS google_access_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE COLLATE NOCASE,requestedAt TEXT NOT NULL)');

app.get('/api/session',(req,res)=>{if(!req.session.csrf)req.session.csrf=randomBytes(24).toString('hex');res.json({user:publicUser(req.session.user),csrf:req.session.csrf,passwordRequired,googleAuthEnabled:googleAuth.enabled})});
app.get('/api/login-users',(req,res)=>{if(passwordRequired)return res.status(404).json({error:'Đăng nhập bằng mật khẩu đang bật'});res.json(db.prepare('SELECT name,username,role FROM users WHERE locked=0 ORDER BY id').all())});
registerGoogleAuth(app,db,{publicUser,normalizeEmail,config:googleAuth});
app.use('/api',(req,res,next)=>{if(req.method!=='GET'&&(!req.session.csrf||req.get('x-csrf-token')!==req.session.csrf))return res.status(403).json({error:'Phiên không hợp lệ. Vui lòng tải lại trang.'});next()});
app.post('/api/login',rateLimit({windowMs:15*60000,limit:passwordRequired?10:120}), (req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=? OR email=? COLLATE NOCASE').get(String(req.body.username||'').trim(),normalizeEmail(req.body.username));if(!u||u.locked||passwordRequired&&!bcrypt.compareSync(String(req.body.password||''),u.password))return res.status(401).json({error:passwordRequired?'Tên đăng nhập hoặc mật khẩu không đúng':'Tài khoản không tồn tại hoặc đã khóa'});req.session.regenerate(err=>{if(err)return res.status(500).json({error:'Không thể tạo phiên'});req.session.user={id:u.id,name:u.name,role:u.role};req.session.csrf=randomBytes(24).toString('hex');res.json({user:publicUser(req.session.user),csrf:req.session.csrf})})});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.post('/api/forgot-password',rateLimit({windowMs:15*60000,limit:5}),(req,res)=>{const username=String(req.body.username||'').trim().slice(0,254);const u=db.prepare("SELECT id FROM users WHERE (username=? OR email=? COLLATE NOCASE) AND role<>'admin' AND locked=0").get(username,normalizeEmail(username));if(u)db.prepare('INSERT INTO password_reset_requests(userId,requestedAt) VALUES(?,?) ON CONFLICT(userId) DO UPDATE SET requestedAt=excluded.requestedAt').run(u.id,new Date().toISOString());res.json({ok:true})});
app.use('/api',(req,res,next)=>req.session.user?next():res.status(401).json({error:'Vui lòng đăng nhập'}));
setupOperations(app,db,audit);
setupStockStages(app,db,audit);
setupPackingOrders(app,db,audit);
setupStockWorkOrders(app,db,audit);
registerDashboardActivity(app,db);
if(process.argv.includes('--bundled-catalog')){const imported=importBundledCatalog(db,dataDir);console.log(`Dữ liệu Excel: ${imported.created} sản phẩm mới, ${imported.matched} khớp, ${imported.review.length} cần đối chiếu${imported.alreadyImported?' (đã nạp trước đó)':''}`)}
app.post('/api/profile',(req,res)=>{const name=req.body.name;if(typeof name!=='string'||!name.trim()||name.trim().length>100)return res.status(400).json({error:'Họ tên cần từ 1 đến 100 ký tự'});db.prepare('UPDATE users SET name=? WHERE id=?').run(name.trim(),req.session.user.id);audit(req,'Đổi họ tên hiển thị');req.session.user.name=name.trim();res.json({ok:true})});

app.post('/api/password',(req,res)=>{const {currentPassword,newPassword}=req.body;const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>128)return res.status(400).json({error:'Mật khẩu mới phải có từ 12 đến 128 ký tự'});if(!bcrypt.compareSync(String(currentPassword||''),u.password))return res.status(400).json({error:'Mật khẩu hiện tại không đúng'});db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(newPassword,12),u.id);audit(req,'Đổi mật khẩu tài khoản');res.json({ok:true})});
registerBrands(app,db,warehouseOnly,audit);
const staffList=registerPeople(app,db,audit,bcrypt,normalizeEmail,validEmail,{passwordRequired});
app.get('/api/data',(req,res)=>{const products=productsWithStages(db);res.json({brands:db.prepare('SELECT * FROM brands ORDER BY name').all(),recoveryRequests:managesWarehouse(req.session.user)?db.prepare("SELECT r.userId,r.requestedAt,u.username,u.name FROM password_reset_requests r JOIN users u ON u.id=r.userId WHERE u.role<>'admin' AND u.locked=0 ORDER BY r.requestedAt DESC").all():[],googleAccessRequests:managesWarehouse(req.session.user)?db.prepare('SELECT * FROM google_access_requests ORDER BY requestedAt DESC').all():[],receipts:req.session.user.role==='processor'?[]:db.prepare('SELECT * FROM receipts ORDER BY id DESC').all(),users:managesWarehouse(req.session.user)?staffList(req):[],products:req.session.user.role==='processor'?products.map(({id,name,code,unit})=>({id,name,code,unit})):req.query.summary==='0'?products:withCompositionSummary(db,products),categories:db.prepare('SELECT * FROM categories').all(),movements:req.session.user.role==='processor'?[]:db.prepare('SELECT * FROM movements ORDER BY id DESC').all(),audit:db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all()})});
app.get('/api/products-page',(req,res)=>{if(req.session.user.role==='processor')return res.status(403).json({error:'Gia công không có quyền tra cứu vật tư'});const limit=Math.min(100,Math.max(10,Number.parseInt(req.query.limit,10)||40)),cursor=Math.max(0,Number.parseInt(req.query.cursor,10)||0),search=String(req.query.search||'').slice(0,150),vehicle=String(req.query.vehicle||'').slice(0,100),color=String(req.query.color||'').slice(0,40),unitType=String(req.query.unitType||'').slice(0,30),category=String(req.query.category||'').slice(0,100),materialKind=String(req.query.materialKind||''),status=String(req.query.status||'all');const all=withCompositionSummary(db,productsWithStages(db)),rows=all.filter(product=>(!materialKind||product.materialKind===materialKind)&&matchesProduct(product,{search,vehicle,color,unitType,brand:String(req.query.brand||''),size:String(req.query.size||''),version:String(req.query.version||'')})&&(!category||product.category===category)&&(status==='all'||status==='faulty'&&product.faulty>0||status==='empty'&&!product.locked&&product.stock===0||status==='low'&&!product.locked&&product.stock>0&&product.stock<=product.min||status==='locked'&&product.locked||status==='pending'&&(product.repair>0||product.anote>0))),items=rows.sort((a,b)=>b.id-a.id).slice(cursor,cursor+limit),nextCursor=cursor+items.length<rows.length?cursor+items.length:null;res.json({items,total:rows.length,nextCursor,hasMore:nextCursor!==null})});
app.post('/api/categories',warehouseOnly,(req,res)=>{const {name,type}=req.body;if(typeof name!=='string'||!name.trim()||name.trim().length>100||!['accessory','vehicle'].includes(type))return res.status(400).json({error:'Danh mục không hợp lệ'});const brandId=type==='vehicle'&&req.body.brandId?Number(req.body.brandId):null;if(brandId&&!db.prepare('SELECT id FROM brands WHERE id=? AND locked=0').get(brandId))return res.status(400).json({error:'Thương hiệu không hợp lệ'});if(type==='vehicle'&&req.body.brandId!==undefined&&!brandId)return res.status(400).json({error:'Chọn thương hiệu cho dòng xe'});try{db.prepare('INSERT INTO categories(name,type,brandId) VALUES(?,?,?)').run(name.trim(),type,brandId);audit(req,`Thêm danh mục ${name.trim()}`);res.json({ok:true})}catch{res.status(400).json({error:'Danh mục đã tồn tại'})}});
app.post('/api/categories/:id',warehouseOnly,(req,res)=>{const c=db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Không tìm thấy danh mục'});const {name}=req.body;if(typeof name!=='string'||!name.trim()||name.trim().length>100||req.body.type&&req.body.type!==c.type)return res.status(400).json({error:'Tên danh mục không hợp lệ; không thể đổi loại danh mục'});const brandId=c.type==='vehicle'?(req.body.brandId===undefined?c.brandId:Number(req.body.brandId)||null):null;if(c.type==='vehicle'&&req.body.brandId!==undefined&&(!brandId||!db.prepare('SELECT id FROM brands WHERE id=? AND locked=0').get(brandId)))return res.status(400).json({error:'Chọn thương hiệu hợp lệ'});db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE categories SET name=?,brandId=? WHERE id=?').run(name.trim(),brandId,c.id);if(c.type==='vehicle')db.prepare('UPDATE products SET brandId=? WHERE vehicle=?').run(brandId,c.name);const field=c.type==='accessory'?'category':'vehicle';db.prepare(`UPDATE products SET ${field}=? WHERE ${field}=?`).run(name.trim(),c.name);audit(req,`Sửa danh mục ${c.name} thành ${name.trim()}`);db.exec('COMMIT');res.json({ok:true})}catch{db.exec('ROLLBACK');res.status(400).json({error:'Tên danh mục đã tồn tại'})}});
app.post('/api/categories/:id/lock',warehouseOnly,(req,res)=>{const c=db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);if(!c)return res.status(404).json({error:'Không tìm thấy danh mục'});db.prepare('UPDATE categories SET locked=? WHERE id=?').run(c.locked?0:1,c.id);audit(req,`${c.locked?'Mở khóa':'Khóa'} danh mục ${c.name}`);res.json({ok:true})});
app.post('/api/products',(req,res)=>{
 const p=req.body,existing=p.id?db.prepare('SELECT * FROM products WHERE id=?').get(p.id):null;
 if(!p.code)p.code=existing?.code||'EBG-'+randomBytes(8).toString('hex');
 if(p.id&&!existing)return res.status(404).json({error:'Không tìm thấy sản phẩm'});
 const model=db.prepare("SELECT brandId FROM categories WHERE type='vehicle' AND name=?").get(p.vehicle||'');
 if(p.brandId!==undefined&&p.brandId!==null&&p.brandId!==''&&(!Number.isSafeInteger(Number(p.brandId))||Number(p.brandId)<=0))return res.status(400).json({error:'Thương hiệu không hợp lệ'});
 const brandId=p.brandId===undefined?(model?.brandId||existing?.brandId||null):(Number(p.brandId)||null);
 if((brandId&&!db.prepare('SELECT id FROM brands WHERE id=? AND locked=0').get(brandId))||(model?.brandId&&brandId!==model.brandId))return res.status(400).json({error:'Dòng xe không thuộc thương hiệu đã chọn'});
 const size=p.size===undefined?(existing?.size||''):String(p.size);if(!['','220','230','240','250','270'].includes(size))return res.status(400).json({error:'Size không hợp lệ'});
 const version=p.version===undefined?(existing?.version||''):p.version;if(typeof version!=='string'||version.trim().length>60||version.trim()==='__none__')return res.status(400).json({error:'Version không hợp lệ (tối đa 60 ký tự)'});
 const unitType=p.unitType===undefined?(existing?.unitType||''):p.unitType;
 if(!['','single','double'].includes(unitType)||typeof p.name!=='string'||!p.name.trim()||p.name.length>180||typeof p.code!=='string'||!p.code.trim()||p.code.length>80||!Number.isSafeInteger(+p.min)||+p.min<0||!(existing?.category===p.category||db.prepare('SELECT id FROM categories WHERE name=? AND type=? AND locked=0').get(p.category,'accessory'))||!(p.vehicle===''||existing?.vehicle===p.vehicle||db.prepare('SELECT id FROM categories WHERE name=? AND type=? AND locked=0').get(p.vehicle,'vehicle')))return res.status(400).json({error:'Vui lòng nhập đủ thông tin và chọn danh mục có sẵn'});
 let m;try{m=productMetadata(db,p,existing)}catch(e){return res.status(400).json({error:e.message})}
 db.exec('BEGIN IMMEDIATE');try{
  if(existing)db.prepare('UPDATE products SET name=?,code=?,category=?,vehicle=?,color=?,min=?,unitType=?,materialKind=?,unit=?,location=?,rawProductId=? WHERE id=?').run(p.name.trim(),p.code.trim(),p.category,p.vehicle,String(p.color||'').slice(0,40),+p.min,unitType,m.materialKind,m.unit,m.location,m.rawProductId,p.id);
  else db.prepare('INSERT INTO products(name,code,category,vehicle,color,min,image,unitType,materialKind,unit,location,rawProductId) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(p.name.trim(),p.code.trim(),p.category,p.vehicle,String(p.color||'').slice(0,40),+p.min,'gear',unitType,m.materialKind,m.unit,m.location,m.rawProductId);
  db.prepare('UPDATE products SET size=?,brandId=?,version=? WHERE code=?').run(size,brandId,version.trim(),p.code.trim());
  audit(req,`${existing?'Sửa':'Thêm'} sản phẩm ${p.code}`);db.exec('COMMIT');res.json({ok:true});
 }catch{db.exec('ROLLBACK');res.status(400).json({error:'Mã sản phẩm đã tồn tại hoặc dữ liệu không hợp lệ'})}
});
app.post('/api/products/:id/lock',(req,res)=>{const p=db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);if(!p)return res.sendStatus(404);db.prepare('UPDATE products SET locked=? WHERE id=?').run(p.locked?0:1,p.id);audit(req,`${p.locked?'Mở khóa':'Khóa'} sản phẩm ${p.code}`);res.json({ok:true})});
app.post('/api/movements',(req,res)=>{
 const anodeVendor=req.body.operation==='send_anode'?(req.body.anodeVendor===undefined?'nam_thai':req.body.anodeVendor):null;
 if(req.body.operation==='send_anode'&&!['nam_thai','binh_phat'].includes(anodeVendor))return res.status(400).json({error:'Chọn đơn vị Anode Nam Thái hoặc Bình Phát'});
 const {operation,note}=req.body,type=movementTypes[operation];
 const items=req.body.items===undefined?[{productId:req.body.productId,quantity:req.body.quantity}]:req.body.items;
 if(!type||!Object.hasOwn(movementTypes,operation)||req.body.kind&&req.body.kind!==type.kind||!Array.isArray(items)||items.length<1||items.length>100)return res.status(400).json({error:'Chọn loại phiếu và thêm từ 1 đến 100 sản phẩm'});
 const seen=new Set(),lines=[];
 for(const item of items){
  if(!item||!['number','string'].includes(typeof item.productId)||!['number','string'].includes(typeof item.quantity)||!Number.isSafeInteger(+item.productId)||+item.productId<=0||!Number.isSafeInteger(+item.quantity)||+item.quantity<=0||seen.has(+item.productId))return res.status(400).json({error:'Mỗi sản phẩm chỉ chọn một lần, số lượng phải là số nguyên dương'});
  seen.add(+item.productId);lines.push({productId:+item.productId,quantity:+item.quantity,stage:operation==='receive_cnc'?'rough':item.stage});
 }
 if(!Number.isSafeInteger(lines.reduce((sum,line)=>sum+line.quantity,0)))return res.status(400).json({error:'Tổng số lượng vượt giới hạn'});
 const repairFaulty=operation==='send_repair'&&req.body.source==='faulty';
 const waiting=['send_anode','send_repair'].includes(operation),stockWork=operation==='send_stock',status=waiting?'pending':'completed';
 if(req.body.status&&req.body.status!==status||req.body.bucket&&req.body.bucket!==type.bucket)return res.status(400).json({error:'Trạng thái hoặc nhóm hàng không khớp loại phiếu'});
 db.exec('BEGIN IMMEDIATE');
 try{
  const products=[];
  for(const line of lines){
   const p=db.prepare('SELECT * FROM products WHERE id=?').get(line.productId);
   if(!p||p.locked){db.exec('ROLLBACK');return res.status(400).json({error:`Sản phẩm #${line.productId} không tồn tại hoặc đã khóa`})}
   if(type.kind==='out'&&p[repairFaulty?'faulty':'stock']<line.quantity){db.exec('ROLLBACK');return res.status(400).json({error:`${p.code}: chỉ còn ${p.stock}, không đủ xuất ${line.quantity}`})}
   if((type.kind==='in'||waiting)&&!Number.isSafeInteger(p[type.bucket]+line.quantity)||stockWork&&!Number.isSafeInteger(p.inProduction+line.quantity)){db.exec('ROLLBACK');return res.status(400).json({error:`${p.code}: số lượng vượt giới hạn`})}
   if(!repairFaulty&&(type.bucket==='stock'||type.kind==='out'))line.stage=resolveStockStage(db,p.id,type.kind==='in'?line.quantity:-line.quantity,line.stage);
   products.push(p);
  }
  const date=new Date().toISOString(),cleanNote=String(note||'').slice(0,500);
  const id=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date,anodeVendor) VALUES(?,?,?,?,?,?,?)').run(type.kind,operation,cleanNote,status,req.session.user.name,date,anodeVendor).lastInsertRowid);
  lines.forEach((line,i)=>{
   const q=line.quantity,p=products[i];
   if(type.kind==='in'){if(type.bucket==='stock')changeStock(db,p.id,q,line.stage);else db.prepare(`UPDATE products SET ${type.bucket}=${type.bucket}+? WHERE id=?`).run(q,p.id)}else{if(repairFaulty)db.prepare('UPDATE products SET faulty=faulty-? WHERE id=?').run(q,p.id);else changeStock(db,p.id,-q,line.stage);if(waiting)db.prepare(`UPDATE products SET ${type.bucket}=${type.bucket}+? WHERE id=?`).run(q,p.id);if(stockWork)db.prepare('UPDATE products SET inProduction=inProduction+? WHERE id=?').run(q,p.id)}
   db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(p.id,type.kind,type.bucket,q,cleanNote,status,req.session.user.name,date,operation,id);
   db.prepare('UPDATE movements SET stage=? WHERE receiptId=? AND productId=?').run(line.stage||null,id,p.id);
  });
  if(stockWork)createStockWorkOrder(db,id,req.session.user.name,date);
  const code=receiptCode({id,kind:type.kind});audit(req,`${type.label} ${code}: ${lines.map((l,i)=>`${l.quantity} × ${products[i].code}`).join(', ')}${waiting?' (chờ nhận về kho)':''}`);
  db.exec('COMMIT');res.json({ok:true,receiptId:id,code});
 }catch(e){db.exec('ROLLBACK');throw e}
});
app.post(['/api/receipts/:id/complete','/api/movements/:id/complete'],warehouseOnly,(req,res)=>{
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
  const faults=req.body.faults||{};if(typeof faults!=='object'||Array.isArray(faults)||Object.keys(faults).some(id=>!lines.some(m=>String(m.id)===id))||lines.some(m=>!Number.isSafeInteger(Number(faults[m.id]||0))||Number(faults[m.id]||0)<0||Number(faults[m.id]||0)>m.quantity)){db.exec('ROLLBACK');return res.status(400).json({error:'Số hàng lỗi không hợp lệ'})}
  const source=header?receiptCode(header):`#${lines[0].id}`,sourceReference=header?`receipt:${header.id}`:`movement:${lines[0].id}`;
  let returnedId=null;const date=new Date().toISOString(),returnNote=`Nhận về từ phiếu ${source}`;
  if(isReturn)returnedId=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES(?,?,?,?,?,?,?)').run('in','receive_stock',returnNote,'completed',req.session.user.name,date,sourceReference).lastInsertRowid);
  for(const m of lines){
   if(isReturn){
    const faulty=Number(faults[m.id]||0),good=m.quantity-faulty;
    if(good)changeStock(db,m.productId,good,m.stage||undefined);
    if(faulty){db.prepare('UPDATE products SET faulty=faulty+? WHERE id=?').run(faulty,m.productId);const fid=Number(db.prepare('INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES(?,?,?,?,?,?,?)').run('in','receive_faulty',returnNote,'completed',req.session.user.name,date,sourceReference).lastInsertRowid);db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(m.productId,'in','faulty',faulty,returnNote,'completed',req.session.user.name,date,'receive_faulty',fid)}db.prepare(`UPDATE products SET ${m.bucket}=${m.bucket}-? WHERE id=?`).run(m.quantity,m.productId);
    if(good)db.prepare('INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId) VALUES(?,?,?,?,?,?,?,?,?,?)').run(m.productId,'in','stock',good,returnNote,'completed',req.session.user.name,date,'receive_stock',returnedId);
    db.prepare('UPDATE movements SET stage=? WHERE receiptId=? AND productId=?').run(m.stage,returnedId,m.productId);
   }else{const delta=m.kind==='in'?m.quantity:-m.quantity;db.prepare(`UPDATE products SET ${m.bucket}=${m.bucket}+? WHERE id=?`).run(delta,m.productId)}
   db.prepare('UPDATE movements SET status=? WHERE id=?').run('completed',m.id);
  }
  if(header)db.prepare('UPDATE receipts SET status=? WHERE id=?').run('completed',header.id);
  audit(req,`${isReturn?'Nhận về kho':'Hoàn tất phiếu cũ'} ${source}: ${lines.map((m,i)=>`${m.quantity} × ${products[i].code}`).join(', ')}`);
  db.exec('COMMIT');res.json({ok:true,receiptId:returnedId});
 }catch(e){db.exec('ROLLBACK');throw e}
});
app.post(['/api/receipts/:id/print','/api/movements/:id/print'],(req,res)=>{
 db.exec('BEGIN IMMEDIATE');
 try{
  let header,items;
  if(req.path.startsWith('/api/receipts/')){header=db.prepare('SELECT * FROM receipts WHERE id=?').get(req.params.id);items=header?db.prepare('SELECT * FROM movements WHERE receiptId=? ORDER BY id').all(header.id):[]}
  else{const m=db.prepare('SELECT * FROM movements WHERE id=?').get(req.params.id);header=m?.receiptId?db.prepare('SELECT * FROM receipts WHERE id=?').get(m.receiptId):null;items=m?(header?db.prepare('SELECT * FROM movements WHERE receiptId=? ORDER BY id').all(header.id):[m]):[]}
  if(!items.length){db.exec('ROLLBACK');return res.status(404).json({error:'Không tìm thấy phiếu'})}
  let clean;try{clean=validateOutboundPrint(req.body.printData,items)}catch(e){db.exec('ROLLBACK');return res.status(400).json({error:e.message})}
  const table=header?'receipts':'movements',id=header?.id||items[0].id;
  db.prepare(`UPDATE ${table} SET printData=? WHERE id=?`).run(JSON.stringify(clean),id);
  const code=header?receiptCode(header):`CŨ-${String(id).padStart(6,'0')}`;audit(req,`Chỉnh thông tin bản in phiếu ${code}`);db.exec('COMMIT');res.json({ok:true,receiptKey:header?`receipt:${id}`:`movement:${id}`});
 }catch(e){db.exec('ROLLBACK');throw e}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Không tìm thấy API'}));
app.use((req,res,next)=>{let path;try{path=decodeURIComponent(req.path).replaceAll('\\','/')}catch{return res.sendStatus(400)}const publicViteDependency=process.env.NODE_ENV!=='production'&&/^\/node_modules\/\.vite\/deps\/[^/]+\.(?:js|css|map)$/.test(path);if(path.split('/').some(segment=>segment.startsWith('.')&&segment!=='.well-known'&&!(segment==='.vite'&&publicViteDependency))||/(?:^|\/)(?:data|test|server)(?:\/|$)|(?:^|\/)(?:server\.js|package(?:-lock)?\.json)$|\.(?:db|sqlite|sqlite3|db-wal|db-shm|log|pem|key|crt)$/i.test(path))return res.sendStatus(404);next()});
const httpServer=createHttpServer(app);
if(process.env.NODE_ENV==='production'){app.use(express.static('dist'));app.get('/{*path}',(req,res)=>res.sendFile(process.cwd()+'/dist/index.html'))}else{const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true,hmr:{server:httpServer},fs:{strict:true,deny:['.env','.env.*','*.{crt,pem,key}','**/.git/**','**/data/**','**/*.{db,sqlite,sqlite3,db-wal,db-shm,log}','**/server.js','**/test/**','**/server/**','**/package.json','**/package-lock.json']}},appType:'spa'});app.use(vite.middlewares)}
app.use((err,req,res,next)=>{if(err.status)return res.status(err.status).json({error:err.message});if(err.message?.includes('STAGE_SELECTION_REQUIRED'))return res.status(400).json({error:'Chọn giai đoạn tồn để xuất; sản phẩm đang có cả NVL/BTP/TP'});console.error(err.message);res.status(500).json({error:'Không thể xử lý yêu cầu'})});
httpServer.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('EBG server ready on port '+(process.env.PORT||3000)));
