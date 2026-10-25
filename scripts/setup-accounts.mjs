import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {roleNames} from '../shared/roles.js';

const accounts=[['admin','admin'],['warehouse','kho'],['processor','giacong'],['packer','donggoi']];

export function setupAccounts(databasePath,{keepLockedRoles=false}={}){
 if(!existsSync(databasePath))throw Error('Chưa có database tại '+resolve(databasePath)+'. Chạy ứng dụng một lần bằng npm run dev, sau đó chạy lại lệnh trên cùng máy và cùng DATA_DIR.');
 const db=new DatabaseSync(databasePath);
 try{
  db.exec('PRAGMA busy_timeout=5000');
  const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
  if(!['id','name','username','email','password','role','locked'].every(c=>columns.includes(c)))throw Error('Database chưa cập nhật. Chạy bản ứng dụng mới trước khi tạo tài khoản.');
  db.exec('BEGIN IMMEDIATE');
  try{
   const result=accounts.map(([role,preferred])=>{
    const existing=db.prepare(`SELECT username FROM users WHERE role=? ${keepLockedRoles?'':'AND locked=0'} ORDER BY CASE WHEN username=? THEN 0 ELSE 1 END,id LIMIT 1`).get(role,preferred);
    if(existing)return {role:roleNames[role],username:existing.username,created:false};
    let username=preferred,suffix=2;
    while(db.prepare('SELECT id FROM users WHERE username=? OR email=? COLLATE NOCASE').get(username,username))username=preferred+'_'+suffix++;
    const password=randomBytes(15).toString('base64url');
    db.prepare('INSERT INTO users(name,username,password,role,locked) VALUES(?,?,?,?,0)').run(roleNames[role],username,bcrypt.hashSync(password,12),role);
    db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Quản trị máy chủ',`Tạo tài khoản ${username} (${role})`,new Date().toISOString());
    return {role:roleNames[role],username,password,created:true};
   });
   db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error}
 }finally{db.close()}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const databasePath=join(process.env.DATA_DIR||'data','ebg.db');
  const accounts=setupAccounts(databasePath);
  console.log('Database: '+resolve(databasePath));
  console.table(accounts.map(a=>({'Vai trò':a.role,'Tên đăng nhập':a.username,'Mật khẩu':a.created?a.password:'Giữ mật khẩu hiện tại','Trạng thái':a.created?'Đã tạo':'Đã có'})));
  console.log('Lưu mật khẩu mới để cấp cho nhân viên. Đăng nhập tại cùng địa chỉ ứng dụng, rồi đổi mật khẩu trong Tài khoản & bảo mật.');
 }catch(error){console.error(error.message);process.exitCode=1}
}
