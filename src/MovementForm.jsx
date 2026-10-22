import React,{useState} from 'react';
import {movementTypes} from '../shared/movements.js';
export default function MovementForm({kind,product,products,action,onClose}){
 const [operation,setOperation]=useState(kind==='in'?'receive_stock':'issue_stock'),[productId,setProductId]=useState(String(product?.id||'')),[saving,setSaving]=useState(false);
 const selected=products.find(p=>String(p.id)===productId),waiting=['send_anode','send_repair'].includes(operation);
 return <form onSubmit={async e=>{e.preventDefault();if(saving)return;const body={...Object.fromEntries(new FormData(e.currentTarget)),kind};setSaving(true);try{await action('movements',body)}finally{setSaving(false)}}}>
  <label>Loại {kind==='in'?'nhập':'xuất'}<select name="operation" value={operation} onChange={e=>setOperation(e.target.value)}>{Object.entries(movementTypes).filter(([,type])=>type.kind===kind).map(([value,type])=><option key={value} value={value}>{type.label}</option>)}</select></label>
  <label>Sản phẩm<select name="productId" required value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Chọn sản phẩm</option>{products.filter(p=>!p.locked).map(p=><option value={p.id} key={p.id}>{p.code} — {p.name}</option>)}</select></label>
  {selected&&<p className="form-hint">Tồn kho chính: <b>{selected.stock}</b> · Hàng lỗi: <b>{selected.faulty||0}</b></p>}
  <label>Số lượng<input name="quantity" type="number" min="1" max={kind==='out'&&selected?selected.stock:undefined} step="1" required defaultValue="1"/></label>
  <label>Ghi chú<textarea name="note" placeholder="Thông tin bổ sung (không bắt buộc)..." maxLength={500}/></label>
  <p className="form-hint">{waiting?'Trừ tồn kho chính ngay, chuyển sang chờ Anode / sửa. Khi hàng trả lại, chọn “Nhận về kho” trên phiếu để ghi nhận nhập kho.':operation==='receive_faulty'?'Hàng lỗi được theo dõi riêng, không cộng vào tồn kho chính.':kind==='in'?'Cộng số lượng vào tồn kho chính.':'Trừ số lượng từ tồn kho chính.'}</p>
  <div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="primary" disabled={saving}>{saving?'Đang lưu...':'Tạo phiếu '+(kind==='in'?'nhập':'xuất')}</button></div>
 </form>
}
