import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import bcrypt from 'bcryptjs';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

test('legacy IT and warehouse migrate to staff without losing accounts or categories',async t=>{
 const root=mkdtempSync(join(tmpdir(),'ebg-migration-'));mkdirSync(join(root,'data'));
 const password=randomBytes(18).toString('hex');const hash=bcrypt.hashSync(password,12);let db=new DatabaseSync(join(root,'data/ebg.db'));
 db.exec('CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,username TEXT UNIQUE,password TEXT,role TEXT);CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE,type TEXT)');
 for(const [id,role]of[[1,'admin'],[2,'it'],[3,'warehouse']])db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,'Existing '+role,role,hash,role);
 db.prepare('INSERT INTO categories VALUES(?,?,?)').run(1,'Existing category','accessory');db.close();
 let child;t.after(async()=>{if(child&&child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}rmSync(root,{recursive:true,force:true})});
 for(let attempt=0;attempt<2;attempt++){
  child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,PORT:'3194'},stdio:['ignore','pipe','pipe']});
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.on('exit',()=>{clearTimeout(timer);fail(Error('Server exited'))});child.stderr.resume()});
  db=new DatabaseSync(join(root,'data/ebg.db'));assert.deepEqual(db.prepare('SELECT role FROM users ORDER BY id').all().map(u=>u.role),['admin','staff','staff']);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM users').get().count,3);assert.equal(db.prepare('SELECT password FROM users WHERE id=2').get().password,hash);assert.equal(db.prepare('SELECT name,locked FROM categories WHERE id=1').get().name,'Existing category');assert.equal(db.prepare('SELECT locked FROM categories WHERE id=1').get().locked,0);db.close();
  const s=await fetch('http://localhost:3194/api/session');const cookie=s.headers.get('set-cookie').split(';')[0];const token=(await s.json()).csrf;
  const login=await fetch('http://localhost:3194/api/login',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':token},body:JSON.stringify({username:'it',password})});assert.equal(login.status,200);assert.equal((await login.json()).user.role,'staff');
  child.kill();await new Promise(r=>child.once('exit',r));
 }
});
