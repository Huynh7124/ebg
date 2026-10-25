import {normalizeRole} from '../shared/roles.js';
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {emitKeypressEvents} from 'node:readline';
import bcrypt from 'bcryptjs';
export function createAccount({databasePath,email,name,role='admin',password}){
 role=normalizeRole(role);email=String(email||'').trim().toLowerCase();name=String(name||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>100||!['admin','warehouse','processor'].includes(role)||typeof password!=='string'||password.length<12||password.length>128)throw Error('Email, họ tên hoặc mật khẩu không hợp lệ (mật khẩu 12–128 ký tự).');
 if(!existsSync(databasePath))throw Error('Chưa có database. Chạy bản mới bằng npm run dev một lần, dừng ứng dụng rồi chạy lại lệnh này.');
 const db=new DatabaseSync(databasePath);
 try{
  if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='email'))throw Error('Database chưa cập nhật. Chạy bản mới bằng npm run dev trước.');
  if(db.prepare('SELECT id FROM users WHERE username=? OR email=? COLLATE NOCASE').get(email,email))throw Error('Email đã có tài khoản. Không ghi đè tài khoản hoặc mật khẩu hiện có.');
  db.exec('BEGIN IMMEDIATE');
  try{db.prepare('INSERT INTO users(name,username,email,password,role,locked) VALUES(?,?,?,?,?,0)').run(name,email,email,bcrypt.hashSync(password,12),role);db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Quản trị máy chủ',`Tạo tài khoản ${email} (${role})`,new Date().toISOString());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
  return {email,role};
 }finally{db.close()}
}
export function hiddenQuestion(label){
 return new Promise((ok,fail)=>{const input=process.stdin;let value='';process.stdout.write(label);emitKeypressEvents(input);input.setRawMode(true);input.resume();
 const finish=()=>{input.off('keypress',key);input.setRawMode(false);input.pause();process.stdout.write('\n')};
 function key(str,k={}){if(k.ctrl&&k.name==='c'){finish();fail(Error('Đã hủy.'));return}if(k.name==='return'){finish();ok(value);return}if(k.name==='backspace'){if(value.length){value=value.slice(0,-1);process.stdout.write('\b \b')}return}if(str&&!k.ctrl&&!k.meta&&!str.includes('\u001b')){value+=str;process.stdout.write('*')}}
 input.on('keypress',key);
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2){if(!['--email','--name','--role'].includes(args[i])||!args[i+1])throw Error('Dùng: npm run account:create -- --email EMAIL --name "Họ tên" --role admin');options[args[i].slice(2)]=args[i+1]}
  if(!process.stdin.isTTY)throw Error('Mở Terminal hoặc PowerShell tương tác để nhập mật khẩu an toàn. Không truyền mật khẩu qua tham số.');
  const password=await hiddenQuestion('Nhập mật khẩu mới (12–128 ký tự): ');const confirm=await hiddenQuestion('Nhập lại mật khẩu: ');if(password!==confirm)throw Error('Hai mật khẩu không khớp.');
  const result=createAccount({databasePath:join(process.env.DATA_DIR||'data','ebg.db'),...options,password});
  console.log(`Đã tạo tài khoản ${result.email} (${result.role}) trong database trên máy này. Không gửi email; dùng mật khẩu vừa nhập để đăng nhập.`);
 }catch(e){console.error(e.message);process.exitCode=1}
}
