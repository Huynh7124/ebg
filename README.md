# EBG Garage — Quản lý kho phụ kiện xe điện

Ứng dụng tiếng Việt với React, Express và SQLite. Yêu cầu Node.js 24 trở lên (sử dụng `node:sqlite`).

## Khởi động

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Máy chủ dùng cổng `3000`, có thể thay bằng biến `PORT`. `npm run build` tạo bản production; `npm start` phục vụ bản build. `npm test` kiểm tra đăng nhập, phân quyền, chống CSRF, nhập xuất tồn, phiếu chờ, sản phẩm khóa và nhật ký trên cơ sở dữ liệu tạm biệt lập.

Mặc định mở ứng dụng sẽ thấy danh sách tài khoản: bấm tên để đăng nhập, không nhập mật khẩu. Có tìm kiếm theo tên nhân viên/tên đăng nhập, hỗ trợ không dấu. Khi khởi động, hệ thống bổ sung những vai trò chưa có tài khoản: `admin`, `kho`, `giacong`, `donggoi`. Tài khoản và mật khẩu đã có được giữ nguyên; vai trò đã có tài khoản bị khóa không được tự tạo lại. Tài khoản bị khóa không xuất hiện trong danh sách và không đăng nhập được. Admin hoặc kho thêm nhân viên tại **Nhân viên** mà không cần đặt mật khẩu; quyền thao tác vẫn theo vai trò ở máy chủ.

Nếu muốn dùng lại màn hình email/tên đăng nhập và mật khẩu, đặt biến môi trường `REQUIRE_PASSWORD=1` trên tiến trình máy chủ rồi khởi động lại. Chế độ này ẩn danh sách tài khoản công khai và yêu cầu mật khẩu cả khi đăng nhập lẫn tạo nhân viên. `INITIAL_ADMIN_PASSWORD` chỉ chọn mật khẩu cho tài khoản mẫu khi khởi tạo database mới; không thay đổi mật khẩu tài khoản đã tồn tại. Các tài khoản tạo bằng chế độ bấm tên có mật khẩu ngẫu nhiên được băm; có thể đặt lại bằng công cụ `account:reset` trước khi chuyển sang đăng nhập mật khẩu.

Kiểm tra luồng bấm tên và bốn vai trò trên trình duyệt sau build: `npm run test:account-login`.

Nút **QR** cạnh ô tìm kiếm trên header mở máy quét mã cho cả bốn vai trò. Camera nhận nhãn `EBG:<id>` hoặc mã sản phẩm, rồi mở thông tin hàng; không tự ghi nhập/xuất hoặc đổi tồn kho. Có ô **Mã QR / mã hàng** để dùng máy quét cầm tay (gửi Enter) hoặc nhập trực tiếp. Camera cần trình duyệt hỗ trợ `BarcodeDetector`, quyền camera và HTTPS/localhost; nếu không hỗ trợ hoặc bị từ chối quyền, vẫn tra bằng mã được. Đóng cửa sổ hoặc quét thành công sẽ tắt camera. Màn hình **Tra / quét mã** dùng cùng máy quét và vẫn xem/in nhãn. Kiểm tra sau build bằng `npm run test:qr` (camera giả lập, không thay cho kiểm tra thiết bị thật).

## Chức năng

- Tổng quan, cảnh báo sản phẩm chạm mức tồn tối thiểu, thông báo và lịch sử thao tác.
- Danh mục phụ kiện và dòng xe do Admin tạo; máy chủ kiểm tra quyền.
- Thêm/sửa/khóa sản phẩm; chỉ chọn danh mục có sẵn; không có giá tiền.
- Tìm tên, mã, màu; lọc danh mục và dòng xe.
- Nhập hàng chỉ có Nhập kho / Nhập lỗi, không yêu cầu xem hay in phiếu nhập. Phiếu xuất chỉ có Xuất kho / Xuất kho đi Anode / Xuất kho đi sửa. Hàng gửi đi được trừ tồn kho chính ngay và theo dõi chờ nhận về. Ngăn xuất quá tồn và nhận về cùng một phiếu hai lần.
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

Giao diện dùng tên “Anode”; tên cột SQLite `anote` cũ được giữ để tương thích dữ liệu. Xuất phiếu hiện ở định dạng CSV; chưa có mẫu PDF/in theo biểu mẫu doanh nghiệp. Logo giao diện và biểu tượng ứng dụng dùng nhận diện chữ đen, tia sét đỏ trên nền trắng; tệp gốc được giữ để đối chiếu.

## Cập nhật bảo mật máy chủ phát triển

Bản sửa chặn truy cập trực tiếp `data/`, cơ sở dữ liệu SQLite, mã máy chủ, `.env`, thư mục test và các đường dẫn `/@fs` tới file riêng tư ở cả chế độ phát triển và production. API đặt `Cache-Control: no-store`; `/api/data` yêu cầu đăng nhập. JSON của dữ liệu mà tài khoản được phép xem vẫn xuất hiện trong tab Network, đây là cơ chế hoạt động của ứng dụng web.

Sau khi cập nhật mã nguồn, dừng tiến trình cũ rồi chạy lại. Trên Windows cũng có thể dùng `npm run build` rồi `npm start` để chạy production. Chỉ phục vụ thư mục `dist` cho tài nguyên tĩnh; không cấu hình hosting/IIS/Nginx phục vụ toàn bộ thư mục dự án. Giữ nguyên `data/` khi cập nhật. Nếu bản cũ từng truy cập được từ Internet và có khả năng file riêng tư đã bị tải, cần đánh giá phạm vi lộ dữ liệu, đổi mật khẩu các tài khoản và thay `SESSION_SECRET`, sau đó khởi động lại máy chủ.

## Cài ứng dụng lên điện thoại / máy tính (PWA)

`npm run build` tạo manifest, icon và service worker có phiên bản theo nội dung build. Chạy `npm start` để kiểm tra bản production. Trên một máy chủ có HTTPS, Chrome/Edge hỗ trợ cài ứng dụng; trên iPhone/iPad dùng Safari → Chia sẻ → Thêm vào Màn hình chính. Nút **Cài ứng dụng EBG** sẽ mở lời mời cài hoặc hướng dẫn theo trình duyệt. Localhost được dùng cho kiểm thử, không phải đường dẫn chia sẻ cho điện thoại khác.

Chỉ cache file giao diện công khai, không cache API, thông tin đăng nhập hay dữ liệu kho. Khi mất mạng có thể mở khung ứng dụng và hướng dẫn, nhưng không thể đăng nhập, đọc kho hoặc ghi nhập/xuất. Thông báo sẽ yêu cầu kết nối lại. Bản service worker mới có thể cần đóng hết cửa sổ ứng dụng rồi mở lại để kích hoạt.

Kiểm tra trình duyệt bằng `npm run test:pwa` sau build (cần Chromium của Playwright; có thể đặt `CHROMIUM_PATH` tới Chromium sẵn có). Bài kiểm tra dùng database tạm, xác minh manifest/icon, service worker, hướng dẫn cài đặt, API không bị cache, trạng thái offline và màn hình mobile.

Ứng dụng vẫn dùng SQLite cho đến khi có cấu hình dự án Firebase và hoàn tất chuyển đổi. Xem [hướng dẫn chuẩn bị Firebase Spark](docs/FIREBASE-SPARK.md). Chưa có chức năng backup tự động hoặc triển khai Firebase ở bản này.

## Bốn vai trò Admin / Kho / Gia công / Đóng gói

Mỗi vai trò có màn hình chính và menu riêng sau khi bấm tên đăng nhập:

| Vai trò | Màn hình chính | Nội dung ưu tiên |
| --- | --- | --- |
| Admin | Quản trị hệ thống | Đội ngũ theo vai trò, phân quyền, sao lưu và hoạt động toàn đội |
| Nhân viên kho | Điều hành kho | Yêu cầu chờ xác nhận, hàng chờ xuất, kiểm nhận và tồn cần bổ sung |
| Nhân viên gia công | Gia công của tôi | Việc mới được giao, việc đang làm, kết quả chờ kho và yêu cầu đã gửi |
| Nhân viên đóng gói | Đóng gói của tôi | Lên đơn đầu ngày, hàng chờ nhận và danh sách đóng gói theo ngày |

Gia công và đóng gói chỉ có menu công việc riêng và tra cứu hàng/vật tư; không hiện menu quản trị nhân viên, nhập/xuất kho, danh mục, lịch sử toàn kho hoặc báo cáo chung. Phiếu xuất liên quan vẫn được xem/in từ chi tiết công việc. Khi thay đổi vai trò trong phiên đang mở, lần tải lại dữ liệu tiếp theo sẽ chuyển sang màn hình và menu tương ứng, đóng nội dung của vai trò trước.

- **Admin:** toàn quyền, tạo/sửa/khóa tài khoản và phân vai trò cho mọi người. Hệ thống luôn giữ ít nhất một Admin hoạt động.
- **Nhân viên kho:** quản lý sản phẩm, danh mục, định mức, nhập/xuất/kiểm hàng, duyệt yêu cầu, tạo lệnh gia công/sửa, mua vật tư và quản lý tài khoản nhân viên. Kho được tạo tài khoản, sửa/khóa/đặt lại mật khẩu và phân các vai trò kho, gia công, đóng gói cho nhân viên; chỉ Admin cấp quyền hoặc quản lý tài khoản Admin.
- **Nhân viên gia công:** nhận công việc theo đơn hoặc làm bổ sung tồn do kho giao, báo sẵn sàng bàn giao, xin cấp bổ sung cho việc mình nhận và gửi yêu cầu đi đơn. Kho duyệt và xuất thực tế rồi nhân viên xác nhận nhận. Nhân viên gia công không tự thay đổi tồn hoặc nhận kiểm hàng thay kho.

- **Nhân viên đóng gói:** mỗi sáng lên danh sách hàng theo ngày và mã đơn; chờ kho xác nhận, xuất thực tế rồi xác nhận nhận hàng. Chỉ xem yêu cầu của mình, không tự xuất kho hoặc phân quyền.

Luồng làm hàng: Kho tạo lệnh → kho xuất → nhân viên nhận → báo sẵn sàng → kho kiểm nhận đạt/lỗi. Báo hoàn thành không tự tăng tồn. Luồng đi đơn: Nhân viên gửi yêu cầu có mã đơn → kho xác nhận (chưa trừ tồn) → kho xuất thực tế → nhân viên nhận hàng. Đơn đóng gói có mã DG và ngày đóng gói để kho theo dõi đầu ngày.

Khi nâng cấp, giữ dữ liệu và mật khẩu. Tài khoản `warehouse` giữ vai trò kho; `it` chuyển thành gia công. `staff` của bản có quyền kho riêng được chuyển dựa vào quyền kho đã có; tài khoản không có quyền kho chuyển thành gia công. Tài khoản `staff` từ bản cũ chưa có bảng quyền giữ nghiệp vụ kho đã được dùng trước đây. Các cờ quyền mua/kho cũ không thể vượt quyền của vai trò mới. Phân quyền có hiệu lực ở yêu cầu API tiếp theo của phiên đang đăng nhập.

## Khắc phục trang trắng khi chạy dev

Bản sửa cho phép Vite phục vụ đúng các module giao diện công khai ở `/node_modules/.vite/deps/*.js` mà vẫn chặn file riêng tư, file metadata và đường dẫn database. Kênh cập nhật giao diện Vite dùng chung HTTP server với Express. Nếu đã gặp 404 với `react.js`, `react-dom_client.js` hoặc `react_jsx-dev-runtime.js`, cập nhật mã nguồn rồi dừng và khởi động lại `npm run dev`, sau đó tải lại trang.

Có thể chạy `npm run test:dev` để kiểm tra giao diện dev bằng Chromium (hỗ trợ `CHROMIUM_PATH`); kiểm thử dùng thư mục dữ liệu tạm, không dùng database kho. Biến `DATA_DIR` cho phép chỉ định thư mục lưu SQLite, mặc định vẫn là `data/`; không đổi biến này trên máy thật nếu chưa chuyển dữ liệu sang thư mục tương ứng.

## Đăng nhập bằng email và tạo tài khoản chủ kho trên máy chạy ứng dụng

Các hướng dẫn mật khẩu dưới đây áp dụng khi bật `REQUIRE_PASSWORD=1`. Chế độ mặc định chỉ cần bấm tài khoản trên màn hình đăng nhập.

Admin có thể gán email cho nhân viên trong màn hình Nhân viên. Email là duy nhất (không phân biệt hoa/thường), dùng được thay cho tên đăng nhập; tên đăng nhập cũ vẫn hoạt động. Email chưa được xác minh và chưa có chức năng gửi thư tự động. Email không được dùng để tự cấp quyền.

Để tạo một tài khoản Admin mới trên chính máy chứa database, chạy bản mới một lần để cập nhật schema, dừng máy chủ rồi mở Terminal/PowerShell trong thư mục dự án:

```sh
npm run account:create -- --email owner@example.com --name "Chủ kho" --role admin
```

Nhập mật khẩu 12–128 ký tự và xác nhận khi được hỏi. Mật khẩu được che bằng dấu `*`, chỉ lưu bcrypt, không ghi vào mã nguồn hoặc in ra log. Lệnh không ghi đè tài khoản có sẵn và không gửi email. Có thể dùng `--role processor` để tạo Nhân viên. Lệnh áp dụng cho database trên máy đang chạy lệnh (`DATA_DIR` hoặc thư mục `data/` mặc định); tạo trên một máy không tự tạo tài khoản trên máy khác. Khởi động lại ứng dụng rồi đăng nhập bằng email và mật khẩu vừa nhập.

Việc tải ZIP từ GitHub không mang theo tài khoản hoặc database. Không đặt email/mật khẩu của chủ kho cố định trong source. Muốn dùng thư xác minh/đặt mật khẩu cần tích hợp Firebase Authentication hoặc dịch vụ gửi thư riêng; hiện chưa cấu hình hoặc gửi bất kỳ email nào.

Để bổ sung đủ bốn vai trò trên máy đang chạy phần mềm, cập nhật mã nguồn rồi chạy trong thư mục dự án:

```sh
npm run accounts:setup
```

Lệnh dùng database tại `DATA_DIR/ebg.db` hoặc `data/ebg.db`, cần chạy ứng dụng bản mới ít nhất một lần trước đó. Mỗi vai trò chưa có tài khoản hoạt động được tạo với tên `admin`, `kho`, `giacong` hoặc `donggoi` và mật khẩu ngẫu nhiên riêng, hiện tại terminal sau khi tạo thành công. Lưu thông tin này để cấp cho nhân viên rồi đổi mật khẩu tại **Tài khoản & bảo mật**. Nếu tên đã được dùng, lệnh thêm hậu tố số. Vai trò đã có tài khoản hoạt động giữ nguyên tài khoản và mật khẩu; chạy lại không đặt lại mật khẩu, không mở khóa tài khoản cũ và không thay đổi tồn kho. Lệnh chỉ tạo tài khoản trên máy chạy lệnh, không đồng bộ qua GitHub.

## Logo và biểu tượng

Giao diện dùng logo `public/brand/ebg-black-red.png`: chữ EBG và EBIKE GARAGE màu đen, tia sét đỏ, nền trong suốt. Header, đăng nhập, phiếu xuất và biểu tượng PWA dùng cùng nhận diện trên nền trắng. Tệp logo gốc `Asset-4.png.webp` vẫn được giữ để đối chiếu.

Khi cần đóng gói lại favicon/icon: chạy `CHROMIUM_PATH=/path/to/chromium node scripts/build-brand-icons.mjs`. Công cụ contain-fit toàn bộ logo trên nền trắng, gồm phiên bản maskable với vùng an toàn. Icon đã được commit; chạy ứng dụng/build thông thường không cần Chromium.

## Nhập / xuất kho đơn giản

| Loại phiếu | Tác động tồn |
| --- | --- |
| Nhập kho | Cộng tồn kho chính |
| Nhập lỗi | Cộng số lượng lỗi riêng (`faulty`), không cộng kho chính |
| Xuất kho | Trừ tồn kho chính |
| Xuất kho đi Anode | Trừ kho chính ngay, cộng số lượng đang Anode, phiếu chờ |
| Xuất kho đi sửa | Trừ kho chính ngay, cộng số lượng đang sửa, phiếu chờ |

Form chọn một loại phiếu, thêm nhiều dòng sản phẩm và số lượng bằng nút Thêm sản phẩm, cùng một ghi chú chung. API dùng `operation` tương ứng `receive_stock`, `receive_faulty`, `issue_stock`, `send_anode`, `send_repair`. Không cho tạo loại nhập Anode hoặc xuất lỗi; không tin `bucket`/`status` do client gửi để thay đổi tác động tồn. Cả ba loại xuất trong phiên bản này đều lấy hàng từ kho chính.

Khi hàng gửi Anode/sửa thực sự trả lại, bấm **Nhận về kho** trên phiếu chờ. Thao tác giảm số đang gửi, cộng kho chính, hoàn tất phiếu gốc và tạo phiếu Nhập kho có ghi rõ số phiếu nguồn. Toàn bộ thao tác nằm trong cùng transaction; bấm lại bị từ chối, không cộng tồn hai lần. Hiện nhận về toàn bộ số lượng của phiếu, chưa hỗ trợ nhận về từng phần.

Khi nâng cấp, giữ nguyên `data/`. Migration thêm trường `faulty` cho sản phẩm và `operation` cho phiếu, không tính lại số dư cũ hoặc đổi nội dung phiếu cũ. Phiếu lịch sử chưa có `operation` hiển thị nhãn “phiếu cũ”, giữ nguyên cơ chế hoàn tất trước đây để không sai tồn. Không tự chuyển số dư nhóm “sửa/lỗi” cũ sang hàng lỗi vì không có đủ thông tin để phân loại chính xác.

## Một phiếu nhiều sản phẩm

Form nhập/xuất có nút **Thêm sản phẩm**, số lượng riêng từng dòng, nút xóa dòng và tổng số lượng. Mỗi phiếu có một loại nhập/xuất chung, một ghi chú chung, từ 1 đến 100 sản phẩm không trùng nhau. Một lần lưu tạo một header trong `receipts`, các dòng trong `movements` cùng `receiptId` và một bản ghi lịch sử. Mã phiếu dạng `PN-000001` / `PX-000002`.

API `POST /api/movements` nhận `{ operation, items: [{ productId, quantity }], note }`; định dạng một dòng cũ vẫn được hỗ trợ để tương thích. API kiểm tra tất cả dòng bên trong transaction trước khi ghi. Nếu có sản phẩm khóa, thiếu tồn, số lượng sai hoặc trùng sản phẩm, không dòng nào được cập nhật, không tạo phiếu hoặc lịch sử dở dang.

Danh sách nhập/xuất hiển thị mỗi phiếu một dòng, đếm số phiếu thay vì số dòng sản phẩm. **Xem phiếu** mở chi tiết tất cả sản phẩm, tổng số lượng, người lập, ngày và ghi chú. Có thể **In phiếu** (hoặc lưu PDF trong hộp thoại in) và **Xuất CSV phiếu** riêng. CSV theo ngày/tuần/tháng/năm vẫn có từng dòng sản phẩm, dùng chung mã phiếu để đối chiếu.

Hàng đi Anode/sửa: nút **Nhận về kho** nhận về toàn bộ sản phẩm trên phiếu trong một transaction, tạo một phiếu nhập nhiều dòng liên kết với phiếu gốc. Nếu một dòng không đủ điều kiện, chưa nhận về dòng nào. Chưa hỗ trợ nhận về từng phần. Gọi URL hoàn tất theo một dòng của phiếu cũng xử lý cả phiếu, không tách lẻ hoặc cộng tồn hai lần.

Migration thêm bảng header và cột `receiptId`, không gộp hoặc sửa các phiếu lịch sử. Phiếu cũ chưa có header hiển thị mã `CŨ-...` và tiếp tục xem/in/xuất được dưới dạng phiếu một sản phẩm. Giữ nguyên thư mục `data/` khi cập nhật và sao lưu trước khi nâng cấp.

## Tự mở phiếu sau mỗi giao dịch

Nhập kho là form nhập nhiều sản phẩm, lưu xong cập nhật tồn và trở về danh sách sản phẩm; không hiển thị danh sách, chi tiết hoặc nút in phiếu nhập. Nhận hàng về từ Anode/sửa cũng không mở phiếu nhập. Dữ liệu giao dịch và liên kết nhập cũ vẫn được giữ để đối chiếu, không xóa database. Xuất kho vẫn lập phiếu và tự mở để xem/chỉnh thông tin trước khi in. Trong lịch sử phiếu xuất, nút **In** cạnh **Xem phiếu** mở đúng phiếu và gọi cửa sổ in trực tiếp, dùng thông tin bản in đã lưu. Nếu lưu thất bại, form giữ nguyên các dòng để sửa và thử lại.

Chữ nội dung, mô tả, tiêu đề bảng, trạng thái và số liệu đã được tăng độ đậm và tương phản; giữ chữ trắng trên nền đỏ của công ty.

## Tìm sản phẩm / phiếu theo dòng xe, màu và Đơn/Đôi

Form lập phiếu nhập/xuất và danh sách phiếu có bộ lọc tên/mã sản phẩm, dòng xe, màu sắc và Đơn/Đôi. Các điều kiện kết hợp trên cùng một sản phẩm. Khi đổi bộ lọc trong form, sản phẩm đã chọn vẫn được giữ trên dòng, không bị xóa hoặc mất số lượng. Có nút Xóa bộ lọc và số sản phẩm phù hợp để chọn nhanh.

Thêm/sửa sản phẩm có trường `unitType`: Chưa phân loại (`''`), Đơn (`single`), Đôi (`double`). Migration để trống cho sản phẩm cũ, không tự đoán phân loại; hãy cập nhật trường này nếu cần lọc Đơn/Đôi. Phân loại không tự nhân đôi số lượng nhập/xuất. API xác thực giá trị và giữ phân loại hiện có khi client cũ không gửi trường này.

Danh sách phiếu giữ nguyên toàn bộ phiếu khi có ít nhất một dòng sản phẩm khớp đủ điều kiện. Nút Xuất phiếu CSV ở danh sách kết hợp bộ lọc hiện tại với kỳ ngày/tuần/tháng/năm; xuất tất cả dòng của các phiếu khớp, không tách hoặc cắt mất các sản phẩm còn lại trong phiếu. Chi tiết phiếu và CSV có dòng xe, màu và Đơn/Đôi. Tìm kiếm dùng thuộc tính hiện tại của sản phẩm.

## Giao diện đăng nhập tối giản

Màn hình chưa đăng nhập có một hộp thoại ở giữa với logo đen/đỏ trên nền trắng. Mặc định hiển thị danh sách tên nhân viên, tên đăng nhập và vai trò; bấm tài khoản để vào ngay. Khi bật `REQUIRE_PASSWORD=1`, hộp thoại dùng form Gmail/email và mật khẩu. Nút cài ứng dụng xuất hiện sau đăng nhập; thông báo mất mạng vẫn hoạt động.

Đăng nhập hiện vẫn xác thực tài khoản trong SQLite, chưa phải OAuth/Google Sign-In. Nhập mật khẩu của tài khoản kho được Admin cấp, không nhập mật khẩu hộp thư Google. Tên đăng nhập cũ vẫn được backend chấp nhận để không khóa người dùng hiện có. Tích hợp popup Google cần cấu hình dự án Firebase/OAuth và kiểm tra quyền tài khoản trước khi cho truy cập kho.

## Mẫu in phiếu xuất theo Excel nội bộ

Phiếu xuất dùng bố cục của sheet **PXK (MẪU)** trong file `Xuất kho nội bộ.xlsx` do chủ kho cung cấp: logo và thông tin công ty/MST/địa chỉ/liên hệ, tiêu đề Phiếu Xuất Kho, số/ngày phiếu, kho, phòng ban giao–nhận, lý do; bảng **No – Nhóm – Tên hàng – ĐVT – SL – Ghi chú**; nội dung xác nhận và hai ô ký Người lập phiếu / Người nhận hàng. Font K2D được phục vụ cục bộ. Bản in A4 dọc, tối thiểu 5 dòng như mẫu; nhiều sản phẩm sẽ tiếp tục sang trang sau, không cắt bớt dòng. Giao diện hiện chỉ sử dụng mẫu in cho phiếu xuất.

Mở phiếu xuất → **Chỉnh thông tin trước khi in** để sửa thông tin công ty, tiêu đề, số/ngày trên bản in, kho, bên giao/nhận, lý do, người ký, nội dung xác nhận và tên/nhóm/ĐVT/ghi chú hiển thị từng dòng. Có thể lưu rồi mở lại. Bấm **In phiếu** cũng tự lưu các thay đổi hợp lệ trước khi mở hộp thoại in; dùng Lưu thành PDF của trình duyệt nếu cần. Mã hệ thống luôn in cuối phiếu để đối chiếu kể cả khi đổi số phiếu hiển thị.

Số lượng, sản phẩm gốc và tác động tồn kho không thay đổi bởi chỉnh bản in. Không cho thêm/xóa dòng hoặc đổi số lượng qua API mẫu in; cần nghiệp vụ điều chỉnh kho riêng nếu giao dịch sai số lượng. CSV vẫn xuất dữ liệu giao dịch gốc, không dùng tên/ghi chú ghi đè của mẫu in.

Thông tin in lưu dưới dạng `printData` trên header `receipts`, hoặc dòng `movements` cho phiếu cũ, có nhật ký ai chỉnh. Dùng API `POST /api/receipts/:id/print` hoặc `/api/movements/:id/print`, yêu cầu đăng nhập và CSRF như các thao tác kho khác. Chỉ lưu các trường bản in đã kiểm tra độ dài, ngày, đúng ID dòng; không cập nhật tồn. Migration thêm cột nếu thiếu, giữ nguyên `data/`. File Excel đính kèm và các dữ liệu lịch sử trong các sheet khác không được đưa lên repository.

### Tài khoản và khôi phục mật khẩu

- Tài khoản & bảo mật: đổi họ tên hiển thị của chính mình hoặc đổi mật khẩu bằng mật khẩu hiện tại. Admin vẫn sửa tên nhân viên trong mục Nhân viên. Các thao tác cũ giữ tên đã ghi trong lịch sử.
- Nút con mắt hiện/ẩn mật khẩu đang nhập. Không thể xem lại mật khẩu đã lưu vì database chỉ lưu bản băm.
- Quên mật khẩu ở trang đăng nhập: nhân viên nhập email hoặc tên đăng nhập để gửi yêu cầu. Admin hoặc nhân viên kho xem yêu cầu ở mục Nhân viên, chọn đặt lại và lưu mật khẩu mới (12–128 ký tự), sau đó cung cấp trực tiếp cho nhân viên. Các phiên đăng nhập cũ bị thu hồi. Không gửi email tự động; chưa cấu hình SMTP.
- Nếu quên mật khẩu Admin, chủ máy chủ mở terminal trong thư mục ứng dụng và chạy:

```bash
npm run account:reset -- --username admin
```

Có thể thay `admin` bằng email hoặc tên đăng nhập. Nhập mật khẩu mới và xác nhận trong terminal; không đặt mật khẩu trong tham số lệnh. Lệnh dùng `DATA_DIR` như server và giữ dữ liệu kho, ghi lịch sử, kết thúc phiên cũ; không mở khóa tài khoản đang bị khóa.

Phiếu xuất dùng bố cục A4, logo đen khi in, chữ 13pt; thông tin bản in có thể chỉnh và lưu riêng từng phiếu mà không thay đổi số lượng kho. Nhập hàng không còn yêu cầu xem hay in phiếu.


### Theo dõi Anode

Trong **Sản phẩm → Hàng sửa & Anode**, phần **Theo dõi phiếu Anode** hiển thị riêng phiếu Xuất kho đi Anode, đơn vị Nam Thái/Bình Phát, sản phẩm, số lượng và trạng thái. Có bộ lọc **Chờ hàng về / Đã về**, xem phiếu và in trực tiếp. Tích **Đã về** để nhận toàn bộ hàng trên phiếu về kho: giảm số đang Anode, cộng tồn kho chính, lưu người thao tác và chuyển phiếu hoàn tất. Không nhận về từng phần. Phiếu đã về giữ ô tích và không được tích lại; dữ liệu được lưu trên máy chủ, không chỉ trên trình duyệt.

Bộ lọc trong danh sách Sản phẩm dùng cùng thành phần và cách lọc của form phiếu xuất: tên/mã không phân biệt dấu, dòng xe, màu sắc và Đơn/Đôi; vẫn có bộ lọc danh mục riêng. Tab Hàng sửa & Anode hiển thị danh sách phiếu Anode và phiếu gửi sửa để xem, in và xử lý nhận hàng về. Không có mục Anode riêng trên thanh điều hướng.

## Điều phối kho, sản xuất và bàn giao

Màn hình **Điều phối kho** bổ sung yêu cầu cấp hàng hai chiều, lệnh sản xuất/lắp ráp theo định mức phiên bản, Anode đổi mã màu, Carbon theo số vật tư thực dùng, sửa hàng lỗi và bàn giao hàng sẵn. Có người nhận, nơi nhận, hạn trả, đổi hạn/đổi người có lý do, kết quả theo ngày và nhận nhiều đợt với số đạt/lỗi riêng.

Tạo yêu cầu chưa trừ tồn; kho xuất thực tế mới trừ. Định mức đã chụp trong lệnh không đổi khi cập nhật phiên bản mới. Các lỗi hoặc vật tư còn thừa cần đối chiếu trước khi đóng. Không tự nhập ngược vật tư qua ngày và không tự trừ linh kiện lần nữa khi xuất thành phẩm.

Dữ liệu cũ được giữ. Nhân viên mới mặc định là gia công. Admin hoặc kho phân vai trò nhân viên tại **Dữ liệu & quyền** hoặc **Nhân viên**; chỉ Admin cấp vai trò Admin. Có nạp CSV xem trước/chặn ghi đè số dư, hồ sơ nhà cung cấp/đề nghị mua, nhãn QR theo mã hàng và sao lưu SQLite nhất quán. Quét camera phụ thuộc hỗ trợ trình duyệt; có tra mã từ đầu đọc hoặc bàn phím.

Hướng dẫn vận hành, đơn vị, nhập dữ liệu và khôi phục: [docs/WAREHOUSE-V2.md](docs/WAREHOUSE-V2.md). Kiểm tra giao diện điều phối sau build bằng `CHROMIUM_PATH=/usr/bin/chromium npm run test:operations`.
