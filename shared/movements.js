export const movementTypes={
 receive_cnc:{label:'Nhập từ CNC',kind:'in',bucket:'stock'},
 receive_anode:{label:'Nhập hàng Anode về',kind:'in',bucket:'stock'},
 receive_repair:{label:'Nhập sửa',kind:'in',bucket:'stock'},
 receive_stock:{label:'Nhập hàng',kind:'in',bucket:'stock'},
 receive_faulty:{label:'Nhập lỗi',kind:'in',bucket:'faulty'},
 issue_stock:{label:'Xuất kho',kind:'out',bucket:'stock'},
 send_stock:{label:'Xuất kho để stock',kind:'out',bucket:'stock'},
 send_anode:{label:'Xuất kho đi Anode',kind:'out',bucket:'anote'},
 send_repair:{label:'Xuất kho đi sửa',kind:'out',bucket:'repair'}
};
export const movementLabel=m=>movementTypes[m.operation]?.label||`${m.kind==='in'?'Nhập':'Xuất'} ${ {stock:'hàng kho',repair:'hàng sửa / lỗi',anote:'hàng Anote',faulty:'hàng lỗi'}[m.bucket]||''} (phiếu cũ)`;

export const receiptCode=r=>`${r.kind==='in'?'PN':'PX'}-${String(r.id).padStart(6,'0')}`;
export function groupReceipts(movements,headers=[]){
 const byId=new Map(headers.map(r=>[r.id,r])),groups=new Map();
 for(const m of movements){
  const header=m.receiptId?byId.get(m.receiptId):null,key=header?`receipt:${header.id}`:`movement:${m.id}`;
  if(!groups.has(key))groups.set(key,{...(header||m),key,legacy:!header,code:header?receiptCode(header):`CŨ-${String(m.id).padStart(6,'0')}`,completePath:header?`receipts/${header.id}/complete`:`movements/${m.id}/complete`,items:[],quantity:0});
  const r=groups.get(key);r.items.push(m);r.quantity+=m.quantity;
 }
 return [...groups.values()].map(r=>({...r,items:r.items.sort((a,b)=>a.id-b.id)}));
}
