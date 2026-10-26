import React from 'react';
import {ArrowRight,ClipboardList,Package,ShieldCheck,Users} from 'lucide-react';
import {roleNames} from '../shared/roles.js';

function Shortcuts({items}){
 return <div className="role-shortcuts">{items.map(({label,detail,Icon,onClick})=><button key={label} onClick={onClick}><Icon size={21}/><span><b>{label}</b><small>{detail}</small></span><ArrowRight size={16}/></button>)}</div>;
}

export default function RoleOverview({role,data,products,onNavigate,onTab}){
 const people=data.people.filter(person=>!person.locked);
 if(role==='admin')return <div className="role-overview role-overview-admin" aria-label="Tổng quan quản trị">
  <div className="ops-metrics"><button onClick={()=>onNavigate('employees')}><span>Nhân viên hoạt động</span><strong>{people.length}</strong><ArrowRight size={18}/></button><button onClick={()=>onNavigate('products')}><span>Mã hàng đang quản lý</span><strong>{products.length}</strong><ArrowRight size={18}/></button></div>
  <Shortcuts items={[
   {label:'Quản lý nhân viên',detail:'Tạo, sửa và khóa tài khoản',Icon:Users,onClick:()=>onNavigate('employees')},
   {label:'Phân quyền & dữ liệu',detail:'Vai trò, nhập Excel và sao lưu',Icon:ShieldCheck,onClick:()=>onTab('data')},
   {label:'Theo dõi tồn kho',detail:'Sản phẩm và tình trạng hàng hóa',Icon:Package,onClick:()=>onNavigate('products')}
  ]}/>
  <section className="ops-panel role-team"><h3>Đội ngũ theo vai trò</h3><div className="role-team-grid">{Object.entries(roleNames).map(([key,label])=><div key={key}><span>{label}</span><b>{people.filter(person=>person.role===key).length}</b><small>đang hoạt động</small></div>)}</div></section>
 </div>;
 if(role==='warehouse')return <div className="role-overview role-overview-warehouse" aria-label="Tổng quan nhân viên kho">
  <Shortcuts items={[
   {label:'Nhập kho',detail:'Ghi nhận hàng thực nhận',Icon:Package,onClick:()=>onNavigate('in')},
   {label:'Xuất kho',detail:'Tạo, xem và in phiếu xuất',Icon:ClipboardList,onClick:()=>onNavigate('out')},
   {label:'Quản lý nhân viên',detail:'Tài khoản và vai trò nhân viên',Icon:Users,onClick:()=>onNavigate('employees')}
  ]}/>
  <section className="ops-panel"><h3>Mặt hàng cần bổ sung</h3><p>Theo mức tồn tối thiểu của từng mã hàng.</p>{products.filter(product=>!product.locked&&product.stock<=product.min).slice(0,6).map(product=><div className="ops-summary-row" key={product.id}><span><b>{product.name}</b><small>{product.code} · Còn {product.stock} / tối thiểu {product.min} {product.unit}</small></span></div>)}<button className="secondary" onClick={()=>onNavigate('products')}>Xem toàn bộ tồn kho</button></section>
 </div>;
 return null;
}
