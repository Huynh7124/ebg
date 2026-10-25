import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,access} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
const output=process.argv[2];
if(!output){console.error('Dùng: npm run backup -- /đường/dẫn/ebg-backup.db');process.exit(1)}
const source=resolve(process.env.DATA_DIR||'data','ebg.db'),target=resolve(output);
try{await access(target);throw Error('Đích đã tồn tại; chọn tên mới để giữ bản cũ')}catch(e){if(e.code!=='ENOENT')throw e}
await mkdir(dirname(target),{recursive:true});const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,target);const check=new DatabaseSync(target,{readOnly:true});try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Bản sao không qua kiểm tra toàn vẹn')}finally{check.close()}console.log('Đã tạo bản sao nhất quán:',target)}finally{db.close()}
