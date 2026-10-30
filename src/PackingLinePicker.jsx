import ModalCloseButton from './ModalCloseButton.jsx';
import {Search,X} from 'lucide-react';
import React,{useState,useEffect} from 'react';
import ProductFilterPanel from './ProductFilterPanel.jsx';
import {emptyProductFilters,matchesProduct} from '../shared/product-filters.js';
import {stockStageNames} from '../shared/stock-stages.js';

export default function PackingLinePicker({products,brands=[],categories=[],value,onChange,title,raw=false,disabled=false,notes=false}){
 const [filters,setFilters]=useState({...emptyProductFilters,size:'',category:'',kind:raw?'raw':''});
 const [query,setQuery]=useState(''),[limit,setLimit]=useState(20);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(filters.search||''),250);return()=>clearTimeout(timer)},[filters.search]);
 useEffect(()=>setLimit(20),[query,filters.brand,filters.vehicle,filters.color,filters.unitType,filters.size,filters.category,filters.kind,filters.version]);
 const candidates=products.filter(p=>!p.locked);
 const filtered=candidates.filter(p=>matchesProduct(p,{...filters,search:query,size:''})&&(!filters.size||(filters.size==='none'?!p.size:String(p.size)===filters.size))&&(!filters.category||p.category===filters.category)&&(!filters.kind||p.materialKind===filters.kind||Number(p.stages?.[filters.kind])>0));
 function add(product){if(disabled||value.some(l=>Number(l.productId)===product.id))return;const row={productId:product.id,name:product.name,unit:product.unit,quantity:1,note:''},empty=value.findIndex(l=>!l.productId);onChange(empty<0?[...value,row]:value.map((l,i)=>i===empty?row:l))}
 const update=(index,patch)=>onChange(value.map((row,i)=>i===index?{...row,...patch}:row));
 return <fieldset className="ops-lines packing-line-picker" disabled={disabled}><legend>{title}</legend>
 <label className="packing-search-label">Tìm sản phẩm<div className="packing-product-search"><Search size={20} aria-hidden="true"/><input type="search" aria-label="Tìm tên hoặc mã sản phẩm trong phiếu" placeholder="Tìm tên hoặc mã sản phẩm..." value={filters.search||''} disabled={disabled} onChange={e=>setFilters({...emptyProductFilters,search:e.target.value,size:'',category:'',kind:''})} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}}/>{filters.search&&<button type="button" aria-label="Xóa tìm kiếm sản phẩm trong phiếu" onClick={()=>{setFilters({...filters,search:''});setQuery('')}}><X size={18}/></button>}</div></label>
 <ProductFilterPanel brands={brands} categories={categories} products={products} value={{...filters,cat:filters.category||''}} onChange={next=>setFilters({...filters,...next,category:next.cat||''})} status="all" onStatus={()=>{}} lowCount={0} showStatus={false}/>
 <div className="packing-picker-extra">
 <label>Nhóm sản phẩm<select aria-label={title+' nhóm sản phẩm'} value={filters.kind||''} onChange={e=>setFilters({...filters,kind:e.target.value})}><option value="">Tất cả sản phẩm</option>{Object.entries(stockStageNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
 </div><p>{filtered.length} sản phẩm phù hợp bộ lọc. Các dòng đã chọn được giữ khi đổi bộ lọc.</p>
 {(filters.search||query)&&<div className="packing-search-results" aria-label="Kết quả tìm sản phẩm" aria-live="polite"><table><thead><tr><th>Sản phẩm</th><th>Nhóm</th><th>ĐVT</th><th>Tồn kho</th><th/></tr></thead><tbody>{filtered.slice(0,limit).map(product=>{const chosen=value.some(l=>Number(l.productId)===product.id);return <tr key={product.id}><td>{product.name}</td><td>{stockStageNames[product.materialKind]||'Chưa phân loại'}</td><td>{product.unit}</td><td>{product.stock}</td><td><button type="button" className="secondary" disabled={disabled||chosen} aria-label={(chosen?'Đã chọn ':'Thêm ')+product.name} onClick={()=>add(product)}>{chosen?'Đã chọn':'Thêm'}</button></td></tr>})}</tbody></table>{!filtered.length&&<p>Không tìm thấy sản phẩm phù hợp.</p>}{filtered.length>limit&&<button type="button" className="secondary" onClick={()=>setLimit(n=>n+20)}>Xem thêm sản phẩm</button>}</div>}
 {value.map((row,index)=>{const selected=products.find(p=>p.id===Number(row.productId));const options=selected&&!filtered.some(p=>p.id===selected.id)?[selected,...filtered]:filtered;return <div className="ops-line" key={index}>
 <label>{title} {index+1}<select aria-label={title+' '+(index+1)} required value={row.productId} onChange={e=>{const product=products.find(p=>p.id===Number(e.target.value));update(index,{productId:product?.id||'',name:product?.name||'',unit:product?.unit||''})}}><option value="">Chọn hàng...</option>{options.filter(p=>p.id===Number(row.productId)||!value.some(l=>Number(l.productId)===p.id)).map(p=><option key={p.id} value={p.id}>{p.name} ({p.unit}) · Kho: {p.stock}</option>)}</select></label>
 <label>Số lượng<input aria-label={title+' số lượng '+(index+1)} type="number" required min="1" max="1000000000" step="1" value={row.quantity} onChange={e=>update(index,{quantity:e.target.value})}/></label>
 {notes&&<label>Ghi chú<input aria-label={'Ghi chú mặt hàng '+(index+1)} maxLength={500} value={row.note||''} onChange={e=>update(index,{note:e.target.value})}/></label>}
 <ModalCloseButton label={'Xóa '+title+' '+(index+1)} disabled={disabled} onClick={()=>onChange(value.filter((_,i)=>i!==index))}/>
 </div>})}<button className="secondary" type="button" onClick={()=>onChange([...value,{productId:'',quantity:1,note:''}])}>Thêm mặt hàng</button>
 </fieldset>;
}
