# AGENTS.md — Bàn giao cho AI tiếp tục

Hệ thống quản lý chuỗi phòng trọ. Phạm vi đang làm: chức năng CHỦ TRỌ (backend `phong-tro-backend`, frontend `phong-tro-frontend`). Người dùng giao tiếp bằng TIẾNG VIỆT; báo cáo và commit message theo phong cách đã dùng (xem `git log`).

## 1. Nguồn chuẩn
- `SRS.md` v0.3 là chuẩn hiện hành. Khi lệch `phantich.md` thì theo SRS. Khi SRS mơ hồ ở điểm ảnh hưởng số tiền: DỪNG và hỏi người dùng, không tự suy đoán.
- `data2.md` = schema chuẩn (hiện 37 bảng); `chutro.md` mục 9 = trạng thái triển khai (chỉ ghi "Đã có" khi có tên test chứng minh).
- `docs/OCR_SETUP.md`: tích hợp OCR. README backend: cách chạy test và kiểm chứng MySQL 8.

## 2. Môi trường kiểm thử
- MySQL 8.0.46 trong container `qlpt-mysql8`, kết nối TCP cục bộ qua cổng 3307. MariaDB 10.4 qua TCP cục bộ cổng 3306. Triển khai thật là MySQL ≥ 8.0.16. Sandbox của Codex KHÔNG dùng được lệnh `docker`; chỉ dùng TCP. Lấy thông tin đăng nhập từ môi trường kiểm thử, không ghi vào tài liệu hoặc log.
- Biến test: `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`, `TEST_DB_NAME` (kết thúc `_test`/`_ci`), `MIGRATION_TEST_DB_NAME`, cùng các biến fixture `TEST_*` (xem README). Ở chế độ test, JWT tự bootstrap; ở production thiếu `JWT_SECRET`/`JWT_EXPIRE` thì khởi động thất bại.
- Mất kết nối DB: thử lại tối đa 5 lần cách nhau 10 giây rồi dừng, báo lỗi nguyên văn.
- TUYỆT ĐỐI không chạy migration lên database thật của người dùng; chỉ DB tạm/DB test.
- Frontend: sandbox từng lỗi `npm ci` với `EPERM spawn`. Người dùng tự `npm run build` ngoài sandbox. KHÔNG bao giờ báo "build pass" khi chưa chạy thật.

## 3. Mốc kiểm chứng gần nhất (cập nhật khi bàn giao)
- HEAD trước commit bàn giao: `4b3e94e5985a22f6ee0e7ce1ff10ee79e5a5eedd` | tag mới nhất: `checkpoint-before-f5-g3b`.
- Unit: 107/107 (lần chạy cuối sau test `innerHTML`) | Integration MySQL 8: 57/57 (lần chạy cuối trước commit test `innerHTML`; commit cuối chỉ thêm unit test).
- `scripts/check-invariants.js`: 19 nhóm, 0 vi phạm; chạy tự động cuối integration trước khi dọn DB, exit code 0 ở lần chạy 57/57.
- Migration 004 → 015 pass 2 lượt trên MySQL 8.0.46 và MariaDB 10.4.32, 37 bảng khớp `data2.md`. Chưa xác minh MySQL 8.0.16.
- Frontend build: người dùng xác nhận "build OK cho bản hiện tại" trước đợt F.5 Nhóm 3 bổ sung; CHƯA chạy hoặc xác nhận build sau Nhóm 3.
- Worktree trước commit bàn giao: không có file tracked sửa đổi; 9 đường dẫn untracked chủ ý gồm 6 model và 3 tài liệu cấu trúc (xem mục 4). Không stage, sửa hoặc xóa chúng.
- Quy tắc: mọi thay đổi không được làm giảm các mốc trên.

## 4. Quy tắc bắt buộc
- Không lệnh phá hủy (`reset --hard`, `clean`, `checkout .`, `stash drop`). Mỗi việc một commit `feat/fix/test/docs(FR-xxx)` đúng nhãn FR theo SRS; riêng commit bàn giao này dùng nhãn người dùng yêu cầu `docs: add AGENTS.md handoff`. Tạo tag `checkpoint-before-<việc>` trước đợt lớn.
- KHÔNG đụng file untracked chủ ý: sáu model `IdempotencyKey`, `MeterUpload`, `NguoiO`, `OutboxEvent`, `SuCo`, `YeuCau` (nháp/trùng schema chuẩn), ba tài liệu cấu trúc thư mục cũ, thư mục `OCR/` (dự án Python riêng, đã ignore).
- Nghiệp vụ nhiều bảng chạy trong MỘT transaction, kể cả audit và thông báo. Không dùng giá trị trạng thái ngoài miền DB.
- Migration: guard bằng `INFORMATION_SCHEMA` + prepared statement; KHÔNG `ADD COLUMN IF NOT EXISTS`; KHÔNG `CASE` trong CHECK (MySQL 8 từ chối, dùng `AND/OR` thuần); bỏ CHECK phải phát hiện engine (`DROP CHECK` cho MySQL, `DROP CONSTRAINT` cho MariaDB); tạo index mới trước khi drop index cũ (MySQL không cho drop index đang đỡ FK); chạy lặp được; đồng bộ `migration` + `schema.js` + `models/index.js` + `data2.md` + schema-contract test; kiểm chứng trên CẢ MySQL 8 và MariaDB NGAY khi viết. Cần bảng/cột mới: đề xuất DDL cho người dùng duyệt TRƯỚC.
- Cron: idempotent, có named lock qua helper chung `withNamedLock` (lấy và nhả trên CÙNG một kết nối, nhả trong `finally`, có timeout), cấu hình đọc từ `system-config` DB (fallback env/default).
- Thông báo: luôn tạo bằng INSERT với `khoaSuKien` và unique `(maTaiKhoan, khoaSuKien)`, bắt duplicate-key; KHÔNG đọc-rồi-ghi.
- Audit: dùng helper audit, TRONG transaction, không lưu mật khẩu/hash/token/định danh nhạy cảm; mỗi thao tác đúng một bản ghi.
- Test: mỗi test nằm trong file được commit; test race/bảo vệ dữ liệu phải có PHÉP THỬ PHỦ ĐỊNH (vô hiệu hóa mã được kiểm tra, xác nhận test đỏ, khôi phục). Không nới test cho qua; lỗi thật thì sửa nguyên nhân gốc.
- Báo cáo trung thực: nêu rõ cái gì chưa chạy. Mọi khẳng định "ĐÃ CÓ" kèm tên file test hoặc hash commit.

## 5. Quyết định nghiệp vụ ĐÃ CHỐT (không đổi nếu chưa hỏi người dùng)
- `POST /api/hop-dong/:id/renew` bị khóa; gia hạn chỉ qua yêu cầu 6/12 tháng, hợp đồng phải `SAP_HET_HAN`.
- Khách không tự hủy yêu cầu trả phòng (SM-05); chỉ Chủ trọ rút duyệt có lý do. Duyệt trả phòng chỉ lưu ngày; cron chuyển phòng `DANG_XU_LY_TRA_PHONG` đúng ngày trả.
- Sự cố khách chịu chi phí đi qua `ChiPhiSuCoKhachThue` → `KhoanKhauTru` lúc quyết toán, không cộng vào phiếu đang mở.
- Giữ luồng xác nhận minh chứng thanh toán.
- Chỉ nhận chỉ số ĐIỆN cuối; nước = đơn giá × số người × tỷ lệ ngày (người đứng tên + người ở cùng `DANG_O`). Không có chỉ số nước (FR-098, BR-23, CON-04).
- Kỳ T = tháng phát hành (tiền phòng, nước của T; điện của T−1). 05/T nhắc, 06/T quá hạn, từ ngày 11 ghi nhận công nợ (snapshot, không đóng băng số dư, không phí phạt/khóa phòng). "Đang quá hạn" là giá trị SUY RA (`quaHan` và còn nợ).
- Điều chỉnh giảm vượt dư nợ: 409, không tạo số dư có. Điều chỉnh là append-only (BR-27/47).
- Số âm cho `GIAM_TRU`/`DIEU_CHINH_GIAM`; bất biến tổng đại số: tổng phải trả = Σ dòng chi tiết (có dấu).
- Doanh thu: khấu trừ cọc TÍNH vào doanh thu (nguồn duy nhất `BienBanTraPhong`, không cộng lại giao dịch `KHAU_TRU_COC`); cọc hoàn lại không phải doanh thu/chi phí; đặt cọc không tạo `KhoanThu`; tiền giữ phòng không hoàn lại tạo `KhoanThu`. Ghi nhận khấu trừ cọc theo ngày quyết toán.
- Báo cáo (`GET /api/v1/reports/cashflow`): `totalRevenue` = `totalCollected` = tiền THỰC NHẬN (Σ KhoanThu hiệu lực + khấu trừ cọc); `grossRevenue = totalRevenue + discounts`; `profit = totalRevenue − totalExpenses`. Phân bổ giảm trừ được SNAPSHOT trên `KhoanThu` (`doanhThuGop`, `giamTruPhanBo`, `nguonSnapshot` = `GHI_NHAN`|`SUY_DIEN`) nên báo cáo lịch sử KHÔNG đổi khi điều chỉnh phiếu về sau. `byBuilding` có `inComparison` (căn ngừng hoạt động vẫn hiện nhưng không vào so sánh).
- Giữ phòng quá hạn CHỈ thông báo Chủ trọ; phòng vẫn `DA_GIU`, hồ sơ vẫn `DANG_GIU`; phòng chỉ về `TRONG` khi Chủ trọ hủy hoặc chuyển thành hợp đồng (`DA_CHUYEN_THANH_HOP_DONG`).
- Khóa idempotency thanh toán: gắn nội dung; cùng khóa khác nội dung → 409 `IDEMPOTENCY_CONFLICT`; hai khóa khác nhau cùng phiếu được ghi nếu tổng ≤ dư nợ, vượt → 409 `PAYMENT_EXCEEDS_OUTSTANDING`.

## 6. Việc ĐÃ XONG (tóm tắt, chi tiết xem `chutro.md` mục 9 và `git log`)
Giai đoạn 0, B (lịch sử hợp đồng 010, chuyển phòng 011), C (rút duyệt, ngày trả, quyết toán 012), D (phiếu thu, công nợ, 013), E (cấu hình DB, token ảnh điện ký HMAC, audit đầy đủ, thông báo khóa sự kiện 014, validation), F.0–F.4 (báo cáo BR-44 + snapshot 015, người ở cùng, giữ phòng, OCR Chủ trọ), tương thích MySQL 8, F.5 Nhóm 1 (quyết toán, phiếu thu), Nhóm 2 (công nợ, báo cáo), vá tham số kỳ báo cáo trả 400, hai lần thu một phần. F.5 Nhóm 3: ba API đọc và UI tương ứng, test ranh giới giờ Việt Nam và bộ quét `innerHTML` (xem mục 7); chưa có xác nhận build sau Nhóm 3.

## 7. VIỆC ĐANG LÀM DỞ (làm tiếp từ đây)
F.5 Nhóm 3 đã hoàn tất phần được duyệt, CHỜ người dùng xác nhận "build nhóm 3 OK" trước khi làm tiếp. Không tự bắt đầu nhóm/giai đoạn mới.
1. API chi tiết đề xuất người ở cùng và UI duyệt sau khi đối chiếu định danh: `3f2715c`, `de8bd02`; test `co-tenant-detail.*` và `frontend-f5g3-cotenants.test.js`.
2. DTO `readingType` bốn loại và UI nhãn tiếng Việt: `1a8ba8f`, `fb0e4d7`; test `meter-reading-types.*`, `frontend-f5g3-meter.test.js`.
3. Giữ phòng: lịch sử gia hạn, báo giá hoàn chung hàm với hủy, 409 khi `expectedRefundAmount` lệch, UI xác nhận: `a17f861`, `97cb88b`; test `reservation-read.*`, `frontend-f5g3-reservations.test.js`.
4. Ranh giới tháng báo cáo/cron giờ Việt Nam và quét `innerHTML`: `127f5b1`, `4b3e94e`; test `report-vietnam-boundary.test.js`, `frontend-innerhtml-safety.test.js`. Bộ quét hiện là kiểm tra tĩnh theo mẫu, không thay thế kiểm thử XSS runtime.
5. Rủi ro cần xin quyết định: các thao tác ghi cũ `create/extend` giữ phòng và luồng duyệt người ở cùng chưa được mở rộng kiểm tra cùng quyền sở hữu như các API đọc mới và hủy giữ phòng. Người dùng đã được hỏi nhưng chưa trả lời. Không tự sửa lan sang backend trước khi có chỉ thị.
Mốc tiếp tục: unit ≥ 107, integration ≥ 57. Bản Nhóm 3 chưa được người dùng xác nhận build; dừng chờ.

## 8. Việc CÒN LẠI SAU NHÓM 3 (theo thứ tự đề xuất)
- Giai đoạn G: in hợp đồng (FR-184), xuất Excel báo cáo (FR-194), liên kết sự cố mới/cũ.
- Màn hình cấu hình hệ thống (FR-200).
- Dọn cuối: `npm audit` (backend 14, frontend 3 cảnh báo; chỉ `npm audit fix` không `--force`, trên nhánh riêng), xử lý dữ liệu hoàn cọc legacy (không tự bịa giao dịch hoàn), thu hồi token/logout phía server, xác minh bản tối thiểu MySQL 8.0.16.
- Nghiệm thu tổng: clone sạch từ HEAD (`npm ci` backend, unit, integration, `check-invariants`, verify-migrations hai lượt trên cả hai engine, cron seed legacy 18 hợp đồng/30 phòng/21 tài khoản hai lượt, `git diff --check`); người dùng build frontend; cập nhật `chutro.md` mục 9 lần cuối.

## 9. Cách làm việc với người dùng
- Làm theo từng giai đoạn, DỪNG đúng điểm đã hẹn, báo cáo bằng bảng: FR | File | Mô tả | Test | Trạng thái, kèm mốc test trước/sau, hash commit, lỗi thật phát hiện, mục còn thiếu, câu hỏi cần quyết định.
- Nếu một chỉ thị của người dùng mâu thuẫn với SRS, làm theo SRS và nêu lệch (từng có trường hợp chỉ thị sai về giữ phòng quá hạn). Thà dừng hỏi còn hơn tự suy đoán số liệu tiền.
- Có thể dùng lại skill/kinh nghiệm: sai lầm đã gặp gồm CHECK dùng `CASE` (MySQL 8 lỗi), `include` trùng thuộc tính trong một object Sequelize (bị ghi đè), `GET_LOCK` gắn kết nối, clone sạch thiếu `.env`.
