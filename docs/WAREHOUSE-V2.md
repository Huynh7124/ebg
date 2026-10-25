# EBG — Điều phối kho, sản xuất và bàn giao

Bản này triển khai các luồng từ yêu cầu nghiệp vụ ghi âm, giữ dữ liệu và phiếu cũ. Không nạp số lượng, mã hàng hoặc tên người trong ví dụ ghi âm thành dữ liệu vận hành.

## Khởi động và kiểm tra

Yêu cầu Node.js 24+. Trong thư mục dự án:

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Production: `npm run build` rồi `npm start`. Truy cập ứng dụng theo cách triển khai hiện có. Máy chủ tự bổ sung bảng/cột; không xóa database để nâng cấp. Sao lưu trước khi triển khai bản mới lên kho đang vận hành.

```sh
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:operations
CHROMIUM_PATH=/usr/bin/chromium npm run test:pwa
CHROMIUM_PATH=/usr/bin/chromium npm run test:dev
```

Kiểm thử dùng database tạm; không sử dụng kho thật. `test:operations` kiểm tra giao diện thực: tạo định mức, lập yêu cầu, kho xuất, nhận việc, kiểm nhận 8 đạt/2 lỗi, đóng đối chiếu, tra QR, xem trước/nạp CSV và quyền nhân viên.

## Bắt đầu với dữ liệu thật

Mặc định đăng nhập bằng cách bấm tên trong danh sách tài khoản, không cần mật khẩu. Khi khởi động, ứng dụng bổ sung các vai trò chưa có tài khoản, giữ nguyên nhân viên và mật khẩu cũ, không tạo thay tài khoản bị khóa. Admin/kho thêm nhân viên mới không cần đặt mật khẩu. Để dùng lại xác thực mật khẩu, đặt `REQUIRE_PASSWORD=1` cho máy chủ rồi khởi động lại; khi đó việc đăng nhập và tạo nhân viên yêu cầu mật khẩu.

Màn hình mở đầu theo vai trò: **Quản trị hệ thống** cho Admin, **Điều hành kho** cho kho, **Gia công của tôi** cho gia công và **Đóng gói của tôi** cho đóng gói. Các chức năng điều phối trong hướng dẫn nằm trong màn hình này. Gia công dùng **Việc được giao / Yêu cầu của tôi**; đóng gói dùng **Đơn của tôi / Nhận hàng**. Hai vai trò này có thêm tra cứu sản phẩm, không hiện menu và báo cáo quản trị chung. Danh sách công việc vẫn được máy chủ giới hạn theo người được giao/người gửi; đổi vai trò sẽ cập nhật màn hình sau lần tải dữ liệu tiếp theo.

1. Admin phân một trong bốn vai trò tại **Điều phối kho → Dữ liệu & quyền** hoặc **Nhân viên**. Nhân viên kho có quyền quản lý hàng, danh mục, định mức, yêu cầu, mua vật tư và tài khoản nhân viên. Nhân viên kho được phân các vai trò warehouse/processor/packer cho nhân viên khác; không được cấp vai trò hoặc quản lý tài khoản Admin. Nhân viên gia công chỉ tạo yêu cầu đi đơn/cấp bổ sung, nhận việc được giao và báo sẵn sàng bàn giao. Bản sao SQLite gồm tài khoản/phiên vẫn chỉ Admin được tải; kho có xuất JSON nghiệp vụ.
2. Tạo danh mục phụ kiện/dòng xe ở màn hình cũ. Nguyên liệu dùng chung có thể để trống dòng xe.
3. Trong form sản phẩm, xác định loại hàng: nguyên liệu, cụm/bán thành phẩm, thành phẩm hoặc chưa phân loại; đơn vị cơ sở và vị trí tại kho.
4. Mỗi số lượng là số nguyên theo đơn vị cơ sở, ví dụ cái, bộ, tấm, mm hoặc g. Không đổi đơn vị của mã đã có tồn/lịch sử/định mức/yêu cầu. Muốn quản lý đơn vị khác phải đối chiếu và tạo mã thích hợp, không sửa tên đơn vị để tự chuyển số lượng.
5. Các số dư trước nâng cấp được giữ nguyên; không tự suy đoán loại hàng từ tên. Đơn vị mặc định của dữ liệu cũ là `cái`, cần rà lại trước khi mở rộng vận hành. Nếu đơn vị cũ chưa đúng, thực hiện đối chiếu dữ liệu có kế hoạch; không dùng nhập file để ghi đè số dư đang có.

## Yêu cầu và công việc

Vào **Điều phối kho → Tạo yêu cầu**. Chọn loại việc, mục đích theo đơn/bổ sung tồn, người nhận, nơi nhận, hạn trả và có nhận nhiều đợt hay không.

- **Sản xuất/lắp ráp:** nhập đầu ra cần làm. Vật tư được lấy từ phiên bản định mức đã được kho/Admin duyệt tại lúc lập yêu cầu.
- **Anode đổi màu:** chọn các mã màu đã liên kết mã thô. Hệ thống gom lượng mã thô cần cấp. Chỉ dùng quan hệ 1 chi tiết thô → 1 chi tiết màu, cùng đơn vị; không tự ghép chuỗi mã từ ví dụ 8+2.
- **Carbon:** chọn đầu vào (tấm/vật tư) và các mã chi tiết đầu ra riêng. Khi nhận phải ghi số vật tư thực dùng; không tự đặt định mức tấm/bộ. Nếu một tấm đã được ghi dùng ở đợt trước thì có thể nhận tiếp các chi tiết thuộc kế hoạch với lượng tấm dùng thêm bằng 0.
- **Sửa hàng lỗi:** lấy từ số `faulty`, không trừ kho hàng đạt; nhận lại có số đạt và số lỗi.
- **Đóng/giao hàng:** kho xuất, bên nhận xác nhận bàn giao. Đây là hoàn tất chặng bàn giao kho tới nơi nhận đã chọn, không phải tích hợp theo dõi vận đơn.
- **Cấp bổ sung:** từ chi tiết một lệnh đang mở, người nhận xin thêm vật tư. Kho xuất xong thì vật tư được gắn vào lệnh gốc. Không tự lấy hàng chỉ vì đã tạo yêu cầu.

Tạo yêu cầu không trừ tồn. Kho bấm **Kho duyệt & xuất thực tế** mới trừ tồn khả dụng và ghi lượng đang làm/Anode/sửa/chờ giao. Người nhận, nhân viên kho hoặc Admin xác nhận bàn giao rồi mới nhận kết quả. Admin thực hiện thay được lưu theo chính tài khoản Admin, không giả danh người khác.

Nhân viên gia công bấm **Báo sẵn sàng bàn giao**, chọn số thực sẵn sàng. Lệnh chuyển **Chờ kho nhận kết quả** nhưng tồn không đổi. Kho xác nhận số thực nhận và kiểm chất lượng. Nhập kết quả tạo cùng một lần kiểm nhận với số đạt và số lỗi. Ví dụ nhận 10 = 8 đạt + 2 lỗi: tăng 8 vào kho dùng được và 2 vào hàng lỗi, không biến 2 lỗi thành mất hàng. Mọi lần nhận có khóa chống ghi lặp. Vượt số còn chờ, thiếu vật tư hoặc bất kỳ dòng sai đều hủy toàn bộ lần ghi.

## Định mức và số có thể lắp

Admin hoặc nhân viên kho tạo định mức cho **một đơn vị đầu ra**. Mỗi lần lưu tạo phiên bản mới; lệnh cũ giữ nguyên thành phần/phiên bản cũ. Chặn tự chứa chính mình và vòng lặp gián tiếp giữa các cụm.

Cụm đã ghép có mã riêng và tồn riêng, là một thành phần có thể cấp. Không tự tách cụm thành linh kiện rời, không cộng linh kiện nằm trong cụm vào tồn rời.

Số “có thể lắp” chỉ tính theo linh kiện rời có sẵn, đúng mã, chưa giữ hàng. Các mẫu dùng chung nguyên liệu cạnh tranh cùng tồn; không cộng tổng số có thể lắp từng mẫu. Sản xuất đã trừ vật tư lúc cấp thì xuất thành phẩm không trừ lại vật tư.

## Dở dang, đổi người và deadline

Hàng chưa xong qua ngày vẫn giữ trên lệnh và người/nơi nhận; không tự nhập ngược về kho lúc hết ngày. Trả vật tư chưa dùng cần kho xác nhận lượng thực trả và lý do.

Nhận nhiều đợt phải được chọn rõ lúc tạo. Nếu không cho nhận nhiều đợt, hệ thống yêu cầu đủ toàn bộ số còn chờ. Khi có lỗi hoặc vật tư cần trả, lệnh chuyển **Cần xử lý kết quả**; kho đối chiếu, trả hết vật tư nếu còn và đóng bằng lý do. Số lỗi/thiếu vẫn giữ trong lịch sử. Sửa lỗi là yêu cầu riêng; không tự xóa số lỗi khi đóng lệnh.

Người được giao việc, nhân viên kho hoặc Admin đổi deadline có lý do; giữ hạn cũ/mới và tài khoản đổi. Việc theo đơn được xếp trước việc làm tồn, sau đó theo hạn. Dashboard có lọc đội, việc liên quan đến mình và quá hạn; kết quả nhận trong ngày được tách theo người phụ trách và từng mã/đơn vị.

Kho có thể **Bàn giao đổi người** ở lệnh đang mở với lý do. Số vật tư giữ nguyên; người mới phải xác nhận nhận lại. Các yêu cầu bổ sung chưa xuất được cập nhật theo người nhận mới. Không đổi người bằng cách sửa tên tài khoản.

## Dữ liệu CSV

Tải tiêu đề mẫu hoặc xuất danh mục trong **Dữ liệu & quyền**. UTF-8 CSV, dấu phẩy, đúng các tên cột:

```text
code,name,category,vehicle,color,unit,materialKind,min,stock,faulty
```

`materialKind`: `raw`, `semi`, `finished`, `unclassified`. Khi mở Excel, đặt cột mã là văn bản để giữ số 0 đầu. Xuất CSV có xử lý các giá trị có thể trở thành công thức; kiểm tra lại nếu mã thật bắt đầu bằng dấu công thức.

- **Tạo mới + số dư đầu kỳ:** chỉ mã chưa tồn tại; cho số đạt và lỗi đã kiểm đếm.
- **Cập nhật thông tin:** chỉ mã đã tồn tại; bỏ cột `stock` và `faulty`, không thay đơn vị. Không tạo phiếu để ghi đè số dư.
- Tối đa 1000 dòng/256 KB mỗi đợt từ giao diện. Xem trước lỗi theo dòng và xác nhận đúng file trước khi ghi. Một dòng sai làm hủy cả đợt; chặn nhập lại cùng file.
- Mã thô/mã màu liên kết ở form sản phẩm; không tự suy đoán liên kết từ chuỗi mã CSV.

Xuất JSON dùng đối chiếu danh mục, phiếu, lệnh và lịch sử. JSON này không chứa bảng mật khẩu hay phiên đăng nhập, không thay thế bản sao SQLite.

## Mua vật tư

Mọi người lập đề nghị theo mã/đơn vị/lý do. Admin hoặc nhân viên kho duyệt, chọn nhà cung cấp và xác nhận đã đặt. Người có quyền kho nhận thực tế theo đợt, tách đạt/lỗi; số chưa về vẫn chờ. Nhà cung cấp có thông tin liên hệ và ghi chú báo giá/điều kiện, không có thanh toán hoặc công nợ.

## Tra và quét mã

Nhãn QR đại diện **một mã hàng**, chứa `EBG:<id>` và in kèm mã/tên/đơn vị để đọc bằng mắt. Chưa đại diện thùng nhiều mã hay lô sản xuất. Có thể tra bằng mã hàng từ đầu đọc bàn phím.

Camera dùng BarcodeDetector của trình duyệt và cần HTTPS/quyền camera; nếu trình duyệt không hỗ trợ thì dùng đầu đọc hoặc nhập mã. Đóng màn hình/dừng quét sẽ tắt camera. Quét chỉ tra cứu, không tự tạo giao dịch tồn. Không cần dịch vụ QR bên ngoài.

## Sao lưu và khôi phục

Admin tải bản sao nhất quán từ SQLite backup API trong giao diện hoặc chạy:

```sh
DATA_DIR=/duong-dan/data npm run backup -- /noi-luu-rieng/ebg-2026-10-25.db
```

Lệnh không ghi đè bản sao đã có. Có thể gọi bằng lịch sao lưu của máy chủ; bản này không tự cài cron hoặc tự gửi dữ liệu ra dịch vụ bên ngoài. Bản sao SQLite có dữ liệu tài khoản/phiên; quản lý theo quyền Admin.

Khôi phục vào **thư mục mới**, giữ nguyên database đang dùng:

```sh
npm run backup:restore -- /noi-luu-rieng/ebg-2026-10-25.db /duong-dan/data-restored
```

Lệnh kiểm tra toàn vẹn và bảng EBG, từ chối đích đã có database. Sau khi khôi phục, dừng máy chủ cũ, đối chiếu dữ liệu rồi đặt `DATA_DIR` tới thư mục mới và khởi động. Bản kiểm thử kiểm tra thật database phục hồi, số lệnh và số dư; không chỉ kiểm tra file được tạo.

## Phiếu cũ và giới hạn rõ ràng

Phiếu cũ, đăng nhập, danh mục, in A4 và dữ liệu cũ được giữ. Các phiếu Anode/sửa cũ tiếp tục hoàn tất theo luồng cũ; không tự chuyển thành lệnh mới và không tạo lại cùng hàng đang gửi. Giao dịch nhiều bộ phận mới dùng Điều phối kho để có người nhận, định mức và kết quả kiểm nhận.

Bản này quản lý vị trí tại kho trên mã hàng và nơi giữ theo lệnh; chưa có sổ nhiều kho vật lý, đặt giữ hàng hoặc truy vết linh kiện theo từng lô. Chưa có tháo cụm tự động, tối ưu sơ đồ cắt, điểm thưởng/lương tự động, kế toán/công nợ, đồng bộ Google Sheet hai chiều hay ghi giao dịch offline. Các quy tắc đó cần dữ liệu/tiêu chuẩn được duyệt trước khi mở rộng.

## Chuyển đổi vai trò

Các vai trò lưu trong database là `admin`, `warehouse`, `processor`, `packer`. `staff` trong API cũ được hiểu là `processor` khi tạo tài khoản; giao diện và CLI mới dùng bốn tên chuẩn. Quyền kho/mua dựa trên vai trò, không dựa vào cờ quyền cũ. Tài khoản `staff` đã có cờ kho chuyển thành `warehouse`; các `staff` còn lại thành `processor`. Bản rất cũ chưa có bảng quyền giữ quyền kho của nhân viên đã vận hành. Vai trò `it` chuyển thành `processor`, `warehouse` giữ nguyên. Không xóa số dư, phiếu, tài khoản hoặc mật khẩu.

Nhân viên gia công nhìn danh sách công việc mình được giao hoặc đã yêu cầu; kho/Admin nhìn toàn bộ. Tạo yêu cầu gia công/sửa mới thuộc kho; nhân viên đi đơn gửi loại **Đóng/giao hàng** với mục đích **Phục vụ đơn hàng**, người nhận là chính mình và có mã tham chiếu. Yêu cầu này chờ kho duyệt, chưa trừ tồn.

## Đóng gói đầu ngày và phân quyền từ kho

Nhân viên kho tạo tài khoản với vai trò **Nhân viên đóng gói**, hoặc đổi vai trò nhân viên hiện có ở **Nhân viên / Dữ liệu & quyền**. Kho được phân vai trò kho, gia công hoặc đóng gói; không thấy lựa chọn Admin và máy chủ cũng chặn mọi cách cấp quyền/đổi tài khoản Admin. Admin vẫn có mọi quyền.

Mỗi sáng nhân viên đóng gói mở **Điều phối kho → Lên đơn đóng gói**, nhập mã đơn/danh sách, ngày đóng gói, hàng và số lượng. Mã yêu cầu tự có tiền tố DG; không ghi số lượng ví dụ làm số dư. Kho thấy hộp **Đơn đóng gói đầu ngày** và có thể lọc theo ngày. Nhân viên đóng gói chỉ thấy yêu cầu mình tạo hoặc được giao.

Luồng gồm bốn trạng thái: **Chờ kho duyệt → Kho đã xác nhận → Chờ nhận việc → Hoàn tất**. Kho bấm **Kho xác nhận yêu cầu** trước; bước này không trừ tồn. Sau đó bấm **Kho xuất thực tế**, lúc này mới giảm tồn và ghi hàng chờ bàn giao. Nhân viên đóng gói bấm **Xác nhận đã nhận bàn giao** khi nhận hàng thực tế; hệ thống chống xuất/nhận hai lần. Luồng Đóng/giao hàng của nhân viên gia công cũng dùng hai bước xác nhận và xuất. Các yêu cầu đóng/giao đang chờ từ bản trước cần xác nhận trước khi xuất; phiếu đã xuất giữ nguyên.

Đóng gói không được tự tạo lệnh sản xuất/sửa, cấp vật tư từ kho hoặc phân quyền. Nếu thiếu hàng, kho xử lý yêu cầu và điều phối sản xuất trước, rồi xuất khi có đủ; tạo hoặc xác nhận yêu cầu không tạo hàng giả. Chưa có tác vụ tự tạo đơn lúc sáng: nhân viên chủ động lên danh sách mỗi ngày.
