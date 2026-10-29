# Thương hiệu và dòng xe

Trong Sản phẩm, chọn Thương hiệu rồi chọn Dòng xe. Đổi thương hiệu sẽ xóa lựa chọn dòng xe cũ. Các bộ lọc màu, size, đơn/đôi, nhóm và trạng thái vẫn kết hợp được.

Danh sách ban đầu có 10 thương hiệu và 26 dòng xe theo yêu cầu. Danh sách được tạo một lần khi khởi động bản mới. Đổi tên hoặc thêm dòng xe sẽ được lưu trong SQLite, không bị đặt lại sau khi khởi động.

Admin hoặc nhân viên kho mở **Danh mục → Thương hiệu & dòng xe** để:

- Thêm thương hiệu và đổi tên thương hiệu.
- Thêm dòng xe ngay trong thẻ thương hiệu.
- Bấm tên dòng xe để sửa tên hoặc đổi thương hiệu; sản phẩm của dòng đó được cập nhật cùng.
- Dùng danh sách Dòng xe bên dưới để khóa/mở khóa.

Form thêm/sửa sản phẩm có Thương hiệu và Dòng xe liên kết. Sản phẩm dùng chung có thể để trống dòng xe. Danh mục dòng xe cũ chưa có thương hiệu vẫn được giữ để phân loại lại, không suy đoán thương hiệu từ tên sản phẩm Excel.

Các nhãn mặc định cũ Sur-Ron Light Bee, Sur-Ron Ultra Bee và Talaria Sting được quy về Light Bee, Ultra Bee, Sting. E Ride Pro cũ chỉ thể hiện thương hiệu, được giữ thương hiệu E Ride Pro với dòng xe để trống, không đoán phiên bản SS. Các nhãn cũ này được khóa trong danh mục để tránh lựa chọn trùng.

API kiểm tra quyền Admin/kho khi tạo, sửa thương hiệu và dòng xe; kiểm tra dòng xe phải thuộc thương hiệu khi lưu sản phẩm. Chọn thương hiệu ở bộ lọc chỉ lấy sản phẩm đã được gán thương hiệu đó.
