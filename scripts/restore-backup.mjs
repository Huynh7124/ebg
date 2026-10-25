import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,access} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const [sourceArg,targetArg]=process.argv.slice(2);
if(!sourceArg||!targetArg){console.error('Dùng: npm run backup:restore -- /bản-sao.db /thư-mục-dữ-liệu-mới');process.exit(1)}
const source=resolve(sourceArg),dir=resolve(targetArg),target=join(dir,'ebg.db');
try{await access(target);throw Error('Đích đã có database. Khôi phục vào thư mục mới; giữ nguyên kho đang dùng.')}catch(e){if(e.code!=='ENOENT')throw e}
const input=new DatabaseSync(source,{readOnly:true});
try{
 if(input.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Bản sao không toàn vẹn');
 for(const name of ['users','products','movements'])if(!input.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name))throw Error('Không phải cơ sở dữ liệu EBG');
 await mkdir(dir,{recursive:true});await backup(input,target);
 const out=new DatabaseSync(target,{readOnly:true});try{if(out.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Khôi phục không toàn vẹn');console.log('Đã khôi phục',out.prepare('SELECT COUNT(*) n FROM products').get().n,'mã hàng vào',dir)}finally{out.close()}
 console.log('Dừng máy chủ cũ, kiểm tra dữ liệu và đặt DATA_DIR tới thư mục mới trước khi khởi động.');
}finally{input.close()}
