import React from 'react';
import {ArrowRight,CheckCheck,ClipboardList,Package,ShieldCheck,Users} from 'lucide-react';
import {roleNames} from '../shared/roles.js';
import {requestCode,workStates,workTypes} from '../shared/operations.js';

const active=request=>!['completed','cancelled'].includes(request.status);
const byDue=(a,b)=>a.dueDate.localeCompare(b.dueDate);
const time=value=>new Date(value).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

function Metrics({items}){
 return <div className="ops-metrics">{items.map(({label,count,onClick})=><button key={label} onClick={onClick}><span>{label}</span><strong>{count}</strong><ArrowRight size={18}/></button>)}</div>;
}

function Queue({title,description,requests,products,onSelect,empty='Chưa có công việc cần xử lý.'}){
 const byId=new Map(products.map(product=>[product.id,product]));
 return <section className="role-queue"><div className="ops-section-heading"><div><h3>{title}</h3>{description&&<p>{description}</p>}</div><span className="count">{requests.length}</span></div><div className="role-job-list">{requests.slice().sort(byDue).slice(0,8).map(request=><article className="role-job" key={request.id}><div className="role-job-heading"><button className="ops-code" onClick={()=>onSelect(request.id)}>{requestCode(request)}</button><span className={'ops-status ops-status-'+request.status}>{workStates[request.status]}</span></div><h4>{request.reference||workTypes[request.type]}</h4><p>{request.outputs.map(line=>`${byId.get(line.productId)?.name||'Mặt hàng'} × ${line.quantity} ${byId.get(line.productId)?.unit||''}`).join(' · ')}</p><div className="role-job-footer"><small>{request.destination} · Hạn {time(request.dueDate)}</small><button className="secondary" aria-label={'Mở '+requestCode(request)} onClick={()=>onSelect(request.id)}>Xem việc<ArrowRight size={14}/></button></div></article>)}</div>{!requests.length&&<div className="role-empty"><CheckCheck size={22}/><p>{empty}</p></div>}</section>;
}

function Shortcuts({items}){
 return <div className="role-shortcuts">{items.map(({label,detail,Icon,onClick})=><button key={label} onClick={onClick}><Icon size={21}/><span><b>{label}</b><small>{detail}</small></span><ArrowRight size={16}/></button>)}</div>;
}

function DailyResults({data,products,onlyMine=false}){
 const results=new Map(),today=new Date().toLocaleDateString(),byId=new Map(products.map(product=>[product.id,product]));
 for(const event of data.events.filter(event=>event.type==='Kiểm nhận'&&new Date(event.date).toLocaleDateString()===today)){
  const owner=event.payload.assigneeId??data.requests.find(request=>request.id===event.requestId)?.assigneeId;
  if(onlyMine&&owner!==data.userId)continue;
  for(const item of event.payload.items){const key=owner+':'+item.productId,record=results.get(key)||{owner,productId:item.productId,good:0,faulty:0};record.good+=item.good;record.faulty+=item.faulty;results.set(key,record)}
 }
 return <section className="ops-panel"><h3>{onlyMine?'Kết quả của tôi được kho nhận hôm nay':'Kết quả bàn giao hôm nay'}</h3><p>Theo từng mặt hàng và đơn vị, sau khi kho kiểm nhận.</p>{[...results.values()].map(item=><div className="ops-summary-row" key={item.owner+':'+item.productId}><span><b>{byId.get(item.productId)?.name||'Mặt hàng'}</b><small>{data.people.find(person=>person.id===item.owner)?.name} · {byId.get(item.productId)?.unit}</small></span><span>{item.good} đạt · {item.faulty} lỗi</span></div>)}{!results.size&&<p>Chưa có kết quả kiểm nhận trong ngày.</p>}</section>;
}

export default function RoleOverview({role,data,products,onNavigate,onTab,onSelect,packingTable}){
 const requests=data.requests,live=requests.filter(active),people=data.people.filter(person=>!person.locked);
 const queueProps={products,onSelect};
 const metric=(label,rows,tab,status)=>({label,count:rows.length,onClick:()=>onTab(tab,status)});
 if(role==='admin')return <div className="role-overview role-overview-admin" aria-label="Tổng quan quản trị">
  <Metrics items={[
   {label:'Nhân viên hoạt động',count:people.length,onClick:()=>onNavigate('employees')},
   metric('Công việc đang mở',live,'requests','active'),
   metric('Yêu cầu chờ duyệt',requests.filter(r=>r.status==='pending'),'requests','pending'),
  ]}/>
  <Shortcuts items={[
   {label:'Quản lý nhân viên',detail:'Tạo, sửa và khóa tài khoản',Icon:Users,onClick:()=>onNavigate('employees')},
   {label:'Phân quyền & sao lưu',detail:'Vai trò, đội và dữ liệu hệ thống',Icon:ShieldCheck,onClick:()=>onTab('data')},
   {label:'Theo dõi tồn kho',detail:'Sản phẩm và tình trạng hàng hóa',Icon:Package,onClick:()=>onNavigate('products')}
  ]}/>
  <section className="ops-panel role-team"><h3>Đội ngũ theo vai trò</h3><div className="role-team-grid">{Object.entries(roleNames).map(([key,label])=><div key={key}><span>{label}</span><b>{people.filter(person=>person.role===key).length}</b><small>đang hoạt động</small></div>)}</div></section>
  <Queue title="Hoạt động cần theo dõi" description="Yêu cầu và công việc đang mở của toàn đội." requests={live} {...queueProps}/>
  <DailyResults data={data} products={products}/>
 </div>;
 if(role==='warehouse')return <div className="role-overview role-overview-warehouse" aria-label="Tổng quan nhân viên kho">
  <Metrics items={[
   metric('Chờ kho xác nhận',requests.filter(r=>r.status==='pending'),'requests','pending'),
   metric('Đã xác nhận, chờ xuất',requests.filter(r=>r.status==='approved'),'requests','approved'),
   metric('Chờ kho kiểm nhận',requests.filter(r=>r.status==='ready'),'work','ready'),
   metric('Cần đối chiếu / lỗi',requests.filter(r=>r.status==='quality'),'work','quality')
  ]}/>
  <Shortcuts items={[
   {label:'Nhập hàng',detail:'Ghi nhận hàng thực nhận vào kho',Icon:Package,onClick:()=>onNavigate('in')},
   {label:'Phiếu xuất kho',detail:'Tạo, xem và in phiếu xuất',Icon:ClipboardList,onClick:()=>onNavigate('out')},
   {label:'Quản lý nhân viên',detail:'Tài khoản và vai trò nhân viên',Icon:Users,onClick:()=>onNavigate('employees')}
  ]}/>
  <div className="role-queue-grid"><Queue title="Yêu cầu cần kho xử lý" requests={requests.filter(r=>['pending','approved'].includes(r.status))} {...queueProps}/><Queue title="Hàng chờ kiểm nhận / đối chiếu" requests={requests.filter(r=>['ready','quality'].includes(r.status))} {...queueProps}/></div>
  {packingTable}
  <section className="ops-panel"><h3>Mặt hàng cần bổ sung</h3><p>Theo mức tồn tối thiểu của từng mã hàng.</p>{products.filter(p=>!p.locked&&p.stock<=p.min).slice(0,6).map(p=><div className="ops-summary-row" key={p.id}><span><b>{p.name}</b><small>{p.code} · Còn {p.stock} / tối thiểu {p.min} {p.unit}</small></span></div>)}<button className="secondary" onClick={()=>onNavigate('products')}>Xem toàn bộ tồn kho</button></section>
  <DailyResults data={data} products={products}/>
 </div>;
 if(role==='packer')return <div className="role-overview role-overview-packer" aria-label="Tổng quan nhân viên đóng gói">
  <Metrics items={[
   metric('Chờ kho xác nhận',requests.filter(r=>r.status==='pending'),'requests','pending'),
   metric('Kho đã xác nhận',requests.filter(r=>r.status==='approved'),'requests','approved'),
   metric('Chờ nhận hàng',requests.filter(r=>r.status==='issued'),'work','issued'),
   metric('Đã nhận hàng',requests.filter(r=>r.status==='completed'),'work','completed')
  ]}/>
  <ol className="role-flow" aria-label="Quy trình đóng gói">{['Lên đơn','Kho xác nhận','Kho xuất hàng','Nhận để đóng gói'].map((step,index)=><li key={step}><span>{index+1}</span>{step}</li>)}</ol>
  <Queue title="Hàng kho đã xuất, chờ tôi nhận" description="Mở đơn và xác nhận khi đã nhận hàng thực tế." requests={requests.filter(r=>r.assigneeId===data.userId&&r.status==='issued')} {...queueProps}/>
  {packingTable}
 </div>;
 const mine=requests.filter(r=>r.assigneeId===data.userId),working=mine.filter(r=>['working','partial'].includes(r.status));
 return <div className="role-overview role-overview-processor" aria-label="Tổng quan nhân viên gia công">
  <Metrics items={[
   metric('Chờ tôi nhận việc',mine.filter(r=>r.status==='issued'),'work','issued'),
   metric('Đang gia công',working,'work','processing'),
   metric('Chờ kho kiểm nhận',mine.filter(r=>r.status==='ready'),'work','ready'),
   metric('Cần đối chiếu',mine.filter(r=>r.status==='quality'),'work','quality')
  ]}/>
  <div className="role-queue-grid"><Queue title="Việc mới kho giao" description="Nhận vật tư và xác nhận nhận việc trước khi làm." requests={mine.filter(r=>r.status==='issued')} {...queueProps}/><Queue title="Việc tôi đang làm" description="Báo sẵn sàng bàn giao sau khi gia công xong." requests={working} {...queueProps}/></div>
  <Queue title="Kết quả đang chờ kho" requests={mine.filter(r=>['ready','quality'].includes(r.status))} {...queueProps}/>
  <Queue title="Yêu cầu tôi đã gửi" description="Theo dõi yêu cầu lấy hàng và vật tư bổ sung." requests={requests.filter(r=>r.requesterId===data.userId&&['pending','approved'].includes(r.status))} {...queueProps}/>
  <DailyResults data={data} products={products} onlyMine/>
 </div>;
}
