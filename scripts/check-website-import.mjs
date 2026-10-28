import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const file=process.argv[2];if(!file)throw Error('Pass the workbook path');
const dataDir=await mkdtemp(join(tmpdir(),'ebg-website-test-'));
const child=spawn(process.execPath,['server.js'],{env:{...process.env,DATA_DIR:dataDir,PORT:'3297',REQUIRE_PASSWORD:'0'},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),20000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.stderr.resume()});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({serviceWorkers:'block'});await page.goto('http://localhost:3297');await page.waitForLoadState('networkidle');
 const bytes=[...await readFile(file)];
 const result=await page.evaluate(async bytes=>{
  const {parseCompositionWorkbook}=await import('/src/xlsx-composition.js');
  const payload=await parseCompositionWorkbook(new File([new Uint8Array(bytes)],'NVL Sản phẩm Website (14).xlsx'));
  let session=await(await fetch('/api/session')).json();
  const call=async(path,body)=>{const r=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-csrf-token':session.csrf},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(JSON.stringify(data));return data};
  session=await call('login',{username:'admin'});
  const plan=await call('ops/import-xlsx/preview',payload);
  if(plan.errors.length)return {plan};
  const before=await call('data');
  const saved=await call('ops/import-xlsx',{...payload,confirmation:plan.digest});
  const after=await call('data');
  return {plan,saved,before:before.products,after:after.products};
 },bytes);
 await mkdir('docs/import-preview',{recursive:true});
 const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 await writeFile('docs/import-preview/website-14.csv','\uFEFF'+[['Tên','Nhóm','Loại','Size','ĐVT','Tồn ban đầu'],...result.plan.rows.map(r=>[r.name,r.category,r.materialKind==='finished'?'TP':'NVL',r.size,r.unit,0])].map(r=>r.map(csvCell).join(',')).join('\r\n'));
 console.log(JSON.stringify({count:result.plan.count,types:result.plan.rows.reduce((a,r)=>(a[r.materialKind]=(a[r.materialKind]||0)+1,a),{}),sizes:result.plan.rows.reduce((a,r)=>(a[r.size||'none']=(a[r.size||'none']||0)+1,a),{}),errors:result.plan.errors,warnings:result.plan.warnings},null,2));
 assert.equal(result.plan.errors.length,0);
 for(const row of result.plan.rows){const p=result.after.find(p=>p.code===row.code);assert.ok(p);assert.equal(p.materialKind,row.materialKind);assert.equal(p.size,row.size);assert.equal(p.stock,0)}
 for(const old of result.before)assert.deepEqual(result.after.find(p=>p.id===old.id),old);
 console.log('PASS: workbook parsed in browser, imported into isolated database, TP/NVL and sizes persisted, original products unchanged.');
}finally{await browser?.close();child.kill();await new Promise(r=>child.once('exit',r));await rm(dataDir,{recursive:true,force:true})}
