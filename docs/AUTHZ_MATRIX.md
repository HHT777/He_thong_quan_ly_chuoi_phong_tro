# Ma trận quyền sở hữu API — mốc Giai đoạn 1

Nguồn route: `src/app.js`, `src/routes/*.routes.js` (117 khai báo trong 9 tệp; `management.routes.js` được mount thêm bí danh `/api`). `tests/authz-route-manifest.test.js` chốt cả số lượng và chữ ký toàn bộ khai báo: thêm/sửa/xóa route phải rà lại tài liệu và chủ sở hữu. Đây là khóa kiểm kê, **không** chứng minh 117 route đã an toàn.

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
| `phong.routes.js` | `POST/GET /`, `GET/PUT/DELETE /:id` | Phòng/căn của B |
| `management.routes.js` | `GET/POST /can-tro`, `GET/PUT/DELETE /can-tro/:id`; `GET/POST /khach-thue`, `GET/PUT/DELETE /khach-thue/:id`; `GET/POST /thu-chi`, `PUT/DELETE /thu-chi/:id` | Căn, khách, thu chi của B; alias mount kép |
| `mvp.routes.js` | `GET/POST /reservations`, `GET /reservations/:id/extension-history`, `GET /reservations/:id/cancellation-quote`, `PATCH /reservations/:id/extend`, `POST /reservations/:id/cancel`; `GET/POST /assets`, `PUT/DELETE /assets/:id` | Giữ phòng, tài sản của B; **cron quá hạn hiện broadcast tới mọi Chủ trọ hoạt động** |
| `mvp.routes.js` | `POST /requests`, `GET /requests`, `PATCH /requests/:id`, `POST /requests/:id/revoke`; `GET /move-outs`; `POST/GET /incidents`, `PATCH/DELETE /incidents/:id`; `GET /co-tenant-proposals/:id`, `POST/GET /co-tenants`, `PATCH /co-tenants/:id` | Yêu cầu, sự cố, người ở cùng chéo chủ/khách |
| `mvp.routes.js` | `GET /debt`, `GET /reports/cashflow`, `GET/POST /contracts/:id/violations`; `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/broadcast` | Tổng hợp/tìm kiếm theo căn, người nhận broadcast, vi phạm |
| `meterReading.routes.js` | `GET /meter-readings`, `GET/PATCH/DELETE /meter-readings/:readingId`, `POST /meter-readings/:readingId/confirmations|correction-requests`, `POST /meter-readings/manual`, `POST /meter-readings/ocr-previews|ocr-submit`, `GET /private-files/:id` | Chỉ số/ảnh/file của B; đường dẫn file riêng tư |

## Giai đoạn 3 — route nền tảng/khách, chưa có ma trận A/B toàn diện

| Tệp | Route còn chờ rà soát | Ghi chú |
| --- | --- | --- |
| `auth.routes.js` | `POST /login`, `POST /register-khach-thue`, `GET /profile` | Public/self; đăng ký khách cần kiểm quan hệ chủ |
| `tenant.routes.js` | `GET /thong-bao`, `POST /su-co` | Chỉ chủ thể đăng nhập |
| `hopDong.routes.js` | `GET /`, `GET /expiring`, `GET /:id/history`, `POST /:id/renew` | List có test bổ sung; lịch sử/renew khóa cần test riêng |
| `datCoc.routes.js` | `GET /`, `GET /:id`, `PUT /:id` | List/detail có test bổ sung; update chưa có test A/B riêng |
| `khoanPhaiThu.routes.js` | `GET /`, `GET /list/overdue`, `GET /:id`, `GET /khach-thue/:khachThueId`, `GET /payment/list`, `GET /payment/:id` | Một số đã có test bổ sung; overdue/khách chưa đủ |
| `meterReading.routes.js` | `GET /me/meter-reading-context`, `POST /me/meter-reading-ocr-previews`, `POST /me/meter-readings` | Khách tự phục vụ |
| `mvp.routes.js` | `PATCH /account/password`; `GET/PUT /system-config[/:key]`, `GET/POST /incident-categories`; `POST /jobs/debt-lifecycle|close-overdue-debt|remind-due-bills|billing`; `GET/POST /notifications` được liệt kê ở Giai đoạn 2 | Global/system/self, phải quyết định phạm vi vận hành nhiều Chủ trọ |

Giai đoạn 2/3 là tồn đọng, **không** được coi là đã an toàn chỉ vì có RBAC vai trò. Khi triển khai, bổ sung từng route vào test manifest theo chủ sở hữu thực tế và phép thử phủ định.
