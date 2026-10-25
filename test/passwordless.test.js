import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

test('account selection login preserves sessions, locks, roles and optional password authentication',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-passwordless-')),password=randomBytes(20).toString('hex'),base='http://127.0.0.1:3231/api/';let child;
 async function stop(){if(child&&child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve))}}
 async function start(mode){let errors='';child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,DATA_DIR:join(root,'data'),PORT:'3231',REQUIRE_PASSWORD:mode,INITIAL_ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>errors+=d);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(errors||'Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error(errors||'Server exited'))})})}
 t.after(async()=>{await stop();await rm(root,{recursive:true,force:true})});
 function client(){let cookie='',csrf='';return {async req(path,body,expected=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];if(data.csrf)csrf=data.csrf;assert.equal(r.status,expected,path+': '+JSON.stringify(data));return data},async login(username){await this.req('session');return this.req('login',{username,role:'admin'})}}}
 const snapshot=()=>{const db=new DatabaseSync(join(root,'data','ebg.db'));try{return {users:db.prepare('SELECT * FROM users ORDER BY id').all(),products:db.prepare('SELECT * FROM products ORDER BY id').all()}}finally{db.close()}};
 await start('0');const admin=client(),processor=client(),packer=client();
 await t.test('lists only active account display fields, requires CSRF and logs in without a password',async()=>{
  const users=await admin.req('login-users');assert.deepEqual(users.map(u=>u.username),['admin','kho','giacong','donggoi']);assert.ok(users.every(u=>Object.keys(u).sort().join(',')==='name,role,username'));
  await admin.req('data',undefined,401);await admin.req('login',{username:'admin'},403);
  assert.equal((await admin.req('session')).passwordRequired,false);await admin.req('login',{username:'missing'},401);assert.equal((await admin.login('admin')).user.role,'admin');
 });
 await t.test('selected worker keeps server-side role and cannot mutate stock or employees',async()=>{
  assert.equal((await processor.login('giacong')).user.role,'processor');assert.equal((await packer.login('donggoi')).user.role,'packer');
  for(const worker of [processor,packer]){await worker.req('users',undefined,403);await worker.req('users',{name:'No',username:'no',role:'admin'},403);await worker.req('movements',{operation:'receive_stock',items:[{productId:1,quantity:1}]},403);assert.equal((await worker.req('ops')).access.warehouse,false)}
  await processor.req('logout',{});await processor.req('data',undefined,401);assert.equal((await processor.req('session')).user,null);assert.equal((await processor.req('login',{username:'kho'})).user.role,'warehouse');
 });
 await t.test('creates employees without passwords and removes locked accounts and their sessions',async()=>{
  await admin.req('users',{name:'Nhân viên mới',username:'worker_new',role:'packer'});assert.equal((await client().login('worker_new')).user.role,'packer');
  const selected=(await admin.req('users')).find(u=>u.username==='donggoi');await admin.req(`users/${selected.id}/lock`,{});
  assert.ok(!(await admin.req('login-users')).some(u=>u.username==='donggoi'));await packer.req('data',undefined,401);await packer.req('session');await packer.req('login',{username:'donggoi'},401);
 });
 await t.test('restart preserves accounts, hashes, locked roles and inventory; password mode can be restored',async()=>{
  const before=snapshot();await stop();await start('0');assert.deepEqual(snapshot(),before);assert.ok(!(await client().req('login-users')).some(u=>u.username==='donggoi'));
  await stop();await start('1');assert.deepEqual(snapshot(),before);
  const secure=client();assert.equal((await secure.req('session')).passwordRequired,true);await secure.req('login-users',undefined,404);await secure.req('login',{username:'admin'},401);await secure.req('login',{username:'admin',password:'incorrect'},401);assert.equal((await secure.req('login',{username:'admin',password})).user.role,'admin');await secure.req('users',{name:'Missing password',username:'no_password',role:'packer'},400);
 });
});
