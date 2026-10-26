const managementPages={products:'Sản phẩm',in:'Nhập kho',out:'Xuất kho',categories:'Danh mục',employees:'Nhân viên',history:'Lịch sử hoạt động'};
const managementTabs={overview:'Tổng quan',requests:'Yêu cầu',work:'Công việc',purchase:'Mua vật tư',labels:'Tra / quét mã',data:'Dữ liệu & quyền'};

const workspaces={
 admin:{title:'Quản trị hệ thống',headline:'Quản lý đội ngũ và toàn bộ hoạt động.',description:'Phân quyền nhân viên, theo dõi kho, gia công và đóng gói từ một nơi.',navigation:{operations:'Quản trị hệ thống',...managementPages},tabs:managementTabs,requestLabel:'Tạo yêu cầu'},
 warehouse:{title:'Điều hành kho',headline:'Xác nhận đúng đơn. Xuất đúng hàng.',description:'Tiếp nhận yêu cầu, xuất hàng thực tế và kiểm nhận kết quả từ nhân viên.',navigation:{operations:'Điều hành kho',...managementPages},tabs:managementTabs,requestLabel:'Tạo yêu cầu'},
 processor:{title:'Gia công của tôi',headline:'Nhận việc và bàn giao kết quả.',description:'Theo dõi việc kho giao, vật tư đang giữ và kết quả chờ kho kiểm nhận.',navigation:{operations:'Gia công của tôi',products:'Tra cứu vật tư'},tabs:{overview:'Tổng quan',work:'Việc được giao',requests:'Yêu cầu của tôi',labels:'Tra / quét mã'},requestLabel:'Gửi yêu cầu cho kho'},
 packer:{title:'Đóng gói của tôi',headline:'Lên đơn đóng gói đầu ngày.',description:'Lên danh sách theo đơn, chờ kho xác nhận và xuất, rồi nhận hàng để đóng gói.',navigation:{operations:'Đóng gói của tôi',products:'Tra cứu hàng'},tabs:{overview:'Tổng quan',requests:'Đơn của tôi',work:'Nhận hàng',labels:'Tra / quét mã'},requestLabel:'Lên đơn đóng gói'}
};

export const workspaceFor=role=>workspaces[role]||workspaces.processor;
