# Backend audit — Hệ thống quản lý chuỗi phòng trọ

## Thông tin kiểm tra

| Thuộc tính | Giá trị |
|---|---|
| Ngày kiểm tra | 12/10/2026 |
| Phạm vi | `phong-tro-backend/` và database MySQL `phong_tro` |
| Nguồn đối chiếu | `data1.md`, `data2.md`, `SRS.md`, `system_design.md`, `api_contract.md` |
| Trạng thái tổng thể | **PASS có giới hạn** — backend khởi động, đọc dữ liệu và các API chính hoạt động với schema mới; các luồng ghi phá hủy/chỉnh sửa tài chính chưa chạy E2E trên database hiện tại |
| Database auto-sync | Tắt; `DB_SYNC` không được bật trong lần kiểm tra |

Tài liệu này là snapshot mới nhất và thay thế trạng thái backend cũ ghi ngày 04/10/2026 trong `audit/implementation_progress.md` và `audit/implementation_report.md` đối với phần schema/database.

## 1. Tình trạng schema và kết nối

- Backend đang kết nối `DB_NAME=phong_tro` trên MySQL.
- Kết nối và lệnh `SELECT 1+1` thành công.
- Database có đúng 25 bảng nghiệp vụ theo `data2.md`.
- Đã đối chiếu toàn bộ tên bảng và cột vật lý với model Sequelize: **25/25 bảng PASS**.
- Tổng số bản ghi được đọc khi kiểm tra: **631**.
- Model dùng khóa chuỗi 36 ký tự và ánh xạ snake_case trong code sang camelCase trong database qua thuộc tính `field`.
- Cột sinh `HopDong.maPhongDangThue` do MySQL quản lý; Sequelize không insert/update cột này.
- Không chạy migration, seed, `sequelize.sync()` hoặc thao tác sửa dữ liệu trong lần audit.

Model schema chuẩn hiện tại: `phong-tro-backend/src/models/schema.js`. Quan hệ model được đăng ký tại `phong-tro-backend/src/models/index.js`.

## 2. Thay đổi backend đã áp dụng

### Tài khoản và xác thực

- Đăng nhập đọc đúng `TaiKhoan.matKhauHash` và quan hệ `KhachThue.maTaiKhoan`.
- Trạng thái khóa dùng `DA_KHOA`, thay cho trạng thái legacy `TAM_DUNG`.
- JWT chứa đúng `ma_tai_khoan`, `ma_khach_thue`, `vai_tro` và cờ buộc đổi mật khẩu.
- Tạo tài khoản và gắn tài khoản vào hồ sơ khách được thực hiện trong cùng transaction.

### Căn, phòng, hợp đồng và cọc

- `CanTro`, `PhongTro`, `HopDong`, `TienCoc` dùng đúng tên bảng/cột và UUID của schema mới.
- Tạo hợp đồng đồng thời tạo hồ sơ `TienCoc` và chuyển phòng sang `DANG_THUE` trong transaction.
- Danh sách hợp đồng hỗ trợ giới hạn dữ liệu theo khách thuê.
- Trạng thái hợp đồng hợp lệ gồm `DANG_HIEU_LUC`, `SAP_HET_HAN`, `HET_HAN`, `DA_THANH_LY`.
- Cron job cập nhật trạng thái/cảnh báo hợp đồng sử dụng `ThongBao` mới.

### Điện và OCR

- Luồng điện dùng bảng `ChiSoDien`, kỳ được chuyển thành `thang` + `nam`.
- Hỗ trợ context kỳ, OCR preview, khách gửi chỉ số, Chủ trọ xem/sửa/xác nhận và nhập tay.
- OCR preview tạm được giữ trong bộ nhớ tiến trình vì `data2.md` không có bảng upload tạm.
- Ảnh được ánh xạ vào `anhCongToUrl`; trạng thái chỉ dùng `CHO_XAC_NHAN` và `DA_XAC_NHAN`.
- Đã sửa lỗi hợp đồng `SAP_HET_HAN` bị coi là không hoạt động. Khách có hợp đồng `DANG_HIEU_LUC` hoặc `SAP_HET_HAN` hiện truy cập được context nhập điện.

### Tài chính

- `ThanhToan` được dùng đúng nghĩa là nghĩa vụ/phải trả theo hợp đồng và kỳ.
- `ChiTietThanhToan` chứa các cấu phần tiền.
- `GiaoDichThanhToan` chứa từng lần thu; `KhoanThu` ghi nhận thu thực tế.
- Ghi nhận một lần thu, cập nhật tổng đã thu/còn nợ và tạo `KhoanThu` nằm trong cùng transaction.
- Chặn số tiền thu không dương hoặc vượt số còn nợ.
- Idempotency cho lần thu dùng ID xác định từ `billId + Idempotency-Key`, không cần bảng kỹ thuật ngoài `data2.md`.
- Báo cáo cashflow đọc `KhoanThu` hiệu lực và `KhoanChi`.

### Yêu cầu, sự cố và trả phòng

- `YeuCau` và ba subtype được ánh xạ đúng schema.
- Sự cố dùng đúng trạng thái `CHO_TIEP_NHAN`, `DANG_XU_LY`, `DA_XU_LY` và đúng các cột chi phí/bên chịu phí.
- Thành viên phòng dùng `ThanhVienPhong` và kiểm tra sức chứa.
- Quyết toán trả phòng dùng `BienBanTraPhong`, `KhoanKhauTru`, `TienCoc`, `HopDong` và `PhongTro` trong transaction.
- Thông báo dùng đúng `ThongBao.maTaiKhoan`, `daDoc`, `thoiDiemTao`.

## 3. Kết quả kiểm thử

### Unit và schema contract

Lệnh:

```powershell
Set-Location phong-tro-backend
npm test
```

Kết quả: **3/3 PASS**.

- BR-03: công thức cấu phần tiền không tạo tổng âm.
- BR-23: tiền nước dựa trên số người, không dùng OCR nước.
- Sequelize schema contract: đủ 25 bảng và toàn bộ cột trong `data2.md`.

### Kiểm tra cú pháp

- Chạy `node --check` cho toàn bộ `src/**/*.js`.
- Kết quả: **63/63 file PASS**.

### Smoke test HTTP và phân quyền

Backend khởi động thành công tại `http://127.0.0.1:3001` và đã được tắt sau kiểm thử.

| Nhóm | Kết quả |
|---|---|
| `GET /health` | 200 PASS |
| `GET /ready` | 200 PASS, database `up` |
| Đăng nhập Chủ trọ `chutro` | 200 PASS |
| Đăng nhập Khách thuê `0912000001` | 200 PASS |
| API không token | 401 PASS |
| Khách gọi API phòng chỉ dành cho Chủ trọ | 403 PASS |
| Profile Chủ trọ/Khách thuê | 200 PASS |
| Căn, phòng, khách thuê | 200 PASS |
| Hợp đồng, cọc | 200 PASS |
| Khoản phải thu, danh sách lần thu, công nợ | 200 PASS |
| Danh sách/context chỉ số điện | 200 PASS |
| Yêu cầu, sự cố, thành viên phòng | 200 PASS |
| Thông báo, thu chi, báo cáo cashflow | 200 PASS |

Tổng cộng đã gọi **29 trường hợp HTTP** gồm happy path và kiểm tra từ chối quyền. Một lỗi context điện với hợp đồng `SAP_HET_HAN` được phát hiện, sửa và kiểm thử lại thành công: HTTP 200, phòng `101`, kỳ `2026-10`, chỉ số trước `1370`.

## 4. Phần chưa kiểm thử

Các phần sau **chưa được xác nhận E2E trong lần audit này**:

- API tạo/sửa/xóa dữ liệu trên database `phong_tro` hiện tại.
- Ghi nhận thanh toán thật, rollback khi lỗi giữa `GiaoDichThanhToan` và `KhoanThu`.
- Hai request thanh toán/xác nhận điện chạy đồng thời.
- OCR FastAPI với ảnh thật, timeout 30 giây và dọn file tạm.
- Quyết toán trả phòng, khấu trừ cọc và các nhánh chi phí sự cố bằng HTTP E2E.
- Cron job khi chạy đúng thời điểm lịch.
- Kafka, outbox relay, consumer/replay và browser E2E frontend.

Các integration test cũ trong `phong-tro-backend/tests/*.integration.test.js` không được chạy vì chúng gọi HTTP và có thể ghi/xóa dữ liệu trong database đang dùng. Một số test cũng còn giả định schema/API legacy trước `data2.md`; cần chuyển sang database test riêng trước khi dùng lại.

## 5. Giới hạn và rủi ro còn lại

`data2.md` không có các bảng/cột kỹ thuật từng được dùng trong implementation cũ:

- `audit_log`, `outbox_event`, `idempotency_key`, `meter_upload`;
- `version`, `correctionRequested`, lịch sử revision chỉ số điện;
- trạng thái rút yêu cầu;
- trạng thái phòng `DA_GIU` và aggregate giữ phòng riêng.

Do đó:

- Endpoint yêu cầu chụp lại chỉ số không thể lưu cờ/lý do bền vững và hiện trả lỗi contract rõ ràng.
- OCR preview tạm mất khi backend restart.
- Chưa có audit/outbox/Kafka bền vững theo `system_design.md`.
- Không thể lưu thao tác rút yêu cầu an toàn theo miền trạng thái hiện tại.
- Các file model legacy vẫn còn trong thư mục `src/models`, nhưng `src/models/index.js` chỉ đăng ký schema chuẩn từ `schema.js`; không được import trực tiếp model legacy.

Để hoàn thiện các yêu cầu trên cần migration bổ sung được duyệt; không nên bật `DB_SYNC=true` để Sequelize tự sửa database.

## 6. Kết luận

Backend hiện đã tương thích cấu trúc 25 bảng của database `phong_tro`; frontend đã được nối với các luồng đọc và xác thực đã smoke-test. Trước khi nghiệm thu các luồng ghi tài chính/vòng đời, cần tạo database test riêng, cập nhật integration fixtures theo UUID/schema mới và chạy đầy đủ test transaction, concurrency, rollback và OCR.

## 7. Cập nhật tích hợp frontend — 12/10/2026

Đã chuẩn hóa `ApiClient`, cấu hình proxy Vite và ánh xạ lại tên trường frontend theo schema `data2.md`. Các màn hình hiện lấy dữ liệu thật gồm dashboard, căn/phòng, cư dân, hợp đồng, cọc, hóa đơn, công nợ, thanh toán, thu–chi, chỉ số điện, sự cố, thông báo, báo cáo, trả phòng và các màn hình chính của khách thuê.

Các lỗi luồng đã sửa:

- Form tạo phòng gửi đủ `so_phong`, `dien_tich`, `so_nguoi_toi_da` và `noi_that_mo_ta`.
- Form tạo khách thuê dùng `cccd_giay_to` thay cho tên trường schema cũ.
- Yêu cầu gia hạn tính và gửi `requestedEndDate`; trạng thái yêu cầu đọc từ `loai_yeu_cau`.
- Hóa đơn, thanh toán, thông báo, sự cố và thu–chi dùng đúng trường vật lý mới.
- Sửa thứ tự nạp script ở màn sự cố/thông báo khách thuê.
- Sửa lỗi đăng nhập HTTP 405 khi chạy frontend bằng Live Server: port `5500` gọi trực tiếp backend `:3001`; chỉ Vite port `4173` dùng proxy `/api`.
- Sửa điều hướng sidebar dưới base path `/phong-tro-frontend`: URL không còn bị ghép lặp khi click; menu Chủ trọ hiển thị đủ 16 mục và menu Khách thuê hiển thị theo đúng vai trò.
- Thay toàn bộ service frontend trả mảng giả bằng lời gọi API thực.
- Sửa lỗi phân quyền danh sách thanh toán: tenant trước đây nhận 45 dòng do outer join; sau sửa chỉ nhận 4 dòng thuộc tenant thử nghiệm, **0 dòng ngoài phạm vi**.

Kết quả xác minh sau tích hợp:

- `npm run build` frontend: **PASS**.
- Kiểm tra cú pháp toàn bộ JavaScript frontend/backend: **PASS**.
- Kiểm tra đường dẫn script trong HTML: **PASS**.
- Backend `npm test`: **3/3 PASS**.
- Smoke test API đọc dùng bởi frontend: **23/23 PASS** cho Chủ trọ và Khách thuê.
- Backend đã được tắt sau kiểm thử; không thực hiện thao tác ghi dữ liệu trong smoke test này.

Giới hạn còn lại: chưa chạy browser E2E tự động và chưa thao tác thử các form ghi dữ liệu trên database test riêng.
