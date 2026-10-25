export const workTypes={production:'Sản xuất / lắp ráp',anode:'Anode đổi màu',carbon:'Cắt / gia công Carbon',repair:'Sửa hàng lỗi',delivery:'Đóng / giao hàng',supply:'Cấp vật tư bổ sung'};
export const workStates={pending:'Chờ kho duyệt',issued:'Chờ nhận việc',working:'Đang thực hiện',partial:'Đã trả một phần',quality:'Cần xử lý kết quả',completed:'Hoàn tất',cancelled:'Đã hủy'};
export const materialKinds={unclassified:'Chưa phân loại',raw:'Nguyên vật liệu',semi:'Cụm / bán thành phẩm',finished:'Thành phẩm'};
export const bucketFor=type=>type==='anode'?'anote':type==='repair'?'repair':type==='delivery'?'inTransit':'inProduction';
export function assemblyCapacity(bom,products){
 const byId=new Map(products.map(p=>[p.id,p]));
 return bom?.lines?.length?Math.min(...bom.lines.map(l=>{const p=byId.get(l.productId);return !p||p.locked?0:Math.floor(p.stock/l.quantity)})):null;
}
export function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false,afterQuote=false;
 text=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"'){quoted=false;afterQuote=true;}else cell+=c}
  else if(afterQuote&&![' ', '\t', ',', '\n', '\r'].includes(c))throw Error('Ký tự sau ô có ngoặc kép không hợp lệ');
  else if(afterQuote&&(c===' '||c==='\t'))continue;
  else if(c==='"'){if(cell)throw Error('Dấu ngoặc kép không hợp lệ');quoted=true}
  else if(c===','){row.push(cell);cell='';afterQuote=false}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';afterQuote=false}
  else cell+=c;
 }
 if(quoted)throw Error('CSV chưa đóng dấu ngoặc kép');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw Error('Cần dòng tiêu đề và ít nhất một mặt hàng');
 const headers=rows.shift().map(h=>h.trim());
 if(new Set(headers).size!==headers.length)throw Error('Tiêu đề CSV bị trùng');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error(`Dòng ${i+2}: số cột không khớp`);return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()]))});
}
export const csvCell=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'")+'"';
