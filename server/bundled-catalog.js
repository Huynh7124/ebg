import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {changeStock} from './stock-stages.js';
const normalize=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
const identity=p=>[normalize(p.name),p.materialKind,normalize(p.unit)].join('|');
export function importBundledCatalog(db,dataDir){
 const bundle=JSON.parse(readFileSync(new URL('../imports/catalog-2026-11-03.json',import.meta.url),'utf8'));
 db.exec('CREATE TABLE IF NOT EXISTS bundled_catalog_imports(id TEXT PRIMARY KEY,report TEXT NOT NULL)');
 const done=db.prepare('SELECT report FROM bundled_catalog_imports WHERE id=?').get(bundle.id);if(done)return {...JSON.parse(done.report),alreadyImported:true};
 const report={source:bundle.id,created:0,matched:0,stockImported:0,compositions:0,review:[],warnings:bundle.warnings};
 const existing=db.prepare('SELECT * FROM products').all(),index=new Map();for(const p of existing){const key=identity(p);if(!index.has(key))index.set(key,[]);index.get(key).push(p)}
 if(existing.length){mkdirSync(join(dataDir,'backups'),{recursive:true});report.backup=join(dataDir,'backups',`before-catalog-${Date.now()}.db`);db.prepare('VACUUM INTO ?').run(report.backup)}
 db.exec('BEGIN IMMEDIATE');
 try{
  if(bundle.replace){
   // This catalog is an explicit full replacement. Keep accounts and settings,
   // but remove product-related records so no old rows leak into filters or stock.
   for(const table of ['product_stage_stock','stock_stage_context','stage_transfers','ops_boms','ops_purchases','ops_requests','ops_events','movements','receipts','packing_orders','products']){
    if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))db.exec(`DELETE FROM ${table}`);
   }
   if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='audit'").get())db.exec('DELETE FROM audit');
   report.replaced=true;
   existing.length=0;
   index.clear();
  }
  for(const [name,type] of [['sourceType',"TEXT NOT NULL DEFAULT ''"],['catalogNotes',"TEXT NOT NULL DEFAULT ''"]])if(!db.prepare('PRAGMA table_info(products)').all().some(c=>c.name===name))db.exec(`ALTER TABLE products ADD COLUMN ${name} ${type}`);
  const ids=new Map(),now=new Date().toISOString();
  for(const row of bundle.rows){
   const matches=bundle.replace?[]:(index.get(identity(row))||[]);if(matches.length>1){report.review.push({name:row.name,reason:'Nhiều sản phẩm hiện có cùng tên/loại/đơn vị; chưa nhập dòng này'});continue}
   let product=matches[0],created=false;
   const brand=db.prepare('SELECT id FROM brands WHERE name=? COLLATE NOCASE').get(row.brand);
   if(!product){
    db.prepare('INSERT OR IGNORE INTO categories(name,type) VALUES(?,?)').run(row.category,'accessory');
    const id=Number(db.prepare("INSERT INTO products(name,code,category,vehicle,color,stock,min,materialKind,unit,location,size,version,brandId,sourceType,catalogNotes) VALUES(?,?,?,?,?,0,?, ?,?,'Kho chính',?,?,?,?,?)").run(row.name,row.code,row.category,row.vehicle,row.color,row.min??5,row.materialKind,row.unit,row.size,row.version,brand?.id||null,row.sourceType||'',row.packaging.join('\n')).lastInsertRowid);
    product=db.prepare('SELECT * FROM products WHERE id=?').get(id);index.set(identity(row),[product]);created=true;report.created++;
   }else{
    report.matched++;
    db.prepare("UPDATE products SET size=CASE WHEN size='' THEN ? ELSE size END,version=CASE WHEN version='' THEN ? ELSE version END,color=CASE WHEN color='' THEN ? ELSE color END,catalogNotes=CASE WHEN catalogNotes='' THEN ? ELSE catalogNotes END WHERE id=?").run(row.size,row.version,row.color,row.packaging.join('\n'),product.id);
   }
   ids.set(row.key,product.id);
   if(row.stock!==null){
    const hasActivity=db.prepare('SELECT 1 FROM movements WHERE productId=? LIMIT 1').get(product.id);
    const hasBalances=['stock','faulty','repair','anote','inProduction','inTransit','withPacking'].some(k=>product[k]>0);
    if(!created&&(hasActivity||hasBalances)){if(product.stock!==row.stock)report.review.push({id:product.id,name:row.name,current:product.stock,excel:row.stock,reason:'Giữ tồn đang vận hành; cần đối chiếu số kiểm kê Excel'});continue}
    if(row.stock){
     changeStock(db,product.id,row.stock,row.materialKind);
     const note=`Tồn đầu kỳ từ KHO EBG cột TỔNG, dòng ${row.sourceRows.join(', ')}`;
     const rid=Number(db.prepare("INSERT INTO receipts(kind,operation,note,status,user,date,sourceReference) VALUES('in','receive_stock',?,'completed','Nhập dữ liệu Excel',?,?)").run(note,now,bundle.id+':'+row.key).lastInsertRowid);
     db.prepare("INSERT INTO movements(productId,kind,bucket,quantity,note,status,user,date,operation,receiptId,stage) VALUES(?,'in','stock',?,?,'completed','Nhập dữ liệu Excel',?,'receive_stock',?,?)").run(product.id,row.stock,note,now,rid,row.materialKind);
    }report.stockImported++;
   }
  }
  for(const c of bundle.compositions){const pid=ids.get(c.key);if(!pid||c.lines.some(l=>!ids.has(l.key))){report.review.push({name:c.key,reason:'Cấu tạo có dòng chưa đối chiếu được'});continue}
   if(db.prepare('SELECT 1 FROM ops_boms WHERE productId=?').get(pid)){report.review.push({id:pid,reason:'Giữ cấu tạo hiện có, không ghi đè tự động'});continue}
   if(c.lines.length){db.prepare('INSERT INTO ops_boms(productId,version,lines,actor,date) VALUES(?,1,?,NULL,?)').run(pid,JSON.stringify(c.lines.map(l=>({productId:ids.get(l.key),quantity:l.quantity}))),now);report.compositions++}
  }
  db.prepare('INSERT INTO bundled_catalog_imports VALUES(?,?)').run(bundle.id,JSON.stringify(report));
  db.prepare('INSERT INTO audit(user,action,date) VALUES(?,?,?)').run('Nhập dữ liệu Excel',`Nạp hai file Excel: thêm ${report.created}, khớp ${report.matched}, cần đối chiếu ${report.review.length}`,now);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e}
 writeFileSync(join(dataDir,'catalog-import-report.json'),JSON.stringify(report,null,2));return report;
}
