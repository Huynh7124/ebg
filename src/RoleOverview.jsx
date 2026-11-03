import React from 'react';
import {AlertTriangle,ArrowRight,ClipboardList,Package,PackageX,ShieldCheck,Users} from 'lucide-react';
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
 if(role==='warehouse'){const activeProducts=products.filter(product=>!product.locked),empty=activeProducts.filter(product=>Number(product.stock)===0),low=activeProducts.filter(product=>Number(product.stock)>0&&Number(product.stock)<=Number(product.min));return <div className="role-overview role-overview-warehouse" aria-label="Tổng quan nhân viên kho">
  <Shortcuts items={[
   {label:'Nhập kho',detail:'Ghi nhận hàng thực nhận',Icon:Package,onClick:()=>onNavigate('in')},
   {label:'Xuất kho',detail:'Tạo, xem và in phiếu xuất',Icon:ClipboardList,onClick:()=>onNavigate('out')},
   {label:'Quản lý nhân viên',detail:'Tài khoản và vai trò nhân viên',Icon:Users,onClick:()=>onNavigate('employees')}
  ]}/>
  <section className="ops-panel warehouse-morning-alert"><div className="ops-section-heading"><div><h3>Kiểm tra đầu ngày</h3><p>Ưu tiên nhập hoặc điều chuyển các mã đã chạm mức tồn tối thiểu.</p></div></div><div className="warehouse-alert-metrics"><button type="button" className="warehouse-alert-empty" onClick={()=>onNavigate('products','empty')}><PackageX size={19}/><span>Hết hàng</span><b>{empty.length}</b><small>mã sản phẩm</small></button><button type="button" className="warehouse-alert-low" onClick={()=>onNavigate('products','low')}><AlertTriangle size={19}/><span>Sắp hết</span><b>{low.length}</b><small>mã sản phẩm</small></button></div>{[...empty,...low].slice(0,6).map(product=><div className="ops-summary-row" key={product.id}><span><b>{product.name}</b><small>{product.code} · Còn {product.stock} / tối thiểu {product.min} {product.unit}</small></span><button className="text-button" onClick={()=>onNavigate('products',Number(product.stock)===0?'empty':'low')}>Xem</button></div>)}{!empty.length&&!low.length&&<div className="role-empty">Tồn kho hiện chưa có mã nào cần bổ sung.</div>}<button className="secondary" onClick={()=>onNavigate('products')}>Xem toàn bộ tồn kho</button></section>
 </div>}
 return null;
}
