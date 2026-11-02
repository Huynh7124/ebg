const zone='Asia/Ho_Chi_Minh';
const parts=date=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date));
const local=date=>Object.fromEntries(parts(date).map(p=>[p.type,p.value]));
const dayMs=86400000;

export function dashboardActivity({orders,stockOrders,receipts,users=[],period='month',date,now=Date.now()}){
 if(!['day','week','month','year'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Chọn thời gian hợp lệ');
 const [year,month]=date.split('-').map(Number),count=period==='day'?24:period==='week'?7:period==='year'?12:new Date(Date.UTC(year,month,0)).getUTCDate();
 const selected=Date.parse(date),weekStart=selected-((new Date(selected).getUTCDay()+6)%7)*dayMs;
 const weekEnd=weekStart+6*dayMs;
 const buckets=Array.from({length:count},(_,i)=>({label:period==='day'?`${i}h`:period==='week'?`${['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','CN'][i]} · ${new Date(weekStart+i*dayMs).toISOString().slice(5,10).split('-').reverse().join('/')}`:period==='year'?`Tháng ${i+1}`:String(i+1),processing:0,packing:0,outbound:0}));
 const details={processing:[],packing:[],outbound:[]};
 const staff=new Map(),totals={processing:0,packing:0,outbound:0};
 const add=(kind,timestamp,actor,code)=>{
  if(!timestamp||!Number.isFinite(Date.parse(timestamp)))return;
  const p=local(timestamp),day=`${p.year}-${p.month}-${p.day}`;
  if(period==='day'?day!==date:period==='week'?(Date.parse(day)<weekStart||Date.parse(day)>weekEnd):period==='month'?day.slice(0,7)!==date.slice(0,7):p.year!==String(year))return;
  const index=period==='day'?Number(p.hour):period==='week'?(Date.parse(day)-weekStart)/dayMs:period==='month'?Number(p.day)-1:Number(p.month)-1;
  buckets[index][kind]++;totals[kind]++;details[kind].push({code:code||'Dữ liệu cũ',date:timestamp,actor:actor||'Chưa rõ',bucket:index});
  const name=actor||'Chưa rõ';if(!staff.has(name))staff.set(name,{name,processing:0,packing:0,outbound:0});staff.get(name)[kind]++;
 };
 for(const order of orders){
  const history=Array.isArray(order.events)?order.events:[];
  const finished=history.find(e=>e.action==='Gia công hoàn thành, chuyển đóng gói');
  if(finished)add('processing',finished.date,finished.actor,'DGGC-'+String(order.id||'?').padStart(6,'0'));
  const packed=history.find(e=>e.action==='Đóng gói hoàn thành');
  if(packed)add('packing',packed.date,packed.actor,'DGGC-'+String(order.id||'?').padStart(6,'0'));
 }
 for(const order of stockOrders)if(order.completedAt)add('processing',order.completedAt,users.find(u=>u.id===order.processorId)?.name,'STOCK-'+String(order.id||'?').padStart(6,'0'));
 for(const receipt of receipts)if(receipt.kind==='out')add('outbound',receipt.date,receipt.user,'PX-'+String(receipt.id||'?').padStart(6,'0'));
 const backlog={warehouse:orders.filter(o=>['pending','prepared'].includes(o.status)).length,processing:orders.filter(o=>['issued','working'].includes(o.status)).length+stockOrders.filter(o=>o.status==='planned'&&!o.completedAt).length,packing:orders.filter(o=>['warehouse_issued','packing_received','awaiting_packing','received'].includes(o.status)).length,stockOpen:stockOrders.filter(o=>o.status==='open').length,stockOverdue:stockOrders.filter(o=>!o.completedAt&&o.returnAt&&Date.parse(o.returnAt)<now).length};
 const packingRow=o=>({code:'DGGC-'+String(o.id||'?').padStart(6,'0'),status:o.status,date:o.createdAt,actor:users.find(u=>u.id===o.requesterId)?.name||'—'}),stockRow=o=>({code:'STOCK-'+String(o.id||'?').padStart(6,'0'),status:o.completedAt?'completed':o.status,date:o.returnAt||o.createdAt,actor:users.find(u=>u.id===o.processorId)?.name||'Chưa nhận'});
 const backlogDetails={warehouse:orders.filter(o=>['pending','prepared'].includes(o.status)).map(packingRow),processing:[...orders.filter(o=>['issued','working'].includes(o.status)).map(packingRow),...stockOrders.filter(o=>o.status==='planned'&&!o.completedAt).map(stockRow)],packing:orders.filter(o=>['warehouse_issued','packing_received','awaiting_packing','received'].includes(o.status)).map(packingRow),stockOpen:stockOrders.filter(o=>o.status==='open').map(stockRow),stockOverdue:stockOrders.filter(o=>!o.completedAt&&o.returnAt&&Date.parse(o.returnAt)<now).map(stockRow)};
 return {details,backlogDetails,period,date,...(period==='week'?{weekStart:new Date(weekStart).toISOString().slice(0,10),weekEnd:new Date(weekEnd).toISOString().slice(0,10)}:{}),timeZone:zone,buckets,totals,backlog,staff:[...staff.values()].sort((a,b)=>(b.processing+b.packing+b.outbound)-(a.processing+a.packing+a.outbound))};
}

export function registerDashboardActivity(app,db){
 app.get('/api/dashboard/activity',async(req,res)=>{
  if(req.session.user.role!=='admin')return res.status(403).json({error:'Chỉ Admin được xem thống kê hoạt động'});
  try{
   const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
   if(req.query.demo==='1'){
    const {createDemoActivity}=await import('../shared/dashboard-demo.js');
    const date=String(req.query.date||today),period=String(req.query.period||'month');
    // Validate before generating demo events, including week ranges spanning years.
    dashboardActivity({orders:[],stockOrders:[],receipts:[],period,date});
    return res.json({...dashboardActivity({...createDemoActivity(date),period,date}),demo:true});
   }
   const orders=db.prepare('SELECT id,requesterId,status,payload FROM packing_orders').all().map(r=>({...JSON.parse(r.payload),id:r.id,requesterId:r.requesterId,status:r.status}));
   res.json(dashboardActivity({orders,stockOrders:db.prepare('SELECT * FROM stock_work_orders').all(),receipts:db.prepare("SELECT id,kind,date,user FROM receipts WHERE kind='out'").all(),users:db.prepare('SELECT id,name FROM users').all(),period:String(req.query.period||'month'),date:String(req.query.date||today)}));
  }catch(error){res.status(400).json({error:error.message})}
 });
}
