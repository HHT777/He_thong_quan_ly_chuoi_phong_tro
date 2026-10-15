# API contract — Luồng nhập và xác nhận chỉ số điện bằng OCR

## 1. Phạm vi và nguồn chuẩn

Tài liệu này chốt contract cho một vertical slice: **Khách thuê gửi ảnh công tơ → OCR đề xuất chỉ số → khách sửa/xác nhận gửi → Chủ trọ kiểm tra và xác nhận chỉ số**.

- Nghiệp vụ nguồn: `SRS.md` v0.3, WF-04, SM-03, UC-09, UC-10, FR-055…FR-070, BR-04/11/35, INT-01, NFR-003/006/019, SEC-03/09/13.
- Frontend liên quan: `phong-tro-frontend/pages/khach-thue/nhap-chi-so-dien.html` và `phong-tro-frontend/pages/dien-nuoc.html`.
- Model hiện có: `OCR/meter_ocr/`, FastAPI + hai model YOLO, nội bộ có `POST /ocr`.
- API công khai trong tài liệu này có prefix **`/api/v1`**. Các route `/api/...` hiện có của backend là legacy và chưa triển khai slice này.

Ngoài phạm vi contract: tạo phiếu thu, chỉ số nước, thay công tơ, sửa chỉ số đã có phiếu, lưu ảnh CCCD và chuyển tiền. Chủ trọ nhập tay khi không có submission của khách được nêu ở mục 8 để không khóa UC-10, nhưng không làm thay đổi contract OCR nội bộ.

## 2. Kết quả đối chiếu màn hình frontend với UC

### 2.1 Cách đánh giá

- **Đã nối API**: trang có page script gọi backend hiện hữu; chưa đồng nghĩa đủ toàn bộ AC của SRS.
- **UI tĩnh**: có bố cục/dữ liệu mẫu nhưng nút chưa gọi API.
- **Một phần**: có màn gần đúng nhưng thiếu nhánh, trường hoặc quy tắc bắt buộc.
- **Thiếu**: chưa có luồng thao tác tương ứng.
- **Lệch SRS**: UI hiện có thể dẫn tới hành vi ngoài phạm vi hoặc trái quy tắc đã chốt.

### 2.2 Ma trận màn hình hiện có

| Màn hình hiện có | UC đối chiếu | Hiện trạng | Gap chính so với SRS v0.3 |
|---|---|---|---|
| `pages/login.html` | UC-24 | Đã nối API đăng nhập | Thiếu quên/đặt lại mật khẩu UC-01, buộc đổi mật khẩu đầu và đổi mật khẩu. |
| `pages/dashboard.html` | UC-03/04/06/19/23 (tổng hợp) | Đã nối một số API | Là dashboard hỗ trợ, không thay thế các flow CRUD/duyệt/báo cáo đầy đủ. |
| `pages/can-tro.html` | UC-03 | Đã nối API đọc | Nút thêm/sửa/dừng hoạt động và validation chưa thành flow hoàn chỉnh. |
| `pages/phong.html` | UC-04 | Đã nối API đọc | Thiếu flow nội thất, trạng thái hợp lệ và lịch sử; hành vi xóa phải bị BR-15 chặn. |
| `pages/khach-thue.html` | UC-05, liên quan UC-02 | Đã nối API đọc | Thiếu quản lý tài khoản khách (tạo/khóa/mở), điều kiện hợp đồng+cọc và lịch sử thuê đầy đủ. |
| `pages/hop-dong.html` | UC-06 | Đã nối API đọc | Thiếu form đầy đủ, xác nhận bản giấy, chỉ số điện đầu, cọc/giữ phòng và transaction nguyên tử. |
| `pages/coc.html` | UC-26, UC-06, UC-15 | UI tĩnh, một phần | UI cọc/giữ chưa thể hiện điều kiện hoàn theo từng thỏa thuận; không được tự mặc định “mất cọc” khi quá hạn. |
| `pages/dien-nuoc.html` | UC-10 | UI tĩnh, lệch SRS | Chưa có lọc kỳ/căn, ảnh, cờ sửa tay, xác nhận/từ chối/nhập tay; đang quản lý “chỉ số nước” dù BR-23 loại khỏi phạm vi. |
| `pages/tien-phong.html` | UC-20, liên quan UC-22 | UI tĩnh, một phần | Chưa có lịch lập phiếu, phòng bị bỏ qua, phí/giảm trừ, chống trùng và điều chỉnh có audit. |
| `pages/thanh-toan.html` | UC-11 | UI tĩnh | Thiếu từng lần thu, số còn thiếu, chặn trả thừa, thu bổ sung/nợ kỳ gốc và idempotency. |
| `pages/cong-no.html` | UC-23 | UI tĩnh | Thiếu hình thành nợ hết ngày 10, nợ kỳ gốc, thu nợ muộn và cập nhật số dư nguyên tử. |
| `pages/thu-chi.html` | UC-19, UC-17 | Đã nối API đọc | Chưa đủ phân loại thực thu/chi/giảm trừ, liên kết chi phí sự cố và công thức BR-44. |
| `pages/su-co.html` | UC-17 | UI tĩnh | Thiếu state machine, bên chịu chi phí, hủy có lý do và follow-up mã mới. |
| `pages/tra-phong.html` | UC-15, liên quan UC-16 | UI tĩnh, một phần | Thiếu duyệt/rút duyệt, ngoại lệ trả sớm, chốt điện, quyết toán cọc và thanh lý nguyên tử. |
| `pages/bao-cao.html` | UC-19 | UI tĩnh | Chưa có lọc kỳ/căn, nguồn số liệu BR-44 và xuất Excel; nút “Xuất PDF” không phải ưu tiên MVP đã chốt. |
| `pages/thong-bao.html` | UC-25 (màn Chủ trọ) | UI tĩnh, một phần | SRS ưu tiên inbox/thông báo nghiệp vụ tự động; chức năng soạn broadcast thủ công chưa có UC/FR rõ. |
| `pages/cai-dat.html` | UC-24, FR-200/UC-29 | UI tĩnh, một phần | Thiếu đổi mật khẩu thực, cấu hình lịch phiếu/ngày mốc và audit thay đổi cấu hình. |
| `pages/khach-thue/thong-tin-thue.html` | UC-07 | Đã nối API | Cần bảo đảm chỉ dữ liệu own và dữ liệu hợp đồng/phòng đúng phạm vi. |
| `pages/khach-thue/hop-dong.html` | UC-07 | Đã nối API | Trùng mục tiêu với “Thông tin thuê”; cần chọn một điểm vào chính, không duy trì hai contract khác nhau. |
| `pages/khach-thue/tien-phai-tra.html` | UC-12 | Đã nối API | Cần tách nợ cũ, tổng cần trả, kỳ không có dữ liệu và chỉ cho xem own. |
| `pages/khach-thue/thanh-toan.html` | UC-12 | Đã nối API đọc, một phần | Theo SRS thanh toán thực tế ngoài hệ thống; nếu tải minh chứng thì chỉ là file để Chủ trọ xem, không tự đổi số đã thu. |
| `pages/khach-thue/nhap-chi-so-dien.html` | UC-09 | UI tĩnh, lệch SRS | Chưa có upload/preview ảnh/OCR/trạng thái; đang cho nhập chỉ số nước và ước tính nước; chưa gắn page script. |
| `pages/khach-thue/yeu-cau-gia-han.html` | UC-13 | UI tĩnh | Thiếu chỉ cho gói 6/12 tháng, chống yêu cầu chờ trùng và theo dõi trạng thái. |
| `pages/khach-thue/yeu-cau-tra-phong.html` | UC-14 | UI tĩnh | Thiếu quy tắc báo trước 30 ngày, nhánh ngoại lệ và chống yêu cầu chờ trùng. |
| `pages/khach-thue/su-co.html` | UC-18 | Đã nối API tạo | Cần đủ sửa/hủy khi Chờ tiếp nhận, ảnh hợp lệ và trạng thái own. |
| `pages/khach-thue/thong-bao.html` | UC-25 | Đã nối API đọc | Cần đánh dấu đã đọc, phân trang và kiểm soát recipient/own. |

Các UC MVP chưa có flow thao tác đáp ứng SRS: **UC-01, UC-02, UC-08, UC-16, UC-22, UC-28, UC-29**. UC-27 là P1 nên chưa có màn là đúng phạm vi. Các trang có nhãn “Đã nối API” vẫn cần contract/test; nhiều service trong `assets/js/services/` hiện chỉ trả mảng rỗng và log console.

## 3. Luồng đã chốt

```text
Khách mở màn
  → lấy context kỳ/phòng/chỉ số trước
  → upload ảnh để OCR preview
  → backend kiểm MIME/kích thước, lưu ảnh tạm private, gọi OCR nội bộ
  → trả suggestedReading hoặc trạng thái yêu cầu nhập tay
  → khách kiểm tra, có thể sửa số, rồi submit
  → backend lưu reading + ảnh ở CHO_XAC_NHAN và phát outbox notification
  → Chủ trọ xem danh sách/chi tiết
  → có thể sửa số chưa xác nhận hoặc từ chối yêu cầu gửi lại
  → xác nhận nguyên tử: DA_XAC_NHAN + lượng điện + tiền điện + audit + notification
```

Quyết định ranh giới:

1. Browser **không gọi trực tiếp** FastAPI OCR; chỉ APP-API biết URL nội bộ và chuẩn hóa lỗi.
2. OCR chỉ sinh **đề xuất**, không tạo bản ghi chỉ số và không tự chuyển `DA_XAC_NHAN`.
3. Upload OCR tạo một ảnh tạm private có `uploadToken`; chỉ khi submit mới gắn ảnh vào bản ghi nghiệp vụ.
4. Nếu OCR không đọc được/timeout, response vẫn trả `uploadToken` để khách nhập tay và tiếp tục. Ảnh hỏng/sai MIME thì không tạo token.
5. Backend tự xác định khách/phòng/hợp đồng từ access token; client không được gửi `tenantId`, `roomId` để chọn dữ liệu người khác.
6. `readingValue` là integer không âm. Chuỗi OCR giữ số 0 đầu, nhưng giá trị nghiệp vụ được parse thành integer sau khi qua regex/độ dài cấu hình.
7. Kỳ dùng `YYYY-MM`; thời gian response dùng ISO 8601 có offset. Mốc ngày theo `Asia/Ho_Chi_Minh`.
8. Chỉ số gửi lại trong trạng thái `CHO_XAC_NHAN` cập nhật bản hiện tại nhưng phải lưu revision/audit cũ. Yêu cầu khách chụp lại được biểu diễn bằng `correctionRequested: true`, không tạo thêm trạng thái ngoài SM-03. Không dùng HTTP DELETE.

## 4. Quy ước chung API công khai

### 4.1 Headers

```http
Authorization: Bearer <access-token>
X-Request-Id: <uuid>                 # optional từ client; server sinh nếu thiếu
Idempotency-Key: <uuid>              # bắt buộc với POST submit/confirm/correction-request/manual
If-Match: "<version>"                # bắt buộc với thao tác sửa/xác nhận/từ chối
```

`Content-Type: application/json` trừ endpoint upload dùng `multipart/form-data`. Không tự đặt `Content-Type` multipart ở browser; để runtime thêm boundary.

### 4.2 Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": null,
  "correlationId": "01J..."
}
```

Danh sách dùng `meta: { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 }`.

### 4.3 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "READING_BELOW_PREVIOUS",
    "message": "Chỉ số điện không được nhỏ hơn chỉ số kỳ trước.",
    "details": { "previousReading": 180, "submittedReading": 179 }
  },
  "correlationId": "01J..."
}
```

| HTTP | Dùng khi |
|---|---|
| 400 | JSON/multipart hỏng, thiếu file. |
| 401 | Thiếu/hết hạn token. |
| 403 | Sai role hoặc truy cập dữ liệu không thuộc mình. |
| 404 | Không có phòng/hợp đồng/reading trong phạm vi được phép. |
| 409 | Đã xác nhận, kỳ đã có phiếu, version cũ, kỳ đã có reading không cho tạo mới. |
| 413 | Ảnh lớn hơn giới hạn cấu hình (mặc định 10 MB). |
| 415 | MIME thực không phải JPEG/PNG. |
| 422 | Dữ liệu đúng cú pháp nhưng vi phạm nghiệp vụ. |
| 503 | Hạ tầng upload/private storage không sẵn sàng nên chưa thể giữ ảnh; không tạo dữ liệu dở. OCR không sẵn sàng nhưng ảnh đã giữ được thì map sang preview `MANUAL_REQUIRED` (HTTP 200). |

## 5. API cho Khách thuê — UC-09

### 5.1 Lấy context kỳ hiện tại

`GET /api/v1/me/meter-reading-context?period=2026-10`

Response `200`:

```json
{
  "success": true,
  "data": {
    "period": "2026-10",
    "submissionWindowOpen": true,
    "room": { "id": "room_101", "code": "P101", "buildingName": "Căn A" },
    "previousReading": { "value": 180, "recordedAt": "2026-09-01T08:00:00+07:00" },
    "current": null,
    "imagePolicy": { "mimeTypes": ["image/jpeg", "image/png"], "maxBytes": 10485760 }
  },
  "meta": null,
  "correlationId": "01J..."
}
```

Nếu đang có bản ghi `CHO_XAC_NHAN`, `current` chứa DTO ở mục 7 để UI cho gửi lại; nếu `DA_XAC_NHAN`, UI chỉ xem. Ngoài thời gian nhập trả `200` với `submissionWindowOpen: false`; server vẫn là nơi chặn submit bằng `422 SUBMISSION_WINDOW_CLOSED`.

### 5.2 Upload ảnh và lấy OCR preview

`POST /api/v1/me/meter-reading-ocr-previews`

Request multipart:

```text
file: <binary JPEG/PNG>               required
period: 2026-10                       required
```

Response `200` khi đọc được:

```json
{
  "success": true,
  "data": {
    "uploadToken": "upl_01J...",
    "expiresAt": "2026-10-01T09:15:00+07:00",
    "ocrStatus": "RECOGNIZED",
    "ocrValue": "000210",
    "suggestedReading": 210,
    "previousReading": 180,
    "canSubmit": true,
    "warnings": []
  },
  "meta": null,
  "correlationId": "01J..."
}
```

Response `200` khi model không đọc được hoặc timeout (fallback có chủ đích, không phải lỗi HTTP đối với UI):

```json
{
  "success": true,
  "data": {
    "uploadToken": "upl_01J...",
    "expiresAt": "2026-10-01T09:15:00+07:00",
    "ocrStatus": "MANUAL_REQUIRED",
    "ocrValue": null,
    "suggestedReading": null,
    "previousReading": 180,
    "canSubmit": false,
    "warnings": [{ "code": "OCR_FAILED", "message": "Không đọc được chỉ số. Vui lòng chụp lại hoặc nhập tay." }]
  },
  "meta": null,
  "correlationId": "01J..."
}
```

`canSubmit` trong preview chỉ phản ánh đề xuất OCR; sau khi khách nhập tay hợp lệ UI có thể submit. Preview không tạo meter reading và không gửi thông báo.

### 5.3 Gửi chỉ số chờ Chủ trọ xác nhận

`POST /api/v1/me/meter-readings`

```json
{
  "period": "2026-10",
  "uploadToken": "upl_01J...",
  "readingValue": 210,
  "ocrValue": "000210",
  "entryMode": "OCR_ACCEPTED",
  "note": null
}
```

`entryMode`:

- `OCR_ACCEPTED`: `readingValue` bằng giá trị parse từ `ocrValue`.
- `OCR_CORRECTED`: OCR có kết quả nhưng khách sửa tay; server tự xác minh khác biệt và đặt `manuallyCorrected: true`.
- `MANUAL_AFTER_OCR_FAILURE`: OCR lỗi/timeout, khách nhập tay; `ocrValue` phải là `null`.

Client không được tự quyết cờ `manuallyCorrected`; server suy ra từ preview gắn với `uploadToken`. `readingValue < previousReading` trả `422 READING_BELOW_PREVIOUS` và không tạo/cập nhật reading.

Response `201` khi tạo mới, `200` khi gửi lại bản `CHO_XAC_NHAN`:

```json
{
  "success": true,
  "data": {
    "id": "mr_01J...",
    "period": "2026-10",
    "status": "CHO_XAC_NHAN",
    "readingValue": 210,
    "previousReading": 180,
    "entryMode": "OCR_ACCEPTED",
    "manuallyCorrected": false,
    "submittedAt": "2026-10-01T08:16:00+07:00",
    "version": 1
  },
  "meta": null,
  "correlationId": "01J..."
}
```

Commit nghiệp vụ gồm reading/revision, liên kết ảnh private, audit tối thiểu và outbox `METER_READING_SUBMITTED`; nếu bất kỳ phần bắt buộc nào lỗi thì rollback toàn bộ. Consumer Kafka tạo thông báo cho Chủ trọ; lỗi consumer không rollback submission đã commit.

## 6. API cho Chủ trọ — UC-10

### 6.1 Danh sách và chi tiết

`GET /api/v1/meter-readings?period=2026-10&buildingId=bld_01&status=CHO_XAC_NHAN&page=1&pageSize=20`

`GET /api/v1/meter-readings/{readingId}`

DTO chi tiết theo mục 7. Chỉ Chủ trọ được gọi danh sách toàn chuỗi. Ảnh không trả URL public vĩnh viễn; response trả `evidenceImage.downloadUrl` có thời hạn ngắn và endpoint tải vẫn kiểm authorization.

### 6.2 Sửa bản chưa xác nhận

`PATCH /api/v1/meter-readings/{readingId}` với `If-Match`:

```json
{
  "readingValue": 212,
  "reason": "Ảnh rõ số cuối là 2"
}
```

Chỉ cho sửa `CHO_XAC_NHAN`; reason bắt buộc; lưu audit old/new/actor/time. Response `200` trả DTO mới và tăng `version`.

### 6.3 Xác nhận

`POST /api/v1/meter-readings/{readingId}/confirmations` với `Idempotency-Key` và `If-Match`.

```json
{ "note": null }
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": "mr_01J...",
    "status": "DA_XAC_NHAN",
    "period": "2026-10",
    "previousReading": 180,
    "readingValue": 210,
    "consumptionKwh": 30,
    "unitPriceVnd": 3500,
    "electricityAmountVnd": 105000,
    "confirmedAt": "2026-10-01T10:05:00+07:00",
    "confirmedBy": { "id": "usr_owner", "displayName": "Chủ trọ" },
    "version": 2
  },
  "meta": null,
  "correlationId": "01J..."
}
```

Trong một transaction: khóa/đọc lại version và hợp đồng hiệu lực → kiểm `readingValue >= previousReading` → snapshot `unitPriceVnd` → tính consumption/amount → đổi trạng thái → audit → outbox `METER_READING_CONFIRMED`. Lặp cùng `Idempotency-Key` trả lại kết quả cũ; key khác trên reading đã xác nhận trả `409 READING_ALREADY_CONFIRMED`.

### 6.4 Từ chối để khách gửi lại

`POST /api/v1/meter-readings/{readingId}/correction-requests`

```json
{ "reason": "Ảnh bị lóa, không nhìn rõ chữ số cuối" }
```

Response `200` giữ `status: CHO_XAC_NHAN`, đặt `correctionRequested: true`, lưu `correctionReason`, tăng version và ghi audit/outbox. Khách được upload và submit lại; lần submit mới đặt `correctionRequested: false`. Không xóa ảnh/revision cũ. Cách này khớp SM-03 (`Pending → Pending`) thay vì đưa trạng thái legacy `CAN_DIEU_CHINH` vào contract mới.

## 7. DTO meter reading chuẩn

```json
{
  "id": "mr_01J...",
  "period": "2026-10",
  "room": { "id": "room_101", "code": "P101", "buildingId": "bld_01", "buildingName": "Căn A" },
  "tenant": { "id": "tenant_01", "displayName": "Nguyễn Văn A" },
  "previousReading": 180,
  "readingValue": 210,
  "ocrValue": "000210",
  "entryMode": "OCR_ACCEPTED",
  "manuallyCorrected": false,
  "status": "CHO_XAC_NHAN",
  "correctionRequested": false,
  "correctionReason": null,
  "consumptionKwh": null,
  "unitPriceVnd": 3500,
  "electricityAmountVnd": null,
  "evidenceImage": {
    "id": "file_01J...",
    "downloadUrl": "/api/v1/private-files/file_01J...?token=short-lived",
    "expiresAt": "2026-10-01T10:10:00+07:00"
  },
  "submittedAt": "2026-10-01T08:16:00+07:00",
  "confirmedAt": null,
  "version": 1
}
```

Enum công khai:

- `status`: `CHO_XAC_NHAN | DA_XAC_NHAN`.
- `ocrStatus`: `RECOGNIZED | MANUAL_REQUIRED`.
- `entryMode`: `OCR_ACCEPTED | OCR_CORRECTED | MANUAL_AFTER_OCR_FAILURE | LANDLORD_MANUAL`.

Database hiện dùng `DECIMAL`, bảng tên `dien_nuoc` và enum legacy có `CAN_DIEU_CHINH`; khi triển khai phải migration có kiểm soát sang invariant integer cho chỉ số/kWh/VND và biểu diễn yêu cầu sửa bằng cờ/reason, hoặc chuyển đổi rõ ở repository. Không để JSON trả chuỗi decimal hay trạng thái legacy cho contract này.

## 8. Chủ trọ nhập tay khi khách chưa gửi

`POST /api/v1/meter-readings/manual`

```json
{
  "roomId": "room_101",
  "period": "2026-10",
  "readingValue": 210,
  "reason": "OCR không khả dụng, Chủ trọ chốt trực tiếp với khách"
}
```

Chỉ role Chủ trọ; `Idempotency-Key` bắt buộc. Theo SM-03, bản này được tạo thẳng `DA_XAC_NHAN`, tính tiền trong cùng transaction, `entryMode: LANDLORD_MANUAL`, có audit. Nếu đã có bản `CHO_XAC_NHAN`, endpoint trả `409 PENDING_READING_EXISTS`; Chủ trọ phải dùng sửa + xác nhận để không mất lịch sử.

## 9. Contract nội bộ APP-API ↔ OCR hiện có

### 9.1 Request thực tế

`POST {OCR_BASE_URL}/ocr`, multipart field bắt buộc tên **`file`**. Timeout cứng 30 giây; APP-API có thể retry tối đa một lần chỉ khi chưa nhận response và còn trong ngân sách thời gian. OCR service không được public ra Internet.

### 9.2 Response thực tế

Thành công:

```json
{ "success": true, "ocr_value": "012345", "error_code": null }
```

Không nhận dạng được (HTTP 200):

```json
{ "success": false, "ocr_value": null, "error_code": "METER_DISPLAY_NOT_FOUND" }
```

hoặc `OCR_FAILED`. OCR hiện trả HTTP `400` cho file rỗng/không decode được và `415` nếu `content_type` không bắt đầu bằng `image/`.

Adapter chuẩn hóa:

```json
{
  "status": "RECOGNIZED",
  "rawValue": "012345",
  "numericValue": 12345,
  "confidence": null,
  "providerCode": null
}
```

Model hiện tại **không trả confidence**, nên `confidence` phải là `null`, không được giả lập. INT-01 trong SRS ghi dự kiến có độ tin cậy; đây là gap thiết kế đã được xử lý bằng field nullable, chưa phải lý do chặn tích hợp.

APP-API phải kiểm tra `ocr_value` bằng `^[0-9]+$` và số chữ số theo cấu hình loại công tơ trước khi trả `RECOGNIZED`. `METER_DISPLAY_NOT_FOUND`, `OCR_FAILED`, response sai schema, network error và timeout đều map sang preview `MANUAL_REQUIRED` với warning cụ thể; không lưu raw response/model path vào log nghiệp vụ.

### 9.3 Health

`GET {OCR_BASE_URL}/health` → `{ "success": true }`. Readiness APP-API không phụ thuộc cứng vào OCR: OCR down vẫn cho hệ thống chạy và UI nhập tay.

## 10. Event tối thiểu

Outbox event dùng envelope:

```json
{
  "eventId": "evt_01J...",
  "eventType": "METER_READING_SUBMITTED",
  "occurredAt": "2026-10-01T08:16:00+07:00",
  "aggregateId": "mr_01J...",
  "recipientIds": ["usr_owner"],
  "data": { "readingId": "mr_01J...", "roomCode": "P101", "period": "2026-10" },
  "correlationId": "01J...",
  "schemaVersion": 1
}
```

Cho phép `METER_READING_SUBMITTED`, `METER_READING_CORRECTION_REQUESTED`, `METER_READING_CONFIRMED`. Không đưa ảnh, token tải ảnh, số điện thoại hay dữ liệu giấy tờ vào event. Consumer deduplicate bằng `eventId`.

## 11. Acceptance/contract tests bắt buộc

1. Ảnh JPEG/PNG hợp lệ, OCR đọc `000210`, kỳ trước 180 → preview 210; submit tạo `CHO_XAC_NHAN` kèm ảnh.
2. OCR đọc sai, khách nhập 212 → `OCR_CORRECTED`, `manuallyCorrected=true`; Chủ trọ nhìn thấy cờ.
3. OCR fail/timeout → có `uploadToken`, khách nhập tay được; không có meter reading trước khi submit.
4. Ảnh giả đuôi PNG, ảnh hỏng, file 10 MB + 1 byte → lần lượt 415/400/413; không có file mồ côi lâu dài.
5. Chỉ số 179 khi kỳ trước 180 → 422 và không lưu dữ liệu dở.
6. Tenant A không đọc/sửa reading hoặc ảnh của tenant B, kể cả đoán ID → 404 hoặc 403 nhất quán.
7. Hai lần submit cùng idempotency key → một revision nghiệp vụ; hai request confirm cạnh tranh → một request thành công.
8. Xác nhận 180→210 với giá 3.500 → 30 kWh, 105.000 VND; chèn lỗi giữa transaction → vẫn `CHO_XAC_NHAN`, không có amount/audit/outbox dở.
9. Reading đã có phiếu kỳ tương ứng → sửa/xác nhận lại bị 409 theo BR-35.
10. OCR down không làm health chính hoặc các module khác chết; p95 preview mục tiêu ≤10 giây, trên 30 giây chuyển fallback.
11. Khách gửi lại bản `CHO_XAC_NHAN` đang có `correctionRequested=true` → giữ revision/ảnh cũ trong lịch sử và xóa cờ yêu cầu sửa trên revision mới.
12. UI khách không còn trường nhập “chỉ số nước”; tiền nước lấy số người đang ở theo BR-23, không qua OCR.

## 12. Việc triển khai frontend từ contract

- `nhap-chi-so-dien.html`: bỏ chỉ số nước/ước tính nước; thêm input file camera (`accept="image/jpeg,image/png"`), preview ảnh, trạng thái OCR, input chỉ số có thể sửa, cảnh báo sửa tay, nút gửi và lịch sử trạng thái.
- Tạo page script thật và service gọi ba endpoint ở mục 5 qua `ApiClient`; `ApiClient` phải hỗ trợ multipart và error envelope, không ép `Content-Type: application/json` cho `FormData`.
- `dien-nuoc.html`: đổi bảng sang kỳ/căn/phòng/trạng thái; thêm ảnh, cờ sửa tay, sửa có lý do, xác nhận/từ chối và optimistic version.
- Không nhúng `OCR_BASE_URL` vào frontend. Không lưu ảnh/token ảnh trong `localStorage` và không log binary/base64.

## 13. Điểm còn phải cấu hình, không làm đổi contract

- `OCR_BASE_URL`, timeout, số lần retry, TTL upload tạm.
- Ngày/giờ mở kỳ nhập và giới hạn ảnh (mặc định 10 MB).
- Số chữ số hợp lệ theo loại công tơ; nếu chưa quản lý loại công tơ, cho phép 1–12 chữ số và ghi quyết định trong ADR.
- Nơi lưu file private và cơ chế URL ký ngắn hạn.

Các giá trị này thuộc cấu hình triển khai; endpoint, trạng thái, envelope và trách nhiệm giữa frontend/APP-API/OCR trong tài liệu này là contract đã chốt cho slice.
