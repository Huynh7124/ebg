const decoder=new TextDecoder();
const normalize=value=>String(value??'').trim().replace(/\s+/g,' ');

async function unzip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
 for(let i=Math.max(0,bytes.length-65557);i<=bytes.length-22;i++)if(view.getUint32(i,true)===0x06054b50)end=i;
 if(end<0)throw Error('File không phải XLSX hợp lệ');
 const count=view.getUint16(end+10,true),central=view.getUint32(end+16,true),files=new Map();let offset=central;
 for(let i=0;i<count;i++){
  if(view.getUint32(offset,true)!==0x02014b50)throw Error('Cấu trúc file XLSX bị lỗi');
  const method=view.getUint16(offset+10,true),size=view.getUint32(offset+20,true),nameLength=view.getUint16(offset+28,true),extraLength=view.getUint16(offset+30,true),commentLength=view.getUint16(offset+32,true),local=view.getUint32(offset+42,true),name=decoder.decode(bytes.slice(offset+46,offset+46+nameLength));
  const localName=view.getUint16(local+26,true),localExtra=view.getUint16(local+28,true),start=local+30+localName+localExtra,compressed=bytes.slice(start,start+size);let content;
  if(method===0)content=compressed;
  else if(method===8){if(!globalThis.DecompressionStream)throw Error('Trình duyệt chưa hỗ trợ đọc XLSX; hãy cập nhật Chrome hoặc Edge');content=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
  else throw Error('File XLSX dùng kiểu nén chưa được hỗ trợ');
  files.set(name,content);offset+=46+nameLength+extraLength+commentLength;
 }
 return files;
}

const xml=(files,path)=>{const data=files.get(path);if(!data)throw Error('File XLSX thiếu '+path);const doc=new DOMParser().parseFromString(decoder.decode(data),'application/xml');if(doc.querySelector('parsererror'))throw Error('Không đọc được XML trong file XLSX');return doc};
const cellText=node=>[...node.querySelectorAll('t')].map(item=>item.textContent||'').join('');
const column=reference=>{let value=0;for(const char of reference.match(/^[A-Z]+/)?.[0]||'')value=value*26+char.charCodeAt(0)-64;return value-1};

export async function parseCompositionWorkbook(file){
 if(!file||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Chọn file Excel định dạng .xlsx');
 if(file.size>8*1024*1024)throw Error('File Excel tối đa 8 MB');
 const files=await unzip(await file.arrayBuffer()),workbook=xml(files,'xl/workbook.xml'),relationships=xml(files,'xl/_rels/workbook.xml.rels'),targets=new Map([...relationships.querySelectorAll('Relationship')].map(rel=>[rel.getAttribute('Id'),rel.getAttribute('Target')]));
 const shared=files.has('xl/sharedStrings.xml')?[...xml(files,'xl/sharedStrings.xml').querySelectorAll('si')].map(cellText):[];
 const blocks=[],skipped=[];
 for(const sheet of workbook.querySelectorAll('sheet')){
  const title=normalize(sheet.getAttribute('name')),id=sheet.getAttribute('r:id'),target=targets.get(id);if(!target)continue;
  const path=target.startsWith('/')?target.slice(1):'xl/'+target.replace(/^\.\//,''),doc=xml(files,path),rows=[];
  for(const row of doc.querySelectorAll('sheetData row')){const values=[];for(const cell of row.querySelectorAll('c')){const index=column(cell.getAttribute('r')||'A1'),type=cell.getAttribute('t'),raw=type==='inlineStr'?cellText(cell):cell.querySelector('v')?.textContent??'';values[index]=type==='s'?shared[Number(raw)]??'':raw}rows.push(values)}
  const headerIndex=rows.findIndex(row=>row.some(value=>normalize(value).toLocaleLowerCase('vi-VN')==='tên hàng hóa')&&row.some(value=>normalize(value).toLocaleLowerCase('vi-VN')==='tên thành phần'));
  if(headerIndex<0){if(rows.some(row=>row.some(value=>normalize(value))))skipped.push(title);continue}
  const headers=rows[headerIndex].map(value=>normalize(value).toLocaleLowerCase('vi-VN')),at=name=>headers.indexOf(name),productName=at('tên hàng hóa'),productCode=at('mã sản phẩm'),componentName=at('tên thành phần'),componentCode=at('mã thành phần'),quantity=at('số lượng');let current=null;
  for(let index=headerIndex+1;index<rows.length;index++){
   const row=rows[index],name=normalize(row[productName]);
   if(name){current={sheet:title,row:index+1,name,code:normalize(row[productCode]),components:[]};blocks.push(current)}
   const component=normalize(row[componentName]);if(current&&component)current.components.push({row:index+1,name:component,code:normalize(row[componentCode]),quantity:normalize(row[quantity])});
  }
 }
 if(!blocks.length)throw Error('Không tìm thấy bảng có cột Tên hàng hóa, Tên thành phần và Số lượng');
 return {fileName:file.name,blocks,skipped};
}
