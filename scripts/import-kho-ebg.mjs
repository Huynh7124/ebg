import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const path=join(process.env.DATA_DIR||'data','ebg.db');
if(!existsSync(path))throw Error('Chạy npm run dev một lần rồi dừng trước khi nhập.');
const rows=JSON.parse(readFileSync(new URL('../imports/kho-ebg.json',import.meta.url),'utf8'));
const db=new DatabaseSync(path);let count=0,skipped=0;
try{
 db.exec('BEGIN IMMEDIATE');
 db.exec('CREATE TABLE IF NOT EXISTS catalog_import_rows(source TEXT,row INTEGER,productId INTEGER,PRIMARY KEY(source,row))');
 if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name==='sourceType'))db.exec("ALTER TABLE products ADD COLUMN sourceType TEXT NOT NULL DEFAULT ''");
 for(const row of rows){
  if(db.prepare('SELECT 1 FROM catalog_import_rows WHERE source=? AND row=?').get('KHO EBG',row.row)){skipped++;continue}
  const kind={TP:'finished',NVL:'raw',BTP:'semi'}[row.type]||'unclassified';
  db.prepare('INSERT OR IGNORE INTO categories(name,type) VALUES(?,?)').run(row.category,'accessory');
  const id=Number(db.prepare("INSERT INTO products(name,code,category,vehicle,color,stock,min,materialKind,unit,location,sourceType) VALUES(?,?,?,'','',?,0,?,?,'Kho chính',?)").run(row.name,'KEBG-'+row.row,row.category,row.stock,kind,row.unit,row.type).lastInsertRowid);
  if(row.stock){const date=new Date().toISOString();const rid=Number(db.prepare("INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES('in','receive_stock',?,'completed','Nhập Excel',?,?)").run('Tồn đầu kỳ KHO EBG dòng '+row.row,date,'KHO EBG:'+row.row).lastInsertRowid);db.prepare("INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId,stage) VALUES(?,'in','stock',?,?,'completed','Nhập Excel',?,'receive_stock',?,?)").run(id,row.stock,'Tồn đầu kỳ từ cột TỔNG',date,rid,kind)}
  db.prepare('INSERT INTO catalog_import_rows VALUES(?,?,?)').run('KHO EBG',row.row,id);count++;
 }
 db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Nhập Excel',`Nhập KHO EBG: ${count} sản phẩm`,new Date().toISOString());
 db.exec('COMMIT');console.log(`Đã thêm ${count} sản phẩm; bỏ qua ${skipped} dòng đã nhập.`);
}catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e}finally{db.close()}
