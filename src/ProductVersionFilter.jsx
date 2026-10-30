import React from 'react';
export default function ProductVersionFilter({products,value='',onChange,disabled=false}){
 const versions=[...new Set(products.map(p=>p.version||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
 return <label>Version<select aria-label="Lọc version sản phẩm" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">Tất cả version</option><option value="__none__">Chưa có version</option>{versions.map(version=><option key={version} value={version}>{version}</option>)}</select></label>;
}
