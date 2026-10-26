# Quy trình tạo sản phẩm mới — EBG

Ngày cập nhật: 26/10/2026 (Việt Nam).

Tài liệu mô tả quy trình đề xuất theo trao đổi với người dùng và bảng định mức “NVL Sản phẩm Website”. Đây là tài liệu nghiệp vụ; việc lưu tài liệu không đồng nghĩa các chức năng đề xuất đã được triển khai.

## 1. Phân loại sản phẩm

| Loại | Khi sử dụng | Ví dụ |
| --- | --- | --- |
| NVL / linh kiện đầu vào | Mua về để sản xuất hoặc lắp ráp | Ốc, dây dầu cuộn, dầu thắng |
| BTP | Chi tiết hoặc cụm trung gian do EBG gia công/lắp để sử dụng tiếp | Lòng pulley, Lever Head |
| TP | Sản phẩm hoàn thiện bán riêng, đi đơn hoặc nhập stock | Pulley kit, đĩa phanh hoàn chỉnh |

Xác nhận mua ngoài hay tự sản xuất trước khi chốt loại. Chữ Raw trong tên/màu không tự động có nghĩa là NVL. Thành phẩm có thể tính theo cái, đôi hoặc bộ.

Một vật thể vừa bán riêng vừa dùng lắp bộ nên có một mã tồn kho và thuộc tính cho phép bán riêng; không tạo hai tồn độc lập cho cùng một vật thể.

## 2. Khai báo danh mục

Kho hoặc Admin khai báo:

- Mã duy nhất, tên, nhóm hàng và loại NVL/BTP/TP.
- Đơn vị tồn cơ sở: cái, con, bộ, cm/mm, ml…
- Thông số phân biệt: dòng xe, kích thước, phiên bản, màu, trái/phải.
- Nguồn hàng: mua ngoài hoặc tự sản xuất/lắp ráp; có bán riêng không.
- Vị trí kho và mức tồn tối thiểu nếu cần.

Ví dụ mã đề xuất: `TP-PULLEY-LBX-V2-18`, tên “Pulley kit V2 18mm LBX”. Mã này là ví dụ, không phải mã đã được xác nhận trong file nguồn.

## 3. Khai báo định mức

Với sản phẩm tự sản xuất/lắp bộ, chọn các thành phần đã có trong danh mục. Tạo thành phần còn thiếu sau khi kiểm tra trùng mã/biến thể.

Ví dụ từ sheet Pulley, dòng 2–6:

| Thành phần | Cho 1 bộ | Cho 10 bộ |
| --- | ---: | ---: |
| Pulley trước LBX/Tala | 1 | 10 |
| Lòng pulley sau V2 LBX | 1 | 10 |
| Carbon belt 18mm | 1 | 10 |
| Răng Pulley sau V2 LBX | 1 | 10 |
| Ốc thép M5x8 | 6 | 60 |

Tách vật tư gia công/lắp ráp và vật tư đóng gói. Phụ kiện ở cột H và quy cách đóng gói ở cột G cần được chuẩn hóa thành mã, lượng và đơn vị trước khi tự động cấp vật tư. Không tự suy ra số lượng 1 khi file chưa ghi.

Cụm trung gian cần định mức riêng. Ví dụ Lever Head trái gồm adapter, que báo thắng trái và ốc âm M3-4. Nếu xuất Lever Head đã lắp sẵn thì không trừ thêm linh kiện bên trong. Nếu thiếu cụm, lập công việc lắp cụm trước rồi cấp cho bộ lớn.

## 4. Kiểm tra trước khi cho sử dụng

Quy trình đề xuất: Kho/Admin kiểm tra mã, biến thể, đơn vị, thành phần, số lượng, công đoạn và quan hệ cụm. Không cho định mức chứa chính nó hoặc tạo vòng tham chiếu giữa các bộ.

Sản phẩm đủ thông tin mới được chọn để lên đơn. Thay đổi định mức cần phiên bản mới; đơn đã cấp vật tư giữ bản định mức đã sử dụng.

## 5. Ghi nhận tồn thực tế

Tạo danh mục không có nghĩa là đã có hàng. Chỉ ghi tăng tồn khi:

- Có phiếu nhập hàng thực nhận.
- Kiểm kê và ghi nhận tồn đầu kỳ.
- Có kết quả sản xuất/lắp ráp được xác nhận và nhập về kho.

Cột Số lượng trong file nguồn là định mức, không phải tồn đầu kỳ. Một chai dầu 1 lít quy đổi thành 1.000 ml; dây 157 cm không được ghi thành 157 cái. Tách phần số và đơn vị.

Theo dõi số lượng theo mã, nơi giữ và tình trạng: kho, gia công, đóng gói, hàng lỗi. Hàng lỗi là tình trạng của đúng mã bị lỗi; một con ốc lỗi không tự động đồng nghĩa một bộ lỗi.

## 6. Đưa sản phẩm vào luồng làm hàng

1. Đóng gói chọn sản phẩm/bộ, ngày đơn và số lượng; mặc định đi đơn.
2. Tính nhu cầu vật tư theo định mức và kiểm tra khả năng cấp.
3. Kho chuẩn bị, chọn người gia công, xuất vật tư; mở phiếu xuất chứa mặt hàng thực xuất.
4. Gia công nhận và làm hàng; khi hoàn thành khai báo hàng lỗi và lý do theo sản phẩm.
5. Đóng gói nhận hàng đạt rồi hoàn thành đơn.
6. Luồng stock ghi hàng đạt vào kho; luồng đi đơn theo dõi hàng đạt bên đóng gói.

Khả năng lắp không phải tồn TP thực tế. Có đủ bốn thành phần đầu cho 10 bộ nhưng chỉ 54 con ốc thì tối đa lắp 9 bộ theo ví dụ trên, trước khi xét các đơn khác đã giữ vật tư.

Vật tư đã xuất được chuyển sang phần gia công giữ. Khi tiêu hao phải giảm phần này, không trừ tồn kho lần thứ hai. Quy trình đầy đủ cần đối chiếu thực dùng, vật tư thừa trả kho, hàng lỗi và sản phẩm đạt.

## 7. Phạm vi hiện có và phần cần bổ sung

Hiện mã nguồn có phân loại NVL/BTP/TP, định mức có phiên bản, tính vật tư theo định mức trực tiếp khi kho chuẩn bị, lưu bản định mức theo đơn, xuất phiếu và luồng Kho → Gia công → Đóng gói.

Các nội dung sau cần thiết kế/triển khai hoặc kiểm tra thêm trước khi áp dụng đầy đủ:

- Duyệt danh mục sản phẩm trước khi cho lên đơn; nguồn hàng và thuộc tính bán riêng.
- Tự động lập kế hoạch cho định mức nhiều cấp và lệnh lắp cụm trung gian.
- Chuẩn hóa/quy đổi đơn vị dài, thể tích; không đưa nguyên chuỗi `30ml` vào trường số lượng.
- Giữ vật tư cho từng đơn và đối chiếu khả năng cấp giữa nhiều đơn.
- Tách cấp bao bì/phụ kiện cho công đoạn đóng gói.
- Luồng đơn mới hiện hoàn thành gia công theo toàn bộ số lượng và vật tư đã cấp; cần bổ sung đối chiếu tiêu hao thực tế, trả thừa, hàng lỗi ở cấp linh kiện và hoàn thành từng phần nếu sử dụng các nghiệp vụ này.
- Form đóng gói hiện chỉ tạo đơn đi đơn; không có lựa chọn tạo stock trên form này.

## 8. Chuẩn hóa file trước khi nạp

12 file (2)–(13) đã được đối chiếu có cùng nội dung ô/công thức; không cộng dồn các bản. Có 297 cụm định mức đọc từ cột C và 1.638 dòng thành phần; chưa phải danh mục SKU đã được duyệt.

Cần xử lý mã sản phẩm trống, tên trùng, mã thành phần nhiều tên và lượng thiếu. Ví dụ sheet Đĩa tải dòng 23 nằm trong đầu ra 46T nhưng ghi thành phần 43T và thiếu lượng. Không tự sửa hoặc tự gán tồn cho các dòng chưa được xác nhận.
