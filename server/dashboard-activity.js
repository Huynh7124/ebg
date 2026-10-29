const zone='Asia/Ho_Chi_Minh';
const parts=date=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date));
const local=date=>Object.fromEntries(parts(date).map(p=>[p.type,p.value]));

export function dashboardActivity({orders,stockOrders,receipts,users=[],period='month',date,now=Date.now()}){
 if(!['day','month','year'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Chọn thời gian hợp lệ');
 const [year,month]=date.split('-').map(Number),count=period==='day'?24:period==='year'?12:new Date(Date.UTC(year,month,0)).getUTCDate();
 const buckets=Array.from({length:count},(_,i)=>({label:period==='day'?`${i}h`:period==='year'?`T${i+1}`:String(i+1),processing:0,packing:0,outbound:0}));
 const staff=new Map(),totals={processing:0,packing:0,outbound:0};
 const add=(kind,timestamp,actor)=>{
  if(!timestamp||!Number.isFinite(Date.parse(timestamp)))return;
  const p=local(timestamp),day=`${p.year}-${p.month}-${p.day}`;
  if(period==='day'?day!==date:period==='month'?day.slice(0,7)!==date.slice(0,7):p.year!==String(year))return;
  const index=period==='day'?Number(p.hour):period==='month'?Number(p.day)-1:Number(p.month)-1;
  buckets[index][kind]++;totals[kind]++;
  const name=actor||'Chưa rõ';if(!staff.has(name))staff.set(name,{name,processing:0,packing:0,outbound:0});staff.get(name)[kind]++;
 };
 for(const order of orders){
  const history=Array.isArray(order.events)?order.events:[];
  const finished=history.find(e=>e.action==='Gia công hoàn thành, chuyển đóng gói');
  if(finished)add('processing',finished.date,finished.actor);
  const packed=history.find(e=>e.action==='Đóng gói hoàn thành');
  if(packed)add('packing',packed.date,packed.actor);
 }
 for(const order of stockOrders)if(order.completedAt)add('processing',order.completedAt,users.find(u=>u.id===order.processorId)?.name);
 for(const receipt of receipts)if(receipt.kind==='out')add('outbound',receipt.date,receipt.user);
 const backlog={warehouse:orders.filter(o=>['pending','prepared'].includes(o.status)).length,processing:orders.filter(o=>['issued','working'].includes(o.status)).length+stockOrders.filter(o=>o.status==='planned'&&!o.completedAt).length,packing:orders.filter(o=>['awaiting_packing','received'].includes(o.status)).length,stockOpen:stockOrders.filter(o=>o.status==='open').length,stockOverdue:stockOrders.filter(o=>!o.completedAt&&o.returnAt&&Date.parse(o.returnAt)<now).length};
 return {period,date,timeZone:zone,buckets,totals,backlog,staff:[...staff.values()].sort((a,b)=>(b.processing+b.packing+b.outbound)-(a.processing+a.packing+a.outbound))};
}

export function registerDashboardActivity(app,db){
 app.get('/api/dashboard/activity',(req,res)=>{
  if(req.session.user.role!=='admin')return res.status(403).json({error:'Chỉ Admin được xem thống kê hoạt động'});
  try{
   const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
   const orders=db.prepare('SELECT status,payload FROM packing_orders').all().map(r=>({...JSON.parse(r.payload),status:r.status}));
   res.json(dashboardActivity({orders,stockOrders:db.prepare('SELECT * FROM stock_work_orders').all(),receipts:db.prepare("SELECT kind,date,user FROM receipts WHERE kind='out'").all(),users:db.prepare('SELECT id,name FROM users').all(),period:String(req.query.period||'month'),date:String(req.query.date||today)}));
  }catch(error){res.status(400).json({error:error.message})}
 });
}
