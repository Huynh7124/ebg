# Yêu cầu lấy hàng và bàn giao gia công

Luồng mới áp dụng cho đơn đầu ngày từ nhân viên đóng gói:

1. Đóng gói tạo yêu cầu theo ngày, sản phẩm và số lượng.
2. Kho mở yêu cầu, chọn hàng thực xuất, giai đoạn tồn và số lượng. Không chọn nhân viên gia công. Chuẩn bị chưa trừ tồn.
3. Kho bấm **Xuất cho đóng gói**. Hệ thống trừ tồn đúng một lần, ghi hàng đã cấp cho đóng gói và tạo phiếu xuất kho có bên nhận là Đóng gói.
4. Chính nhân viên đóng gói tạo yêu cầu đối chiếu phiếu rồi bấm **Xác nhận đã nhận hàng từ kho**.
5. Đóng gói bấm **Xuất qua gia công**. Toàn bộ hàng đã cấp được chuyển sang gia công, không trừ tồn thêm. Mã phiếu giao GC-DGGC liên kết cùng yêu cầu và phiếu xuất kho.
6. Mọi gia công thấy phiếu chưa ai nhận. Người đầu tiên bấm **Nhận yêu cầu làm hàng** được ghi nhận là người phụ trách. Những người khác không nhận trùng và không còn thấy đơn đó.
7. Gia công hoàn thành, nhập số lỗi và lý do theo từng sản phẩm. Hàng lỗi ở trạng thái chờ kho xác nhận, chưa cộng tồn; phần đạt chờ đóng gói nhận. Kho mở đơn → **Xác nhận hàng lỗi** → kiểm đếm và bấm **Xác nhận đã nhận hàng lỗi vào kho** để tạo phiếu nhập lỗi và cộng tồn đúng một lần. Đóng gói nhận hàng đạt độc lập, nhưng chỉ hoàn tất đơn sau khi kho xác nhận lỗi. Đơn cũ đã nhập lỗi không bị nhập lại.

Kho vào **Sản phẩm → Hàng lỗi → Xuất đi sửa** để xuất từ nguồn kho lỗi; không trừ thêm tồn thường. Xác nhận hiện áp dụng toàn bộ số lỗi trên đơn, chưa hỗ trợ nhận lỗi từng phần.
8. Đóng gói nhận phần đạt, có thể kiểm nhận nhiều đợt như trước. Nhận đủ rồi bấm **Hoàn thành đóng gói**.

Kho không thể thay đóng gói nhận/chuyển hàng. Admin có quyền xử lý qua API khi cần. Hàng cấp cho đóng gói được theo dõi bằng withPacking; hàng gia công bằng inProduction. Tồn của từng giai đoạn chỉ giảm ở bước kho xuất.

Hiện bàn giao kho → đóng gói → gia công toàn bộ phiếu một lần, không chia phiếu cho nhiều người gia công và không nhận vật tư từng phần. Không cho giao nhiều hơn số đã cấp hoặc xuất/chuyển/nhận lặp.

Đơn đã xuất theo luồng cũ giữ người gia công được giao và tiếp tục xử lý như trước. Đơn cũ chưa xuất chuyển sang luồng mới khi kho xuất. Luồng **Xuất kho để stock** riêng vẫn dùng danh sách yêu cầu stock hiện có.

Dashboard tính thêm các đơn chờ đóng gói nhận vật tư/chuyển gia công. Nhập/xuất và các lần bàn giao đều ghi lịch sử người thực hiện.

Kiểm tra bằng `npm test` và `npm run test:packing-production` sau khi build. Các kiểm tra sử dụng database tạm, bao gồm nhận trùng đồng thời, quyền của người tạo, hàng lỗi, tồn không bị trừ hai lần và tiếp tục đơn cũ.
