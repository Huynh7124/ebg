import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import bcrypt from 'bcryptjs';
import {hiddenQuestion} from './create-account.mjs';
try{
 const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--username'||!args[1])throw Error('Dùng: npm run account:reset -- --username EMAIL_HOẶC_TÊN_ĐĂNG_NHẬP');
 if(!process.stdin.isTTY)throw Error('Mở Terminal tương tác để nhập mật khẩu an toàn.');
 const path=join(resolve(process.env.DATA_DIR||'data'),'ebg.db');if(!existsSync(path))throw Error('Không tìm thấy database. Kiểm tra DATA_DIR.');
 const db=new DatabaseSync(path);try{
 const user=db.prepare('SELECT id,username FROM users WHERE username=? OR email=? COLLATE NOCASE').get(args[1],args[1]);if(!user)throw Error('Không tìm thấy tài khoản.');
 const password=await hiddenQuestion('Mật khẩu mới (12–128 ký tự): ');if(password.length<12||password.length>128)throw Error('Mật khẩu cần từ 12 đến 128 ký tự.');if(password!==await hiddenQuestion('Nhập lại mật khẩu: '))throw Error('Mật khẩu nhập lại không khớp.');
 db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(password,12),user.id);db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.user.id')=?").run(user.id);if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='password_reset_requests'").get())db.prepare('DELETE FROM password_reset_requests WHERE userId=?').run(user.id);db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Quản trị máy chủ',`Đặt lại mật khẩu ${user.username}`,new Date().toISOString());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}console.log('Đã đặt lại mật khẩu và kết thúc các phiên đăng nhập cũ.');
 }finally{db.close()}
}catch(e){console.error(e.message);process.exitCode=1}
