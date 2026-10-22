# EBG Garage — Quản lý kho phụ kiện xe điện

Ứng dụng tiếng Việt với React, Express và SQLite. Yêu cầu Node.js 24 trở lên (sử dụng `node:sqlite`).

## Khởi động

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Máy chủ dùng cổng `3000`, có thể thay bằng biến `PORT`. `npm run build` tạo bản production; `npm start` phục vụ bản build. `npm test` kiểm tra đăng nhập, phân quyền, chống CSRF, nhập xuất tồn, phiếu chờ, sản phẩm khóa và nhật ký trên cơ sở dữ liệu tạm biệt lập.

Lần chạy đầu tạo 2 tài khoản mẫu: `admin` (Admin), `kho` (Nhân viên). Đặt biến `INITIAL_ADMIN_PASSWORD` trước lần chạy đầu để chọn mật khẩu khởi tạo; nếu không, hệ thống sinh mật khẩu ngẫu nhiên và hiển thị **một lần ở terminal máy chủ**. Biến này không thay đổi mật khẩu tài khoản đã tồn tại. Đăng nhập và đổi mật khẩu tại **Tài khoản & bảo mật**. Admin có thể cấp tài khoản cùng vai trò tại đây.

## Chức năng

- Tổng quan, cảnh báo sản phẩm chạm mức tồn tối thiểu, thông báo và lịch sử thao tác.
- Danh mục phụ kiện và dòng xe do Admin tạo; máy chủ kiểm tra quyền.
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
- Đổi mật khẩu của cả 2 tài khoản mẫu, tạo tài khoản cá nhân, không dùng tài khoản chung cho vận hành thực tế.
- Thiết lập sao lưu định kỳ và kiểm thử phục hồi dữ liệu.

Có cookie HttpOnly/SameSite, phiên 8 giờ, bcrypt, giới hạn thử đăng nhập, chống CSRF, Helmet, truy vấn SQL có tham số, kiểm tra số lượng và quyền tại API. Đây là phiên bản đầu cho một kho: chưa có MFA, quy trình khôi phục mật khẩu/email, đánh giá bảo mật độc lập. Đổi mật khẩu hiện không thu hồi các phiên khác. Khởi động lại không giữ phiên nếu chưa cấu hình `SESSION_SECRET` ổn định.

“Anote” được giữ nguyên theo yêu cầu như một nhóm hàng riêng, có trạng thái chờ. Xuất phiếu hiện ở định dạng CSV; chưa có mẫu PDF/in theo biểu mẫu doanh nghiệp. Biểu trưng giao diện là wordmark EBG dựng bằng chữ, chưa thay thế bằng tệp logo gốc.

## Cập nhật bảo mật máy chủ phát triển

Bản sửa chặn truy cập trực tiếp `data/`, cơ sở dữ liệu SQLite, mã máy chủ, `.env`, thư mục test và các đường dẫn `/@fs` tới file riêng tư ở cả chế độ phát triển và production. API đặt `Cache-Control: no-store`; `/api/data` yêu cầu đăng nhập. JSON của dữ liệu mà tài khoản được phép xem vẫn xuất hiện trong tab Network, đây là cơ chế hoạt động của ứng dụng web.

Sau khi cập nhật mã nguồn, dừng tiến trình cũ rồi chạy lại. Trên Windows cũng có thể dùng `npm run build` rồi `npm start` để chạy production. Chỉ phục vụ thư mục `dist` cho tài nguyên tĩnh; không cấu hình hosting/IIS/Nginx phục vụ toàn bộ thư mục dự án. Giữ nguyên `data/` khi cập nhật. Nếu bản cũ từng truy cập được từ Internet và có khả năng file riêng tư đã bị tải, cần đánh giá phạm vi lộ dữ liệu, đổi mật khẩu các tài khoản và thay `SESSION_SECRET`, sau đó khởi động lại máy chủ.

## Cài ứng dụng lên điện thoại / máy tính (PWA)

`npm run build` tạo manifest, icon và service worker có phiên bản theo nội dung build. Chạy `npm start` để kiểm tra bản production. Trên một máy chủ có HTTPS, Chrome/Edge hỗ trợ cài ứng dụng; trên iPhone/iPad dùng Safari → Chia sẻ → Thêm vào Màn hình chính. Nút **Cài ứng dụng EBG** sẽ mở lời mời cài hoặc hướng dẫn theo trình duyệt. Localhost được dùng cho kiểm thử, không phải đường dẫn chia sẻ cho điện thoại khác.

Chỉ cache file giao diện công khai, không cache API, thông tin đăng nhập hay dữ liệu kho. Khi mất mạng có thể mở khung ứng dụng và hướng dẫn, nhưng không thể đăng nhập, đọc kho hoặc ghi nhập/xuất. Thông báo sẽ yêu cầu kết nối lại. Bản service worker mới có thể cần đóng hết cửa sổ ứng dụng rồi mở lại để kích hoạt.

Kiểm tra trình duyệt bằng `npm run test:pwa` sau build (cần Chromium của Playwright; có thể đặt `CHROMIUM_PATH` tới Chromium sẵn có). Bài kiểm tra dùng database tạm, xác minh manifest/icon, service worker, hướng dẫn cài đặt, API không bị cache, trạng thái offline và màn hình mobile.

Ứng dụng vẫn dùng SQLite cho đến khi có cấu hình dự án Firebase và hoàn tất chuyển đổi. Xem [hướng dẫn chuẩn bị Firebase Spark](docs/FIREBASE-SPARK.md). Chưa có chức năng backup tự động hoặc triển khai Firebase ở bản này.

## Hai vai trò Admin / Nhân viên

Chỉ Admin được thêm, sửa, khóa/mở khóa nhân viên và danh mục (dòng xe, dòng phụ kiện). Mục **Nhân viên** cho phép quản lý họ tên, tên đăng nhập, đặt lại mật khẩu và trạng thái tài khoản; API không trả mật khẩu hoặc hash. Khóa nhân viên thu hồi phiên hiện có và chặn đăng nhập mới. Đặt lại mật khẩu nhân viên cũng thu hồi phiên. Không có thao tác thay đổi hoặc khóa tài khoản Admin trong màn hình này.

Nhân viên vẫn quản lý sản phẩm và nhập/xuất kho, xem danh mục, tồn kho và lịch sử. Nhân viên không truy cập được danh sách tài khoản hoặc API quản lý danh mục. Khóa danh mục ngăn gán danh mục đó cho sản phẩm mới hoặc đổi một sản phẩm sang danh mục đó; sản phẩm đã thuộc danh mục vẫn giữ liên kết và giao dịch bình thường. Đổi tên danh mục tự cập nhật liên kết sản phẩm trong cùng transaction.

Khi khởi động bản mới, migration tự thêm cột trạng thái nếu chưa có, chuyển vai trò `it` và `warehouse` cũ thành `staff` (Nhân viên), giữ ID, mật khẩu và dữ liệu. Tài khoản có tên đăng nhập `it` cũ vẫn tồn tại nhưng chỉ còn quyền Nhân viên; Admin có thể sửa tên đăng nhập hoặc khóa tài khoản này. Trước khi cập nhật máy thật, dừng ứng dụng và sao lưu thư mục `data/`; không xóa database để cập nhật vai trò.

## Khắc phục trang trắng khi chạy dev

Bản sửa cho phép Vite phục vụ đúng các module giao diện công khai ở `/node_modules/.vite/deps/*.js` mà vẫn chặn file riêng tư, file metadata và đường dẫn database. Kênh cập nhật giao diện Vite dùng chung HTTP server với Express. Nếu đã gặp 404 với `react.js`, `react-dom_client.js` hoặc `react_jsx-dev-runtime.js`, cập nhật mã nguồn rồi dừng và khởi động lại `npm run dev`, sau đó tải lại trang.

Có thể chạy `npm run test:dev` để kiểm tra giao diện dev bằng Chromium (hỗ trợ `CHROMIUM_PATH`); kiểm thử dùng thư mục dữ liệu tạm, không dùng database kho. Biến `DATA_DIR` cho phép chỉ định thư mục lưu SQLite, mặc định vẫn là `data/`; không đổi biến này trên máy thật nếu chưa chuyển dữ liệu sang thư mục tương ứng.

## Đăng nhập bằng email và tạo tài khoản chủ kho trên máy chạy ứng dụng

Admin có thể gán email cho nhân viên trong màn hình Nhân viên. Email là duy nhất (không phân biệt hoa/thường), dùng được thay cho tên đăng nhập; tên đăng nhập cũ vẫn hoạt động. Email chưa được xác minh và chưa có chức năng gửi thư tự động. Email không được dùng để tự cấp quyền.

Để tạo một tài khoản Admin mới trên chính máy chứa database, chạy bản mới một lần để cập nhật schema, dừng máy chủ rồi mở Terminal/PowerShell trong thư mục dự án:

```sh
npm run account:create -- --email owner@example.com --name "Chủ kho" --role admin
```

Nhập mật khẩu 12–128 ký tự và xác nhận khi được hỏi. Mật khẩu được che bằng dấu `*`, chỉ lưu bcrypt, không ghi vào mã nguồn hoặc in ra log. Lệnh không ghi đè tài khoản có sẵn và không gửi email. Có thể dùng `--role staff` để tạo Nhân viên. Lệnh áp dụng cho database trên máy đang chạy lệnh (`DATA_DIR` hoặc thư mục `data/` mặc định); tạo trên một máy không tự tạo tài khoản trên máy khác. Khởi động lại ứng dụng rồi đăng nhập bằng email và mật khẩu vừa nhập.

Việc tải ZIP từ GitHub không mang theo tài khoản hoặc database. Không đặt email/mật khẩu của chủ kho cố định trong source. Muốn dùng thư xác minh/đặt mật khẩu cần tích hợp Firebase Authentication hoặc dịch vụ gửi thư riêng; hiện chưa cấu hình hoặc gửi bất kỳ email nào.
