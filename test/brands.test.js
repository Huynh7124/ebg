import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {defaultBrands,initializeBrands} from '../server/brands.js';
import {matchesProduct} from '../shared/product-filters.js';

test('brands seed once and do not restore renamed models on restart',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT UNIQUE,type TEXT,locked INTEGER DEFAULT 0);CREATE TABLE products(id INTEGER PRIMARY KEY,vehicle TEXT);INSERT INTO categories(name,type) VALUES('Sur-Ron Light Bee','vehicle');INSERT INTO products(vehicle) VALUES('Sur-Ron Light Bee')");
  initializeBrands(db);assert.equal(db.prepare('SELECT COUNT(*) n FROM brands').get().n,10);
  const brand=db.prepare("SELECT id FROM brands WHERE name='Surron'").get();assert.equal(db.prepare('SELECT brandId FROM products').get().brandId,brand.id);
  db.prepare("UPDATE categories SET name='MX5 mới' WHERE name='MX5'").run();initializeBrands(db);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM categories WHERE name='MX5'").get().n,0);
 }finally{db.close()}
});

test('warehouse manages brands/models and paginated filtering enforces brand/model combinations',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ebg-brands-'));const base='http://127.0.0.1:3261/api/';let log='';
 const child=spawn(process.execPath,[resolve('server.js'),'--production'],{cwd:root,env:{...process.env,DATA_DIR:root,PORT:'3261',REQUIRE_PASSWORD:'0'},stdio:['ignore','pipe','pipe']});child.stderr.on('data',d=>log+=d);
 t.after(async()=>{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r))}await rm(root,{recursive:true,force:true})});
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error(log)),15000);child.stdout.on('data',d=>{if(String(d).includes('server ready')){clearTimeout(timer);ok()}})});
 function client(){let cookie='',csrf='';return {async req(path,body,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json','x-csrf-token':csrf},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();if(d.csrf)csrf=d.csrf;assert.equal(r.status,status,JSON.stringify(d));return d},async login(username){await this.req('session');await this.req('login',{username})}}}
 const kho=client(),packer=client();await kho.login('kho');await packer.login('donggoi');let data=await kho.req('data');
 for(const [name,models] of Object.entries(defaultBrands)){const b=data.brands.find(b=>b.name===name);assert.ok(b);for(const model of models)assert.ok(data.categories.some(c=>c.name===model&&c.brandId===b.id))}
 await packer.req('brands',{name:'Không được'},403);await packer.req('categories',{name:'Không được',type:'vehicle',brandId:1},403);
 await kho.req('brands',{name:'Test Brand'});await kho.req('brands',{name:'test brand'},400);data=await kho.req('data');const id=data.brands.find(b=>b.name==='Test Brand').id;
 await kho.req('categories',{name:'Dòng thử',type:'vehicle',brandId:id});await kho.req('categories',{name:'Sai',type:'vehicle',brandId:999999},400);
 const item={name:'Sản phẩm theo dòng',category:data.categories.find(c=>c.type==='accessory').name,vehicle:'Dòng thử',brandId:id,color:'Đen',min:0};
 await kho.req('products',item);await kho.req('products',{...item,brandId:data.brands.find(b=>b.name==='Surron').id},400);
 let page=await kho.req('products-page?brand=Test%20Brand&vehicle='+encodeURIComponent('Dòng thử'));assert.equal(page.total,1);assert.equal(page.items[0].brand,'Test Brand');
 assert.equal(matchesProduct(page.items[0],{brand:'Talaria'}),false);
 await kho.req('brands/'+id,{name:'Thương hiệu mới'});page=await kho.req('products-page?brand='+encodeURIComponent('Thương hiệu mới'));assert.equal(page.total,1);
 const model=(await kho.req('data')).categories.find(c=>c.name==='Dòng thử');await kho.req('categories/'+model.id,{name:'Dòng đổi tên',brandId:id});page=await kho.req('products-page?vehicle='+encodeURIComponent('Dòng đổi tên'));assert.equal(page.total,1);
});
