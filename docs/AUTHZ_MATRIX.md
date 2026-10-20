# Ma trận quyền sở hữu API — mốc Giai đoạn 1

Nguồn route: `src/app.js`, `src/routes/*.routes.js` (120 khai báo trong 9 tệp; `management.routes.js` được mount thêm bí danh `/api`). `tests/authz-route-manifest.test.js` chốt cả số lượng và chữ ký toàn bộ khai báo: thêm/sửa/xóa route phải rà lại tài liệu và chủ sở hữu. Đây là khóa kiểm kê, **không** chứng minh 120 route đã an toàn.

Mô hình: nhiều Chủ trọ độc lập; `CanTro.maChuTro` là gốc sở hữu. Phòng → căn; hợp đồng → phòng → căn; phiếu/cọc/thu/điều chỉnh/biên bản → hợp đồng → phòng → căn. ID người khác và ID không tồn tại cùng trả `404 RESOURCE_NOT_FOUND`; sai vai trò trả 403. Tài nguyên chưa ánh xạ bị chặn theo mặc định bằng `OWNERSHIP_RESOURCE_UNMAPPED`. Kiểm tra phân quyền nằm ở `ownership.service.js`/`propertyAccess.service.js` và được gọi trong service/controller tương ứng.

## Giai đoạn 1 — đã vá và có test chéo Chủ trọ

Đường dẫn dưới đây là đường dẫn đã mount; `:id` luôn là mã nội bộ, không phải tên phòng. Mọi route ghi trong bảng được test bằng đối tượng A/B và ID không tồn tại; test so sánh phản hồi và snapshot DB trước/sau. Chi tiết: `tests/authz-phase1.integration.test.js`. Các route danh sách/đọc liên quan được kiểm riêng trong cùng test.

| Nhóm/FR | Route ghi/đọc nhạy cảm | Số route manifest | Kiểm tra sở hữu | Test |
| --- | --- | ---: | --- | --- |
| Hợp đồng FR-035/041 | `POST /api/hop-dong`, `GET/PUT /api/hop-dong/:id`, `POST /api/hop-dong/:id/transfers` | 4 | Hợp đồng/phòng nguồn và phòng đích thuộc A | `authz-phase1.integration.test.js`, nhóm `contract` |
| Cọc FR-043/044 | `POST /api/dat-coc`, `POST /api/dat-coc/:id/confirm`, `POST /api/dat-coc/:id/cancel` | 3 | Cọc → hợp đồng thuộc A | cùng test, `deposit` |
| Phiếu thu FR-144 | `POST /api/khoan-phai-thu`, `POST /api/v1/bills/preview`, `POST /api/v1/bills/generate` | 3 | Mọi hợp đồng đầu vào thuộc A; trộn A+B từ chối toàn bộ | cùng test, `bill` |
| Thanh toán FR-073/079 | `POST /api/khoan-phai-thu/payment/create`, `POST /api/khoan-phai-thu/payment/:id/confirm`, `GET /api/khoan-phai-thu/payment/stats`, `POST /api/v1/bills/:id/mark-paid`, `POST /api/v1/bills/mark-all-paid`, `POST /api/v1/payments/:id/cancel` | 6 | Lần thu/phiếu/căn thuộc A; stats giới hạn theo A | cùng test, `payment` |
| Điều chỉnh FR-164/175 | `POST /api/v1/discounts`, `POST /api/v1/bills/:id/adjustments`, `POST/PATCH /api/v1/billing-adjustments[/:id]`, `POST /api/v1/billing-adjustments/:id/toggle` | 5 | Phiếu/định nghĩa điều chỉnh → hợp đồng thuộc A | cùng test, `adjustment` |
| Tài khoản khách FR-002/007 | `POST /api/v1/accounts`, `PATCH /api/v1/accounts/:id/status`, `POST /api/v1/accounts/reset-password` | 3 | Khách/tài khoản gắn khách thuộc A | cùng test, `account` |
| Quyết toán FR-096/187 | `GET /api/v1/move-outs/:contractId/context`, `POST /api/v1/move-outs/:contractId/settle` | 1 ghi + 1 đọc | Hợp đồng thuộc A, kiểm tra trong transaction của settle | cùng test, `settlement` |
| Hoàn cọc FR-188 | `POST /api/v1/move-outs/:id/deposit-refunds` | 1 | Biên bản → hợp đồng thuộc A, trước lookup idempotency | cùng test, `refund` |

26 route manifest = 25 dòng bảng kiểm tra chéo trực tiếp + 1 route stats tổng hợp. Hai phép thử khách A truy cập hợp đồng/phiếu khách B cũng nằm trong test. Nhóm route đọc/list bổ sung gồm `GET /api/hop-dong`, `GET /api/dat-coc[/:id]`, `GET /api/khoan-phai-thu[/:id]`, `GET /api/khoan-phai-thu/payment/list|:id`, `GET /api/v1/billing-adjustments[?contractId]`, `GET /api/v1/move-outs/:contractId/context`. Chỉ các route ghi ở bảng và các route đọc vừa nêu mới được xác nhận bởi test này; không suy rộng sang route khác.

## Giai đoạn 2 — chưa khai báo/kiểm chứng đầy đủ quyền sở hữu

Danh sách còn lại theo khai báo route, ghi rõ phương thức; route bí danh `management` có cả `/api/management` và `/api`. Các route này cần test A/B trước khi đánh dấu an toàn:

| Tệp | Route còn chờ rà soát (path tương đối mount) | Rủi ro chính |
| --- | --- | --- |
| `phong.routes.js` | `POST /`, `PUT/DELETE /:id` | Phòng/căn của B; `GET /` và `GET /:id` đã vá BE-1 FR-024/026 |
| `management.routes.js` | `GET/POST /can-tro`, `GET/PUT/DELETE /can-tro/:id`; `GET/POST /khach-thue`, `GET/PUT/DELETE /khach-thue/:id`; `GET/POST /thu-chi`, `PUT/DELETE /thu-chi/:id` | Căn, khách, thu chi của B; alias mount kép |
| `mvp.routes.js` | `GET/POST /reservations`, `GET /reservations/:id/extension-history`, `GET /reservations/:id/cancellation-quote`, `PATCH /reservations/:id/extend`, `POST /reservations/:id/cancel`; `GET/POST /assets`, `PUT/DELETE /assets/:id` | Giữ phòng, tài sản của B; producer cron thông báo quá hạn đã vá riêng ở FR-159 |
| `mvp.routes.js` | `POST /requests`, `GET /requests`, `PATCH /requests/:id`, `POST /requests/:id/revoke`; `POST /incidents` từ khách; `GET /co-tenant-proposals/:id`, `POST/GET /co-tenants`, `PATCH /co-tenants/:id` | Yêu cầu và người ở cùng chéo chủ/khách; sự cố Chủ trọ đã được khoanh phạm vi ở G2, báo sự cố từ khách còn P2-2; `GET /move-outs` đã vá G1 |
| `mvp.routes.js` | `GET/POST /contracts/:id/violations`; `GET /notifications`, `PATCH /notifications/:id/read` | Vi phạm/thông báo; cashflow, `GET /debt` và broadcast đã vá phạm vi chủ sở hữu |
| `meterReading.routes.js` | `GET /meter-readings`, `GET/PATCH/DELETE /meter-readings/:readingId`, `POST /meter-readings/:readingId/confirmations|correction-requests`, `POST /meter-readings/manual`, `POST /meter-readings/ocr-previews|ocr-submit`, `GET /private-files/:id` | Chỉ số/ảnh/file của B; đường dẫn file riêng tư |

## Giai đoạn 3 — route nền tảng/khách, chưa có ma trận A/B toàn diện

| Tệp | Route còn chờ rà soát | Ghi chú |
| --- | --- | --- |
| `auth.routes.js` | `POST /login`, `POST /register-khach-thue`, `GET /profile` | Public/self; đăng ký khách cần kiểm quan hệ chủ |
| `tenant.routes.js` | `GET /thong-bao`, `POST /su-co` | Chỉ chủ thể đăng nhập |
| `hopDong.routes.js` | `GET /expiring`, `GET /:id/history`, `POST /:id/renew` | List đã vá G1; lịch sử/renew khóa cần test riêng |
| `datCoc.routes.js` | `PUT /:id` | List/detail đã vá G1; update có guard qua `getDatCocById` nhưng chưa có test A/B riêng |
| `khoanPhaiThu.routes.js` | `GET /list/overdue`, `GET /khach-thue/:khachThueId` | List/detail/payment list/payment detail đã vá G1; overdue/khách chưa đủ test A/B |
| `meterReading.routes.js` | `GET /me/meter-reading-context`, `POST /me/meter-reading-ocr-previews`, `POST /me/meter-readings` | Khách tự phục vụ |
| `mvp.routes.js` | `PATCH /account/password`; `GET/PUT /system-config[/:key]`, `GET/POST /incident-categories`; `POST /jobs/debt-lifecycle|close-overdue-debt|remind-due-bills|billing`; `GET/POST /notifications` được liệt kê ở Giai đoạn 2 | Global/system/self, phải quyết định phạm vi vận hành nhiều Chủ trọ |

Giai đoạn 2/3 là tồn đọng, **không** được coi là đã an toàn chỉ vì có RBAC vai trò. Lý do hoãn: SRS giai đoạn đầu vận hành một Chủ trọ; phải mở lại toàn bộ phần P2 **trước khi bật nhiều Chủ trọ**. Khi triển khai, bổ sung từng route vào test manifest theo chủ sở hữu thực tế và phép thử phủ định. Các bảng nhóm phía trên là ghi chú lịch sử; bảng kiểm kê dưới đây là trạng thái mới nhất và có ưu tiên khi hai chỗ khác nhau.

## Kiểm kê route-theo-route (120 khai báo, không nhân đôi bí danh mount)

`G1` = đã vá/kiểm chứng ở lượt authz; `P2-2`/`P2-3` = tồn đọng Giai đoạn 2/3, cần test A/B trước nhiều Chủ trọ; `N/A` = không áp dụng kiểm tra sở hữu đối tượng (nêu lý do). Đường dẫn tương đối với mount trong `app.js`: `management.routes.js` có hai mount `/api/management` và `/api`. Mỗi dòng là một khai báo `router.METHOD(path)`; bảng được đối chiếu bằng `authz-route-manifest.test.js`. `G1` không có nghĩa mọi tổ hợp dữ liệu đã có phép thử phủ định *riêng*; trạng thái bằng chứng chi tiết ở bảng kế tiếp.

| Tệp | Method | Path | Phân loại / commit hoặc lý do |
| --- | --- | --- | --- |
| auth.routes.js | POST | /login | N/A: xác thực public, chưa có đối tượng sở hữu |
| auth.routes.js | POST | /register-khach-thue | P2-3: đăng ký/quan hệ chủ |
| auth.routes.js | GET | /profile | P2-3: self profile |
| datCoc.routes.js | POST | / | G1 `3745649` |
| datCoc.routes.js | GET | / | G1 `3745649` |
| datCoc.routes.js | GET | /:id | G1 `3745649` |
| datCoc.routes.js | PUT | /:id | P2-3: cập nhật cọc chưa có test riêng |
| datCoc.routes.js | POST | /:id/confirm | G1 `3745649` |
| datCoc.routes.js | POST | /:id/cancel | G1 `3745649` |
| hopDong.routes.js | POST | / | G1 `60c7962` |
| hopDong.routes.js | GET | / | G1 `60c7962` |
| hopDong.routes.js | GET | /expiring | P2-3: danh sách sắp hạn chưa có test riêng |
| hopDong.routes.js | GET | /:id/history | P2-3: lịch sử đã có guard, thiếu test A/B riêng |
| hopDong.routes.js | GET | /:id/print | G1 FR-184: Chủ trọ sở hữu căn; Khách 403; A/B 404; `contract-print.integration.test.js` |
| hopDong.routes.js | POST | /:id/transfers | G1 `60c7962` |
| hopDong.routes.js | GET | /:id | G1 `60c7962` |
| hopDong.routes.js | PUT | /:id | G1 `60c7962` |
| hopDong.routes.js | POST | /:id/renew | N/A: luôn 409, gia hạn trực tiếp bị khóa |
| khoanPhaiThu.routes.js | POST | / | G1 `3bf4ae6` |
| khoanPhaiThu.routes.js | GET | / | G1 `3bf4ae6` |
| khoanPhaiThu.routes.js | GET | /list/overdue | P2-3: danh sách quá hạn chưa có test riêng |
| khoanPhaiThu.routes.js | GET | /:id | G1 `3bf4ae6` |
| khoanPhaiThu.routes.js | GET | /khach-thue/:khachThueId | P2-3: lọc khách chưa có test A/B riêng |
| khoanPhaiThu.routes.js | POST | /payment/create | G1 `2223786` |
| khoanPhaiThu.routes.js | GET | /payment/list | G1 `2223786` |
| khoanPhaiThu.routes.js | GET | /payment/stats | G1 `2223786` |
| khoanPhaiThu.routes.js | POST | /payment/:id/confirm | G1 `2223786` |
| khoanPhaiThu.routes.js | GET | /payment/:id | G1 `2223786` |
| management.routes.js | GET | /can-tro | P2-2: danh sách căn |
| management.routes.js | POST | /can-tro | P2-2: tạo căn |
| management.routes.js | GET | /can-tro/:id | P2-2: chi tiết căn |
| management.routes.js | PUT | /can-tro/:id | P2-2: sửa căn |
| management.routes.js | DELETE | /can-tro/:id | P2-2: xóa căn |
| management.routes.js | GET | /khach-thue | P2-2: danh sách khách |
| management.routes.js | POST | /khach-thue | P2-2: tạo khách |
| management.routes.js | GET | /khach-thue/:id | P2-2: chi tiết khách |
| management.routes.js | PUT | /khach-thue/:id | P2-2: sửa khách |
| management.routes.js | DELETE | /khach-thue/:id | P2-2: xóa khách |
| management.routes.js | GET | /thu-chi | P2-2: danh sách thu chi |
| management.routes.js | POST | /thu-chi | P2-2: tạo thu chi |
| management.routes.js | PUT | /thu-chi/:id | P2-2: sửa thu chi |
| management.routes.js | DELETE | /thu-chi/:id | P2-2: xóa mềm thu chi |
| meterReading.routes.js | GET | /me/meter-reading-context | P2-3: khách tự xem |
| meterReading.routes.js | POST | /me/meter-reading-ocr-previews | P2-3: OCR khách |
| meterReading.routes.js | POST | /meter-readings/ocr-previews | P2-2: OCR Chủ trọ |
| meterReading.routes.js | POST | /me/meter-readings | P2-3: khách ghi điện |
| meterReading.routes.js | POST | /meter-readings/ocr-submit | P2-2: Chủ trọ ghi OCR |
| meterReading.routes.js | GET | /meter-readings | P2-2: danh sách chỉ số |
| meterReading.routes.js | GET | /meter-readings/:readingId | P2-2: chi tiết chỉ số |
| meterReading.routes.js | PATCH | /meter-readings/:readingId | P2-2: sửa chỉ số |
| meterReading.routes.js | DELETE | /meter-readings/:readingId | P2-2: xóa chỉ số |
| meterReading.routes.js | POST | /meter-readings/:readingId/confirmations | P2-2: xác nhận chỉ số |
| meterReading.routes.js | POST | /meter-readings/:readingId/correction-requests | P2-2: yêu cầu sửa |
| meterReading.routes.js | POST | /meter-readings/manual | P2-2: ghi tay |
| meterReading.routes.js | GET | /private-files/:id | P2-2: ảnh riêng tư |
| mvp.routes.js | PATCH | /account/password | P2-3: tự đổi mật khẩu |
| mvp.routes.js | POST | /accounts | G1 `5041074` |
| mvp.routes.js | PATCH | /accounts/:id/status | G1 `5041074` |
| mvp.routes.js | POST | /accounts/reset-password | G1 `5041074` |
| mvp.routes.js | GET | /reservations | P2-2: danh sách giữ phòng |
| mvp.routes.js | POST | /reservations | P2-2: tạo giữ phòng |
| mvp.routes.js | GET | /reservations/:id/extension-history | P2-2: lịch sử gia hạn |
| mvp.routes.js | GET | /reservations/:id/cancellation-quote | P2-2: báo giá hủy |
| mvp.routes.js | PATCH | /reservations/:id/extend | P2-2: gia hạn giữ phòng |
| mvp.routes.js | POST | /reservations/:id/cancel | P2-2: hủy giữ phòng |
| mvp.routes.js | GET | /system-config | P2-3: cấu hình toàn hệ thống |
| mvp.routes.js | PUT | /system-config/:key | P2-3: cấu hình toàn hệ thống |
| mvp.routes.js | GET | /incident-categories | P2-3: danh mục chung |
| mvp.routes.js | POST | /incident-categories | P2-3: danh mục chung |
| mvp.routes.js | GET | /contracts/:id/violations | P2-2: vi phạm hợp đồng |
| mvp.routes.js | POST | /contracts/:id/violations | P2-2: ghi vi phạm |
| mvp.routes.js | POST | /discounts | G1 `71ee3fe` |
| mvp.routes.js | POST | /bills/:id/adjustments | G1 `71ee3fe` |
| mvp.routes.js | GET | /billing-adjustments | G1 `71ee3fe` |
| mvp.routes.js | POST | /billing-adjustments | G1 `71ee3fe` |
| mvp.routes.js | PATCH | /billing-adjustments/:id | G1 `71ee3fe` |
| mvp.routes.js | POST | /billing-adjustments/:id/toggle | G1 `71ee3fe` |
| mvp.routes.js | POST | /bills/preview | G1 `3bf4ae6` |
| mvp.routes.js | POST | /bills/generate | G1 `3bf4ae6` |
| mvp.routes.js | GET | /debt | G1 `aa0acf6` |
| mvp.routes.js | GET | /dashboard/summary | BE-1 FR-024/144: Chủ trọ; tổng hợp phòng và phiếu DINH_KY chỉ trong căn sở hữu |
| mvp.routes.js | POST | /bills/:id/mark-paid | G1 `2223786` |
| mvp.routes.js | POST | /bills/mark-all-paid | G1 `2223786` |
| mvp.routes.js | POST | /payments/:id/cancel | G1 `2223786` |
| mvp.routes.js | POST | /jobs/debt-lifecycle | P2-3: job toàn hệ thống |
| mvp.routes.js | POST | /jobs/close-overdue-debt | P2-3: job toàn hệ thống |
| mvp.routes.js | POST | /jobs/remind-due-bills | P2-3: job toàn hệ thống |
| mvp.routes.js | POST | /jobs/billing | P2-3: job toàn hệ thống |
| mvp.routes.js | GET | /assets | P2-2: danh sách tài sản |
| mvp.routes.js | POST | /assets | P2-2: tạo tài sản |
| mvp.routes.js | PUT | /assets/:id | P2-2: sửa tài sản |
| mvp.routes.js | DELETE | /assets/:id | P2-2: xóa tài sản |
| mvp.routes.js | POST | /requests | P2-2: yêu cầu khách |
| mvp.routes.js | GET | /requests | P2-2: danh sách yêu cầu |
| mvp.routes.js | PATCH | /requests/:id | P2-2: duyệt yêu cầu |
| mvp.routes.js | POST | /requests/:id/revoke | P2-2: rút duyệt |
| mvp.routes.js | GET | /move-outs | G1 `282d06b` |
| mvp.routes.js | POST | /move-outs/:contractId/settle | G1 `481a9e9` |
| mvp.routes.js | GET | /move-outs/:contractId/context | G1 `481a9e9` |
| mvp.routes.js | POST | /move-outs/:id/deposit-refunds | G1 `354b895` |
| mvp.routes.js | POST | /incidents | G2 FR-192: Chủ trọ phải sở hữu phòng và sự cố trước; khách không được liên kết. P2-2 còn việc kiểm phạm vi phòng khi khách báo sự cố. |
| mvp.routes.js | GET | /incidents | G2 FR-192: Chủ trọ chỉ thấy sự cố trong căn sở hữu; khách chỉ thấy sự cố mình báo. |
| mvp.routes.js | PATCH | /incidents/:id | G2 FR-192: Chủ trọ sở hữu mới sửa được; không nhận liên kết sau tạo. |
| mvp.routes.js | DELETE | /incidents/:id | G2 FR-192: Chủ trọ sở hữu mới xóa được theo điều kiện nghiệp vụ cũ. |
| mvp.routes.js | DELETE | /incidents/:id/previous | G2 FR-192: Chủ trọ sở hữu sự cố mới; 404 nếu không tồn tại/khác chủ, 403 sai vai trò |
| mvp.routes.js | GET | /co-tenant-proposals/:id | P2-2: đề xuất người ở cùng |
| mvp.routes.js | POST | /co-tenants | P2-2: đề xuất người ở cùng |
| mvp.routes.js | GET | /co-tenants | P2-2: danh sách người ở cùng |
| mvp.routes.js | PATCH | /co-tenants/:id | P2-2: sửa người ở cùng |
| mvp.routes.js | GET | /notifications | P2-2: danh sách thông báo |
| mvp.routes.js | PATCH | /notifications/:id/read | P2-2: đánh dấu đã đọc |
| mvp.routes.js | POST | /notifications/broadcast | G1 `1bb2fc7`: chỉ khách trong căn của chủ |
| mvp.routes.js | GET | /reports/cashflow | G3 FR-194: tổng hợp chỉ căn sở hữu; buildingId lạ/khác chủ 404 |
| mvp.routes.js | GET | /reports/cashflow.xlsx | G3 FR-194: xuất cùng dữ liệu cashflow của căn sở hữu; chỉ Chủ trọ |
| phong.routes.js | POST | / | P2-2: tạo phòng |
| phong.routes.js | GET | / | BE-1 FR-024: chỉ phòng thuộc căn của Chủ trọ; lọc căn khác/không tồn tại 404 |
| phong.routes.js | GET | /:id | BE-1 FR-026: phòng khác chủ/không tồn tại 404 |
| phong.routes.js | PUT | /:id | P2-2: sửa phòng |
| phong.routes.js | DELETE | /:id | P2-2: xóa phòng |
| tenant.routes.js | GET | /thong-bao | P2-3: thông báo khách |
| tenant.routes.js | POST | /su-co | P2-3: báo sự cố khách |

## Rà producer thông báo (FR-159)

`notification.service.createIdempotent` chỉ INSERT, khóa DB `UNIQUE(maTaiKhoan,khoaSuKien)` là tầng chống trùng. Bảng này kiểm tra **người nhận** chứ không thay đổi nội dung/sự kiện. Các producer dùng `khoaSuKien` sẵn có; không backfill thông báo cũ.

| Producer | Người nhận hiện tại | Có thể gửi nhầm Chủ trọ khác? | Xử lý |
| --- | --- | --- | --- |
| `reservation.service.notifyExpired` | Chủ trọ sở hữu `DatGiuPhong.maPhong → PhongTro.maCan → CanTro.maChuTro` | Trước vá: **có** (mọi Chủ trọ hoạt động) | Đã sửa FR-159 `1bb2fc7`; test hai chủ, chạy hai lần, mutation đỏ |
| `cron.jobs.updateContractStates` | Khách hợp đồng và Chủ trọ sở hữu phòng hợp đồng | Trước vá: **có** (Chủ trọ đầu tiên) | Đã sửa FR-159 `1bb2fc7`; mutation đỏ |
| `mvp.routes.js` broadcast | Chỉ tài khoản khách có hợp đồng tại căn của Chủ trọ gửi; explicit recipient ngoài phạm vi bị 404 toàn bộ | Trước vá: gửi khách toàn hệ thống, **có rò dữ liệu chéo chủ** | Đã sửa FR-159 `1bb2fc7`; mutation đỏ |
| `billingCron.service` phát hành phiếu | Khách của hợp đồng phiếu | Không thấy đường gửi Chủ trọ khác | Giữ nguyên; cần test P2 nếu khách có nhiều chủ |
| `debtLifecycle.service` nhắc/chốt nợ | Khách của hợp đồng phiếu | Không thấy | Giữ nguyên; `actorId` cron toàn cục là rủi ro audit P2, không phải người nhận thông báo |
| `hopDong.service` tạo hợp đồng | Khách đứng tên hợp đồng | Không thấy | Giữ nguyên |
| `thanhToan.service` ghi nhận thu | Khách của phiếu | Không thấy | Giữ nguyên |
| `paymentConfirmation.service` xác nhận minh chứng | Khách của phiếu | Không thấy | Giữ nguyên |
| `roomTransfer.service` chuyển phòng | Khách của hợp đồng chuyển | Không thấy | Giữ nguyên |
| `moveOutRequest.service` rút duyệt / đến ngày trả | Khách gắn yêu cầu | Không gửi Chủ trọ khác | Giữ nguyên; FR-186 yêu cầu thông báo Chủ trọ lúc đến ngày trả, cần đối chiếu riêng P2 |
| `moveOut.service` thanh lý | Khách của hợp đồng | Không thấy | Giữ nguyên |
| `incident.service` kết thúc sự cố | Tài khoản người báo | Không thấy | Giữ nguyên |
| `mvp.routes.js` duyệt/từ chối yêu cầu | Khách gắn yêu cầu | Không thấy | Giữ nguyên |

Test `notification-ownership.integration.test.js` tạo hai Chủ trọ có cùng `soPhong` ở hai căn, xác minh mỗi Chủ trọ chỉ thấy khóa sự kiện của mình ở `GET /notifications`, cron lần hai tạo 0 bản ghi, broadcast A không thể chọn khách B. Phép thử phủ định: thay lookup sở hữu trong reservation hoặc contract bằng Chủ trọ toàn cục, hoặc bỏ preflight recipient broadcast, đều làm đúng test này đỏ; mã đã khôi phục.

**Giới hạn mô hình số hợp đồng:** `HopDong` hiện chỉ có khóa nội bộ UUID `maHopDong`; không có cột số hợp đồng hiển thị độc lập để tạo hai số trùng nhau. Không thể tạo hai `maHopDong` trùng mà vẫn giữ PK. Test trùng `soPhong` có thật; tra cứu hợp đồng được kiểm bằng UUID nội bộ. Nếu sản phẩm cần số hợp đồng hiển thị có thể trùng giữa các Chủ trọ thì phải thiết kế trường riêng (DDL, chưa được duyệt), không mô phỏng bằng sửa PK.

## Bằng chứng phủ định riêng 26 route Giai đoạn 1

Chạy `AUTHZ_ROUTE=<tên route>` cùng `AUTHZ_MUTATION_ROUTE=<tên route>` và preloader **chỉ trong tiến trình test** trên `qlpt_authz_test`. Header chỉ gắn vào một HTTP request; preloader vô hiệu hóa `assertOwned`/`getOwnedBuildingIds` trong ngữ cảnh request đó, không sửa production. Test route được chọn phải đỏ và request đối chứng không gắn header vẫn 404 `RESOURCE_NOT_FOUND`. Sau mỗi lần test runner tạo lại DB test; không có mã vô hiệu hóa nào còn trong ứng dụng. Bảng ghi status **thực tế khi tắt guard**, không phải status của bản đã vá. Một số nghiệp vụ vẫn chặn 400/409 sau guard, nhưng khác 404 nên test vẫn bắt được việc bỏ lớp phân quyền.

| Route | Guard tại mã nguồn | Khi tắt riêng guard: status / kết quả | Test đối chứng |
| --- | --- | --- | --- |
| `POST /api/hop-dong` | `hopDong.service.js:31-32` | 400, trùng hợp đồng phòng B; đỏ | GET hợp đồng B: 404 |
| `GET /api/hop-dong/:id` | `hopDong.service.js:165` | 200, lộ hợp đồng B; đỏ | GET hợp đồng B không đột biến: 404 |
| `PUT /api/hop-dong/:id` | `hopDong.service.js:193` | 200, đổi `HopDong`/audit B; đỏ | 404 |
| `POST /api/hop-dong/:id/transfers` | `roomTransfer.service.js:59-60` | 201, đổi phòng/hợp đồng B; đỏ | 404 |
| `POST /api/dat-coc` | `datCoc.service.js:7` | 409, B đã có cọc; đỏ | 404 |
| `POST /api/dat-coc/:id/confirm` | `datCoc.service.js:33` | 200; đỏ | 404 |
| `POST /api/dat-coc/:id/cancel` | `datCoc.service.js:33` | 200, đổi cọc B; đỏ | 404 |
| `POST /api/khoan-phai-thu` | `khoanPhaiThu.service.js:28` | 201, tạo phiếu B; đỏ | 404 |
| `POST /api/khoan-phai-thu/payment/create` | `thanhToan.service.js:20,35` | 201, thu tiền B; đỏ | 404 |
| `POST /api/khoan-phai-thu/payment/:id/confirm` | `paymentConfirmation.service.js:11` | 409, minh chứng không chờ; đỏ | 404 |
| `GET /api/khoan-phai-thu/payment/stats` | `thanhToan.service.js:100` | 200, tổng B lọt vào A (500000); đỏ | GET hợp đồng B: 404 |
| `POST /api/v1/accounts` | `tenantAccount.service.js:57` | 409, B đã có tài khoản; đỏ | 404 |
| `PATCH /api/v1/accounts/:id/status` | `tenantAccount.service.js:113` | 200, khóa tài khoản B; đỏ | 404 |
| `POST /api/v1/accounts/reset-password` | `tenantAccount.service.js:127` | 200, reset B; đỏ | 404 |
| `POST /api/v1/discounts` | `billAdjustment.service.js:23` | 201, giảm trừ phiếu B; đỏ | 404 |
| `POST /api/v1/bills/:id/adjustments` | `billAdjustment.service.js:23` | 201, điều chỉnh phiếu B; đỏ | 404 |
| `POST /api/v1/billing-adjustments` | `billingAdjustmentDefinition.service.js:33` | 201, định nghĩa của B; đỏ | 404 |
| `PATCH /api/v1/billing-adjustments/:id` | `billingAdjustmentDefinition.service.js:48` | 200, sửa B; đỏ | 404 |
| `POST /api/v1/billing-adjustments/:id/toggle` | `billingAdjustmentDefinition.service.js:62` | 200, đổi B; đỏ | 404 |
| `POST /api/v1/bills/preview` | `billGeneration.service.js:60-64` | 200 với danh sách A+B; đỏ | 404 |
| `POST /api/v1/bills/generate` | `billGeneration.service.js:60-64` | 201 với danh sách A+B; đỏ | 404 |
| `POST /api/v1/bills/:id/mark-paid` | `paymentLifecycle.service.js:26` | 201, thu phiếu B; đỏ | 404 |
| `POST /api/v1/bills/mark-all-paid` | `paymentLifecycle.service.js:32` | 201, thu căn B; đỏ | 404 |
| `POST /api/v1/payments/:id/cancel` | `paymentLifecycle.service.js:42` | 200, hủy lần thu B; đỏ | 404 |
| `POST /api/v1/move-outs/:contractId/settle` | `moveOut.service.js:50` | 200, thanh lý B; đỏ | 404 |
| `POST /api/v1/move-outs/:id/deposit-refunds` | `moveOut.service.js:114` | 201, hoàn cọc B; đỏ | 404 |

**Kết quả:** 26/26 route đỏ khi tắt guard riêng; 0 route thiếu phép thử riêng. Bản không đột biến cần trở lại xanh ở toàn bộ integration. Các route đọc/list mở rộng được kiểm bằng `authz-phase1.integration.test.js` và các test tích hợp nghiệp vụ; `GET /debt`, `GET /move-outs`, `GET /reports/cashflow` và bản xuất có test riêng sau vá. Các route P2-2/P2-3 khác vẫn cần rà trước khi bật nhiều Chủ trọ.

**G3 chưa làm:** xuất Excel công nợ UC-23 và các báo cáo RPT-01…06 ngoài màn cashflow UC-19; chỉ bản xuất cashflow UC-19 được triển khai theo quyết định phạm vi G3.

**Chi phí chưa phân căn (quyết định G3/P2):** `GET /reports/cashflow` và bản `.xlsx` giữ `KhoanChi.maCan IS NULL` trong `totalExpenses`/`profit` khi hệ thống có đúng một `ChuTro` và không lọc riêng một căn. Khi có ít nhất hai `ChuTro`, không gán khoản này cho bất kỳ chủ nào; JSON, Excel và màn hình công khai `unassignedExpenses: {count,total}`. Trước khi bật nhiều Chủ trọ P2 phải quyết định phân bổ/xử lý các khoản chưa phân căn; không được âm thầm loại khỏi đối soát toàn hệ thống. Test: `01-cashflow-unassigned.integration.test.js`, `cashflow-export.integration.test.js`.

**BE-1 tổng quan chỉ-đọc:** `GET /api/v1/dashboard/summary?period=YYYY-MM` chỉ cho `CHU_TRO`; không truyền kỳ thì lấy tháng theo `Asia/Ho_Chi_Minh`. `rooms.total` là mọi phòng thuộc căn sở hữu, `rooms.byStatus` gồm năm trạng thái chuẩn và `KHAC` cho trạng thái chưa biết. `bills` chỉ đếm phiếu `DINH_KY` trong kỳ, không trộn nợ `SAU_THANH_LY`: `daThu` khi dư nợ bằng 0; `conNo` khi dư nợ dương và cờ `quaHan` chưa bật; `quaHan` khi dư nợ dương và cờ đã bật. Các nhóm loại trừ nhau và cộng bằng `total`. Cờ `quaHan` do cron công nợ lưu khi tới `overdueDay` (mặc định ngày 06/T), không tính lại ngày trong API; cấu hình thay đổi hoặc cron chưa chạy có thể làm thời điểm cờ khác ngày mặc định. Test: `dashboard-summary.test.js`, `zz-dashboard-summary.integration.test.js`.
