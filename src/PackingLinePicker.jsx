import React,{useState} from 'react';
import ProductSearchFilters from './ProductSearchFilters.jsx';
import {emptyProductFilters,matchesProduct} from '../shared/product-filters.js';
import {stockStageNames} from '../shared/stock-stages.js';

export default function PackingLinePicker({products,value,onChange,title,raw=false,disabled=false,notes=false}){
 const [filters,setFilters]=useState({...emptyProductFilters,size:'',category:'',kind:raw?'raw':''});
 const candidates=products.filter(p=>!p.locked);
 const filtered=candidates.filter(p=>matchesProduct(p,{...filters,size:''})&&(!filters.size||(filters.size==='none'?!p.size:String(p.size)===filters.size))&&(!filters.category||p.category===filters.category)&&(!filters.kind||p.materialKind===filters.kind||Number(p.stages?.[filters.kind])>0));
 const update=(index,patch)=>onChange(value.map((row,i)=>i===index?{...row,...patch}:row));
 return <fieldset className="ops-lines packing-line-picker" disabled={disabled}><legend>{title}</legend>
 <ProductSearchFilters products={candidates} value={filters} onChange={setFilters} disabled={disabled}/>
 <div className="packing-picker-extra">
 <label>Nhóm sản phẩm<select aria-label={title+' nhóm sản phẩm'} value={filters.kind||''} onChange={e=>setFilters({...filters,kind:e.target.value})}><option value="">Tất cả sản phẩm</option>{Object.entries(stockStageNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
 <label>Danh mục<select aria-label={title+' danh mục'} value={filters.category||''} onChange={e=>setFilters({...filters,category:e.target.value})}><option value="">Tất cả danh mục</option>{[...new Set(candidates.map(p=>p.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')).map(name=><option key={name}>{name}</option>)}</select></label>
 <label>Size<select aria-label={title+' size'} value={filters.size||''} onChange={e=>setFilters({...filters,size:e.target.value})}><option value="">Tất cả size</option><option value="none">Không có size</option>{[220,230,240,250,270].map(size=><option key={size} value={size}>{size}</option>)}</select></label>
 </div><p>{filtered.length} sản phẩm phù hợp bộ lọc. Các dòng đã chọn được giữ khi đổi bộ lọc.</p>
 {value.map((row,index)=>{const selected=products.find(p=>p.id===Number(row.productId));const options=selected&&!filtered.some(p=>p.id===selected.id)?[selected,...filtered]:filtered;return <div className="ops-line" key={index}>
 <label>{title} {index+1}<select aria-label={title+' '+(index+1)} required value={row.productId} onChange={e=>{const product=products.find(p=>p.id===Number(e.target.value));update(index,{productId:product?.id||'',name:product?.name||'',unit:product?.unit||''})}}><option value="">Chọn hàng...</option>{options.filter(p=>p.id===Number(row.productId)||!value.some(l=>Number(l.productId)===p.id)).map(p=><option key={p.id} value={p.id}>{p.name} ({p.unit}) · Kho: {p.stock}</option>)}</select></label>
 <label>Số lượng<input aria-label={title+' số lượng '+(index+1)} type="number" required min="1" max="1000000000" step="1" value={row.quantity} onChange={e=>update(index,{quantity:e.target.value})}/></label>
 {notes&&<label>Ghi chú<input aria-label={'Ghi chú mặt hàng '+(index+1)} maxLength={500} value={row.note||''} onChange={e=>update(index,{note:e.target.value})}/></label>}
 <button type="button" aria-label={'Xóa '+title+' '+(index+1)} onClick={()=>onChange(value.filter((_,i)=>i!==index))}>×</button>
 </div>})}<button className="secondary" type="button" onClick={()=>onChange([...value,{productId:'',quantity:1,note:''}])}>Thêm mặt hàng</button>
 </fieldset>;
}
