export const packingPrintLabels={pickup:'Phiếu lấy hàng',production:'Phiếu gia công'};
export function defaultPackingPrint(order,products,people,type){
 const byId=new Map(products.map(p=>[p.id,p]));
 return {date:order.orderDate,warehouse:'Cao Lỗ',requester:people.find(p=>p.id===order.requesterId)?.name||order.events?.[0]?.actor||'',receiver:type==='production'?(people.find(p=>p.id===order.processorId)?.name||''):(order.events?.find(e=>e.action==='Kho chuẩn bị xong')?.actor||''),senderDepartment:'Shipping',receiverDepartment:'Gia Công',note:'',lines:(type==='pickup'?(order.pickupItems||order.inputs||[]):order.items).map(l=>({productId:l.productId,name:byId.get(l.productId)?.name||'Sản phẩm không còn trong danh mục',unit:byId.get(l.productId)?.unit||'',quantity:l.quantity,note:''}))};
}
export function validatePackingPrint(input,order,products,people,type){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Thông tin phiếu không hợp lệ');
 const result=defaultPackingPrint(order,products,people,type);
 for(const key of ['date','warehouse','requester','receiver','senderDepartment','receiverDepartment','note']){
  const value=input[key];if(typeof value!=='string'||value.length>(key==='note'?2000:200))throw Error('Thông tin phiếu thiếu hoặc quá dài');result[key]=value.trim();
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)||!Number.isFinite(Date.parse(result.date))||new Date(result.date).toISOString().slice(0,10)!==result.date)throw Error('Ngày trên phiếu không hợp lệ');
 if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw Error('Cần chọn 1–100 mặt hàng');
 const seen=new Set();result.lines=input.lines.map(line=>{
  const product=products.find(p=>p.id===Number(line.productId));
  if(!product||seen.has(product.id)||!['number','string'].includes(typeof line.quantity)||!Number.isSafeInteger(Number(line.quantity))||Number(line.quantity)<1||Number(line.quantity)>1e9||typeof line.note!=='string'||line.note.length>500)throw Error('Mặt hàng, số lượng hoặc ghi chú không hợp lệ');
  seen.add(product.id);return {productId:product.id,name:product.name,unit:product.unit,quantity:Number(line.quantity),note:line.note.trim()};
 });
 // Keep saved item identities stable when the catalog is renamed later.
 const saved=order.printForms?.[type];if(saved)for(const line of result.lines){const old=saved.lines.find(l=>l.productId===line.productId);if(old){line.name=old.name;line.unit=old.unit;}}
 return result;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function packingPrintHtml(data,type){
 const production=type==='production',minimum=production?12:15;
 const rows=[...data.lines,...Array.from({length:Math.max(0,minimum-data.lines.length)},()=>null)];
 const date=data.date.split('-').reverse().join(' / ');
 return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${production?'PHIẾU GIA CÔNG':'PHIẾU LẤY HÀNG Ở KHO'}</title><style>
 @page{size:${production?'A4':'letter'} portrait;margin:8mm 12mm}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font:13pt "Times New Roman",Times,serif}article{max-width:190mm;margin:auto}p{margin:0 0 5mm}.company{font-weight:bold;margin-bottom:5mm}.address,.tax{padding-left:6mm}h1{font-size:${production?'13':'18'}pt;text-align:center;margin:4mm 0 5mm}.date,.warehouse{text-align:center;font-weight:bold;margin-bottom:4mm}.parties{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin:0 3mm 3mm;line-height:1.25}.parties div{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}th,td{border:1pt solid #000;padding:2mm;overflow-wrap:anywhere}th{font-size:14pt;height:11mm}td{height:${production?'12':'10'}mm;vertical-align:top;white-space:pre-wrap}td:first-child,td:nth-child(3),td:nth-child(4){text-align:center}tr{break-inside:avoid}.note{margin-top:6mm;white-space:pre-wrap;overflow-wrap:anywhere}.signatures{display:flex;justify-content:space-between;padding:3mm 4mm 8mm;break-inside:avoid;font-weight:${production?'normal':'bold'}}.signatures span{min-width:50mm;text-align:center}@media screen{body{padding:8mm 12mm}}
 </style></head><body><article><p class="company">CÔNG TY TNHH EBIKE GARAGE VIỆT NAM</p><p class="address">Địa chỉ: <b>348 Hoàng Văn Thụ, P.Tân Sơn Nhất, TP HCM.</b></p><p class="tax">MST: <b>0319279878</b></p><h1>${production?'PHIẾU GIA CÔNG':'PHIẾU LẤY HÀNG Ở KHO'}</h1><p class="date">Ngày: ${esc(date)}</p><p class="warehouse">Kho: ${esc(data.warehouse)}</p><div class="parties"><div>Người đề nghị: ${esc(data.requester)}${production?'<br>– Phòng Ban: '+esc(data.senderDepartment):''}</div><div>– ${production?'Người nhận':'Nhân viên kho'}: ${esc(data.receiver)}${production?'<br>– Phòng Ban: '+esc(data.receiverDepartment):''}</div></div><table><colgroup>${(production?[8,47,8.5,7.5,29]:[8,35,9,6,42]).map(w=>`<col style="width:${w}%">`).join('')}</colgroup><thead><tr><th>No.</th><th>Tên hàng</th><th>ĐVT</th><th>SL</th><th>Ghi chú</th></tr></thead><tbody>${rows.map((l,i)=>`<tr><td>${i+1}.</td><td>${esc(l?.name)}</td><td>${esc(l?.unit)}</td><td>${esc(l?.quantity)}</td><td>${esc(l?.note)}</td></tr>`).join('')}</tbody></table>${production?'<p class="note">GHI CHÚ : '+esc(data.note)+'</p>':''}<div class="signatures"><span>Người lập phiếu</span><span>${production?'Người nhận hàng':'Người xuất hàng'}</span></div></article></body></html>`;
}
