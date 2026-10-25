# Chuẩn bị Firebase Spark cho một kho dùng chung

## Trạng thái

Bản hiện tại dùng Express + SQLite. Đã có PWA để cài từ một máy chủ HTTPS, nhưng **chưa kết nối Firebase**. Chỉ đưa thư mục `dist` lên Firebase Hosting lúc này sẽ không có API đăng nhập/quản lý kho. Chưa có triển khai, chưa có chuyển dữ liệu và chưa có sao lưu tự động.

Mô hình cần triển khai tiếp: một bộ dữ liệu kho dùng chung, tài khoản nhân viên riêng và quyền Admin/Nhân viên kho/Nhân viên gia công/Nhân viên đóng gói. Firebase Hosting phục vụ React, Authentication quản lý đăng nhập email/mật khẩu và Firestore lưu dữ liệu; không dùng Cloud Functions hoặc dịch vụ cần Blaze. Không cung cấp chức năng tự đăng ký quyền truy cập kho. Quyền phải được xác minh trong Security Rules, không tin vai trò do trình duyệt gửi lên. Việc tạo tài khoản và gán vai trò ban đầu thực hiện qua Firebase Console.

## Tạo dự án miễn phí

1. Mở https://console.firebase.google.com/ bằng tài khoản Google của chủ kho, tạo một dự án, ví dụ `ebg-kho`. Giữ gói **Spark**, không liên kết tài khoản thanh toán; có thể tắt Google Analytics nếu không cần.
2. Vào **Project settings → General → Your apps**, chọn biểu tượng Web `</>`, đặt tên `EBG Kho`, đăng ký ứng dụng. Sao chép đối tượng `firebaseConfig`: `apiKey`, `authDomain`, `projectId`, `storageBucket` (nếu có), `messagingSenderId` (nếu có), `appId`. Đây là cấu hình công khai, không phải khóa Service Account.
3. Bật **Authentication → Sign-in method → Email/Password**. Sau này cần thêm tên miền triển khai vào danh sách Authorized domains nếu chưa có.
4. Vào **Firestore Database → Create database**, dùng database mặc định, chọn **Production mode** để giữ quyền bị chặn cho đến khi có Security Rules đã kiểm thử. Chọn vị trí gần người dùng; vị trí database không thể đổi sau khi tạo. Không bật Test mode hoặc quy tắc cho phép mọi người đọc/ghi.
5. Gửi Project ID và cấu hình Web App để tích hợp. Không gửi mật khẩu Google, mật khẩu nhân viên, private key hoặc JSON Service Account trong chat.

Không bật Hosting/deploy bản hiện tại và coi đó là hệ thống Firebase hoàn chỉnh. Bước tiếp theo là chuyển API sang Firestore, viết và kiểm thử rules/transaction, quản lý vai trò, kiểm tra cạnh tranh nhập/xuất rồi mới triển khai bằng tài khoản chủ dự án.

## Dữ liệu và chi phí

Không đưa `data/ebg.db` lên Hosting. Trước khi chuyển dữ liệu cũ, dừng ghi, sao lưu SQLite và kiểm tra số lượng sản phẩm, tồn từng nhóm, phiếu và lịch sử sau nhập. Mật khẩu bcrypt trong SQLite không tự trở thành tài khoản Firebase; cần quy trình cấp tài khoản/đặt mật khẩu riêng.

Spark miễn phí trong hạn mức, không phải không giới hạn. Theo dõi Usage ở Console và không nâng lên Blaze nếu không muốn bật thanh toán. Cần kết nối Internet để xác nhận nhập/xuất; không ghi hàng chờ offline khi chưa có thiết kế đồng bộ bảo đảm tồn kho. PWA không tự tạo backup; hiện chưa có lịch sao lưu tự động.
