# Luồng hoạt động hiện tại của KHO EBG

Kiểm tra ngày 31/10/2026, đối chiếu mã nguồn tại commit `25ade7c`. Tài liệu mô tả chức năng đang có, không coi các yêu cầu trước đây là chức năng đã hoàn thành. Không thay đổi dữ liệu nghiệp vụ trong quá trình kiểm tra.

## 1. Vai trò và phạm vi

| Chức năng trên giao diện | Admin | Nhân viên kho | Nhân viên gia công | Nhân viên đóng gói |
|---|---|---|---|---|
| Dashboard thống kê toàn hệ thống | Có | Không | Không | Không |
| Xem, thêm, sửa, khóa sản phẩm | Có | Có | Không | Chỉ tra cứu |
| Nhập/xuất kho, Anode, sửa hàng | Có | Có | Không | Không |
| Chuẩn bị và xuất theo phiếu lấy hàng | Có | Có | Không | Gửi phiếu |
| Nhận hàng kho rồi chuyển gia công | Không có nút làm thay | Không | Không | Người tạo đơn |
| Nhận đơn gia công từ hàng chờ chung | Không | Không | Có | Không |
| Báo hoàn thành và báo lỗi đi đơn | Không có nút làm thay | Không | Người nhận đơn |
| Xác nhận nhập hàng lỗi gia công | Có | Có | Không | Không |
| Nhận hàng đạt, hoàn tất đóng gói | Không có nút làm thay | Không | Không | Người tạo đơn |
| Nhận stock, hẹn trả, báo hoàn thành | Không | Không | Người nhận stock | Không |
| Quản lý thương hiệu, dòng, nhóm | Có | Có | Không | Chỉ lọc/tra cứu |
| Cấp vai trò, khóa/mở tài khoản | Mọi vai trò | Các vai trò ngoài Admin | Không | Không |
| Nhập Excel/CSV, xuất dữ liệu JSON | Có | Có | Không | Không |
| Tải bản sao lưu SQLite | Có | Không | Không | Không |
| Tra/quét QR sản phẩm | Có | Có | Không | Có ở header |

Admin có ngoại lệ ở một số API để hỗ trợ xử lý đơn của người khác, nhưng giao diện không cung cấp đầy đủ các nút làm thay đóng gói/gia công. Tạo đơn đóng gói mới vẫn yêu cầu vai trò đóng gói; nhận stock yêu cầu vai trò gia công. Vì vậy không hiểu “Admin mọi quyền” là mọi thao tác nhân viên đều xuất hiện trên màn hình Admin.

## 2. Đăng nhập, phiên và tài khoản

1. Mặc định, khi không bật `REQUIRE_PASSWORD=1`, người dùng chọn tài khoản có sẵn để vào phần mềm, không nhập mật khẩu.
2. Khi bật cấu hình mật khẩu, đăng nhập bằng tên đăng nhập hoặc email và mật khẩu.
3. Google login đã có mã xử lý nhưng chỉ bật khi cấu hình đủ Client ID, Client Secret và callback URL. Không thể kết luận website người dùng đang bật Google chỉ từ mã nguồn.
4. Google chỉ cho vào nếu email đã xác minh và khớp tài khoản được lưu, chưa bị khóa. Email lạ bị từ chối; chưa tự tạo tài khoản “chờ duyệt”.
5. Người dùng không tự chọn vai trò. Admin/kho cấp vai trò cho tài khoản hiện có; máy chủ đọc lại vai trò trong các yêu cầu API tiếp theo.
6. Khóa tài khoản chấm dứt phiên đăng nhập. Không cho khóa chính mình hoặc làm mất Admin hoạt động cuối cùng.
7. Giao diện Nhân viên chỉ cấp vai trò và khóa/mở; không có nút thêm thành viên hoặc sửa email. API/script tạo tài khoản vẫn tồn tại.
8. Tài khoản & bảo mật cho sửa tên hiển thị; chức năng đổi mật khẩu phụ thuộc chế độ đăng nhập. Giao diện cấp vai trò không yêu cầu sửa tên.
9. Trang chính được ghi trên URL để F5 quay lại trang hợp lệ theo vai trò. Tab con, modal và mọi bộ lọc không được bảo đảm giữ nguyên sau F5.

Đây chưa phải luồng “bất kỳ Gmail mới đăng nhập → chờ duyệt → kho/Admin cấp chức vụ” hoàn chỉnh.

## 3. Màn hình Admin

- Dashboard; Quản trị hệ thống; Sản phẩm; Nhập kho; Xuất kho; Danh mục; Nhân viên; Lịch sử hoạt động.
- Nhập và xuất nằm trên header. Admin có các thao tác kho như nhân viên kho.
- Dashboard xem số sản phẩm, hết hàng, sắp hết, sản phẩm có lỗi; tồn theo giai đoạn; đang Anode/sửa/gia công; hàng đã cấp cho đóng gói; sản phẩm cần bổ sung.
- Số lượng tồn được tổng hợp riêng theo đơn vị, không cộng cái/bộ/chiều dài thành một số chung.
- Biểu đồ chọn ngày, tuần, tháng, năm; nhãn tháng bằng tiếng Việt, thời gian thống kê theo Việt Nam. Tuần từ thứ Hai đến Chủ nhật.
- Gia công: đếm đơn đi đơn đã báo hoàn thành và đơn stock có thời điểm hoàn thành. Đóng gói: đếm lúc bấm hoàn tất. Kho: đếm từng phiếu xuất, gồm xuất thường, đi đơn, stock, Anode và sửa.
- Ba chỉ số là số lượt công đoạn, không cộng thành tổng đơn duy nhất. Biểu đồ không phải biểu đồ lịch sử tồn kho.
- Có bảng kết quả theo nhân viên và số đơn đang chờ hiện tại; các số đang chờ không đổi theo kỳ biểu đồ. Chỉ số kho chờ hiện đếm trạng thái chờ chuẩn bị/đã chuẩn bị, chưa đếm riêng các đơn chờ xác nhận lỗi.
- Chế độ dữ liệu mẫu Excel là minh họa riêng, không ghi đè kho thật. Danh mục mẫu dashboard là bộ mẫu trước đó, không đồng nhất với bộ nhập hai Excel mới nhất.

## 4. Màn hình nhân viên kho

Vào Điều hành kho hoặc Xuất kho để xem yêu cầu lấy hàng do đóng gói gửi lên. Kho xem tất cả đơn và tiến độ, chuẩn bị hàng, xuất phiếu, xác nhận lỗi; không nhận vật tư/chuyển gia công thay người đóng gói.

Kho còn có quản lý sản phẩm, danh mục, nhân viên, báo cáo, lịch sử, tra mã và nhập dữ liệu. Kho được cấp vai trò kho/gia công/đóng gói cho người khác; không được cấp Admin hoặc sửa/khóa tài khoản Admin. Tải sao lưu SQLite đầy đủ dành riêng Admin.

## 5. Luồng đi đơn: đóng gói → kho → đóng gói → gia công → đóng gói

| Bước | Người thực hiện | Thao tác và kết quả | Tác động số lượng |
|---|---|---|---|
| 1 | Đóng gói | Bấm Lên đơn đóng gói; chọn ngày, danh sách lấy từ kho và danh sách sản phẩm cần làm; gửi kho | Chưa trừ tồn |
| 2 | Kho/Admin | Mở Chuẩn bị hàng; chọn giai đoạn xuất; Xác nhận chuẩn bị xong | Chưa trừ hoặc giữ chỗ tồn |
| 3 | Kho/Admin | Bấm Xuất cho đóng gói; tạo và mở phiếu xuất kho | Trừ tồn/giai đoạn một lần; cộng hàng cấp cho đóng gói |
| 4 | Đóng gói tạo đơn | Đối chiếu và Xác nhận đã nhận hàng từ kho | Chỉ xác nhận bàn giao |
| 5 | Đóng gói tạo đơn | Bấm Xuất qua gia công; tạo mã liên kết GC-DGGC | Chuyển hàng cấp đóng gói sang đang gia công; không trừ kho lần hai |
| 6 | Gia công | Thấy hàng chờ chung, bấm Nhận yêu cầu làm hàng | Ghi nhận người phụ trách, chống nhận trùng |
| 7 | Gia công nhận đơn | Nhập số lỗi/lý do từng sản phẩm; xác nhận đủ hàng, dùng hết vật tư; hoàn thành | Trừ vật tư đang gia công; hàng đạt sang chờ đóng gói; lỗi chờ kho xác nhận |
| 8a | Kho/Admin | Kiểm đếm lỗi, bấm Xác nhận đã nhận hàng lỗi vào kho | Cộng kho lỗi và lập phiếu nhập lỗi đúng một lần |
| 8b | Đóng gói tạo đơn | Nhận hàng đạt, nhập số thực nhận từng mặt hàng, có thể nhận nhiều đợt | Giảm hàng chờ nhận; hàng đi đơn không cộng lại tồn kho |
| 9 | Đóng gói tạo đơn | Nhận đủ và bấm Hoàn thành đóng gói | Kết thúc đơn; phải hết lỗi chờ xác nhận |

### Phiếu khi tạo đơn

- Phiếu lấy hàng: danh sách hàng đề nghị kho cấp; mặc định bộ lọc NVL nhưng có thể đổi để lấy BTP/TP hoặc loại khác đang có tồn.
- Phiếu gia công: danh sách sản phẩm cần làm. Danh sách này có thể khác danh sách vật tư lấy từ kho.
- Có lọc thương hiệu, dòng sản phẩm, nhóm, màu, size, version, đơn/đôi; tìm sản phẩm và chọn nhiều dòng.
- Đơn mới trên giao diện luôn là đi đơn; không phải chọn stock, người gia công, hạn cần hàng, mã tham chiếu hoặc ghi chú.
- Cả hai phiếu đều xem/sửa thông tin bản in và in theo mẫu đã tích hợp. In không làm thay đổi tồn.
- Kho phải xuất đúng sản phẩm và số lượng của phiếu lấy hàng. Kho chọn giai đoạn tồn, không tùy ý thay số lượng khác phiếu.
- Sửa danh sách phiếu lấy hàng chỉ trước khi kho xuất. Nếu đã chuẩn bị rồi sửa danh sách, đơn quay lại chờ chuẩn bị.
- Sửa danh sách sản phẩm cần làm chỉ trước khi chuyển qua gia công. Thông tin bản in được xử lý riêng với danh sách hàng.

### Phạm vi đơn từng nhân viên

- Đóng gói xem các đơn mình tạo; các tab Đang theo dõi, Cần tôi xử lý, Đã hoàn thành.
- Gia công xem đơn chưa ai nhận và đơn mình đã nhận. Khi một người nhận, người khác không nhận lại được và không còn thấy nó trong hàng chờ chung.
- Gia công không có menu tra cứu tồn vật tư; API danh sách sản phẩm phân trang cũng chặn vai trò này. Tên và đơn vị mặt hàng vẫn có để đọc đơn.
- Kho/Admin xem toàn bộ đơn. Giao diện xử lý của kho có tại Điều hành/Quản trị hệ thống và Xuất kho.

### Ví dụ hàng lỗi

Đơn cần 100 sản phẩm, gia công báo 7 lỗi: 93 đạt chờ đóng gói; 7 lỗi chưa vào tồn lỗi. Kho xác nhận thực nhận 7 lỗi mới cộng kho lỗi. Đóng gói có thể nhận 50 rồi 43 sản phẩm. Đơn chỉ hoàn thành khi nhận đủ 93 và kho xác nhận 7 lỗi. Nếu cả 100 đều lỗi, vẫn phải chờ kho xác nhận rồi đóng gói mới hoàn tất.

### Giới hạn đi đơn hiện tại

- Kho xuất toàn bộ phiếu một lần; đóng gói nhận vật tư và chuyển gia công toàn bộ một lần.
- Một đơn do một người gia công nhận, chưa chia cho nhiều người.
- Gia công báo hoàn thành toàn bộ, giả định vật tư cấp đã dùng hết; chưa có giao diện trả vật tư thừa hoặc khai báo hao hụt cho luồng này.
- Hàng đạt nhận nhiều đợt được; hàng lỗi kho xác nhận toàn bộ một lần, chưa xác nhận từng phần hoặc điều chỉnh số lỗi ngay tại bước xác nhận.
- Không tự suy ra vật tư cần lấy từ cấu tạo. Người lập chọn hai danh sách; kho kiểm tra.
- Chưa có nút hủy đơn mới, trả hàng đảo giao dịch hoặc mở lại đơn hoàn tất.
- Chưa có nhánh riêng nhận TP rồi đóng gói trực tiếp bỏ qua gia công: nút hiện tại vẫn theo cùng chuỗi bàn giao.

## 6. Luồng xuất stock

1. Kho/Admin → Xuất kho → Tạo phiếu xuất → chọn Xuất kho để stock.
2. Chọn sản phẩm, số lượng, giai đoạn tồn; không chọn người gia công/hẹn trả tại kho.
3. Lưu: trừ tồn, cộng đang gia công; lập phiếu xuất bình thường và yêu cầu STOCK.
4. Gia công thấy Hàng stock kho đã xuất → Nhận và chọn thời gian trả → chọn ngày giờ tương lai.
5. Người nhận bấm Hoàn thành hàng stock khi làm xong; hệ thống ghi thời điểm và thống kê hoàn thành.

**Chưa khép kín:** bước 5 chỉ ghi tiến độ, chưa trừ đang gia công, chưa tạo phiếu nhập, chưa cộng TP, chưa ghi lỗi stock. Không được coi bấm Hoàn thành là hàng đã về tồn kho. Nhập hàng thủ công cũng không tự đối chiếu/đóng số đang gia công của yêu cầu stock này. Cần bổ sung bước kho kiểm nhận stock gắn với phiếu gốc.

API còn hỗ trợ đơn đóng gói cũ mang mục đích stock, có nhận đạt vào TP. Đó là cơ chế tương thích riêng; không phải luồng Xuất kho để stock đang thấy trên giao diện.

## 7. Nhập kho thông thường

Kho/Admin bấm Nhập kho trên header, chọn loại, sản phẩm, số lượng và lưu.

| Loại | Kết quả |
|---|---|
| Nhập từ CNC | Luôn cộng vào giai đoạn Hàng phôi của sản phẩm |
| Nhập sửa | Cộng tồn theo giai đoạn chọn/mặc định |
| Nhập hàng | Cộng tồn theo giai đoạn chọn/mặc định |

Giai đoạn mặc định theo loại sản phẩm khi không chọn. Lưu ghi phiếu/dòng nhập trong dữ liệu và lịch sử, giao diện không yêu cầu in phiếu nhập, sau lưu quay về sản phẩm.

Nhập sửa là phiếu nhập độc lập, không tự tất toán phiếu đã xuất sửa. Để nhận về đúng phiếu sửa, dùng Nhận hàng về trên phiếu đang sửa; tránh vừa nhập độc lập vừa nhận phiếu gây cộng hai lần.

## 8. Xuất thường, Anode và sửa

### Xuất kho thường

Kho chọn Xuất kho, thêm 1–100 mặt hàng, số lượng và giai đoạn. Lưu trừ tồn, lập phiếu PX, mở xem/in. Không tự tạo yêu cầu gia công; muốn tạo hàng stock phải chọn loại stock, muốn đi theo yêu cầu đóng gói phải xuất từ đơn đó.

Phiếu xuất in không có mã sản phẩm; hệ thống vẫn giữ mã nội bộ để liên kết dữ liệu, tra cứu và QR. CSV báo cáo hiện vẫn có cột mã sản phẩm.

### Anode

1. Kho xuất loại Xuất kho đi Anode, chọn Nam Thái hoặc Bình Phát.
2. Trừ tồn giai đoạn đã chọn, tăng đang Anode; phiếu ở trạng thái chờ nhận về.
3. Sản phẩm → dropdown Anode → chọn phiếu → Nhận hàng về (hoặc xử lý tại phiếu xuất).
4. Nhập số lỗi từng dòng; số đạt bằng số xuất trừ số lỗi; xác nhận nhận toàn bộ phiếu.
5. Giảm đang Anode; đạt về tồn, lỗi vào kho lỗi; sinh chứng từ nhận liên kết phiếu xuất; phiếu xuất hoàn tất.

Luồng phiếu hiện nhận lại đúng sản phẩm đã xuất, giữ giai đoạn xuất khi có thông tin đó. Không tự chuyển sang sản phẩm màu khác hoặc tự nâng lên TP; việc liên kết mã thô trong danh mục không có nghĩa phiếu Anode này tự chuyển mã.

### Sửa hàng

1. Sản phẩm → Hàng lỗi → Xuất đi sửa; nguồn mặc định Kho hàng lỗi. Hoặc tạo phiếu xuất đi sửa và chọn nguồn hàng kho/hàng lỗi.
2. Nguồn lỗi: giảm kho lỗi, tăng đang sửa, không trừ thêm tồn thường. Nguồn kho: giảm tồn/giai đoạn và tăng đang sửa.
3. Sản phẩm → Hàng sửa → Nhận hàng về, nhập số vẫn lỗi.
4. Đạt cộng tồn; vẫn lỗi cộng kho lỗi; giảm đang sửa và đóng phiếu. Có thể xuất phần vẫn lỗi đi sửa lần tiếp theo.

Cả Anode và sửa hiện nhận toàn bộ phiếu, chưa nhận từng đợt. Đây là kho trực tiếp kiểm nhận nên không có bước chờ kho xác nhận thứ hai như báo lỗi từ gia công.

## 9. Sản phẩm, phân loại và cấu tạo

- Nhóm sản phẩm có Tất cả, Hàng phôi, NVL, BTP, TP. Dữ liệu còn có Chưa phân loại.
- Bộ lọc theo thương hiệu/dòng/nhóm/màu/size/version/đơn-đôi và trạng thái; mới nhất lên trước. Size có không size, 220, 230, 240, 250, 270.
- Màu và version nhập trong form sản phẩm; các giá trị sản phẩm cung cấp lựa chọn lọc. Thương hiệu/dòng/nhóm do Admin/kho quản lý trong Danh mục.
- Thêm sản phẩm tạo thông tin, không đồng nghĩa nhập tồn. Muốn có số lượng dùng nhập kho hoặc chức năng nhập dữ liệu cho phép tồn đầu kỳ.
- Mã nội bộ vẫn được tạo dù người dùng không phải nhập mã; khóa sản phẩm giữ lịch sử, không xóa dữ liệu.
- Loại sản phẩm là thuộc tính danh mục; tồn theo giai đoạn là số dư thực tế. Sửa thuộc tính loại không tự di chuyển số lượng giữa các giai đoạn.
- Chuyển giai đoạn: cùng sản phẩm, tỷ lệ 1:1, trừ nguồn cộng đích, giữ tổng tồn. Ví dụ 100 NVL chuyển 30 sang BTP → còn 70 NVL, 30 BTP, tổng 100.
- Chuyển giai đoạn không phải ghép nhiều linh kiện thành một bộ khác.
- Khối số lượng trong sản phẩm đang hiển thị Tất cả/Chưa phân loại/NVL/BTP/TP; có Hàng phôi khi tồn phôi lớn hơn 0.
- Cấu tạo Excel vẫn được lưu, có thông tin cấu tạo trong chi tiết sản phẩm khi được tải. Máy chủ còn tính được lượng linh kiện nằm trong BTP/TP, nhưng khối số lượng giao diện hiện hiển thị số dư giai đoạn; không nên diễn giải nó là số linh kiện đã nằm trong các bộ.
- Chưa có thao tác lắp/tháo bộ độc lập tự động trừ linh kiện và cộng bộ ngay trong danh mục. Luồng đi đơn dùng danh sách vật tư và sản phẩm người dùng khai báo.

## 10. Excel, CSV, báo cáo và sao lưu

Trong Quản trị hệ thống/Điều hành kho → Dữ liệu & quyền:

- Nhập cấu tạo Excel: chọn file → xem trước số sản phẩm/cấu tạo/cảnh báo → xác nhận. Tên hàng hóa là TP; Tên thành phần là NVL; số lượng cấu tạo là lượng cho một cấu tạo, không phải tồn. Nhập này không cộng tồn.
- CSV danh mục: tải tiêu đề, chuẩn bị file, xem trước và nạp. Có hỗ trợ tồn đầu kỳ cho mã mới; mã đã tồn tại cập nhật thông tin, không ghi đè số dư hiện hữu.
- Xuất danh mục CSV và dữ liệu JSON cho kho/Admin. Bản sao SQLite đầy đủ chỉ Admin; không có giao diện phục hồi trực tiếp, repo có script phục hồi.
- Hai Excel mới nhất đã được đóng gói để lệnh khởi động tiêu chuẩn nạp một lần: 1.432 mục (735 TP, 624 NVL, 56 BTP, 17 chưa phân loại), 292 cấu tạo. Đây là quy mô bộ nhập, không bảo đảm mọi database đang dùng có đúng tổng này.
- Khi nhập vào database đã có dữ liệu: giữ sản phẩm/giao dịch hiện có, bảo vệ số dư đã phát sinh, sao lưu trước nhập, ghi chênh lệch cần đối chiếu. Không tự xóa sạch dữ liệu cũ và không nạp lại tồn sau mỗi lần khởi động.
- File Website chỉ có cấu tạo khởi tạo số dư 0; số tồn lấy từ KHO EBG theo tài liệu nhập. Không biến số lượng linh kiện của cấu tạo thành tồn kho.

Báo cáo hiện là CSV, mở được bằng Excel. Chọn ngày/tuần/tháng/năm: ở Nhập kho chỉ xuất phát sinh nhập; ở Xuất kho chỉ phát sinh xuất; ở trang khác có thể gồm cả hai. Bộ lọc/chọn phiếu của danh sách xuất được áp dụng khi xuất từ danh sách đó. Đây là báo cáo giao dịch, không phải mọi nút Xuất báo cáo đều xuất danh sách tồn hiện tại.

## 11. Tiện ích dùng chung

- Tìm tên/mã ở header cho Admin/kho/đóng gói; có debounce và tải danh sách sản phẩm thêm khi cuộn.
- Quét QR trên máy tính/điện thoại khi có camera và được trình duyệt cấp quyền; triển khai qua HTTPS hoặc localhost để dùng camera. Quét dùng tra cứu, không tự nhập/xuất.
- Admin/kho có màn Tra/quét mã và in nhãn. Đóng gói không có tab con đó nhưng còn nút QR trên header.
- Có tải lại toàn trang ở header, đăng xuất, thông tin tài khoản, cuộn lên đầu, giao diện mobile và cài web dạng PWA.
- Danh sách đơn tự làm mới khi tab đang hiển thị, không phải thông báo đẩy; đơn không được bảo đảm xuất hiện tức thì không có độ trễ.
- Nhật ký ghi người và thời điểm các thao tác; màn lịch sử hiện lấy tối đa 200 bản ghi gần nhất, không phải tra cứu toàn bộ lịch sử không giới hạn.

## 12. Phần cũ còn tồn tại và điểm cần hoàn thiện

1. Giao diện Yêu cầu/Công việc cũ đã bỏ, nhưng bảng dữ liệu, API và một số component cũ vẫn còn. Chưa phải đã xóa toàn bộ luồng cũ khỏi hệ thống.
2. Luồng stock thiếu kiểm nhận về kho và quyết toán số đang gia công; đây là điểm cần ưu tiên để số tồn không treo.
3. Google mới thiếu đăng ký chờ duyệt, trong khi giao diện nhân viên chỉ quản lý tài khoản hiện có.
4. Luồng đi đơn chưa có hủy/đảo giao dịch, trả vật tư thừa, chia người làm hoặc nhận vật tư từng phần.
5. Báo lỗi gia công có bước kho xác nhận đúng yêu cầu, nhưng chưa có cơ chế kho điều chỉnh/chấp nhận một phần số lỗi.
6. Khối NVL/BTP/TP hiện là tồn theo giai đoạn; nhu cầu trình bày riêng “linh kiện rời / nằm trong BTP / nằm trong TP” chưa được thể hiện đầy đủ trên giao diện hiện tại.
7. Giới hạn màn hình chưa đồng nghĩa chỉ gửi dữ liệu tối thiểu: API dữ liệu chung còn trả audit cho các vai trò và trả phiếu/giao dịch cho đóng gói; API ops còn trả danh sách người và cấu tạo. Quyền ghi đã kiểm tra trên máy chủ, nhưng phạm vi dữ liệu đọc cần rà soát thêm nếu yêu cầu bảo mật theo vai trò nghiêm ngặt.
8. Không có vai trò mua vật tư hoặc luồng mua hàng đang hoạt động trên giao diện. Một số bảng cũ liên quan mua vẫn có trong dữ liệu xuất.
9. Một số mô tả phụ vẫn còn từ cũ như “Tạo, sửa tài khoản”, trong khi màn Nhân viên thực tế chỉ cấp quyền/khóa. Không dùng riêng mô tả phụ để suy ra chức năng.

## 13. Căn cứ kiểm tra

- Vai trò/màn hình: `shared/roles.js`, `shared/workspaces.js`, `src/main.jsx`, `src/Operations.jsx`, `src/Employees.jsx`.
- Đi đơn/in phiếu: `server/packing-orders.js`, `src/PackingOrders.jsx`, `src/PackingPrint.jsx`, `shared/packing-print.js`.
- Stock: `server/stock-work-orders.js`, `src/StockWorkOrders.jsx`.
- Nhập/xuất/Anode/sửa: `server.js`, `shared/movements.js`, `src/MovementForm.jsx`, `src/ExternalWork.jsx`.
- Giai đoạn/cấu tạo: `server/stock-stages.js`, `server/composition-summary.js`, `src/StockStages.jsx`, `src/main.jsx`.
- Đăng nhập/phân quyền: `server/google-auth.js`, `server/roles.js`, `server/operations.js`, `server.js`.
- Dashboard: `src/AdminDashboard.jsx`, `src/DashboardActivity.jsx`, `server/dashboard-activity.js`.
- Nhập Excel: `server/bundled-catalog.js`, `server/operations.js`, `docs/import-preview/IMPORT-2026-10-30.md`.

Kiểm tra tự động: `npm test` đạt 72/72; `npm run build` thành công. Kiểm tra trình duyệt luồng đi đơn trên mobile đạt. Kiểm tra trình duyệt stock nguyên bản bị chặn vì dùng ngày hẹn cố định 28/10/2026 đã qua; chạy bản kiểm tra tạm với ngày tương lai đã đạt bước kho xuất → gia công nhận/hẹn trả. Không sửa mã nghiệp vụ hay ghi vào database người dùng. Kết quả này áp dụng mã trong workspace, không xác nhận dữ liệu/cấu hình hoặc phiên bản đang chạy trên máy localhost của người dùng.
