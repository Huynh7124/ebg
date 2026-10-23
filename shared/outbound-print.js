export const anodeVendors={nam_thai:'Nam Thái',binh_phat:'Bình Phát'};
function applyAnodeVendor(data,receipt){return receipt.operation==='send_anode'?{...data,receiverName:anodeVendors[receipt.anodeVendor]||anodeVendors.nam_thai,receiver:'ANODE'}:data}
export function outboundDocumentNumber(receipt,value=''){
 if(receipt.operation==='issue_stock')return '';
 return value.trim()||(receipt.operation==='send_anode'?receipt.code:'');
}
export const outboundPrintFields={companyName:180,taxId:40,address:400,email:160,phone:80,title:100,documentNumber:80,date:10,warehouse:160,sender:200,receiver:200,senderName:160,receiverName:160,reason:1000,preparedBy:120,receivedBy:120,agreement:1600};
const lineFields={group:160,name:400,unit:30,note:400,returnDate:80};
export function defaultOutboundPrint(receipt,products){
 const date=new Date(receipt.date),localDate=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 return {version:1,companyName:'CÔNG TY TNHH EBIKE GARAGE VIỆT NAM',taxId:'0319279878',address:'C7/17F7 ấp 4A Bình Chánh, TP HCM.',email:'ebgketoan@gmail.com',phone:'+84 979 681 368',title:'Phiếu Xuất Kho',documentNumber:outboundDocumentNumber(receipt,receipt.code),date:localDate,warehouse:'Cao Lỗ',senderName:'EBG',receiverName:receipt.operation==='send_anode'?(anodeVendors[receipt.anodeVendor]||'Nam Thái'):'',sender:'Kho EBG (Bên giao)',receiver:receipt.operation==='send_anode'?'ANODE':receipt.operation==='send_repair'?'Bộ phận sửa chữa (Bên nhận)':'Gia Công (Bên nhận)',reason:receipt.note||'',preparedBy:receipt.user||'',receivedBy:'',agreement:'Hai bên đồng ý, thống nhất ký tên. Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.',lines:receipt.items.map(item=>{const p=products.find(p=>p.id===item.productId);return {lineId:item.id,group:p?.category||'',name:p?.name||'Sản phẩm cũ',unit:'Cái',note:'',returnDate:''}})};
}
export function validateOutboundPrint(value,items){
 if(!value||Array.isArray(value)||typeof value!=='object'||value.version!==1||Object.keys(value).some(k=>!['version','lines',...Object.keys(outboundPrintFields)].includes(k)))throw Error('Thông tin mẫu in không hợp lệ');
 const clean={version:1};
 for(const[key,max]of Object.entries(outboundPrintFields)){if(['senderName','receiverName'].includes(key)&&value[key]===undefined){clean[key]='';continue}if(typeof value[key]!=='string'||value[key].length>max)throw Error(`Thông tin ${key} không hợp lệ hoặc quá dài`);clean[key]=value[key].trim()}
 if(!clean.companyName||!clean.title||!/^\d{4}-\d{2}-\d{2}$/.test(clean.date)||!Number.isFinite(Date.parse(clean.date+'T00:00:00Z'))||new Date(clean.date+'T00:00:00Z').toISOString().slice(0,10)!==clean.date)throw Error('Cần tên công ty, tiêu đề và ngày hợp lệ');
 if(!Array.isArray(value.lines)||value.lines.length!==items.length)throw Error('Không được thêm hoặc xóa sản phẩm trong bản in');
 const ids=new Set(items.map(item=>item.id)),seen=new Set();clean.lines=value.lines.map(line=>{
  if(!line||!Number.isSafeInteger(line.lineId)||!ids.has(line.lineId)||seen.has(line.lineId)||Object.keys(line).some(k=>!['lineId',...Object.keys(lineFields)].includes(k)))throw Error('Dòng sản phẩm của bản in không hợp lệ; số lượng lấy từ phiếu gốc');
  seen.add(line.lineId);const row={lineId:line.lineId};for(const[key,max]of Object.entries(lineFields)){if(key==='returnDate'&&line[key]===undefined){row[key]='';continue}if(typeof line[key]!=='string'||line[key].length>max)throw Error('Thông tin dòng sản phẩm không hợp lệ');row[key]=line[key].trim()}if(!row.name||!row.unit)throw Error('Cần tên hàng và đơn vị tính');return row;
 });return clean;
}
export function outboundPrintData(receipt,products){
 const defaults=defaultOutboundPrint(receipt,products);if(!receipt.printData)return defaults;
 try{return applyAnodeVendor(validateOutboundPrint(typeof receipt.printData==='string'?JSON.parse(receipt.printData):receipt.printData,receipt.items),receipt)}catch{return defaults}
}
