import catalog from './dashboard-demo-catalog.json' with {type:'json'};

// Only names, groups, types, sizes and units come from the workbook.
// Every stock quantity, actor and event below is fictional and never persisted.
export function createDemoInventory(){
 const products=catalog.map((p,index)=>{
  const stock=index%13===0?0:index%7===0?4:25+(index*17)%240;
  const stages={rough:0,unclassified:0,raw:0,semi:0,finished:0};
  stages[p.materialKind]=stock;
  if(p.materialKind==='raw'&&index%4===0){stages.semi=Math.floor(stock/3);stages.raw-=stages.semi}
  return {...p,id:index+1,code:`DEMO-${index+1}`,stock,stages,min:10,locked:0,faulty:index%11===0?3:0,anote:index%9===0?12:0,repair:index%17===0?5:0,inProduction:index%6===0?18:0};
 });
 const receipts=Array.from({length:9},(_,i)=>({id:i+1,kind:'out',operation:i<6?'send_anode':'send_repair',status:'pending'}));
 return {products,receipts};
}

export function createDemoActivity(date){
 const year=Number(date.slice(0,4)),orders=[],stockOrders=[],receipts=[];
 const users=[{id:1,name:'Gia công mẫu A'},{id:2,name:'Gia công mẫu B'}];
 const start=Date.UTC(year-1,11,25),end=Date.UTC(year+1,0,8);
 for(let time=start,day=0;time<end;time+=86400000,day++){
  const localDate=new Date(time).toISOString().slice(0,10);
  const iso=hour=>new Date(`${localDate}T${String(hour).padStart(2,'0')}:00:00+07:00`).toISOString();
  const count=2+(day*7)%11;
  for(let i=0;i<count;i++){
   const item={productId:(day+i)%catalog.length+1,quantity:3+(day+i)%8};
   orders.push({status:'completed',items:[item],events:[{action:'Gia công hoàn thành, chuyển đóng gói',date:iso(8+i%8),actor:`Gia công mẫu ${i%2?'A':'B'}`},...(i%4!==0?[{action:'Đóng gói hoàn thành',date:iso(10+i%8),actor:`Đóng gói mẫu ${i%2?'A':'B'}`}]:[])]});
   receipts.push({kind:'out',date:iso(7+i%9),user:'Nhân viên kho mẫu',items:[item]});
  }
  if(day%3===0)stockOrders.push({status:'planned',completedAt:iso(16),processorId:1});
 }
 orders.push(...Array.from({length:7},()=>({status:'pending'})),...Array.from({length:5},()=>({status:'working'})),...Array.from({length:4},()=>({status:'awaiting_packing'})));
 stockOrders.push(...Array.from({length:3},()=>({status:'open'})),{status:'planned',returnAt:'2000-01-01T00:00:00Z'});
 return {orders,stockOrders,receipts,users};
}
