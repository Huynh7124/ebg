import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
const dataDir=await mkdtemp(join(tmpdir(),'ebg-dev-check-'));
const child=spawn(process.execPath,[resolve('server.js')],{env:{...process.env,NODE_ENV:'development',PORT:'3192',DATA_DIR:dataDir},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Startup timeout')),20000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}});child.once('exit',()=>{clearTimeout(timer);fail(Error('Development server exited'))});child.stderr.resume()});
 browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[],failedModules=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\.(?:jsx?|css)(?:\?|$)/.test(r.url()))failedModules.push(new URL(r.url()).pathname)});
 await page.goto('http://localhost:3192');await page.getByRole('heading',{name:'Chào mừng trở lại'}).waitFor();assert.deepEqual(errors,[]);assert.deepEqual(failedModules,[]);
 const deps=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/node_modules/.vite/deps/')&&r.name.includes('react')).map(r=>r.name));assert.ok(deps.length>0,'Real React optimized dependencies must load');
 for(const path of ['/data/ebg.db','/server.js','/.env','/node_modules/.vite/deps/_metadata.json'])assert.ok([403,404].includes((await page.request.get('http://localhost:3192'+path)).status()),path);
 console.log('PASS: real development React app renders on mobile, optimized dependencies load, no JS errors/failed modules, private files still blocked. Data isolated from warehouse database.');
}finally{
 await browser?.close();if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(dataDir,{recursive:true,force:true});
}
