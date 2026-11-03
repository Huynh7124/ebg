import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const dataDir=process.env.DATA_DIR?resolve(process.env.DATA_DIR):resolve('data');
const databasePath=join(dataDir,'ebg.db');
if(!existsSync(databasePath))throw Error(`Không tìm thấy SQLite: ${databasePath}`);
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Chỉ nhập local: hãy chạy Firebase Emulator trước rồi chạy npm run firebase:import.');

const projectId=process.env.FIREBASE_PROJECT_ID||'demo-ebg';
const sqlite=new DatabaseSync(databasePath,{readOnly:true});
const firestore=getFirestore(initializeApp({projectId}));
firestore.settings({ignoreUndefinedProperties:true});

const tables=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name);
const sources=[
 ['users','users',row=>String(row.id),row=>omit(row,['password'])],
 ['products','products',row=>String(row.id)],
 ['categories','categories',row=>String(row.id)],
 ['brands','brands',row=>String(row.id)],
 ['receipts','receipts',row=>String(row.id)],
 ['movements','movements',row=>String(row.id)],
 ['audit','audit',row=>String(row.id)],
 ['product_stage_stock','productStages',row=>`${row.productId}_${row.stage}`],
 ['stock_stage_context','stockStageContext',row=>String(row.productId)],
 ['stage_transfers','stageTransfers',row=>String(row.id)],
 ['packing_orders','packingOrders',row=>String(row.id)],
 ['ops_access','opsAccess',row=>String(row.userId)],
 ['ops_boms','boms',row=>String(row.id)],
 ['ops_requests','operations',row=>String(row.id)],
 ['ops_events','operationEvents',row=>String(row.id)],
 ['ops_suppliers','suppliers',row=>String(row.id)],
 ['ops_purchases','purchases',row=>String(row.id)],
 ['stock_work_orders','stockWorkOrders',row=>String(row.id)]
];

function omit(value,keys=[]){return Object.fromEntries(Object.entries(value).filter(([key])=>!keys.includes(key)));}
function normalize(value){
 const result={};
 for(const [key,item] of Object.entries(value)){
  if(item===null||typeof item==='number'||typeof item==='boolean')result[key]=item;
  else if(typeof item==='string'&&['payload','lines','inputs','outputs','snapshot','report'].includes(key)){
   try{result[key]=JSON.parse(item)}catch{result[key]=item}
  }else result[key]=item;
 }
 return result;
}
async function commit(rows){
 for(let start=0;start<rows.length;start+=400){
  const batch=firestore.batch();
  for(const row of rows.slice(start,start+400))batch.set(firestore.collection(row.collection).doc(row.id),row.data);
  await batch.commit();
 }
}

const rows=[];
for(const [table,collection,documentId,map=identity=>identity] of sources){
 if(!tables.includes(table))continue;
 for(const row of sqlite.prepare(`SELECT * FROM ${table}`).all())rows.push({collection,id:documentId(row),data:normalize(map(row))});
}
await commit(rows);
sqlite.close();
console.log(`Đã nhập ${rows.length} bản ghi SQLite vào Firebase Emulator (${projectId}).`);
