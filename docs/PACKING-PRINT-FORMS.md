# Hai mẫu phiếu đóng gói

Trong từng đơn đóng gói, người lập đơn và admin/nhân viên kho có hai nút **Phiếu lấy hàng / In** và **Phiếu gia công / In**. Có thể mở ngay sau khi gửi đơn cho kho; mẫu đã lưu xuất hiện ở cùng đơn của kho.

- Phiếu lấy hàng ở kho: khổ Letter như file `PHIẾU LẤY HÀNG.docx`, 15 dòng tối thiểu, người đề nghị, nhân viên kho, chữ ký người lập phiếu/người xuất hàng.
- Phiếu gia công: khổ A4 như file `Đề nghị làm hàng đi đơn.docx`, 12 dòng tối thiểu, phòng ban giao/nhận, ghi chú chung, chữ ký người lập phiếu/người nhận hàng.
- Hai danh sách độc lập: **Phiếu lấy hàng** lưu `pickupItems` (nguyên vật liệu cần kho cấp); **Phiếu gia công** lưu `items` (sản phẩm cần làm). Người đóng gói chọn cả hai khi tạo đơn, sau đó có thể sửa trong từng mẫu phiếu. Bộ lọc gồm tên, thương hiệu, dòng sản phẩm, màu, đơn/đôi, size, danh mục và nhóm hàng; phiếu lấy hàng mặc định lọc NVL. Không in mã sản phẩm.
- Kho chuẩn bị danh sách có sẵn từ phiếu lấy hàng, chỉ chọn giai đoạn tồn. Server kiểm tra đúng mã hàng và số lượng ở cả bước chuẩn bị và xuất. Tồn chỉ trừ khi kho xác nhận xuất, không trừ lúc tạo/lưu/in hay chuyển sang gia công.
- Sửa danh sách lấy hàng chỉ trước khi xuất; nếu kho đã chuẩn bị thì trả đơn về chờ chuẩn bị và xóa danh sách chuẩn bị cũ. Sửa danh sách gia công chỉ trước khi chuyển cho gia công. Sau các mốc này chỉ sửa thông tin in/ghi chú.
- Đơn cũ chưa có `pickupItems` vẫn sử dụng quy trình chuẩn bị cũ; lần lưu phiếu lấy hàng đầu tiên sẽ liên kết danh sách lấy hàng với xuất kho.
- Cho sửa ngày, kho, tên người, phòng ban và ghi chú từng dòng. Các tên trong file Word là ví dụ, không dùng để tự phân công nhân viên. Khi chưa có người nhận, để trống.
- Lưu trước khi in; kho và người lập đơn dùng chung bản đã lưu trong `packing_orders.payload.printForms`. Tên và đơn vị mặt hàng được chụp lại khi lưu đầu tiên. Server kiểm tra sản phẩm và số lượng, lưu danh sách được chọn vào đơn cùng giao dịch với mẫu phiếu; tên/đơn vị do server tra cứu.
- Lưu/in không xuất tồn; thay đổi danh sách lấy hàng đã chuẩn bị sẽ yêu cầu kho chuẩn bị lại. Nhân viên khác không được sửa phiếu của người lập đơn.
- In từ vùng phiếu riêng, không kèm header/sidebar ứng dụng. Tắt đầu trang/chân trang của trình duyệt; tỷ lệ 100%, chọn khổ giấy tương ứng. Có thể lưu PDF. Phiếu dài tự sang trang và lặp tiêu đề bảng.

Kiểm tra: `npm run build`, `node --test test/packing-production.test.js`, `node scripts/check-packing-print.mjs`, `npm run test:packing-production`.
