import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {importBundledCatalog} from '../server/bundled-catalog.js';
test('bundled Excel imports stock once, preserves active stock, backs up and links compositions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-catalog-'));
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{env:{...process.env,DATA_DIR:root,PORT:'3299',REQUIRE_PASSWORD:'0'},stdio:['ignore','pipe','pipe']});let log='',db;
 child.stderr.on('data',d=>log+=d);
 try{
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(log||'timeout')),20000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(log))})});
  child.kill();await new Promise(r=>child.once('exit',r));
  db=new DatabaseSync(join(root,'ebg.db'));
  const bundle=JSON.parse(readFileSync(new URL('../imports/catalog-2026-10-30.json',import.meta.url)));
  const row=bundle.rows.find(r=>r.stock>0);
  // A live matching product with a different count must never be overwritten.
  const initial=db.prepare('SELECT * FROM products WHERE id=1').get();
  db.prepare('UPDATE products SET name=?,materialKind=?,unit=? WHERE id=1').run(row.name,row.materialKind,row.unit);
  const before=db.prepare('SELECT * FROM products WHERE id=1').get();
  const report=importBundledCatalog(db,root);assert.equal(report.created,bundle.rows.length-1);assert.equal(report.matched,1);assert.ok(existsSync(report.backup));assert.ok(report.review.some(r=>r.id===1));assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock,initial.stock);
  for(const r of bundle.rows){if(r.key===row.key)continue;const p=db.prepare('SELECT * FROM products WHERE code=?').get(r.code);assert.ok(p);assert.equal(p.stock,r.stock||0);assert.equal(p.version,r.version);const sum=db.prepare('SELECT SUM(quantity) n FROM product_stage_stock WHERE productId=?').get(p.id).n||0;assert.equal(sum,p.stock)}
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ops_boms').get().n,292);
  const snapshot=JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all()),receipts=db.prepare('SELECT COUNT(*) n FROM receipts').get().n;
  assert.equal(importBundledCatalog(db,root).alreadyImported,true);assert.equal(JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all()),snapshot);assert.equal(db.prepare('SELECT COUNT(*) n FROM receipts').get().n,receipts);
 }finally{db?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true})}
});
