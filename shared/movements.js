export const movementTypes={
 receive_stock:{label:'Nhập kho',kind:'in',bucket:'stock'},
 receive_faulty:{label:'Nhập lỗi',kind:'in',bucket:'faulty'},
 issue_stock:{label:'Xuất kho',kind:'out',bucket:'stock'},
 send_anode:{label:'Xuất kho đi Anode',kind:'out',bucket:'anote'},
 send_repair:{label:'Xuất kho đi sửa',kind:'out',bucket:'repair'}
};
export const movementLabel=m=>movementTypes[m.operation]?.label||`${m.kind==='in'?'Nhập':'Xuất'} ${ {stock:'hàng kho',repair:'hàng sửa / lỗi',anote:'hàng Anote',faulty:'hàng lỗi'}[m.bucket]||''} (phiếu cũ)`;
