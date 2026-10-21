# EBG Garage — Quản lý kho phụ kiện xe điện

Ứng dụng tiếng Việt với React, Express và SQLite. Yêu cầu Node.js 24 trở lên (sử dụng `node:sqlite`).

## Khởi động

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Máy chủ dùng cổng `3000`, có thể thay bằng biến `PORT`. `npm run build` tạo bản production; `npm start` phục vụ bản build. `npm test` kiểm tra đăng nhập, phân quyền, chống CSRF, nhập xuất tồn, phiếu chờ, sản phẩm khóa và nhật ký trên cơ sở dữ liệu tạm biệt lập.

Lần chạy đầu tạo 3 tài khoản mẫu: `admin` (Admin), `it` (IT), `kho` (nhân viên kho). Đặt biến `INITIAL_ADMIN_PASSWORD` trước lần chạy đầu để chọn mật khẩu khởi tạo; nếu không, hệ thống sinh mật khẩu ngẫu nhiên và hiển thị **một lần ở terminal máy chủ**. Biến này không thay đổi mật khẩu tài khoản đã tồn tại. Đăng nhập và đổi mật khẩu tại **Tài khoản & bảo mật**. Admin có thể cấp tài khoản cùng vai trò tại đây.

## Chức năng

- Tổng quan, cảnh báo sản phẩm chạm mức tồn tối thiểu, thông báo và lịch sử thao tác.
- Danh mục phụ kiện và dòng xe do Admin hoặc IT tạo; máy chủ kiểm tra quyền.
- Thêm/sửa/khóa sản phẩm; chỉ chọn danh mục có sẵn; không có giá tiền.
- Tìm tên, mã, màu; lọc danh mục và dòng xe.
- Nhập/xuất theo nhóm hàng kho, hàng sửa/lỗi, Anote. Phiếu chờ cho hàng sửa/Anote không thay đổi tồn cho đến khi hoàn tất. Ngăn xuất quá tồn và hoàn tất một phiếu hai lần.
- Xuất CSV phiếu theo ngày/tuần/tháng/năm, mở bằng Excel. Tuần bắt đầu thứ Hai; ngày được tính theo múi giờ của trình duyệt.
- Dữ liệu mẫu: 8 sản phẩm, 6 dòng phụ kiện, 4 dòng xe và 4 phiếu. Tồn mẫu là số dư hiện tại, không phải toàn bộ lịch sử phát sinh.
- Bố cục responsive; danh sách sản phẩm chuyển thành thẻ trên điện thoại. Font được phục vụ cục bộ.

## Lưu trữ và triển khai

Dữ liệu và phiên đăng nhập nằm ở `data/ebg.db`, được Git bỏ qua. Sao lưu SQLite bằng backup API hoặc dừng máy chủ trước khi sao chép toàn bộ thư mục `data/` (bao gồm WAL nếu có). Giữ thư mục này trên ổ đĩa bền vững khi triển khai.

Trước khi mở cho người dùng thật:

- Đặt `SESSION_SECRET` ngẫu nhiên, ổn định (ít nhất 32 byte), lấy từ hệ thống quản lý secrets. Không commit mật khẩu hoặc secret.
- Cấu hình HTTPS và đặt `COOKIE_SECURE=true`. Nếu reverse proxy kết thúc TLS, cấu hình `TRUST_PROXY=1` **chỉ khi** máy chủ nằm sau đúng một proxy tin cậy và không truy cập trực tiếp từ Internet.
- Đổi mật khẩu của cả 3 tài khoản mẫu, tạo tài khoản cá nhân, không dùng tài khoản chung cho vận hành thực tế.
- Thiết lập sao lưu định kỳ và kiểm thử phục hồi dữ liệu.

Có cookie HttpOnly/SameSite, phiên 8 giờ, bcrypt, giới hạn thử đăng nhập, chống CSRF, Helmet, truy vấn SQL có tham số, kiểm tra số lượng và quyền tại API. Đây là phiên bản đầu cho một kho: chưa có MFA, quy trình khôi phục mật khẩu/email, giao diện chỉnh sửa/thu hồi quyền tài khoản, hay đánh giá bảo mật độc lập. Đổi mật khẩu hiện không thu hồi các phiên khác. Khởi động lại không giữ phiên nếu chưa cấu hình `SESSION_SECRET` ổn định.

“Anote” được giữ nguyên theo yêu cầu như một nhóm hàng riêng, có trạng thái chờ. Xuất phiếu hiện ở định dạng CSV; chưa có mẫu PDF/in theo biểu mẫu doanh nghiệp. Biểu trưng giao diện là wordmark EBG dựng bằng chữ, chưa thay thế bằng tệp logo gốc.

## Cập nhật bảo mật máy chủ phát triển

Bản sửa chặn truy cập trực tiếp `data/`, cơ sở dữ liệu SQLite, mã máy chủ, `.env`, thư mục test và các đường dẫn `/@fs` tới file riêng tư ở cả chế độ phát triển và production. API đặt `Cache-Control: no-store`; `/api/data` yêu cầu đăng nhập. JSON của dữ liệu mà tài khoản được phép xem vẫn xuất hiện trong tab Network, đây là cơ chế hoạt động của ứng dụng web.

Sau khi cập nhật mã nguồn, dừng tiến trình cũ rồi chạy lại. Trên Windows cũng có thể dùng `npm run build` rồi `npm start` để chạy production. Chỉ phục vụ thư mục `dist` cho tài nguyên tĩnh; không cấu hình hosting/IIS/Nginx phục vụ toàn bộ thư mục dự án. Giữ nguyên `data/` khi cập nhật. Nếu bản cũ từng truy cập được từ Internet và có khả năng file riêng tư đã bị tải, cần đánh giá phạm vi lộ dữ liệu, đổi mật khẩu các tài khoản và thay `SESSION_SECRET`, sau đó khởi động lại máy chủ.
