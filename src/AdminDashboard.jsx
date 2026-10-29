import DashboardActivity from './DashboardActivity.jsx';
import React,{useMemo,useState} from 'react';
import {Package,AlertTriangle,PackageX,ShieldAlert,ArrowUpRight,Layers} from 'lucide-react';
import './admin-dashboard.css';

const number=value=>Number(value)||0;
const format=value=>value.toLocaleString('vi-VN');
const stages=[['rough','Hàng thô','#64748b'],['unclassified','Chưa phân loại','#94a3b8'],['raw','Nguyên vật liệu','#b8343a'],['semi','Bán thành phẩm','#d89b35'],['finished','Thành phẩm','#32816a']];

export default function AdminDashboard({products:realProducts,receipts:realReceipts,onProducts,api}){
 const [unit,setUnit]=useState(''),[demo,setDemo]=useState(null),[demoLoading,setDemoLoading]=useState(false),[demoError,setDemoError]=useState('');
 const products=demo?.products||realProducts,receipts=demo?.receipts||realReceipts;
 async function toggleDemo(){if(demo){setDemo(null);return}setDemoLoading(true);setDemoError('');try{const module=await import('../shared/dashboard-demo.js');setDemo(module.createDemoInventory())}catch{setDemoError('Không tải được dữ liệu mẫu. Vui lòng thử lại.')}finally{setDemoLoading(false)}}
 const units=useMemo(()=>[...new Set(products.map(p=>p.unit||'cái'))].sort((a,b)=>a.localeCompare(b,'vi')), [products]);
 const selectedUnit=units.includes(unit)?unit:units[0]||'cái';
 const active=products.filter(p=>!p.locked),empty=active.filter(p=>number(p.stock)===0),low=active.filter(p=>number(p.stock)>0&&number(p.stock)<=number(p.min));
 const faulty=products.filter(p=>number(p.faulty)>0),selected=products.filter(p=>(p.unit||'cái')===selectedUnit);
 const sum=key=>selected.reduce((total,p)=>total+number(p[key]),0);
 const allocation=stages.map(([key,label,color])=>({key,label,color,value:selected.reduce((total,p)=>total+number(p.stages?.[key]),0)}));
 const total=sum('stock'),max=Math.max(1,...allocation.map(s=>s.value));
 const pending=operation=>receipts.filter(r=>r.operation===operation&&r.status==='pending').length;
 const alerts=[...empty,...low].slice(0,8);
 const cards=[['Sản phẩm đang quản lý',products.length,`${products.filter(p=>p.locked).length} sản phẩm đã khóa`,Package,'neutral'],['Hết hàng',empty.length,'Sản phẩm hoạt động có tồn bằng 0',PackageX,'red'],['Sắp hết hàng',low.length,'Còn hàng, bằng hoặc dưới mức tối thiểu',AlertTriangle,'amber'],['Có hàng lỗi',faulty.length,'Sản phẩm đang có hàng trong kho lỗi',ShieldAlert,'purple']];
 return <div className="admin-dashboard" aria-label="Dashboard tồn kho Admin">
  <div className="dash-intro"><div><span className="dash-eyebrow">TỔNG QUAN KHO EBG</span><h2>Nắm nhanh tình hình tồn kho</h2><p>{demo?'Đang minh họa tình hình kho bằng danh mục Excel và số liệu giả lập.':'Số liệu từ dữ liệu kho đang lưu. Dùng nút tải lại trên header để cập nhật.'}</p></div><div className="dash-demo-controls"><button className={demo?'primary':'secondary'} disabled={demoLoading} aria-pressed={!!demo} onClick={toggleDemo}>{demoLoading?'Đang tải mẫu…':demo?'Về dữ liệu thật':'Xem dữ liệu mẫu Excel'}</button>{!demo&&<button className="secondary" onClick={onProducts}>Xem sản phẩm <ArrowUpRight size={16}/></button>}</div></div>
  {demo&&<div className="dash-demo-banner" role="status"><b>ĐANG XEM DỮ LIỆU MẪU</b><span>723 sản phẩm từ NVL Sản phẩm Website (14).xlsx. Tên/nhóm/loại/size/đơn vị lấy từ file; tồn kho, đơn hàng, nhân viên và tiến độ là số liệu giả lập để minh họa, không ghi vào kho thật.</span></div>}{demoError&&<p role="alert">{demoError}</p>}
  <div className="dash-metrics">{cards.map(([label,value,detail,Icon,tone])=><article className={'dash-metric dash-tone-'+tone} key={label}><div><span>{label}</span><Icon size={20}/></div><strong>{format(value)}</strong><p>{detail}</p></article>)}</div>
  <DashboardActivity key={demo?'demo':'real'} api={api} demo={!!demo}/>
  <div className="dash-section-title"><div><h3>Phân bổ số lượng</h3><p>Xem riêng từng đơn vị để không cộng lẫn cái, bộ và chiều dài.</p></div><label>Đơn vị<select aria-label="Đơn vị dashboard" value={selectedUnit} onChange={e=>setUnit(e.target.value)}>{(units.length?units:['cái']).map(u=><option key={u}>{u}</option>)}</select></label></div>
  <div className="dash-grid">
   <section className="dash-panel"><div className="dash-panel-heading"><h3><Layers size={18}/> Tồn tại kho</h3><span>{selected.length} sản phẩm</span></div><div className="dash-total"><strong>{format(total)}</strong><span>{selectedUnit} tại kho</span></div><div className="dash-bars">{allocation.map(s=><div className="dash-bar-row" key={s.key}><div><span><i style={{background:s.color}}/>{s.label}</span><b>{format(s.value)}</b></div><div className="dash-track"><span style={{width:`${s.value/max*100}%`,background:s.color}}/></div></div>)}</div></section>
   <section className="dash-panel"><div className="dash-panel-heading"><h3>Hàng ngoài tồn khả dụng</h3><span>{selectedUnit}</span></div><p className="dash-note">Theo dõi riêng, không cộng vào tổng tồn tại kho ở bên trái.</p><div className="dash-buckets">{[['anote','Đang Anode',pending('send_anode')+' phiếu chờ về, mọi đơn vị'],['repair','Đang sửa',pending('send_repair')+' phiếu chờ về, mọi đơn vị'],['faulty','Kho hàng lỗi',faulty.length+' sản phẩm có lỗi, mọi đơn vị'],['inProduction','Đang gia công','Đã xuất vật tư qua gia công']].map(([key,label,note])=><div key={key}><span>{label}<small>{note}</small></span><strong>{format(sum(key))}</strong></div>)}</div></section>
  </div>
  <div className="dash-grid dash-bottom">
   <section className="dash-panel"><div className="dash-panel-heading"><h3>Sản phẩm cần bổ sung</h3><span>{empty.length+low.length} sản phẩm</span></div>{alerts.length?<div className="dash-alert-list">{alerts.map(p=><div key={p.id}><span><b>{p.name}</b><small>Tối thiểu {format(number(p.min))} {p.unit||'cái'}</small></span><span className={number(p.stock)===0?'dash-empty':'dash-low'}>{format(number(p.stock))} {p.unit||'cái'}</span></div>)}</div>:<div className="dash-empty-state">Không có sản phẩm cần bổ sung.</div>}{empty.length+low.length>8&&<p className="dash-note">Đang hiển thị 8 sản phẩm cần chú ý đầu tiên.</p>}</section>
   <section className="dash-panel"><div className="dash-panel-heading"><h3>Tình trạng danh mục</h3><span>{products.length} sản phẩm</span></div><div className="dash-status-strip" aria-hidden="true">{[[active.length-empty.length-low.length,'#32816a'],[low.length,'#d89b35'],[empty.length,'#b8343a'],[products.length-active.length,'#94a3b8']].map(([value,color],i)=><span key={i} style={{flex:value,background:color}}/>)}</div><div className="dash-status-legend">{[['Đủ hàng',active.length-empty.length-low.length,'#32816a'],['Sắp hết',low.length,'#d89b35'],['Hết hàng',empty.length,'#b8343a'],['Đã khóa',products.length-active.length,'#94a3b8']].map(([label,value,color])=><div key={label}><span><i style={{background:color}}/>{label}</span><b>{format(value)}</b></div>)}</div>{!products.length&&<p className="dash-note">Chưa có sản phẩm. Nhập danh mục để bắt đầu theo dõi.</p>}</section>
  </div>
 </div>;
}
