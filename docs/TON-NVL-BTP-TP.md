# Tồn theo giai đoạn NVL / BTP / TP

Áp dụng thay cho việc phải tạo định mức trước khi chuẩn bị đơn mới.

## Xem số lượng

Mỗi mã hàng có NVL, BTP, TP tại kho. Tổng tồn kho bằng tổng ba nhóm cộng phần Chưa phân loại (nếu còn). Hàng đang gia công, chờ giao, lỗi, sửa và Anode là các nhóm theo dõi riêng, không cộng trùng vào tồn sẵn có tại kho.

Tồn cũ được phân theo loại hàng đã lưu. Mã chưa được phân loại giữ số lượng ở Chưa phân loại để kho phân bổ. Đổi thuộc tính danh mục không tự chuyển số dư. Giai đoạn nhập mặc định chỉ dùng khi phiếu nhập không chọn giai đoạn riêng.

## Nhập và xuất

Phiếu nhập/xuất có lựa chọn giai đoạn cho từng sản phẩm. Phiếu xuất không chọn giai đoạn chỉ được tự nhận diện khi mã đó có đúng một nhóm tồn dương. Nếu có nhiều nhóm, kho phải chọn đúng nhóm; không tự lấy bù từ nhóm khác. Phiếu lưu giai đoạn và thể hiện trong ghi chú dòng bản in. Hàng sửa/Anode nhận lại theo giai đoạn của lần xuất đã lưu; phiếu lịch sử chưa có giai đoạn dùng mặc định của sản phẩm.

## Chuyển công đoạn

Sản phẩm → nút ba chấm → Chuyển NVL / BTP / TP → chọn nguồn, đích và số lượng → xác nhận.

Ví dụ NVL 20, BTP 5, TP 3; chuyển 4 NVL sang BTP sẽ thành NVL 16, BTP 9, TP 3. Tổng vẫn là 28. Chỉ dùng cho cùng mã và cùng đơn vị 1:1, khi kho đã kiểm nhận trạng thái thực tế. Đây không phải thao tác chuyển vị trí đến gia công, cũng không phải phép đổi nhiều linh kiện thành một bộ khác mã.

Chỉ Admin và kho được chuyển. Có kiểm tra số dư, mã khóa, lịch sử và chống ghi trùng cùng giao dịch. Không sửa trực tiếp số tồn từ form danh mục.

## Đơn đóng gói và gia công

Đơn mới không tự lấy định mức: kho nhập vật tư thực cấp, lượng và giai đoạn xuất. Phiếu đã chuẩn bị giữ danh sách vật tư đã lưu. Gia công vẫn nhận, khai báo hàng lỗi, hoàn thành và chuyển hàng đạt về đóng gói. Hàng đạt nhập lại kho theo luồng stock được ghi vào TP; đi đơn được theo dõi tại đóng gói, không tăng tồn tại kho.

Kho có thêm loại **Xuất kho để stock** trong phiếu xuất thông thường. Kho chỉ chọn mặt hàng, giai đoạn và số lượng; không chọn người gia công hoặc hạn trả. Phiếu được hoàn tất và in như phiếu xuất kho khác, đồng thời tạo yêu cầu `STOCK-...`. Tất cả nhân viên gia công thấy yêu cầu đang mở; người nhận đầu tiên chọn ngày giờ dự kiến trả. Sau khi nhận, yêu cầu chỉ còn hiển thị cho người đó và kho/Admin. Bước này chỉ ghi nhận lịch hẹn trả, chưa ghi nhận hàng hoàn thành hoặc nhập lại kho.

Mục Định mức được bỏ khỏi giao diện. Dữ liệu định mức và API cũ được giữ để không mất lịch sử và tương thích các lệnh cũ; giao diện tạo yêu cầu sản xuất cũ cũng gửi danh sách vật tư thủ công.

## Lưu trữ và đối chiếu

Bảng product_stage_stock lưu số dư từng giai đoạn; stage_transfers lưu lịch sử chuyển. Trigger đồng bộ các thao tác thay đổi tổng stock, kể cả đường xử lý cũ. Xuất JSON có cả hai bảng; sao lưu SQLite giữ toàn bộ dữ liệu.

Kiểm tra: `node --test test/stock-stages.test.js`, `npm run test:packing-production`, `npm run test:operations` sau build. Kiểm thử gồm di trú không lặp, bảo toàn tổng, xuất đúng nhóm, thiếu tồn, quyền, nhận sửa về nhóm cũ và chuyển giai đoạn trên giao diện điện thoại.
