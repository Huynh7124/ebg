export const roleNames={admin:'Admin',warehouse:'Nhân viên kho',processor:'Nhân viên gia công',packer:'Nhân viên đóng gói'};
export const normalizeRole=role=>role==='staff'?'processor':role;
export const managesWarehouse=user=>['admin','warehouse'].includes(user?.role);
export function roleAccess(role,team=''){
 const warehouse=['admin','warehouse'].includes(role);
 return {admin:role==='admin',warehouse,buyer:warehouse,manageStaff:warehouse,manageRoles:warehouse,packing:role==='packer',team};
}

export const assignableRoles=actorRole=>Object.keys(roleNames).filter(role=>actorRole==='admin'||actorRole==='warehouse'&&role!=='admin');
