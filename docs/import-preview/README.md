# Bản thử NVL Sản phẩm Website (14)

Đã đọc file thật bằng bộ đọc XLSX của giao diện và nhập thử vào SQLite tạm, không thay dữ liệu đang vận hành.

- 292 TP theo Tên hàng hóa; 431 NVL theo Tên thành phần (723 mục).
- TP và NVL trùng tên được tách riêng. Không dùng mã Excel để gộp.
- Size 220/230/240/250/270 lấy từ tên, gồm cách viết 220mm và 220-45. Thiếu size để trống.
- Không có tồn thực tế trong file: sản phẩm mới tồn 0. Số lượng là cấu tạo một bộ.
- Dòng 19 và 23 sheet Đĩa tải thiếu lượng của Đĩa tải 520 43T: giữ danh mục NVL, chưa ghi quan hệ cấu tạo cho hai dòng này.
- 40 dòng thành phần lặp được xử lý theo bộ nhập hiện có (giữ lượng lớn nhất); cần kiểm tra cấu tạo trước khi dùng cho sản xuất.
- Trang tính1 không có cột cấu tạo nên không nhập. Quy cách đóng gói và phụ kiện đi kèm chưa được nhập tự động.

Xem danh sách đầy đủ trong website-14.csv. Trên app: Phân quyền & dữ liệu → Nhập cấu tạo từ Excel → chọn file → xem trước. Bấm xác nhận sẽ thêm danh mục, không xóa danh mục cũ.

Kiểm tra lại bằng `node scripts/check-website-import.mjs "đường-dẫn-file.xlsx"` (cần Chromium; có thể đặt CHROMIUM_PATH). Script chỉ dùng database tạm và xuất CSV xem trước.
