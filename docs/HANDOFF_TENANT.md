# Bàn giao phát triển giao diện Khách thuê

**Ngày:** 22/10/2026

**Mốc mã đã đọc:** `cda8ba3` trên nhánh `ui-2a-giao-dien`

**Phạm vi:** các màn có vai trò `KHACH_THUE` và API phục vụ chính khách đang đăng nhập. Tài liệu này mô tả hiện trạng để tiếp tục làm việc, không phải xác nhận đã nghiệm thu các use case.

## 1. Đọc trước khi sửa

1. `AGENTS.md`: quy tắc làm việc, an toàn database, các quyết định nghiệp vụ đã chốt.
2. `SRS.md` v0.3: nguồn yêu cầu chính. Phần Khách thuê: UC-01, UC-07…09, UC-12…14, UC-18, UC-24/25; xem thêm UC-28 cho đề xuất người ở cùng.
3. `data2.md`: schema chuẩn 37 bảng; `chutro.md` mục 9 là trạng thái triển khai có bằng chứng.
4. `phong-tro-frontend/README.md`, `phong-tro-backend/README.md`, `docs/OCR_SETUP.md`, `docs/AUTHZ_MATRIX.md`.

Frontend hiện hành là Vite SPA: `phong-tro-frontend/index.html` → `src/main.js` → `src/core/router.js`. Các thư mục frontend nguyên mẫu `pages/`, `assets/`, `components/` đã bị bỏ; không lấy chúng làm điểm vào hay sao chép lại luồng cũ.

## 2. Chạy local và đăng nhập

Trong hai terminal riêng:

```powershell
cd phong-tro-backend
npm ci
npm run dev
```

```powershell
cd phong-tro-frontend
npm ci
npm run dev
```

Mở `http://localhost:4173`. Vite proxy `/api` và `/health` sang backend `localhost:3001`. Frontend **không có** script `npm start`; lệnh đó chỉ có ở backend. Backend cần `.env` riêng và database có schema phù hợp; không đưa `.env` vào Git.

`data2.md` khai báo tài khoản **dữ liệu mẫu** `0912000001` / `Demo@123` thuộc vai trò `KHACH_THUE`. Đây không phải bảo đảm mật khẩu của database phát triển đang chạy, vì tài khoản có thể đã được đổi/reset. Fixture integration dùng tài khoản test riêng từ `phong-tro-backend/test.env.template` và chỉ tồn tại khi test chạy.

## 3. Vị trí mã và cách nối API

| Phần | File chính | Ghi chú |
|---|---|---|
| Đăng nhập, điều hướng theo vai trò | `src/main.js`, `src/core/session.js`, `src/core/router.js`, `src/core/module-registry.js` | `KHACH_THUE` vào mặc định `/#/tenant/rental-info`; tab được tìm tự động từ `src/modules/**/*.tab.js`. |
| API client | `src/core/api.js` | Base `/api`, tự gắn Bearer token; dùng `context.api`, `postForm` cho ảnh. Xử lý cả lỗi HTTP và `success: false`. |
| Khung, menu, chuông | `src/layout/app-shell.js` | Cần kiểm tra route chuông riêng cho Khách thuê, xem mục 4. |
| Màn Khách thuê | `src/modules/tenant/*.tab.js` | Mỗi tab khai báo `roles: ["KHACH_THUE"]` và `route`. |
| Thành phần giao diện | `src/shared/components/view.js`, `tab-factory.js`; CSS trong `src/shared/styles/` | Escape dữ liệu từ API trước khi gán HTML; giữ trạng thái tải/lỗi/thử lại. |
| API backend | `phong-tro-backend/src/app.js`, `src/routes/{auth,tenant,meterReading,mvp,khoanPhaiThu}.routes.js` | `app.js` gắn `/api`, `/api/v1`, `/api/auth`, `/api/khoan-phai-thu`. Đọc route và service trước khi gửi payload. |

API cho Khách thuê phải lấy dữ liệu theo `req.user`, hợp đồng/phòng của chính họ. Không tin `tenantId`, `roomId` hoặc `contractId` client gửi nếu chưa kiểm tra quyền sở hữu. ID không tồn tại và ID của khách khác phải có cùng phản hồi 404 `RESOURCE_NOT_FOUND` theo chính sách authz.

## 4. Hiện trạng màn hình và việc cần làm

| Màn hiện có | Route SPA / API đang gọi | Hiện trạng cần lưu ý |
|---|---|---|
| Thông tin thuê (`rental-info.tab.js`) | `/#/tenant/rental-info` → `GET /api/auth/profile` | Mới hiện tài khoản, trạng thái, tên và SĐT. UC-07 còn cần hợp đồng, phòng, điều khoản, thay đổi đơn giá, vi phạm và chi tiết cọc của chính khách. |
| Khoản phải trả (`tenant-finance.tab.js`) | `/#/tenant/finance` → `GET /api/khoan-phai-thu?limit=100` | Mới là bảng tổng. Đối chiếu UC-12: chi tiết kỳ hiện tại/kỳ trước, từng khoản, lịch sử thanh toán, dư nợ, minh chứng ở `CHO_XAC_NHAN`. Không tự đổi số đã thu khi khách gửi minh chứng. Có `GET /api/v1/debt` lọc theo khách đang đăng nhập. |
| Chỉ số điện (`tenant-meter.tab.js`) | `/#/tenant/meter` → `POST /api/v1/me/meter-readings` | Form hiện chỉ gửi `period` và `readingValue`, nên bản ghi có thể không có ảnh. API cho phép submit không token, nhưng muốn gắn ảnh đúng luồng UC-09 phải lấy `uploadToken` từ `POST /api/v1/me/meter-reading-ocr-previews` (multipart ảnh). `GET /api/v1/me/meter-reading-context` trả bối cảnh kỳ và chỉ số trước. Cần hoàn thiện luồng xem kỳ/chỉ số trước → chọn ảnh → xem OCR → sửa tay nếu cần → xác nhận gửi với `Idempotency-Key`. Xem `tests/meter-reading.integration.test.js`. Chỉ có chỉ số **điện**, không nhập chỉ số nước. |
| Báo sự cố (`tenant-incidents.tab.js`) | `/#/tenant/incidents` → `POST /api/v1/incidents` | Form đang yêu cầu khách tự nhập `roomId`. Cần lấy phòng từ hợp đồng của họ, hiển thị danh mục/trạng thái và xử lý ảnh theo UC-18; kiểm tra API `GET /api/v1/incident-categories`, `GET /api/v1/incidents`. Mức ưu tiên hợp lệ: `THAP`, `TRUNG_BINH`, `CAO`, `KHAN_CAP`. |
| Gia hạn / trả phòng (`tenant-requests.tab.js`) | `/#/tenant/requests` → `POST /api/v1/requests` | Form chỉ có ô loại dạng chữ, ngày kết thúc đề xuất và nội dung. API nhận `GIA_HAN` hoặc `TRA_PHONG`; trả phòng còn cần `date`/`expectedMoveOutDate` và có thể cần `earlyReturnReason`. Cần lựa chọn rõ 6/12 tháng, kiểm tra trạng thái hợp đồng và yêu cầu chờ, theo dõi kết quả từ `GET /api/v1/requests`. Gia hạn chỉ qua yêu cầu; không gọi `/api/hop-dong/:id/renew`. |
| Thông báo (`notifications/inbox.tab.js`) | Tab thật `/#/notifications/inbox` → `GET /api/v1/notifications` | Tab cho cả hai vai trò. Trong `app-shell.js`, chuông Khách thuê lại trỏ tới `/#/tenant/notifications` nhưng chưa có tab route này; router có thể đưa về trang mặc định. Cần thống nhất route và cho đánh dấu đọc qua `PATCH /api/v1/notifications/:id/read`. |
| Đề xuất người ở cùng | Chưa có tab Khách thuê | Backend có `POST /api/v1/co-tenants`, `GET /api/v1/co-tenants`, `GET /api/v1/requests`. UC-08 yêu cầu đủ họ tên, SĐT, giấy tờ, ngày sinh, giới tính, thường trú, quan hệ, ngày bắt đầu ở; Chủ trọ mới duyệt. Người ở cùng không có tài khoản riêng. |

Các dòng trên là kết quả đọc mã ngày bàn giao. **Chưa kiểm tra trực quan hoặc chạy E2E** cho từng màn Khách thuê trong lượt tạo tài liệu này. Khi làm, đối chiếu payload thực với route/service và test; không suy ra rằng một API đã hoàn chỉnh chỉ vì có endpoint.

## 5. Quy tắc nghiệp vụ cần giữ

- Khách chỉ thấy dữ liệu tài khoản, phòng, hợp đồng, phiếu thu, chỉ số, yêu cầu, sự cố và thông báo thuộc mình. Vai trò phía giao diện không thay thế kiểm tra quyền ở backend.
- Gia hạn qua yêu cầu 6/12 tháng khi hợp đồng đủ điều kiện. Trả phòng thông thường báo trước 30 ngày; trường hợp sớm cần lý do để Chủ trọ duyệt. Khách không tự rút duyệt yêu cầu trả phòng đã được Chủ trọ duyệt.
- Thanh toán tiền thực tế diễn ra ngoài hệ thống. Ảnh minh chứng do khách gửi chỉ là `CHO_XAC_NHAN`; số tiền đã thu thay đổi khi Chủ trọ ghi nhận/xác nhận theo nghiệp vụ.
- Điện cuối kỳ: ảnh → OCR gợi ý → khách đối chiếu/sửa tay → gửi chờ Chủ trọ xác nhận. Nước tính theo đơn giá × số người ở × tỷ lệ ngày, không có ảnh/chỉ số nước.
- Yêu cầu, sự cố, minh chứng có dữ liệu nhạy cảm; hiển thị an toàn, không đưa CCCD, token hay mật khẩu vào log/audit. Mọi ghi nhiều bảng phải trong một transaction.
- SRS v0.3 có ưu tiên hơn `phantich.md`. Điểm nào ảnh hưởng công thức tiền hoặc schema mà tài liệu chưa rõ thì hỏi người phụ trách trước khi sửa.

## 6. Kiểm chứng và phối hợp

- Frontend: `npm run build` trong `phong-tro-frontend`; test: `node --test tests/*.test.mjs`. Báo kết quả thật trước khi bàn giao. Người dùng muốn được báo khi cần build frontend, thay backend hoặc merge.
- Backend unit: `npm run test:unit`. Integration chỉ dùng DB test được duyệt `qlpt_authz_test` qua `127.0.0.1:3307`, với allowlist chính xác; runner có thể **xóa và dựng lại** DB test. Không chạy seed, migration, sync hoặc lệnh xóa trên DB phát triển `phong_tro`/MariaDB 3306.
- Route backend mới phải cập nhật `docs/AUTHZ_MATRIX.md`, test sở hữu giữa hai Chủ trọ/hai khách và phản hồi 404 không lộ ID. Kiểm tra `tests/authz-route-manifest.test.js`.
- Phối hợp trên nhánh riêng nếu được phân công; không ghi đè CSS hộp thoại in đang sửa dở ở `src/shared/styles/management.css` hoặc các file untracked có chủ ý trong `AGENTS.md`. Không merge/push vào nhánh chính khi chưa được người phụ trách duyệt.
- Mốc gần nhất sau dọn repo: frontend build đạt; frontend test 14 đạt, 1 live-DB bỏ qua; backend unit 153/153. Integration 82/82 là mốc trước đó trên test DB, **chưa chạy lại sau lượt dọn repo**.
