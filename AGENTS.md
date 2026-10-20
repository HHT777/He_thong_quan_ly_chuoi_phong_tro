# AGENTS.md — Bàn giao cho AI tiếp tục

## Cập nhật hiện hành G3 (19/10/2026; ưu tiên hơn các mốc lịch sử bên dưới)

- Nhánh làm việc: `giai-doan-g3-xuat-excel`, HEAD mã/test đã kiểm chứng `3e32798` (sau `d26bb9a`, `5acc9f5` và mốc `163525c`); không merge nhánh này vào `main` trong lượt này. Khi bắt đầu lượt, `main` đã có merge `c0b4d7f` từ bên ngoài; commit docs bàn giao đứng sau HEAD mã/test này.
- G1 in hợp đồng FR-184 đã merge (`cb10ff3`); G2 liên kết sự cố FR-192, migration 016 đã merge (`b7b69fd`); G3 cashflow Excel FR-194 đang hoàn thiện.
- Mốc trước bổ sung: unit 136/136, integration 71/71, 26 nhóm bất biến 0. Mốc sau bổ sung trên MySQL 8 TCP `qlpt_authz_test`: unit 137/137, integration 72/72, 28 nhóm bất biến 0 ở seed và sau integration. Test Python độc lập kiểm tra OPC/SpreadsheetML mẫu đã chạy xanh; frontend build và mở Excel/LibreOffice chưa chạy.
- Quyết định chi phí `KhoanChi.maCan IS NULL`: đúng một `ChuTro` thì tính vào `totalExpenses`/`profit` toàn chuỗi như trước G3; từ hai `ChuTro` trở lên không phân cho ai, trả `unassignedExpenses: {count,total}` riêng trong JSON/Excel/màn hình. Đây là quyết định P2 cần chốt lại trước khi bật nhiều Chủ trọ. Báo cáo lọc một căn không phân khoản NULL vào căn đó.
- Việc còn lại: xuất Excel công nợ UC-23 và RPT-01…06 (Could, chưa làm); Prompt 3 màn hình cấu hình FR-200; Prompt 4 dọn cuối; Prompt 5 nghiệm thu tổng. Người dùng tự build frontend và tự mở Excel/LibreOffice; sandbox không được báo đạt cho hai việc đó.

Hệ thống quản lý chuỗi phòng trọ. Phạm vi đang làm: chức năng CHỦ TRỌ (backend `phong-tro-backend`, frontend `phong-tro-frontend`). Người dùng giao tiếp bằng TIẾNG VIỆT; báo cáo và commit message theo phong cách đã dùng (xem `git log`).

## 1. Nguồn chuẩn
- `SRS.md` v0.3 là chuẩn hiện hành. Khi lệch `phantich.md` thì theo SRS. Khi SRS mơ hồ ở điểm ảnh hưởng số tiền: DỪNG và hỏi người dùng, không tự suy đoán.
- `data2.md` = schema chuẩn (hiện 37 bảng); `chutro.md` mục 9 = trạng thái triển khai (chỉ ghi "Đã có" khi có tên test chứng minh).
- `docs/OCR_SETUP.md`: tích hợp OCR. README backend: cách chạy test và kiểm chứng MySQL 8.

## 2. Môi trường kiểm thử
- MySQL 8.0.46 trong container `qlpt-mysql8`, kết nối TCP cục bộ qua cổng 3307. MariaDB 10.4 qua TCP cục bộ cổng 3306. Triển khai thật là MySQL ≥ 8.0.16. Lấy thông tin đăng nhập từ môi trường kiểm thử, không ghi vào tài liệu hoặc log.
- Biến test: `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`, `TEST_DB_NAME` (kết thúc `_test`/`_ci`), `MIGRATION_TEST_DB_NAME`, cùng các biến fixture `TEST_*` (xem README). Ở chế độ test, JWT tự bootstrap; ở production thiếu `JWT_SECRET`/`JWT_EXPIRE` thì khởi động thất bại.
- Mất kết nối DB: thử lại tối đa 5 lần cách nhau 10 giây rồi dừng, báo lỗi nguyên văn.
- TUYỆT ĐỐI không chạy migration lên database thật của người dùng; chỉ DB tạm/DB test.
- AN TOÀN: chỉ thao tác trên DB tạm/DB test (tên kết thúc `_test`/`_ci`). TUYỆT ĐỐI không chạy migration, seed hay lệnh xóa lên DB dev/thật của người dùng. Trước mọi lệnh có thể xóa dữ liệu hoặc ghi đè (`DROP`, `TRUNCATE`, `rm -rf`, `git reset --hard`, `git clean`, `git checkout .`, `docker rm`, `docker volume rm`) PHẢI hỏi người dùng trong chat.
- Không commit/push lên nhánh chính khi chưa được hỏi. Không `git push`. Làm trên nhánh riêng nếu người dùng yêu cầu.
- Không in hoặc commit bí mật (`.env`, JWT secret, mật khẩu thật).
- Riêng lượt authz đã được duyệt reset DUY NHẤT `qlpt_authz_test` qua TCP `127.0.0.1:3307`; kiểm tra chính xác và log tên DB/host/cổng trước mỗi `DROP`/`CREATE`. DB khác vẫn phải hỏi.

### Khi chạy trong IDE
- Agent chạy trực tiếp trên máy người dùng có thể dùng `docker`, `npm ci`, `npm run build` và đọc log. Phải tự chạy frontend build và báo kết quả hoặc lỗi nguyên văn; không báo đạt khi chưa chạy.
- Nếu container kiểm thử dừng, có thể khởi động lại bằng công cụ IDE phù hợp rồi đợi DB sẵn sàng. Không dùng thao tác xóa container hoặc volume khi chưa hỏi người dùng.

### Khi chạy trong sandbox Codex
- KHÔNG dùng lệnh `docker`; chỉ kết nối DB qua TCP cục bộ. Mất kết nối thì thử lại tối đa 5 lần cách nhau 10 giây rồi dừng, báo lỗi nguyên văn.
- Sandbox từng gặp `npm ci` frontend lỗi `EPERM spawn`; người dùng tự `npm run build` ngoài sandbox. Không báo "build pass" khi chưa chạy thật; báo rõ file frontend đã đổi.

## 3. Mốc kiểm chứng gần nhất (cập nhật khi bàn giao)
- HEAD trước commit docs cập nhật này: `396c096` | nhánh `authz` | tag mốc `checkpoint-before-authz`.
- Unit: 118/118 | Integration MySQL 8: 62/62 không lọc (`AUTHZ_GROUP`/`AUTHZ_ROUTE` không đặt). Riêng 26/26 route authz đỏ khi vô hiệu hóa guard theo từng request, khôi phục xanh; owner-regression 3/3.
- `scripts/check-invariants.js`: 26 nhóm, 0 vi phạm ở DB seed và sau integration 62/62 trên `qlpt_authz_test` qua TCP.
- Migration 004 → 015 pass 2 lượt trên MySQL 8.0.46 và MariaDB 10.4.32, 37 bảng khớp `data2.md`. Chưa xác minh MySQL 8.0.16.
- Frontend build: người dùng xác nhận "build OK cho bản hiện tại" trước đợt F.5 Nhóm 3 bổ sung; CHƯA chạy hoặc xác nhận build sau Nhóm 3.
- Worktree trước commit docs: chỉ `AGENTS.md`, `chutro.md` đang sửa có chủ đích; 10 đường dẫn untracked chủ ý gồm 6 model, 3 tài liệu cấu trúc và `docs/TASK_AUTHZ.md`. Không stage, sửa hoặc xóa chúng.
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
- Mô hình có nhiều Chủ trọ: căn thuộc `CanTro.maChuTro`; tài nguyên suy chủ sở hữu qua căn/phòng/hợp đồng. ID không tồn tại và ID thuộc Chủ trọ/khách khác cùng trả HTTP 404, mã `RESOURCE_NOT_FOUND`, không lộ ID; sai vai trò trả 403. Loại tài nguyên chưa khai báo phải từ chối mặc định (500 mã `OWNERSHIP_RESOURCE_UNMAPPED` và log), không cho qua. Route mới phải khai báo phạm vi sở hữu và có test với hai Chủ trọ. Quyết định này không cho phép tự thay đổi nghiệp vụ tiền hoặc DDL.
- Route mới phải thêm một dòng trong `docs/AUTHZ_MATRIX.md`; `tests/authz-route-manifest.test.js` sẽ đỏ nếu khai báo route thay đổi mà ma trận chưa được cập nhật. Route P2-2/P2-3 chưa được coi an toàn cho nhiều Chủ trọ.

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
Đã hoàn tất phạm vi authz Giai đoạn 1; dừng chờ người dùng duyệt, không làm Giai đoạn G. Bằng chứng đỏ trước vá: `ae53e8d`, `0239855` (26 route manifest + 2 trường hợp khách, 28 route đỏ). `tests/authz-phase1.integration.test.js` chạy không lọc đã xanh 26 route; `tests/authz-route-manifest.test.js` khóa 117 chữ ký route. Sau mỗi nhóm đã chạy unit + integration đầy đủ và phép thử phủ định.
1. Đã xong nhóm hợp đồng/chuyển phòng `60c7962` (FR-035/041): Chủ trọ A không thể đọc/sửa/chuyển hợp đồng hoặc tạo hợp đồng bằng phòng của B; danh sách hợp đồng được lọc theo căn sở hữu. Test riêng nhóm hợp đồng 0 đỏ, phép thử phủ định bỏ `getHopDongById` check đã đỏ, khôi phục xanh.
2. Đã xong nhóm cọc `3745649` (FR-043/044): tạo cọc trên hợp đồng B, xác nhận/hủy/đọc cọc B bị 404 như ID không tồn tại; danh sách chỉ chứa cọc của A. Phép thử phủ định bỏ `getDatCocById` check cho ra 200 khi A xem/xác nhận/hủy cọc B, có thay đổi `TienCoc`; khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
3. Đã xong nhóm phiếu thu `3bf4ae6` (FR-144): đọc/tạo/list phiếu và preview/generate chỉ trên hợp đồng thuộc A; danh sách A+B hoặc A+ID không tồn tại bị 404 trước mọi ghi. Phép thử phủ định bỏ preflight trong `billGeneration.service.js` khiến preview 200/generate 201 với danh sách trộn; khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
4. Đã xong nhóm thanh toán `2223786` (FR-073/079): tạo/xác nhận/hủy/đọc/list/stats và mark-paid/mark-all kiểm tra sở hữu. Nhóm test payment 5 route + stats, 0 đỏ sau vá; phép thử phủ định bỏ kiểm tra hủy khiến A hủy lần thu B và đổi 4 bảng, khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
5. Đã xong nhóm điều chỉnh/giảm trừ `71ee3fe` (FR-164/175): chi tiết phiếu và KhoanDieuChinh theo chủ sở hữu; list định kỳ không chứa B, filter hợp đồng B bị 404. Phép thử phủ định bỏ check ở `billAdjustment.service.js`: A giảm trừ/điều chỉnh phiếu B, đổi ThanhToan, AuditLog, ChiTietThanhToan; khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
6. Đã xong nhóm tài khoản khách `5041074` (FR-002/007): tạo, khóa, reset chỉ trên khách của A; sửa import `TaiKhoan` còn thiếu trong ownership mapper. Phép thử phủ định bỏ check reset: A reset mật khẩu tài khoản B, đổi TaiKhoan và AuditLog; khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
7. Đã xong nhóm quyết toán `481a9e9` (FR-096/187): context và settle chỉ trên hợp đồng thuộc Chủ trọ; A truy cập B và ID không tồn tại đều 404. Phép thử phủ định bỏ check settle: A quyết toán hợp đồng B, đổi 7 bảng, khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
8. Đã xong nhóm hoàn cọc `354b895` (FR-188): kiểm tra chủ sở hữu biên bản trước tra khóa idempotency. Phép thử phủ định bỏ check: A hoàn cọc B, đổi TienCoc, AuditLog, GiaoDichHoanCoc; khôi phục xanh. Sau nhóm: unit 116/116, integration 58/58, 26 bất biến 0.
9. Test manifest route và `docs/AUTHZ_MATRIX.md` đã mở rộng `396c096`: 117 route = 38 G1 + 56 P2-2 + 21 P2-3 + 2 N/A. `3f07247` thêm preloader chỉ trong test để thử riêng 26/26 guard, tất cả đỏ khi bỏ guard và request đối chứng vẫn 404; `8b2e1c2` thêm 3 hồi quy 2xx của chính Chủ trọ. Mốc sau cùng: unit 118/118, integration 62/62, 26 nhóm bất biến 0.
10. Thông báo giữ phòng quá hạn, hợp đồng sắp/hết hạn và broadcast đã sửa phạm vi người nhận theo chủ sở hữu `1bb2fc7` (FR-159); test `notification-ownership.integration.test.js` hai Chủ trọ, khóa sự kiện không trùng và 3 phép thử phủ định đỏ. `GET /debt` vá `aa0acf6` (FR-165), `GET /move-outs` vá `282d06b` (FR-096). Các route P2-2/P2-3 khác, đặc biệt `GET /reports/cashflow`, chưa được xác nhận an toàn nhiều Chủ trọ; trước khi bật P2 phải xử lý ma trận.
11. Frontend đổi đúng hai client: `src/core/api.js`, `assets/js/services/apiClient.js` trong `282f5f3`, chỉ 404 `RESOURCE_NOT_FOUND` đổi thông điệp; test `frontend-authz-errors.test.js`. Frontend build **chưa chạy trong sandbox**, chờ người dùng build/xác nhận. Không làm Giai đoạn G trước xác nhận đó. Mốc tiếp tục: unit ≥ 117, integration ≥ 58, 26 bất biến 0.

## 8. Việc CÒN LẠI SAU NHÓM 3 (theo thứ tự đề xuất)
- Giai đoạn G: in hợp đồng (FR-184), xuất Excel báo cáo (FR-194), liên kết sự cố mới/cũ.
- Màn hình cấu hình hệ thống (FR-200).
- Dọn cuối: `npm audit` (backend 14, frontend 3 cảnh báo; chỉ `npm audit fix` không `--force`, trên nhánh riêng), xử lý dữ liệu hoàn cọc legacy (không tự bịa giao dịch hoàn), thu hồi token/logout phía server, xác minh bản tối thiểu MySQL 8.0.16.
- Nghiệm thu tổng: clone sạch từ HEAD (`npm ci` backend, unit, integration, `check-invariants`, verify-migrations hai lượt trên cả hai engine, cron seed legacy 18 hợp đồng/30 phòng/21 tài khoản hai lượt, `git diff --check`); người dùng build frontend; cập nhật `chutro.md` mục 9 lần cuối.

## 9. Cách làm việc với người dùng
- Làm theo từng giai đoạn, DỪNG đúng điểm đã hẹn, báo cáo bằng bảng: FR | File | Mô tả | Test | Trạng thái, kèm mốc test trước/sau, hash commit, lỗi thật phát hiện, mục còn thiếu, câu hỏi cần quyết định.
- Nếu một chỉ thị của người dùng mâu thuẫn với SRS, làm theo SRS và nêu lệch (từng có trường hợp chỉ thị sai về giữ phòng quá hạn). Thà dừng hỏi còn hơn tự suy đoán số liệu tiền.
- Có thể dùng lại skill/kinh nghiệm: sai lầm đã gặp gồm CHECK dùng `CASE` (MySQL 8 lỗi), `include` trùng thuộc tính trong một object Sequelize (bị ghi đè), `GET_LOCK` gắn kết nối, clone sạch thiếu `.env`.
