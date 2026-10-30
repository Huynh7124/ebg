# Version sản phẩm

Admin hoặc nhân viên kho nhập **Version** khi thêm/sửa sản phẩm (ví dụ V1, V2, 2026), tối đa 60 ký tự; để trống nếu không có version. Đây là thuộc tính sản phẩm, độc lập với số phiên bản cấu tạo/định mức.

Bộ lọc dùng chung cung cấp Tất cả version, Chưa có version và các giá trị đã lưu, sắp xếp tự nhiên (V2 trước V10). Áp dụng trên sản phẩm, phiếu nhập/xuất, tạo phiếu, Anode/hàng sửa, tạo đơn đóng gói và chỉnh phiếu lấy hàng/gia công. Điều kiện version kết hợp với các bộ lọc khác trên cùng sản phẩm; tìm phiếu yêu cầu cùng một dòng đáp ứng mọi điều kiện.

Migration thêm cột `products.version` mặc định rỗng, giữ dữ liệu cũ. Sửa sản phẩm qua API không gửi version sẽ giữ giá trị hiện có. Import Excel hiện chưa ánh xạ version; có thể bổ sung trong phần sửa sản phẩm sau khi nhập.
