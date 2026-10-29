# Hai mẫu phiếu đóng gói

Trong từng đơn đóng gói, người lập đơn và admin/nhân viên kho có hai nút **Phiếu lấy hàng / In** và **Phiếu gia công / In**. Có thể mở ngay sau khi gửi đơn cho kho; mẫu đã lưu xuất hiện ở cùng đơn của kho.

- Phiếu lấy hàng ở kho: khổ Letter như file `PHIẾU LẤY HÀNG.docx`, 15 dòng tối thiểu, người đề nghị, nhân viên kho, chữ ký người lập phiếu/người xuất hàng.
- Phiếu gia công: khổ A4 như file `Đề nghị làm hàng đi đơn.docx`, 12 dòng tối thiểu, phòng ban giao/nhận, ghi chú chung, chữ ký người lập phiếu/người nhận hàng.
- Cả hai lấy **sản phẩm và số lượng yêu cầu** từ đơn đóng gói. Vật tư kho thực tế cấp được ghi ở phiếu xuất kho riêng theo luồng hiện có. Không in mã sản phẩm.
- Cho sửa ngày, kho, tên người, phòng ban và ghi chú từng dòng. Các tên trong file Word là ví dụ, không dùng để tự phân công nhân viên. Khi chưa có người nhận, để trống.
- Lưu trước khi in; kho và người lập đơn dùng chung bản đã lưu trong `packing_orders.payload.printForms`. Tên và đơn vị mặt hàng được chụp lại khi lưu đầu tiên. Server luôn lấy số lượng từ đơn, không chấp nhận thay số lượng qua bản in.
- Lưu/in không xuất tồn, không chuyển trạng thái đơn. Nhân viên khác không được sửa phiếu của người lập đơn.
- In từ vùng phiếu riêng, không kèm header/sidebar ứng dụng. Tắt đầu trang/chân trang của trình duyệt; tỷ lệ 100%, chọn khổ giấy tương ứng. Có thể lưu PDF. Phiếu dài tự sang trang và lặp tiêu đề bảng.

Kiểm tra: `npm run build`, `node --test test/packing-production.test.js`, `node scripts/check-packing-print.mjs`, `npm run test:packing-production`.
