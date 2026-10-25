import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import bcrypt from 'bcryptjs';
import {setupAccounts} from '../scripts/setup-accounts.mjs';

function database(t){
 const root=mkdtempSync(join(tmpdir(),'ebg-setup-accounts-')),path=join(root,'ebg.db');
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 const db=new DatabaseSync(path);
 db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,username TEXT UNIQUE,email TEXT UNIQUE,password TEXT,role TEXT,locked INTEGER DEFAULT 0); CREATE TABLE audit(user TEXT,action TEXT,date TEXT);');
 return {db,path};
}

test('setup provides all four roles with unique passwords, and reruns preserve credentials',t=>{
 const {db,path}=database(t);
 try{
  const created=setupAccounts(path);
  assert.deepEqual(created.map(a=>a.username),['admin','kho','giacong','donggoi']);
  assert.equal(new Set(created.map(a=>a.password)).size,4);
  for(const account of created){const saved=db.prepare('SELECT * FROM users WHERE username=?').get(account.username);assert.equal(account.created,true);assert.ok(account.password.length>=12);assert.notEqual(saved.password,account.password);assert.ok(bcrypt.compareSync(account.password,saved.password))}
  const before=db.prepare('SELECT * FROM users ORDER BY id').all();
  assert.ok(setupAccounts(path).every(a=>!a.created&&!a.password));
  assert.deepEqual(db.prepare('SELECT * FROM users ORDER BY id').all(),before);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get().n,4);
 }finally{db.close()}
});

test('setup retains existing personal accounts and locked accounts without role or password changes',t=>{
 const {db,path}=database(t);
 try{
  const insert=db.prepare('INSERT INTO users(name,username,email,password,role,locked) VALUES(?,?,?,?,?,?)');
  insert.run('Chủ kho','owner','owner@example.com','existing-owner-hash','admin',0);
  insert.run('Kho cũ','kho',null,'locked-warehouse-hash','warehouse',1);
  insert.run('Gia công','custom_worker',null,'existing-worker-hash','processor',0);
  insert.run('Tên bị dùng','donggoi',null,'existing-other-hash','processor',0);
  const before=db.prepare('SELECT * FROM users ORDER BY id').all();
  const result=setupAccounts(path);
  assert.equal(result[0].username,'owner');assert.equal(result[0].created,false);
  assert.equal(result[1].username,'kho_2');assert.equal(result[1].created,true);
  assert.equal(result[2].username,'custom_worker');assert.equal(result[2].created,false);
  assert.equal(result[3].username,'donggoi_2');assert.equal(result[3].created,true);
  assert.deepEqual(db.prepare('SELECT * FROM users WHERE id<=4 ORDER BY id').all(),before);
 }finally{db.close()}
});

test('setup refuses a missing database and rolls back if auditing fails',t=>{
 const {db,path}=database(t);
 try{
  const missing=join(path,'missing.db');assert.throws(()=>setupAccounts(missing),/Chưa có database/);assert.equal(existsSync(missing),false);
  db.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'audit unavailable'); END;");
  assert.throws(()=>setupAccounts(path),/audit unavailable/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,0);
 }finally{db.close()}
});
