import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

for(const mode of ['development','production'])test(`${mode}: private files unavailable and unauthenticated API denied`,async t=>{
 const root=mkdtempSync(join(tmpdir(),'ebg-security-'));
 const port=mode==='development'?3196:3197;
 for(const dir of ['src','dist','test'])mkdirSync(join(root,dir));
 writeFileSync(join(root,'index.html'),'<html><body>Public app</body></html>');
 writeFileSync(join(root,'dist/index.html'),'<html><body>Public app</body></html>');
 writeFileSync(join(root,'server.js'),'PRIVATE_BACKEND_SENTINEL');
 writeFileSync(join(root,'package.json'),'{}');
 writeFileSync(join(root,'.env'),'PRIVATE_ENV_SENTINEL');
 writeFileSync(join(root,'src/main.js'),'console.log("public frontend")');
 writeFileSync(join(root,'test/private.json'),'PRIVATE_TEST_SENTINEL');
 const child=spawn(process.execPath,[resolve('server.js')],{cwd:root,env:{...process.env,DATA_DIR:join(root,'data'),NODE_ENV:mode,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}rmSync(root,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.on('exit',()=>{clearTimeout(timer);fail(Error('Server exited'))});child.stderr.resume()});
 const request=path=>fetch(`http://127.0.0.1:${port}${path}`);
 let r=await request('/api/data');assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(await r.json(),{error:'Vui lòng đăng nhập'});
 r=await request('/api/session');const session=await r.json();assert.equal(session.user,null);assert.equal(r.headers.get('cache-control'),'no-store');
 for(const path of ['/server.js','/server%2ejs','/data/ebg.db','/data/ebg.db-wal','/data/ebg.db-shm','/%64ata/ebg.db','/.env','/package.json','/test/private.json',`/@fs${root}/data/ebg.db`,`/@fs${root}/server.js`,'/server.js?raw','/data/ebg.db?import','/node_modules/.vite/deps/.env','/node_modules/.vite/deps/_metadata.json','/node_modules/.vite/deps/../../.env']){
  const response=await request(path);assert.ok([403,404].includes(response.status),`${mode} ${path}: ${response.status}`);const body=await response.text();assert.ok(!body.includes('PRIVATE_'));assert.ok(!body.includes('SQLite format 3'));
 }
 r=await request('/');assert.equal(r.status,200);assert.ok((await r.text()).includes('Public app'));
 if(mode==='development'){r=await request('/src/main.js');assert.equal(r.status,200);assert.ok((await r.text()).includes('public frontend'))}
});
