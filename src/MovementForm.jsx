import React,{useRef,useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {movementTypes} from '../shared/movements.js';
export default function MovementForm({kind,product,products,action,onClose}){
 const [operation,setOperation]=useState(kind==='in'?'receive_stock':'issue_stock'),[items,setItems]=useState([{key:1,productId:String(product?.id||''),quantity:'1'}]),[saving,setSaving]=useState(false),[note,setNote]=useState('');const nextKey=useRef(2);
 const waiting=['send_anode','send_repair'].includes(operation),total=items.reduce((sum,item)=>sum+(Number(item.quantity)||0),0);
 const update=(key,field,value)=>setItems(rows=>rows.map(row=>row.key===key?{...row,[field]:value}:row));
 return <form onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);try{await action('movements',{kind,operation,note,items:items.map(({productId,quantity})=>({productId,quantity}))})}finally{setSaving(false)}}}>
  <label>Loại {kind==='in'?'nhập':'xuất'}<select name="operation" value={operation} onChange={e=>setOperation(e.target.value)} disabled={saving}>{Object.entries(movementTypes).filter(([,type])=>type.kind===kind).map(([value,type])=><option key={value} value={value}>{type.label}</option>)}</select></label>
  <div className="receipt-lines">{items.map((item,index)=>{const selected=products.find(p=>String(p.id)===item.productId);return <div className="receipt-line" key={item.key}>
   <div className="line-heading"><b>Sản phẩm {index+1}</b><button className="icon-button" type="button" aria-label={'Xóa dòng '+(index+1)} disabled={items.length===1||saving} onClick={()=>setItems(rows=>rows.filter(row=>row.key!==item.key))}><Trash2 size={17}/></button></div>
   <label>Sản phẩm<select name="productId" aria-label={'Sản phẩm dòng '+(index+1)} required value={item.productId} onChange={e=>update(item.key,'productId',e.target.value)} disabled={saving}><option value="">Chọn sản phẩm</option>{products.filter(p=>!p.locked).map(p=><option value={p.id} key={p.id} disabled={items.some(other=>other.key!==item.key&&other.productId===String(p.id))}>{p.code} — {p.name}</option>)}</select></label>
   <div className="line-quantity"><label>Số lượng<input name="quantity" aria-label={'Số lượng dòng '+(index+1)} type="number" min="1" max={kind==='out'&&selected?selected.stock:undefined} step="1" required value={item.quantity} onChange={e=>update(item.key,'quantity',e.target.value)} disabled={saving}/></label>{selected&&<p className="form-hint">Tồn kho: <b>{selected.stock}</b><br/>Hàng lỗi: <b>{selected.faulty||0}</b></p>}</div>
  </div>})}</div>
  <button className="secondary add-receipt-line" type="button" disabled={saving||items.length>=100} onClick={()=>{const key=nextKey.current++;setItems(rows=>[...rows,{key,productId:'',quantity:'1'}])}}><Plus size={16}/>Thêm sản phẩm</button>
  <div className="receipt-total"><span>{items.length} loại sản phẩm</span><b>Tổng số lượng: {total}</b></div>
  <label>Ghi chú chung<textarea name="note" value={note} onChange={e=>setNote(e.target.value)} disabled={saving} placeholder="Thông tin bổ sung cho phiếu (không bắt buộc)..." maxLength={500}/></label>
  <p className="receipt-required-note">Mỗi lần lưu sẽ lập một phiếu mới có mã riêng và mở phiếu để bạn xem hoặc in ngay.</p>
  <p className="form-hint">{waiting?'Trừ tồn kho ngay cho cả phiếu. Khi hàng trả lại đầy đủ, chọn “Nhận về kho” trên phiếu.':operation==='receive_faulty'?'Hàng lỗi được theo dõi riêng, không cộng vào tồn kho chính.':kind==='in'?'Cộng số lượng từng sản phẩm vào tồn kho chính.':'Trừ số lượng từng sản phẩm từ tồn kho chính.'} Nếu có dòng không hợp lệ, toàn bộ phiếu sẽ chưa được lưu.</p>
  <div className="modal-actions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Hủy</button><button className="primary" disabled={saving}>{saving?'Đang lưu...':'Tạo phiếu '+(kind==='in'?'nhập':'xuất')}</button></div>
 </form>
}
