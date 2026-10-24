# Đề xuất triển khai Phiếu thu v2

Trạng thái: **người dùng đã duyệt DDL và quy tắc nghiệp vụ**. Migration tương ứng là `phong-tro-backend/migrations/017_bill_drafts_schedule.sql`; tài liệu này không tự thay đổi database.

## Tiến độ triển khai trong mã nguồn

- Đã dựng lại vùng Phiếu thu và ba hộp thoại Lập phiếu, Thiết lập tự động, Gửi phiếu theo ảnh tham khảo. Danh sách, bốn thẻ, điều kiện phòng, tiền tạm tính và số đếm gửi đều đọc API; giao diện không dùng số minh họa.
- Backend có API xem trước từng phòng, tổng hợp kỳ, gửi trong ứng dụng, cấu hình lịch và nhật ký lần chạy. Phiếu mới là Nháp; gửi thủ công mới tạo thông báo và ghi người/giờ/lần gửi. Lịch mặc định tắt và bỏ qua kỳ đã lỡ.
- Khi tác vụ tự động chạy trên hệ thống có nhiều Chủ trọ, mỗi Chủ trọ chỉ lập phiếu cho căn mình sở hữu; nhật ký hiển thị qua API chỉ liệt kê phòng thuộc Chủ trọ đang xem. Lịch bật/tắt và giờ chạy hiện là cấu hình dùng chung toàn hệ thống.
- Đã cập nhật các đường công nợ, thanh toán, quyết toán và dashboard để phiếu Nháp không bị tính là khoản nợ có thể thu. Phiếu cũ không bị migration sửa dữ liệu.
- Kiểm chứng hiện có: backend unit 154/154, frontend build xanh, bộ quét `innerHTML` 0 vi phạm. **Chưa chạy migration 017 và integration DB** trong môi trường hiện tại vì thiếu toàn bộ `TEST_DB_*`. Chưa kiểm tra trực quan bốn màn trong trình duyệt. Không áp dụng migration lên `phong_tro` khi các bước này chưa được nghiệm thu trên DB test được phép.

## Quy tắc đã chọn

- Phiếu kỳ T gồm tiền phòng, nước, dịch vụ kỳ T và điện tiêu thụ kỳ T−1. Chỉ số điện đã xác nhận của kỳ T−1 là điểm chốt tiêu thụ kỳ trước; kỳ đầu hợp đồng không có điện kỳ trước thì tính 0 đ theo quy tắc kỳ lẻ đã có trong SRS. Backend tính và trả số tiền, điều kiện, lý do bỏ qua; frontend không tự tính.
- Chủ trọ lập tay hoặc job tự động đều tạo phiếu **Nháp**, `daGui=false`. Chủ trọ gửi trong ứng dụng sau khi xem lại. Job không gửi.
- `trangThai` hiện tại tiếp tục là trạng thái **thanh toán** (`CHUA_THANH_TOAN`, `THANH_TOAN_MOT_PHAN`, `DA_THANH_TOAN`); trạng thái phát hành `NHAP`/`DA_GUI` được suy ra từ `daGui`. Không thêm `NHAP` vào cột thanh toán, vì sẽ phá các CHECK hiện có và trộn hai vòng đời.
- Phiếu Nháp chưa được đưa vào danh sách công nợ/quá hạn; không nhận ghi nhận thu qua API thường. Doanh thu báo cáo chỉ từ khoản thu hiệu lực, nên phiếu Nháp không tạo doanh thu. Các phiếu lịch sử đã thanh toán giữ nguyên; không sửa lại dữ liệu đã nhập.
- Lịch tự động có công tắc bật/tắt, mặc định tắt khi triển khai. Không chạy bù kỳ lỡ; lần chạy tiếp theo là kỳ tương lai gần nhất theo giờ Việt Nam. Nếu bật muộn sau giờ hẹn của kỳ hiện tại thì bỏ qua kỳ đó. Lịch không bao giờ tự gửi.
- Cùng hợp đồng/kỳ chỉ một phiếu (`uq_ThanhToan_ky_loai` đã có). Khi job chạy nhiều instance dùng named lock hiện có, và ghi nhật ký theo kỳ để chống chạy trùng. Lỗi một phòng không dừng cả lô.

## DDL cần duyệt

1. `ThanhToan`: thêm `nguoiGuiId VARCHAR(36) NULL`, FK đến `TaiKhoan(maTaiKhoan)`, để lưu người gửi lần gần nhất. Thêm `soLanGui INT NOT NULL DEFAULT 0` với CHECK `soLanGui >= 0`. Giữ `daGui` và `ngayGui` hiện có. Dữ liệu đã gửi trước migration có `nguoiGuiId=NULL`, `soLanGui=0` và được coi là dữ liệu cũ; không bịa người gửi.
2. Tạo `NhatKyLapPhieu` (InnoDB): `maLanChay VARCHAR(36)` PK, `ky CHAR(7)` NOT NULL UNIQUE, `thoiDiemHen DATETIME` NOT NULL, `batDau DATETIME` NOT NULL, `ketThuc DATETIME NULL`, `trangThai VARCHAR(20)` NOT NULL (`DANG_CHAY`, `HOAN_TAT`, `LOI`), `soPhieuLap INT NOT NULL DEFAULT 0`, `soPhongBoQua INT NOT NULL DEFAULT 0`, `soPhongLoi INT NOT NULL DEFAULT 0`, `phamViJson JSON NOT NULL`. Thời gian lưu theo UTC, API hiển thị giờ Việt Nam. Dòng `DANG_CHAY` bị ngắt có thể tiếp tục đúng kỳ dưới named lock; phiếu đã lập được nhận biết qua unique hiện có.
3. Tạo `ChiTietNhatKyLapPhieu` (InnoDB): `maChiTiet VARCHAR(36)` PK, `maLanChay VARCHAR(36)` NOT NULL FK đến `NhatKyLapPhieu`, `maPhong VARCHAR(36)` NOT NULL FK đến `PhongTro`, `maHopDong VARCHAR(36) NULL` FK đến `HopDong`, `ketQua VARCHAR(20)` NOT NULL (`DA_LAP`, `BO_QUA`, `LOI`), `maLyDo VARCHAR(60) NULL`, `dienGiai VARCHAR(255) NULL`; UNIQUE (`maLanChay`, `maPhong`). Ghi một kết quả cho mỗi phòng được xét.

Không cần DDL cho lịch bật/tắt và phạm vi căn: dùng `CauHinhHeThong` hiện có với hai khóa mới `billScheduleEnabled` (boolean, mặc định false) và `billScheduleBuildingIds` (mảng ID căn; mảng rỗng nghĩa là tất cả căn). Backend phải kiểm tra căn thuộc chủ trọ trước khi lưu và lưu cấu hình/audit trong một transaction. Ngày và giờ tiếp tục dùng `billScheduleDay` (1–28) và `billScheduleHour` (0–23).

## API và luồng dự kiến

- Mở rộng API xem trước để trả mọi phòng/hợp đồng của kỳ và căn với `eligible`, `reasonCode`, `estimatedTotal`, tên phòng/khách/căn. Kiểm tra lại đủ điều kiện khi ghi; không tin lựa chọn từ client.
- Mở rộng API danh sách phiếu để lọc tìm kiếm ở server; thêm endpoint tổng hợp bốn thẻ theo kỳ/căn và số phiếu chưa gửi.
- Tạo API gửi một/nhiều phiếu. Mỗi phiếu được xử lý trong transaction gồm kiểm tra quyền, tài khoản khách đang hoạt động, khóa phiếu, tạo thông báo trong ứng dụng, cập nhật người/giờ/lần gửi và audit. Gửi lại yêu cầu xác nhận riêng và khóa idempotency; một phiếu lỗi không dừng phiếu khác. Không gửi email/SMS/Zalo/push.
- Thêm API cấu hình lịch, lần chạy gần nhất, chi tiết phòng bỏ qua và lần chạy tiếp theo do server tính.
- Backend chặn thanh toán/công nợ/quá hạn của phiếu Nháp. Khi gửi, trạng thái thanh toán hiện tại được giữ và phiếu bắt đầu tham gia công nợ. Cần test việc hiển thị và báo cáo cho dữ liệu lịch sử.
- Cập nhật SRS từ quy tắc “tự lập và gửi” sang “tự lập Nháp, gửi thủ công” cùng tiêu chí nghiệm thu. Test MySQL 8 trên DB kiểm thử được phép; không chạy migration trên `phong_tro`.

## Ranh giới với dữ liệu hiện tại

Các phiếu lịch sử tháng 1–10/2026 đã có trạng thái thanh toán và `daGui` hiện hữu. Migration không đổi chúng. Giao diện hiển thị trạng thái phát hành từ `daGui`, trạng thái thanh toán từ `trangThai`; những phiếu cũ chưa gửi nhưng đã thanh toán được hiển thị đúng dữ liệu gốc, không tự chuyển thành Nháp hay sửa số tiền.
