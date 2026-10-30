import {roleAccess,normalizeRole} from '../shared/roles.js';
import {randomBytes} from 'node:crypto';
export function migrateRoles(db){
 const hasAccess=!!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ops_access'").get();
 db.exec('BEGIN IMMEDIATE');
 try{
  db.prepare("UPDATE users SET role='processor' WHERE role='it'").run();
  if(hasAccess){db.prepare("UPDATE users SET role='warehouse' WHERE role='staff' AND id IN (SELECT userId FROM ops_access WHERE warehouse=1)").run();db.prepare("UPDATE users SET role='processor' WHERE role='staff'").run()}
  else db.prepare("UPDATE users SET role='warehouse' WHERE role='staff'").run();
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
}
export function registerPeople(app,db,audit,bcrypt,normalizeEmail,validEmail,{passwordRequired=true}={}){
 const canManage=req=>roleAccess(req.session.user.role).manageStaff;
 const guard=(req,res,next)=>canManage(req)?next():res.status(403).json({error:'Chỉ Admin hoặc nhân viên kho được quản lý nhân viên'});
 const list=req=>db.prepare(`SELECT id,name,username,email,role,locked FROM users ${req.session.user.role==='admin'?'':"WHERE role<>'admin'"} ORDER BY id DESC`).all();
 const mayTarget=(req,u)=>req.session.user.role==='admin'||u.role!=='admin';
 const cleanRole=(req,wanted,current)=>{
  const role=normalizeRole(wanted??current??'processor');if(!['admin','warehouse','processor','packer'].includes(role))return {error:'Chọn vai trò Admin, kho, gia công hoặc đóng gói',status:400};
  if(req.session.user.role!=='admin'&&(role==='admin'||current==='admin'))return {error:'Chỉ Admin được cấp vai trò hoặc thay đổi tài khoản Admin',status:403};return {role};
 };
 const lastAdmin=u=>u.role==='admin'&&!u.locked&&db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND locked=0").get().n<=1;
 app.get('/api/users',guard,(req,res)=>res.json(list(req)));
 app.post('/api/users',guard,(req,res)=>{
  const {name,username}=req.body,password=!passwordRequired&&req.body.password===undefined?randomBytes(24).toString('base64url'):req.body.password,email=normalizeEmail(req.body.email),result=cleanRole(req,req.body.role);
  if(result.error)return res.status(result.status).json({error:result.error});
  if(typeof name!=='string'||!name.trim()||name.length>100||typeof username!=='string'||!/^[a-zA-Z0-9_.-]{1,40}$/.test(username)||typeof password!=='string'||password.length<12||password.length>128||email&&!validEmail(email))return res.status(400).json({error:'Thông tin nhân viên không hợp lệ; mật khẩu cần 12–128 ký tự'});
  try{db.prepare('INSERT INTO users(name,username,email,password,role) VALUES(?,?,?,?,?)').run(name.trim(),username,email||null,bcrypt.hashSync(password,12),result.role);audit(req,`Thêm nhân viên ${username} (${result.role})`);res.json({ok:true})}catch{res.status(400).json({error:'Tên đăng nhập hoặc email đã tồn tại'})}
 });
 app.post('/api/users/:id',guard,(req,res)=>{
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);if(!u)return res.status(404).json({error:'Không tìm thấy nhân viên'});if(!mayTarget(req,u))return res.status(403).json({error:'Nhân viên kho không được sửa tài khoản Admin'});
  const {name=u.name,username=u.username,password}=req.body,email=req.body.email===undefined?u.email:normalizeEmail(req.body.email),result=cleanRole(req,req.body.role,u.role);
  if(result.error)return res.status(result.status).json({error:result.error});if(result.role!=='admin'&&lastAdmin(u))return res.status(400).json({error:'Cần giữ ít nhất một Admin đang hoạt động'});
  if(typeof name!=='string'||!name.trim()||name.length>100||typeof username!=='string'||!/^[a-zA-Z0-9_.-]{1,40}$/.test(username)||email&&!validEmail(email)||password&&(typeof password!=='string'||password.length<12||password.length>128))return res.status(400).json({error:'Thông tin nhân viên không hợp lệ'});
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('UPDATE users SET name=?,username=?,email=?,password=?,role=? WHERE id=?').run(name.trim(),username,email||null,password?bcrypt.hashSync(password,12):u.password,result.role,u.id);
   if(password){db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.user.id')=?").run(u.id);db.prepare('DELETE FROM password_reset_requests WHERE userId=?').run(u.id)}
   audit(req,`Sửa nhân viên ${u.username}${result.role!==u.role?' · '+u.role+' → '+result.role:''}`);db.exec('COMMIT');res.json({ok:true});
  }catch{db.exec('ROLLBACK');res.status(400).json({error:'Tên đăng nhập hoặc email đã tồn tại'})}
 });
 app.post('/api/users/:id/lock',guard,(req,res)=>{
  const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);if(!u)return res.status(404).json({error:'Không tìm thấy nhân viên'});if(!mayTarget(req,u))return res.status(403).json({error:'Nhân viên kho không được khóa hoặc mở khóa Admin'});if(!u.locked&&(lastAdmin(u)||u.id===req.session.user.id))return res.status(400).json({error:'Không khóa chính mình hoặc Admin hoạt động cuối cùng'});
  db.prepare('UPDATE users SET locked=? WHERE id=?').run(u.locked?0:1,u.id);if(!u.locked)db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.user.id')=?").run(u.id);audit(req,`${u.locked?'Mở khóa':'Khóa'} nhân viên ${u.username}`);res.json({ok:true});
 });
 return list;
}
