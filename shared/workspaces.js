const managementPages={products:'Sản phẩm',in:'Nhập kho',out:'Xuất kho',categories:'Danh mục',employees:'Nhân viên',history:'Lịch sử hoạt động'};
const managementTabs={overview:'Tổng quan',labels:'Tra / quét mã',data:'Dữ liệu & quyền'};

const workspaces={
 admin:{title:'Quản trị hệ thống',headline:'Quản lý đội ngũ và toàn bộ hoạt động.',description:'Phân quyền nhân viên, theo dõi kho, gia công và đóng gói từ một nơi.',navigation:{dashboard:'Dashboard',operations:'Quản trị hệ thống',...managementPages},tabs:managementTabs},
 warehouse:{title:'Điều hành kho',headline:'Xác nhận đúng đơn. Xuất đúng hàng.',description:'Tiếp nhận đơn đóng gói, xuất hàng và theo dõi stock.',navigation:{operations:'Điều hành kho',...managementPages},tabs:managementTabs},
 processor:{title:'Gia công của tôi',headline:'Nhận việc và bàn giao kết quả.',description:'Theo dõi đơn gia công và hàng stock ngay tại tổng quan.',navigation:{operations:'Gia công của tôi'},tabs:{overview:'Tổng quan'}},
 packer:{title:'Đóng gói của tôi',headline:'Lên đơn đóng gói đầu ngày.',description:'Lên đơn, theo dõi kho chuẩn bị và nhận hàng ngay tại tổng quan.',navigation:{operations:'Đóng gói của tôi',products:'Tra cứu hàng'},tabs:{overview:'Tổng quan',labels:'Tra / quét mã'},requestLabel:'Lên đơn đóng gói'}
};

export const workspaceFor=role=>workspaces[role]||workspaces.processor;
