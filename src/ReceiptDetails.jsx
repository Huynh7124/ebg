import OutboundReceipt from './OutboundReceipt.jsx';
import {unitTypeNames} from '../shared/product-filters.js';
import React from 'react';
import {movementLabel} from '../shared/movements.js';
export default function ReceiptDetails({receipt,products,action,autoPrint=false}){
 function download(){const esc=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'")+'"';const rows=[['Mã phiếu','Thời gian','Loại phiếu','Mã sản phẩm','Tên sản phẩm','Dòng xe','Màu','Đơn/Đôi','Số lượng','Người thực hiện','Ghi chú'],...receipt.items.map(item=>{const p=products.find(p=>p.id===item.productId);return [receipt.code,new Date(receipt.date).toLocaleString('vi-VN'),movementLabel(receipt),p?.code,p?.name,p?.vehicle,p?.color,unitTypeNames[p?.unitType||''],item.quantity,receipt.user,receipt.note]})];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=receipt.code+'.csv';a.click();URL.revokeObjectURL(url)}
 return <OutboundReceipt autoPrint={autoPrint} receipt={receipt} products={products} action={action} onDownload={download}/>;
}
