# Đối chiếu chức năng Chủ trọ hiện có trong backend với `SRS.md` và `phantich.md`

Ngày rà soát: 14/10/2026<br>
Phạm vi: mã nguồn hiện tại trong `phong-tro-backend/src`, route đã gắn vào `src/app.js`, các service/controller liên quan và test trong `phong-tro-backend/tests`.

## 1. Kết luận nhanh

Backend hiện đã có nền tảng cho hầu hết nhóm nghiệp vụ chính của Chủ trọ: xác thực, căn/phòng/tài sản, khách thuê, hợp đồng/cọc, điện, khoản phải thu, thanh toán, yêu cầu, người ở cùng, trả phòng, sự cố, thu chi, thông báo và báo cáo dòng tiền.

Tuy nhiên, nếu lấy `SRS.md` v0.3 làm chuẩn hiện hành thì hệ thống **chưa hoàn thành đầy đủ**. Các khoảng trống lớn nhất là:

1. Giữ phòng và hủy giữ phòng chưa có.
2. Chuyển phòng giữ nguyên hợp đồng chưa có.
3. Phiếu thu tự động theo lịch, cấu hình lịch và gửi phiếu chưa có.
4. “Tất cả đã đóng”, hủy lần thu có lý do và nghiệp vụ công nợ theo mốc ngày chưa hoàn chỉnh.
5. Luồng duyệt trả phòng chưa tuân thủ ngày trả đã duyệt; chức năng rút duyệt chưa có.
6. Quyết toán trả phòng chưa tự chốt điện/nước/tháng lẻ, chưa ghi nhận lần hoàn cọc thực tế và chưa tạo nợ sau thanh lý khi quyết toán âm.
7. Sự cố Chủ trọ tự tạo đang khởi tạo sai trạng thái; chưa liên kết tài sản và chưa có danh mục cấu hình.
8. Báo cáo mới là báo cáo dòng tiền cơ bản; thiếu giảm trừ, lợi nhuận, nhóm/so sánh theo căn và xuất Excel.
9. Audit/lịch sử thay đổi bắt buộc trong SRS chưa được ghi đầy đủ dù đã có model `AuditLog`.
10. Cấu hình hệ thống tại FR-200 chưa có.

## 2. Quy ước và nguồn chuẩn

### 2.1. Cách đánh giá

| Trạng thái | Ý nghĩa |
|---|---|
| **Đã có** | Có route/service thực hiện được phần nghiệp vụ chính và không thấy thiếu quy tắc cốt lõi trong phạm vi dòng đánh giá |
| **Một phần** | Có API hoặc dữ liệu nền nhưng thiếu thao tác, thiếu BR/FR, sai một phần luồng hoặc chưa có audit/lịch sử bắt buộc |
| **Chưa có** | Không tìm thấy route/service tương ứng, hoặc endpoint hiện tại chủ động trả lỗi “schema không hỗ trợ” |
| **Ngoài chuẩn / cần sửa** | Backend có chức năng nhưng chức năng đó mâu thuẫn với quyết định mới trong `SRS.md` |

“Đã có” trong tài liệu này là kết luận từ mã nguồn và test hiện có, không đồng nghĩa đã nghiệm thu UAT. Lệnh `npm test` ngày rà soát chạy đạt 37/37 test unit/regression; suite integration không thực thi do thiếu biến môi trường `TEST_DB_NAME`.

### 2.2. Quan hệ giữa hai tài liệu yêu cầu

- `phantich.md` mô tả 12 nhóm `FR-CT-01` đến `FR-CT-12` của Chủ trọ.
- `SRS.md` chuẩn hóa thành `FR-001` đến `FR-200`, bổ sung quyết định nghiệp vụ v0.3, Use Case, BR, audit và các chức năng mới.
- Khi hai tài liệu khác nhau, báo cáo ưu tiên `SRS.md` v0.3 theo chính quy tắc ưu tiên tại mục 22.8 của SRS.
- Ví dụ quan trọng: `phantich.md` còn cho “gia hạn trực tiếp”, nhưng `SRS.md` đã đánh `FR-045` là **DEPRECATED** và yêu cầu gia hạn qua yêu cầu 6/12 tháng.

## 3. Ma trận tổng hợp theo nhóm chức năng Chủ trọ

| Nhóm | `phantich.md` | `SRS.md`/UC chính | Hiện trạng backend | Đánh giá |
|---|---|---|---|---|
| Xác thực và tài khoản khách | FR-CT-01 | FR-001–019, 197–198; UC-02, UC-24 | Có đăng nhập, hồ sơ, đổi mật khẩu, tạo/khóa/mở/reset tài khoản khách | **Một phần** |
| Căn trọ | FR-CT-02 | FR-020–023; UC-03 | Có danh sách, tạo, sửa, xóa căn chưa có phòng | **Một phần** |
| Phòng và tài sản | FR-CT-03 | FR-024–029, 160–161; UC-04 | Có CRUD phòng, CRUD tài sản, chặn xóa phòng có hợp đồng | **Một phần** |
| Khách thuê | FR-CT-04 | FR-030–034; UC-05 | Có danh sách kèm hợp đồng/tài khoản, tạo, sửa, xóa khi chưa có lịch sử | **Đã có phần lõi** |
| Hợp đồng và tiền cọc | FR-CT-05 | FR-035–046, 158, 180–184, 199; UC-06 | Có tạo/sửa/xem, tạo cọc cùng transaction, cảnh báo hết hạn, CRUD/xác nhận/hủy cọc | **Một phần** |
| Giữ phòng | Không tách nhóm | FR-167–170; UC-26 | Không có model/route/service giữ phòng | **Chưa có** |
| Chuyển phòng | FR-CT-05.13 | FR-195; UC-27 (P1) | Không có API chuyển phòng | **Chưa có** |
| Tiền điện | FR-CT-06 | FR-063–070, 183; UC-10 | Có danh sách/chi tiết, nhập tay, sửa bản chờ, xác nhận, xem ảnh | **Một phần** |
| Thanh toán và công nợ | FR-CT-07 | FR-071–080, 163, 165, 171–174, 196; UC-11, UC-23 | Có ghi nhận từng lần thu, xác nhận minh chứng, tính lại còn nợ, xem nợ | **Một phần** |
| Phiếu thu/khoản phải thu | FR-CT-08 | FR-144–157, 164, 175–176, 179, 181; UC-20, UC-22 | Có tạo khoản phải thu thủ công/toàn kỳ và điều chỉnh; thiếu lịch, recurring và gửi phiếu | **Một phần** |
| Phê duyệt yêu cầu | FR-CT-09 | FR-105–112, 166, 177–178, 185–186; UC-16, UC-28 | Có danh sách, duyệt/từ chối, tự cập nhật gia hạn/trả phòng/người ở cùng | **Một phần** |
| Xử lý trả phòng | FR-CT-10 | FR-095–104, 187–190; UC-15 | Có checklist và transaction thanh lý/cọc/phòng/cư trú/tài khoản | **Một phần** |
| Sự cố | FR-CT-11 | FR-113–123, 191–192; UC-17 | Có xem, tạo, tiếp nhận, hoàn tất, phân nhánh tài chính, xóa mềm | **Một phần** |
| Thu chi và báo cáo | FR-CT-12 | FR-132–143, 193–194; UC-19 | Có CRUD khoản chi và lọc dòng tiền theo ngày/căn | **Một phần** |
| Thông báo | Rải trong các nhóm | FR-159, 162; UC-25 | Có xem, đánh dấu đọc, thông báo nghiệp vụ và broadcast | **Đã có phần lõi** |
| Tác vụ định thời/cấu hình | BR-02, BR-28, BR-29, BR-35 | FR-153–156, 158, 168, 172–173, 186, 200; UC-29 | Cron chỉ cập nhật/cảnh báo trạng thái hợp đồng; các lịch khác chưa có | **Một phần nhỏ** |

## 4. Đối chiếu chi tiết

### 4.1. Xác thực và quản lý tài khoản khách thuê

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Chủ trọ đăng nhập, xem hồ sơ | FR-011, UC-24 | `POST /api/auth/login`, `GET /api/auth/profile` | **Đã có** | Không có endpoint logout; với JWT có thể logout phía client nhưng chưa có cơ chế thu hồi token |
| Chủ trọ đổi mật khẩu | FR-198, FR-197 | `PATCH /api/v1/account/password` | **Một phần** | Chỉ chặn rỗng và giá trị `1`; chưa ép ≥ 8 ký tự gồm chữ và số |
| Xem khách kèm trạng thái tài khoản | FR-CT-01.1–01.2; FR-001 | `GET /api/management/khach-thue` include `taiKhoan` | **Đã có** | Không có endpoint tài khoản riêng; dữ liệu được trả trong danh sách khách |
| Cấp tài khoản bằng SĐT, mật khẩu mặc định `1` | FR-CT-01.3–01.5; FR-002–006; BR-01 | `POST /api/v1/accounts`; `tenantAccount.service.js` lấy SĐT và chạy transaction | **Một phần** | Có kiểm tra hợp đồng và **sự tồn tại** hồ sơ cọc, nhưng chưa yêu cầu cọc ở trạng thái đã nhận |
| Khóa/mở khóa tài khoản khách | FR-CT-01.6–01.7; FR-007–009 | `PATCH /api/v1/accounts/:id/status`; chặn thao tác nhầm tài khoản Chủ trọ | **Đã có phần lõi** | Chưa ghi lịch sử/audit mở khóa, khóa |
| Chủ trọ đặt lại mật khẩu khách | Nghiệp vụ tài khoản hiện hành | `POST /api/v1/accounts/reset-password` | **Đã có** | `SRS.md` v0.3 thiên về luồng tự động của khách ở UC-01; backend vẫn có thao tác Chủ trọ trực tiếp |
| Lưu lịch sử trạng thái tài khoản | FR-CT-01.8; FR-010; AUD-06 | Có model `AuditLog`, không thấy service trên ghi log | **Chưa có** | Cần ghi người thao tác, trước/sau và thời điểm |

### 4.2. Quản lý căn trọ

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách và chi tiết căn | FR-CT-02.1–02.3; FR-020 | `GET /api/management/can-tro` trả căn kèm phòng | **Một phần** | Không có `GET /can-tro/:id`; tìm/lọc server-side chưa có |
| Tạo căn | FR-CT-02.4; FR-021 | `POST /api/management/can-tro` | **Một phần** | Không thấy validation bắt buộc đầy đủ cho mô tả, quy định, ảnh; phụ thuộc ràng buộc model/DB |
| Sửa căn | FR-CT-02.5; FR-022 | `PUT /api/management/can-tro/:id` | **Đã có phần lõi** | Cập nhật trực tiếp `req.body`, thiếu whitelist/validation/audit |
| Chuyển Hoạt động ↔ Ngừng hoạt động | FR-CT-02.6; FR-023 | Dùng chung endpoint `PUT` | **Một phần** | Chưa chặn ngừng căn khi còn phòng Đang thuê/Đã giữ/Đang xử lý trả phòng |
| Không xóa căn đã có dữ liệu | FR-CT-02.8; BR-15 | `DELETE /api/management/can-tro/:id` chỉ cho xóa khi không có phòng | **Đã có phần lõi** | Căn rỗng vẫn được xóa vật lý; phù hợp nếu hiểu yêu cầu chỉ cấm căn đã phát sinh dữ liệu |
| Loại căn ngừng hoạt động khỏi so sánh báo cáo | FR-CT-02.7 | Báo cáo chưa có bảng so sánh căn | **Chưa có** | Cần áp dụng khi hoàn thiện UC-19 |

### 4.3. Quản lý phòng và tài sản

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách phòng, lọc theo căn/trạng thái | FR-CT-03.1; FR-024 | `GET /api/phong?ma_can=&trang_thai=` | **Đã có** | — |
| Chi tiết phòng | FR-CT-03.2; FR-026 | `GET /api/phong/:id` | **Một phần** | Trả căn nhưng không include danh sách tài sản/nội thất có cấu trúc |
| Tạo/sửa phòng | FR-CT-03.3–03.4; FR-025, FR-027–028 | `POST/PUT /api/phong`; Joi validation | **Đã có phần lõi** | Cần xác nhận ràng buộc số phòng trùng trong cùng căn ở DB; chưa có audit thay đổi giá |
| Theo dõi trạng thái phòng tự động | FR-CT-03.6; FR-160; BR-10 | Tạo hợp đồng → `DANG_THUE`; duyệt trả → `DANG_XU_LY_TRA_PHONG`; thanh lý → `TRONG` | **Một phần** | Duyệt trả đang chuyển ngay thay vì đến ngày trả được duyệt theo FR-109/186; chưa có `DA_GIU` |
| Không xóa phòng có lịch sử | FR-CT-03.8; FR-029; BR-15 | `deletePhong()` đếm hợp đồng và chặn xóa | **Đã có** | Lịch sử ngoài hợp đồng chưa được kiểm tra riêng, nhưng hợp đồng là dấu vết chính |
| CRUD tài sản của phòng | FR-CT-03.5 | `GET/POST/PUT/DELETE /api/v1/assets` | **Đã có phần lõi** | Xóa vật lý; chưa kiểm tra tài sản đã liên kết sự cố/biên bản trả phòng |
| Giá niêm yết không làm đổi hợp đồng hiện hành | FR-CT-03.7; BR-11 | Phòng và hợp đồng là hai bản ghi giá riêng | **Đã có theo cấu trúc** | Không có audit để chứng minh lịch sử thay đổi |

### 4.4. Quản lý khách thuê

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách, hồ sơ, lịch sử hợp đồng | FR-CT-04.1–04.4; FR-030, FR-034 | `GET /api/management/khach-thue` include `hopDongs`, `taiKhoan` | **Đã có phần lõi** | Không có endpoint chi tiết riêng; tìm theo tên/SĐT/CCCD server-side chưa có |
| Thêm/sửa hồ sơ | FR-CT-04.5–04.6; FR-031–033 | `POST/PUT /api/management/khach-thue` | **Một phần** | Thiếu validation rõ ràng ở controller; trùng SĐT chủ yếu phụ thuộc DB/model |
| Liên kết khách với phòng qua hợp đồng | FR-CT-04.7 | `POST /api/hop-dong` | **Đã có** | — |
| Giữ hồ sơ/lịch sử sau trả phòng | FR-CT-04.8; BR-17 | Quyết toán không xóa khách/hợp đồng; xóa khách bị chặn nếu có hợp đồng | **Đã có** | — |

### 4.5. Hợp đồng, cọc, giữ phòng và chuyển phòng

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách/chi tiết hợp đồng | FR-CT-05.6; FR-035, FR-041 | `GET /api/hop-dong`, `GET /api/hop-dong/:id` | **Đã có** | — |
| Tạo hợp đồng và cọc trong một transaction, chuyển phòng Đang thuê | FR-CT-05.1–05.4; FR-036–039 | `POST /api/hop-dong`; `hopDong.service.js` | **Một phần** | Chưa lưu chỉ số điện đầu cùng transaction; chưa thấy trường tick “đã có bản giấy ký”; phí dịch vụ/số người ở chưa đầy đủ theo SRS |
| Chặn hợp đồng chồng lấn | FR-038 | Kiểm tra hợp đồng `DANG_HIEU_LUC` trên phòng | **Một phần** | Không kiểm tra trạng thái `SAP_HET_HAN`; cần dựa thêm unique/ràng buộc DB để tránh race và đủ miền trạng thái |
| Sửa hợp đồng, giữ dữ liệu kỳ cũ | FR-CT-05.7; FR-042, FR-046 | `PUT /api/hop-dong/:id` | **Một phần** | Cập nhật trực tiếp, không xác định hiệu lực từ kỳ chưa lập phiếu và không ghi audit/lịch sử |
| Quản lý/xác nhận/hủy cọc | FR-CT-05.5; FR-043–044 | `POST/GET/PUT /api/dat-coc`, `/confirm`, `/cancel` | **Đã có phần lõi** | Cần đối chiếu chặt miền trạng thái cọc và lịch sử giao dịch; “hủy cọc” không thay thế đầy đủ nghiệp vụ giữ phòng |
| Cảnh báo và tự cập nhật trạng thái hợp đồng | FR-CT-05.10; FR-040, FR-158; BR-02 | `cron.jobs.js` chạy 08:00, cập nhật `SAP_HET_HAN/HET_HAN`, gửi thông báo Chủ trọ và khách | **Đã có phần lõi** | Lịch cố định trong code; chưa cấu hình ngưỡng và chưa có cơ chế lock/job chống chạy nhiều instance ngoài kiểm tra nội dung thông báo |
| Gia hạn qua yêu cầu | FR-108, FR-185; BR-21 | `PATCH /api/v1/requests/:id` cập nhật hợp đồng khi duyệt | **Một phần** | Dùng ngày do khách gửi, chưa bắt buộc hợp đồng `SAP_HET_HAN`, chưa tính đúng gói 6/12 tháng, không lưu lịch sử gia hạn |
| Gia hạn trực tiếp bởi Chủ trọ | `phantich.md` FR-CT-05.8; SRS FR-045 DEPRECATED | `POST /api/hop-dong/:id/renew` vẫn tồn tại | **Ngoài chuẩn / cần sửa** | Trái quyết định Q-18 của SRS v0.3; nên bỏ/khóa endpoint hoặc đổi SRS nếu nghiệp vụ thực tế muốn giữ |
| Ghi nhận vi phạm hợp đồng | FR-CT-05.12; FR-199; BR-24 | Có model dữ liệu liên quan nhưng không có route/service | **Chưa có** | Thiếu tạo/xem vi phạm và liên kết vào quyết toán |
| In hợp đồng | FR-184 (Could) | Không có endpoint xuất/in | **Chưa có** | Mức ưu tiên Could |
| Giữ/hủy giữ phòng, hoàn tiền giữ | FR-167–170; UC-26; BR-41 | Không có route/service | **Chưa có** | Thiếu toàn bộ vòng đời giữ phòng và job nhắc quá hạn |
| Chuyển phòng giữ hợp đồng | FR-CT-05.13; FR-195; UC-27 (P1) | Không có route/service | **Chưa có** | Thiếu chốt điện phòng cũ, chỉ số đầu phòng mới và lịch sử chuyển |

### 4.6. Quản lý chỉ số và tiền điện

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Xem danh sách theo kỳ/trạng thái và chi tiết | FR-CT-06.1–06.4; FR-063–064, FR-067 | `GET /api/v1/meter-readings`, `GET /:readingId`, file riêng tư | **Một phần** | Chưa lọc theo căn trực tiếp; DTO chưa trả lượng tiêu thụ và tổng tiền điện |
| Chủ trọ xác nhận chỉ số khách gửi | FR-CT-06.5; FR-068 | `POST /api/v1/meter-readings/:id/confirmations` | **Đã có phần lõi** | Chưa thấy audit sự kiện xác nhận ngoài cột người/ngày xác nhận |
| Chủ trọ nhập chỉ số thủ công | FR-CT-06.6; FR-065 | `POST /api/v1/meter-readings/manual` | **Đã có** | Chỉ nhập số; không hỗ trợ Chủ trọ tải ảnh + OCR như yêu cầu |
| Chủ trọ thêm bằng ảnh/OCR | FR-CT-06.6 | Endpoint OCR preview `/me/...` dùng `ma_khach_thue` của người đăng nhập | **Chưa có cho Chủ trọ** | Chủ trọ không có `ma_khach_thue`, nên không thể dùng đúng luồng preview hiện tại |
| Sửa chỉ số | FR-CT-06.7; FR-066 | `PATCH /api/v1/meter-readings/:id` | **Một phần** | Chỉ sửa bản `CHO_XAC_NHAN`; lý do được yêu cầu nhưng không được lưu; không có lịch sử và không trả phép tính lại |
| Xóa chỉ số | FR-CT-06.8; BR-36 | Không có route DELETE | **Chưa có** | — |
| Tính lượng điện và tiền điện | FR-CT-06.9; FR-069; BR-04 | `billGeneration.service.js` tính khi sinh khoản phải thu | **Một phần** | Không lưu/hiển thị phép tính ngay khi xác nhận; thiếu audit lịch sử tiền điện |
| Chỉ số đầu hợp đồng | FR-CT-06.10; FR-183; BR-41 | `createHopDong()` không tạo `ChiSoDien` | **Chưa có** | Vì vậy kỳ đầu chỉ chạy được nếu dữ liệu chỉ số đã được tạo ngoài luồng |
| Lịch sử chỉ số/tiền điện | FR-CT-06.11; FR-070; AUD-01 | Bản ghi kỳ được giữ nhưng sửa cập nhật tại chỗ | **Một phần** | Chưa có bảng/event lịch sử cho từng lần sửa |

### 4.7. Khoản phải thu, thanh toán và công nợ

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Xem khoản phải thu theo kỳ/trạng thái/phòng/khách và chi tiết | FR-071–072, FR-144–145 | `GET /api/khoan-phai-thu`, `GET /:id` | **Một phần** | Chưa lọc theo căn trực tiếp; tên model `ThanhToan` đang đại diện kỳ phải trả/phiếu |
| Tạo khoản phải thu thủ công | FR-147–151, FR-157 | `POST /api/khoan-phai-thu` | **Một phần** | Tạo từng hợp đồng; chưa có API preview và chọn nhiều phòng; giảm trừ chưa tạo dòng riêng nên có nguy cơ tổng chi tiết không khớp khi tạo |
| Sinh khoản phải thu cho toàn kỳ | FR-148, FR-153–156, FR-179 | `POST /api/v1/bills/generate` | **Một phần** | Có chống trùng và bỏ phòng thiếu điện, tính nước theo người; phí dịch vụ đang cố định 0, không có lịch tự động/gửi phiếu, không hỗ trợ kỳ lẻ đầu hợp đồng |
| Phí phát sinh và giảm trừ | FR-164, FR-175–176; UC-22 | `POST /api/v1/discounts`, `POST /api/v1/bills/:id/adjustments` | **Một phần** | Chỉ điều chỉnh trực tiếp phiếu hiện có; không có cấu hình Cố định/Theo kỳ, bật/tắt, recurring; lý do được nối vào diễn giải thay vì audit bất biến |
| Ghi nhận từng lần thanh toán | FR-073, FR-076–080; BR-34 | `POST /api/khoan-phai-thu/payment/create` với `Idempotency-Key` và transaction | **Đã có phần lõi** | Không lưu rõ người ghi nhận trong bản ghi giao dịch; thông báo được tạo ngoài transaction chính |
| Không thu vượt số còn thiếu | FR-171; BR-46 | `thanhToan.service.js` chặn `amount > so_tien_con_no` | **Đã có** | — |
| Xem danh sách/chi tiết giao dịch và thống kê | FR-079 | `GET /payment/list`, `/payment/:id`, `/payment/stats` | **Đã có phần lõi** | Stats chỉ tổng đơn giản; cần kiểm tra alias Sequelize khi chạy integration thật |
| Xem và xác nhận minh chứng | FR-084–086, FR-163; BR-25 | `POST /payment/:id/confirm`; danh sách giao dịch có `minh_chung_url` | **Một phần** | Backend không có endpoint upload minh chứng trong bộ route hiện tại; xác nhận là luồng riêng trong khi SRS v0.3 nói tự đối chiếu khi Chủ trọ lưu thanh toán |
| Đánh dấu “Đã đóng” | FR-074 | Có thể nhập đúng toàn bộ số còn lại qua API thanh toán | **Một phần** | Không có endpoint/ý nghĩa riêng cho checkbox “Đã đóng” |
| “Tất cả đã đóng” nguyên tử theo căn/kỳ | FR-075 | Không có route/service | **Chưa có** | — |
| Hủy một lần thu kèm lý do, không xóa lịch sử | FR-079; BR-34 | Không có route hủy giao dịch | **Chưa có** | Không nên triển khai bằng xóa vật lý |
| Xem công nợ | FR-165, FR-196; UC-23 | `GET /api/v1/debt`; `GET /khach-thue/:id`; danh sách quá hạn | **Một phần** | Chưa trả tuổi nợ/nhóm theo căn-phòng-khách rõ ràng; chưa có luồng riêng thu nợ cũ sau khi tài khoản bị khóa |
| Mốc nhắc ngày 05, quá hạn ngày 06, chốt nợ cuối ngày 10 | FR-078, FR-172–173; BR-19 | Có endpoint thủ công `/jobs/remind-due-bills`, `/jobs/close-overdue-debt`; `getOverdueBills()` dùng sau ngày 10 | **Một phần nhỏ** | Không có cron cho hai job; “close” chỉ đếm bản ghi, không ghi cờ/công nợ idempotent; chưa gắn cờ quá hạn từ ngày 06 |

### 4.8. Yêu cầu, phê duyệt và người ở cùng

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Xem danh sách yêu cầu | FR-CT-09.1–09.2; FR-105–106 | `GET /api/v1/requests` | **Một phần** | Trả `YeuCau` cơ bản, không include đầy đủ chi tiết khách/phòng/hợp đồng/subtype trong cùng response |
| Duyệt/từ chối yêu cầu và thông báo kết quả | FR-107, FR-111–112; BR-36 | `PATCH /api/v1/requests/:id` | **Một phần** | Có từ chối nhưng không bắt buộc/lưu lý do; thông báo không có lý do từ chối |
| Duyệt gia hạn | FR-108, FR-185 | Cập nhật hợp đồng trong cùng transaction | **Một phần** | Chưa áp gói 6/12 tháng và chưa lưu lịch sử gia hạn |
| Duyệt trả phòng | FR-109, FR-186; BR-45 | Chuyển phòng sang `DANG_XU_LY_TRA_PHONG` ngay khi duyệt | **Một phần / sai thời điểm** | SRS yêu cầu lưu ngày trả và chỉ chuyển phòng đúng ngày; chưa hỗ trợ ngoại lệ trả sớm có lý do |
| Rút duyệt trả phòng | FR-109 | `/requests/:id/revoke` chủ động trả HTTP 409 | **Chưa có** | Schema hiện tại không có trạng thái/lịch sử phù hợp |
| Duyệt đề xuất người ở cùng | FR-166–178; UC-28 | `coTenant.service.js` tạo cư trú sau khi yêu cầu được duyệt; có chặn sức chứa/trùng SĐT | **Một phần** | Chỉ lưu họ tên/SĐT; thiếu giấy tờ, ngày sinh, giới tính, địa chỉ, quan hệ, ngày bắt đầu theo quyết định N-10 |
| Từ chối người ở cùng có lý do | FR-177 | Dùng từ chối yêu cầu chung | **Một phần** | Không lưu/gửi lý do |
| Đánh dấu người ở cùng đã rời | FR-178 | `PATCH /api/v1/co-tenants/:id` với `DA_ROI` | **Đã có phần lõi** | Chưa kiểm soát hiệu lực từ kỳ kế tiếp và chưa ghi audit |

### 4.9. Xử lý trả phòng và thanh lý

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách yêu cầu trả phòng | FR-095 | `GET /api/v1/move-outs` | **Đã có phần lõi** | Trả yêu cầu và mã hợp đồng, chưa trả trọn form tổng hợp |
| Hiển thị dữ liệu phục vụ quyết toán | FR-096, FR-100, FR-187 | Frontend phải ghép từ nhiều API; settle service tự đọc cọc/nợ/điện | **Một phần** | Không có endpoint context riêng trả khách, phòng, cọc, điện, tài sản, nợ và khoản khách chịu trong một snapshot |
| Chốt điện/nước/tháng lẻ | FR-097–098, FR-180, FR-190 | `moveOut.service.js` chỉ kiểm tra có một chỉ số điện đã xác nhận gần nhất | **Chưa có đầy đủ** | Không nhận/chốt chỉ số cuối, không tính điện/nước cuối kỳ, không hoàn tiền phòng trả trước theo ngày |
| Kiểm tra phòng/tài sản/hư hỏng | FR-099 | Payload bắt buộc `assetsChecked` và `roomCondition` | **Một phần** | Chỉ lưu mô tả tổng; không có dòng tài sản hỏng/mất và chi phí bồi thường chi tiết |
| Công nợ, khấu trừ, tính cọc hoàn | FR-101–103, FR-187 | Tính tổng nợ, buộc deduction ≥ nợ, tạo `KhoanKhauTru`, chặn thiếu checklist | **Một phần** | Không tự đưa mọi khoản khách chịu vào bảng quyết toán; phần deduction vượt cọc không tạo nợ sau thanh lý |
| Thanh lý nguyên tử | FR-104; BR-17, BR-22 | `POST /api/v1/move-outs/:contractId/settle`; transaction cập nhật biên bản, cọc, cư trú, hợp đồng, phòng, tài khoản và thông báo | **Đã có phần lõi** | Chỉ khóa tài khoản nếu không còn hợp đồng khác là hợp lý; cần audit nghiệp vụ đầy đủ |
| Ghi nhận đã hoàn tiền cọc thực tế | FR-188 | Service đặt `so_tien_da_hoan = refund` ngay lúc quyết toán | **Một phần / sai nghĩa** | Việc hoàn thực tế diễn ra ngoài hệ thống; cần thao tác riêng lưu ngày/số tiền đã hoàn, không đồng nhất “cọc được hoàn” với “đã hoàn” |
| Ghi nợ sau thanh lý khi quyết toán âm | FR-189 | Không có | **Chưa có** | — |

### 4.10. Quản lý sự cố

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách/chi tiết/lọc sự cố | FR-113–114 | `GET /api/v1/incidents` | **Một phần** | Route không áp query lọc trạng thái và không có detail endpoint riêng |
| Tiếp nhận, đổi loại/ưu tiên | FR-115 | `PATCH /api/v1/incidents/:id` chuyển `CHO_TIEP_NHAN → DANG_XU_LY` | **Một phần** | Service không cập nhật loại/mức ưu tiên từ payload khi tiếp nhận |
| Chủ trọ tự tạo sự cố | FR-116 | `POST /api/v1/incidents` cho mọi actor | **Một phần / sai trạng thái** | Luôn tạo `CHO_TIEP_NHAN`; yêu cầu Chủ trọ tự tạo phải bắt đầu `DANG_XU_LY` và ghi người/thời điểm tiếp nhận |
| Liên kết tài sản và danh mục cấu hình | FR-117, FR-191 | Không thấy thao tác `SuCoTaiSan` hoặc API danh mục | **Chưa có** | Chỉ lưu chuỗi loại sự cố; chưa hỗ trợ khu vực chung |
| Cập nhật dở dang khi đang xử lý | FR-119 | PATCH cho phép giữ `DANG_XU_LY` | **Một phần** | Patch hiện không lưu kết quả trung gian/thiết bị/chi phí nếu chưa chuyển `DA_XU_LY` |
| Hoàn tất sự cố, Chủ trọ chịu chi phí | FR-118, FR-120–121, FR-123 | Transaction tạo `KhoanChi`, cập nhật sự cố, thông báo khách | **Đã có phần lõi** | Thông báo gửi theo `ma_nguoi_gui`; cần đảm bảo đó là tài khoản hợp lệ cho mọi sự cố Chủ trọ tự tạo |
| Hoàn tất sự cố, khách chịu chi phí | `phantich.md` FR-CT-11.8; SRS FR-122/BR-48 | Backend cộng `ChiTietThanhToan` vào kỳ chưa hoàn thành | **Mâu thuẫn chuẩn** | `phantich.md` cho cộng kỳ gần nhất; SRS v0.3/CON-02 yêu cầu không tự cộng phiếu mà đưa vào khấu trừ cọc khi trả phòng. Backend đang theo tài liệu cũ |
| Xóa/hủy sự cố chưa xử lý | FR-CT-11.10; FR-192; BR-50 | `DELETE /api/v1/incidents/:id`, xóa mềm, bắt buộc lý do, chặn khi đã xử lý/tài chính | **Đã có phần lõi** | Chưa ghi `AuditLog`; chưa có liên kết sự cố mới tham chiếu sự cố cũ |

### 4.11. Thu chi và báo cáo

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Danh sách và ghi khoản chi thủ công | FR-CT-12.3–12.4, 12.9; FR-138–140 | `GET/POST/PUT/DELETE /api/management/thu-chi` | **Một phần** | Không thấy validation số tiền/phạm vi tại controller; sửa cập nhật trực tiếp |
| Chi phí sửa chữa tự động | FR-CT-12.8; FR-134, FR-141 | `incident.service.js` tạo `KhoanChi` khi Chủ trọ chịu | **Đã có** | — |
| Sửa/hủy mềm khoản chi có lý do/audit | FR-193 | Có PUT và DELETE | **Một phần / chưa đúng** | DELETE xóa vật lý, không bắt lý do, không audit |
| Lọc báo cáo theo thời gian và căn | FR-132, FR-143 | `GET /api/v1/reports/cashflow?from=&to=&buildingId=`; validate ngày | **Một phần** | Chỉ nhận khoảng ngày, chưa có giao diện nghiệp vụ tháng/quý/năm và mặc định tháng hiện tại trong service |
| Tính doanh thu thực thu và tổng chi | FR-133–134; BR-44 | Cộng `KhoanThu` hiệu lực và `KhoanChi` | **Một phần** | Chưa tách doanh thu theo loại; chưa xử lý/hiển thị giảm trừ theo công thức BR-44 |
| Tính lợi nhuận | FR-135 | Response có `totalCollected`, `totalExpenses` | **Một phần** | Không trả trường lợi nhuận và chưa trừ giảm trừ theo SRS |
| Chi tiết thu/chi | FR-137 | Response trả mảng `receipts`, `expenses` | **Một phần** | Chưa include phòng, sự cố và đầy đủ nhãn căn trong cùng response |
| Kết quả theo từng căn và so sánh căn | FR-136, FR-142 | Không có grouping/comparison | **Chưa có** | — |
| Xuất Excel | FR-194 (Could) | Không có | **Chưa có** | Mức ưu tiên Could |

### 4.12. Thông báo, tác vụ định thời và cấu hình

| Chức năng yêu cầu | Tham chiếu | Bằng chứng backend hiện tại | Đánh giá | Phần còn thiếu/sai |
|---|---|---|---|---|
| Xem thông báo của chính mình, đánh dấu đã đọc | FR-162; UC-25 | `GET /api/v1/notifications`, `PATCH /:id/read`; thêm alias `GET /api/thong-bao` | **Đã có** | — |
| Chủ trọ phát thông báo cho khách | Chức năng bổ sung hiện có | `POST /api/v1/notifications/broadcast` | **Đã có** | Không được mô tả thành FR riêng trong hai tài liệu, nhưng phù hợp phạm vi quản lý |
| Thông báo không trùng và đúng đối tượng | FR-159 | Job hợp đồng kiểm tra nội dung đã tồn tại; các luồng khác tạo trực tiếp | **Một phần** | Chưa có cơ chế outbox/idempotency dùng thống nhất dù model `OutboxEvent` đã tồn tại |
| Job trạng thái/cảnh báo hợp đồng | FR-040, FR-158; UC-29 | Cron 08:00 mỗi ngày | **Đã có phần lõi** | Thiếu cấu hình ngưỡng và bảo đảm một lần chạy trong triển khai nhiều instance |
| Job lập/gửi phiếu | FR-152–156; BR-28, BR-29 | Không có cron tương ứng | **Chưa có** | — |
| Job nhắc/quá hạn/chốt công nợ | FR-172–173 | Chỉ có endpoint gọi tay, không có cron hoàn chỉnh | **Chưa có đầy đủ** | — |
| Job giữ phòng quá hạn | FR-168 | Không có | **Chưa có** | — |
| Job chuyển phòng đúng ngày trả | FR-186 | Không có | **Chưa có** | Backend đang chuyển trạng thái ngay lúc duyệt |
| Cấu hình mốc ngày, lịch phiếu, danh mục, giới hạn ảnh | FR-200; NFR-013 | Một số giá trị hard-code/env (`MAX_FILE_SIZE`, cron 08:00, ngày 10) | **Chưa có** | Thiếu CRUD cấu hình và nguồn cấu hình tập trung |

## 5. Danh mục API Chủ trọ hiện có trong backend

Các endpoint dưới đây là API thực tế đã được mount trong `src/app.js`. Danh sách này giúp phân biệt “backend đã có” với chức năng chỉ được mô tả trong tài liệu.

| Nhóm | Endpoint chính hiện có |
|---|---|
| Xác thực | `POST /api/auth/login`, `GET /api/auth/profile`, `PATCH /api/v1/account/password` |
| Tài khoản khách | `POST /api/v1/accounts`, `PATCH /api/v1/accounts/:id/status`, `POST /api/v1/accounts/reset-password` |
| Căn trọ | `GET/POST /api/management/can-tro`, `PUT/DELETE /api/management/can-tro/:id` |
| Phòng | `GET/POST /api/phong`, `GET/PUT/DELETE /api/phong/:id` |
| Tài sản | `GET/POST /api/v1/assets`, `PUT/DELETE /api/v1/assets/:id` |
| Khách thuê | `GET/POST /api/management/khach-thue`, `PUT/DELETE /api/management/khach-thue/:id` |
| Hợp đồng | `GET/POST /api/hop-dong`, `GET/PUT /api/hop-dong/:id`, `GET /api/hop-dong/expiring`, `POST /api/hop-dong/:id/renew` |
| Cọc | `GET/POST /api/dat-coc`, `GET/PUT /api/dat-coc/:id`, `POST /api/dat-coc/:id/confirm`, `POST /api/dat-coc/:id/cancel` |
| Điện | `GET /api/v1/meter-readings`, `GET/PATCH /api/v1/meter-readings/:id`, `POST /:id/confirmations`, `POST /meter-readings/manual`, `GET /private-files/:id` |
| Khoản phải thu | `GET/POST /api/khoan-phai-thu`, `GET /api/khoan-phai-thu/:id`, `GET /list/overdue`, `GET /khach-thue/:id`, `POST /api/v1/bills/generate`, `POST /api/v1/bills/:id/adjustments`, `POST /api/v1/discounts` |
| Thanh toán | `POST /api/khoan-phai-thu/payment/create`, `GET /payment/list`, `GET /payment/:id`, `GET /payment/stats`, `POST /payment/:id/confirm` |
| Công nợ/job thủ công | `GET /api/v1/debt`, `POST /api/v1/jobs/close-overdue-debt`, `POST /api/v1/jobs/remind-due-bills` |
| Yêu cầu | `GET /api/v1/requests`, `PATCH /api/v1/requests/:id`; revoke/withdraw hiện trả 409 |
| Người ở cùng | `GET /api/v1/co-tenants`, `PATCH /api/v1/co-tenants/:id` |
| Trả phòng | `GET /api/v1/move-outs`, `POST /api/v1/move-outs/:contractId/settle` |
| Sự cố | `GET/POST /api/v1/incidents`, `PATCH/DELETE /api/v1/incidents/:id` |
| Thu chi | `GET/POST /api/management/thu-chi`, `PUT/DELETE /api/management/thu-chi/:id` |
| Thông báo | `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/broadcast` |
| Báo cáo | `GET /api/v1/reports/cashflow` |

## 6. Danh sách chức năng còn thiếu nên ưu tiên

### P0 — Chặn hoàn thành nghiệp vụ/MVP theo SRS

1. Sửa phê duyệt trả phòng: lưu ngày trả, chỉ chuyển phòng đúng ngày, hỗ trợ rút duyệt có lý do.
2. Hoàn thiện quyết toán: chốt điện/nước/tháng lẻ, dòng hư hỏng/vi phạm, khoản khách chịu, nợ sau thanh lý, ghi nhận hoàn cọc thực tế.
3. Hoàn thiện phiếu thu: preview, chọn nhiều phòng, phí dịch vụ, giảm trừ có audit, lịch tự động, gửi phiếu, không trùng.
4. Hoàn thiện công nợ: cờ quá hạn, cron ngày 05/06/10, hủy lần thu có lý do, thu nợ cũ sau khóa tài khoản.
5. Sửa nhánh sự cố khách chịu theo `SRS.md` v0.3: đưa vào quyết toán/cọc, không tự cộng vào phiếu đang mở.
6. Bổ sung audit cho tài khoản, hợp đồng, chỉ số điện, khoản chi, yêu cầu và điều chỉnh tài chính.

### P1 — Chức năng Must còn thiếu

1. Giữ phòng/hủy giữ/hoàn tiền giữ và nhắc quá hạn.
2. Chỉ số điện đầu hợp đồng; luồng ảnh/OCR cho Chủ trọ; xóa chỉ số đúng BR.
3. Người ở cùng đủ bộ thông tin theo N-10 và từ chối có lý do.
4. Ghi nhận vi phạm hợp đồng.
5. Báo cáo lợi nhuận/giảm trừ, grouping và so sánh theo căn.
6. Cấu hình hệ thống FR-200.
7. Kiểm tra cọc **đã nhận** trước khi cấp tài khoản.
8. Ràng buộc mật khẩu mới theo FR-197.

### P2 — Should/Could hoặc giai đoạn sau

1. Chuyển phòng giữ nguyên hợp đồng (P1 trong SRS, tức sau MVP).
2. In hợp đồng.
3. Xuất báo cáo Excel.
4. Liên kết sự cố mới với sự cố cũ.

## 7. Bằng chứng mã nguồn chính đã dùng để đối chiếu

- Mount route: `phong-tro-backend/src/app.js`.
- Phân quyền: `phong-tro-backend/src/config/roleAccess.js`.
- Route nghiệp vụ mở rộng: `phong-tro-backend/src/routes/mvp.routes.js`.
- Route điện: `phong-tro-backend/src/routes/meterReading.routes.js`.
- Căn/khách/thu chi: `phong-tro-backend/src/controllers/management.controller.js`.
- Phòng: `phong-tro-backend/src/services/phong.service.js`.
- Hợp đồng: `phong-tro-backend/src/services/hopDong.service.js`.
- Tài khoản khách: `phong-tro-backend/src/services/tenantAccount.service.js`.
- Điện/OCR: `phong-tro-backend/src/controllers/meterReading.controller.js`, `src/services/meterReading.service.js`.
- Khoản phải thu/thanh toán: `src/services/khoanPhaiThu.service.js`, `billGeneration.service.js`, `billAdjustment.service.js`, `thanhToan.service.js`, `paymentConfirmation.service.js`.
- Trả phòng: `phong-tro-backend/src/services/moveOut.service.js`.
- Sự cố: `phong-tro-backend/src/services/incident.service.js`.
- Người ở cùng: `phong-tro-backend/src/services/coTenant.service.js`.
- Báo cáo: `phong-tro-backend/src/services/cashflowReport.service.js`.
- Tác vụ định thời: `phong-tro-backend/src/jobs/cron.jobs.js`.

## 8. Lưu ý kiểm thử

- Đã chạy: `npm test` tại `phong-tro-backend`.
- Kết quả unit/regression: **37 đạt, 0 lỗi**.
- Integration: **chưa chạy**, runner báo thiếu `TEST_DB_NAME`; vì vậy các đánh giá trên chủ yếu là code review + test unit/regression, không phải xác nhận toàn bộ API với database thật.
- Cần chạy lại integration trên database test tách biệt trước khi dùng bảng này làm biên bản nghiệm thu cuối cùng.

## 9. Cập nhật trạng thái sau đợt khắc phục (14/10/2026)

Phần này **thay thế trạng thái thực hiện** ở các mục ưu tiên phía trên. Đánh giá dựa trên mã hiện có, không chỉ dựa vào tài liệu/migration. `data2.md` là schema được test đồng bộ bằng Sequelize; các file `migrations/004` đến `011` là kế hoạch nâng cấp cho database triển khai và vẫn phải chạy theo thứ tự trên môi trường thật.

| Nhóm chức năng theo SRS/Phân tích | Tình trạng hiện tại | Bằng chứng/ghi chú |
|---|---|---|
| Audit log và cấu hình mặc định | Đã có lõi | Có `AuditLog`, helper audit và `systemConfig.service`; audit đã được gắn vào một số luồng quan trọng, chưa bao phủ toàn bộ thao tác quản trị. |
| Yêu cầu trả phòng: duyệt/từ chối/rút | Đã cải thiện, còn thiếu | Lưu ngày/lý do/trạng thái; khách có thể rút yêu cầu và phòng quay lại `DANG_THUE`. Chưa hoàn tất toàn bộ phép tính chốt điện/nước, công nợ sau thanh lý. |
| Sự cố khách chịu trách nhiệm | Đã có lõi | Không cộng thẳng vào phiếu thu. Tạo `ChiPhiSuCoKhachThue`; khi trả phòng, khoản chưa khấu trừ được đưa vào `KhoanKhauTru` từ tiền cọc. |
| Hóa đơn, điều chỉnh, xác nhận chứng từ | Đã cải thiện | Giữ endpoint xác nhận chứng từ; đã bổ sung audit cho một số bước tạo/điều chỉnh/xác nhận. Cần rà soát thêm các nhánh audit và dữ liệu thực tế. |
| Gia hạn hợp đồng trực tiếp | Khóa theo quyết định nghiệp vụ | `POST /api/hop-dong/:id/renew` trả về trạng thái khóa; không mở luồng gia hạn trực tiếp. |
| Giữ phòng, gia hạn giữ, hủy/hoàn và nhắc quá hạn | Đã có lõi | Có service, route, trạng thái phòng `DA_GIU`, lịch sử gia hạn, khoản thu giữ không hoàn lại và cron nhắc quá hạn. Cần kiểm thử tích hợp các tình huống tiền/hoàn tiền. |
| Chỉ số điện: xem/chốt/sửa/xóa | Đã có một phần | Có lọc, số tiêu thụ/tạm tính, lịch sử sửa, soft-delete và kiểm tra không xóa chỉ số đã chốt. Chưa có chỉ số đầu hợp đồng; OCR/ảnh cho Chủ trọ và một số quy tắc BR chưa hoàn tất. |
| Người ở cùng | Đã có một phần | Đề xuất/bản ghi đã có CCCD, ngày sinh, giới tính, địa chỉ, quan hệ, ngày vào ở; duyệt tạo người ở cùng. Chưa lưu đầy đủ lý do từ chối và luồng rời phòng kỳ sau. |
| Vi phạm hợp đồng | Đã có lõi | Chủ trọ tạo/xem vi phạm theo hợp đồng; khoản được chọn có thể đưa vào khấu trừ khi trả phòng. |
| Báo cáo thu chi/lợi nhuận | Đã có một phần | Có lợi nhuận, nhóm thu/chi và khoảng tháng/quý/năm. Chưa hoàn chỉnh phân bổ giảm trừ, so sánh theo căn và toàn bộ nhãn/chỉ tiêu theo BR-44. |
| Khoản chi | Đã có một phần | Có trạng thái `HIEU_LUC`/`DA_HUY`, lý do hủy và loại trừ khoản đã hủy khỏi báo cáo. Cần bổ sung audit/validation đầy đủ cho mọi thao tác. |
| Cấu hình hệ thống, danh mục sự cố | Đã có một phần | Có model/migration và endpoint đọc/ghi cấu hình, đọc/thêm danh mục. Cấu hình lưu DB chưa được nối vào tất cả consumer (cron hiện vẫn dùng cấu hình helper/env). |
| Điều kiện cấp tài khoản và mật khẩu | Đã hoàn tất lõi | Chỉ cấp khi tiền cọc `DA_NHAN`; mật khẩu yêu cầu tối thiểu 8 ký tự, có chữ và số. |
| Căn trọ/khách thuê | Đã cải thiện | Có xem chi tiết, tìm kiếm khách và cập nhật whitelist; còn cần rà soát bảo vệ xóa tài sản/ràng buộc dữ liệu thực tế. |
| Vòng đời hợp đồng, lịch sử thao tác | Chỉ có migration, chưa hoàn tất mã | `010_contract_lifecycle_history.sql` đã tạo mục tiêu schema, nhưng model, `data2.md`, service và API lịch sử chưa đồng bộ hoàn chỉnh. Validation giấy hợp đồng mới cũng cần kiểm thử tương thích client/fixture. |
| Chuyển phòng giữ hợp đồng | Chỉ có migration | `011_room_transfer_history.sql` mới tạo schema đích; chưa có model, service, route và kiểm thử nghiệp vụ chuyển phòng. |
| In hợp đồng, xuất Excel, liên kết sự cố cũ/mới | Chưa thực hiện | Vẫn là hạng mục còn thiếu. |

### API/luồng mới đáng chú ý

| API/luồng | Trạng thái |
|---|---|
| `GET/POST /api/v1/reservations`, `PATCH /api/v1/reservations/:id/extend`, `POST /api/v1/reservations/:id/cancel` | Đã thêm |
| `DELETE` chỉ số điện, sửa có lý do và lịch sử sửa | Đã thêm |
| `GET/POST /api/v1/contracts/:id/violations` | Đã thêm |
| Báo cáo dòng tiền theo tháng/quý/năm | Đã mở rộng |
| `GET/PUT /api/v1/system-config/:key` và danh mục sự cố | Đã thêm (cần hoàn thiện wiring cấu hình DB) |
| Xác nhận chứng từ thanh toán | Giữ nguyên theo quyết định nghiệp vụ |

### Việc còn phải làm trước nghiệm thu

1. Hoàn tất đồng bộ migration `010`/`011` vào model, `data2.md`, service, route, RBAC, audit và test; chưa được xem là chức năng đã bàn giao.
2. Bổ sung chỉ số đầu hợp đồng, chốt công nợ/điện/nước khi trả phòng, nợ sau thanh lý và các quy tắc BR còn thiếu.
3. Gắn cấu hình lưu DB vào cron/các consumer, đồng thời tăng audit và validation cho các API quản trị còn lại.
4. Chạy migration `004` → `011` trên bản sao database theo đúng thứ tự và kiểm tra tương thích dữ liệu cũ trước production; một số `ALTER TABLE` không phải thao tác có thể chạy lặp vô điều kiện.
5. Chạy lại toàn bộ integration sau các thay đổi cuối. Lần chạy gần nhất của **unit suite** đạt **40/40**; kết quả integration **9/9** có từ một mốc sớm hơn, trước các thay đổi P2 cuối, nên chưa dùng làm bằng chứng nghiệm thu cuối.

## Báo cáo xác minh D.4 + E (HEAD `70498e6`)

Phạm vi là kiểm tra sau các commit D.4/E; không thực hiện F và không thêm migration. Trạng thái untracked được giữ nguyên theo chỉ thị (6 model, 3 tài liệu cấu trúc, OCR/).

### D.4 – chức năng thanh toán, cron và khoản điều chỉnh

| Mục | Kết luận một dòng | Bằng chứng / test |
|---|---|---|
| 1. Khoản điều chỉnh | **ĐÃ CÓ** – CRUD/toggle, RBAC, audit, kỳ áp dụng, unique `(maThanhToan,maKhoanDieuChinh)`, disabled/future và snapshot bất biến đã được chặn. | `billingAdjustmentDefinition.service.js`, routes `POST/PATCH /billing-adjustments`, `POST /:id/toggle`, migration 012/013; test `FR-157/164/175/176/179 ... snapshot ...` trong `tests/billing-lifecycle.integration.test.js`. |
| 2. Preview | **ĐÃ CÓ** – `POST /api/v1/bills/preview` không ghi DB, kỳ đầu dùng chung helper prorate với settlement; race chỉ tạo một bộ hóa đơn. | Cùng test billing-lifecycle: DB counts không đổi sau preview và hai request đồng thời cho kết quả 201/409, tổng bản ghi = 1. |
| 3. Gửi hóa đơn FR-156 | **ĐÃ CÓ** – `billingCron.service.sendOne` ghi notification và `daGui/ngayGui` trong cùng transaction; chạy lại không gửi trùng. | Test `FR-151/153/155/156 billing cron sends each persisted bill once`; tài khoản bị khóa vẫn nhận notification in-app đã lưu (không phụ thuộc login). |
| 4. Backfill chống spam | **ĐÃ CÓ** – hóa đơn cũ sau backfill không phát notification/kích nợ và không đổi dư nợ. | Test `FR-151/153 migration backfill keeps legacy bills inert across all cron workers`; cửa sổ `billingCronLookbackMonths` mặc định 3, các mốc bill 2/8, nhắc 5, quá hạn 6, chốt 10 có env/DB override. |
| 5. Đăng ký cron | **ĐÃ CÓ** – contract/reservation `0 * * * *`, move-out `5 * * * *`, billing `0 * * * *`, debt `15 * * * *`; giờ chạy lấy từ system config. | `cron.jobs.js`, `billingCron.service.js`, `debtLifecycle.service.js`; test FR-200 xác nhận config đổi không cần restart. |
| 6. Named lock | **ĐÃ CÓ** – năm cron dùng `withNamedLock`, GET/RELEASE cùng connection/transaction, timeout 0–60 giây. | `dbNamedLock.service.js`; test FR-200 hai connection cho kết quả worker thứ hai không chiếm lock. |
| 7. Hủy thanh toán/doanh thu | **ĐÃ CÓ** – báo cáo trước/sau thay đổi, chặn `KHAU_TRU_COC`, lần hủy thứ hai 409. | Test `FR-074/075/079 ... cancellation ...`; doanh thu nguồn KhoanThu chuyển `DA_HUY` nên bị loại khỏi report. |
| 8. Mark all paid | **ĐÃ CÓ** – dedupe theo bill/idempotency key; mỗi bill tạo `KhoanThu` và doanh thu ngay trong transaction. | Test `FR-075 marks every periodic bill ... atomically`; chạy lại trả 0 bản ghi mới, audit/payment idempotency đã kiểm. |

### E.1 – cấu hình, upload và notification

| Mục | Kết luận | Chi tiết bắt buộc |
|---|---|---|
| 1. Config table/consumer | **ĐÃ CÓ**. | `CauHinhHeThong` + GET/PUT landlord; consumer gồm contract, reservation, move-out due, debt milestones, billing windows và `MAX_FILE_SIZE`. Danh mục sự cố là bảng riêng (không nhét vào key-value). Env/default fallback, range validation, test FR-200. |
| 2. Upload token | **ĐÃ CÓ**. | HMAC/JWT stateless dùng `UPLOAD_TOKEN_SECRET || JWT_SECRET`, chống sai actor/tenant, tamper, expired, reload module; cleanup file >15 phút. Multi-instance yêu cầu deploy mount chung `UPLOAD_DIR` (code không thể tự đảm bảo volume). Test unit `E.1.2 signed upload token survives module reload and enforces claims`. |
| 3. Notification FR-159 | **ĐÃ CÓ**. | Toàn bộ producer dùng `createIdempotent` với `khoaSuKien`; unique DB 014 xử lý race, broadcast chia lô transaction, cron/reservation/contract/debt có lock hoặc transaction. Test `FR-159 event key schema...`, `FR-159 reservation expiry race...`, `FR-159 contract expiry race...`, `FR-159 broadcast retry...`, `FR-159 idempotent insert race...`. |

### E.2 – ma trận audit

| Thao tác | Route/service | Audit | Test/bằng chứng |
|---|---|---|---|
| Khóa/mở khóa/reset TK | `tenantAccount.service.js` | ĐÃ CÓ | CT-009/010/015 + audit helper |
| Tạo/sửa HĐ | `contractLifecycle.service.js` | ĐÃ CÓ | FR-042 contract integration |
| Chuyển phòng | `roomTransfer.service.js` | ĐÃ CÓ | FR-195 integration |
| Chốt/sửa/xóa chỉ số | meter controller/service | ĐÃ CÓ | UC-09/10 tests |
| Khoản chi create/edit/cancel | `management.controller.js` | ĐÃ CÓ | `management-integrity.integration.test.js` |
| Request approve/reject/revoke | `mvp.routes.js` | ĐÃ CÓ | FR-109/186 tests |
| Bill adjustment/reduction | adjustment services | ĐÃ CÓ | billing-lifecycle tests |
| KhoanDieuChinh | definition service | ĐÃ CÓ | FR-157/164/175/176/179 |
| Người ở cùng | coTenant routes/service | ĐÃ CÓ | UC-08/17/18/19/25 |
| Soft-delete sự cố | `incident.service.js` | ĐÃ CÓ | CT-005 |
| Đổi giá phòng | `phong.service.js` | ĐÃ CÓ | commit `70498e6`, audit rollback suite |
| System config | `mvp.routes.js` | ĐÃ CÓ | FR-200 audit count |
| Hủy thanh toán | payment lifecycle | ĐÃ CÓ | FR-074 |
| Mark paid one/all | payment lifecycle | ĐÃ CÓ | FR-074/075 |
| Quyết toán trả phòng | move-out service | ĐÃ CÓ | FR-096/187/188/190 |
| Hoàn cọc | move-out service | ĐÃ CÓ | `DEPOSIT_REFUND_RECORDED`, FR-096 |

Audit helper bắt buộc transaction; DTO không ghi password/hash/token (test `audit-integrity.integration.test.js`). Tuy nhiên, **THIẾU** một test count=1 và rollback riêng cho từng thao tác trên; hiện count=1 đã chứng minh rõ cho config/payment, rollback đã có test null actor.

### E.3 – toàn vẹn dữ liệu

| Mục | Kết luận | Bằng chứng / khoảng trống |
|---|---|---|
| 1. Whitelist + Joi | **ĐÃ CÓ**. | `validations/management.validation.js`; building/tenant/expense list field cụ thể, unknown field/amount âm/scope test; không update thẳng `req.body`. |
| 2. Expense DELETE | **ĐÃ CÓ**. | Soft cancel bắt buộc lý do, không physical delete; report chỉ `HIEU_LUC`, test management-integrity. |
| 3. Deactivate building | **THIẾU TEST** (code đã chặn). | Code chặn `DANG_THUE`, `DA_GIU`, `DANG_XU_LY_TRA_PHONG`; test hiện mới bao phủ DANG_THUE, chưa có hai status còn lại. |
| 4. Xóa asset có liên kết | **THIẾU TEST** (code đã chặn). | Transaction block cả `SuCoTaiSan` và `KhoanKhauTru`; test hiện có incident link, chưa có settlement link. |
| 5. Overlap SAP_HET_HAN + race | **ĐÃ CÓ**. | `hopDong.service.js` lock phòng, active domain gồm `DANG_HIEU_LUC`/`SAP_HET_HAN`; test UC-26 chỉ cho một HĐ thành công. |
| 6. Tenant search/filter | **THIẾU/SÁI**. | Search server-side `GET /api/management/khach-thue?q=`, bill `ma_can/buildingId`, meter `buildingId` đã có; chưa escape wildcard `%/_` và chưa có test wildcard/SQL-pattern. |

### Kiểm tra cổng cuối

- Unit: **48/48 xanh** (`npm run test:unit`). Frontend: **Vite build xanh** (45 modules).
- Integration MySQL8, `npm ci`, `verify-migrations.js` hai lượt, DB invariants, clone-clean và MariaDB 10.4: **chưa chạy trong phiên này**; Docker daemon hiện không truy cập được (`docker` pipe permission denied). Không ghi nhận các mốc này là đã đạt.
- Worktree chỉ còn các file untracked đã được chỉ định giữ; không có modified tracked file. Không có migration mới trong D.4/E.

### Việc còn thiếu / cần quyết định

1. Bổ sung transaction/unique event key cho reservation/broadcast notification race (có thể cần DDL mới; chưa triển khai).
2. Bổ sung test building cho từng status `DA_GIU`, `DANG_XU_LY_TRA_PHONG`, asset settlement link, và wildcard escaping.
3. Bổ sung bộ audit count=1/rollback đồng nhất cho từng operation E.2.
4. Khi Docker MySQL8/MariaDB sẵn sàng, chạy lại toàn bộ cổng trên; sau đó mới xem xét chuyển sang F.

## F.0 – đóng tồn đọng sau E

- Commit producer thông báo: `3202fb4 fix(FR-159): key all notification producers`.
- Commit test contract: `d753177 test(FR-159): assert keyed notification transactions`.
- Commit cron legacy: `b5154c0 test(FR-151): verify legacy cron idempotency`.
- Unit: **48/48 → 48/48 pass**. Integration: **40/40 → 41/41 pass** trên MySQL 8.0.46; `check-invariants`: bill detail 0, duplicate bill 0, capacity 0, deposit 0, incident branch 0, notification key 0, deposit refund 0.
- Test `00-legacy-cron.integration.test.js`: seed đúng 18 hợp đồng, 30 phòng, 21 tài khoản; toàn bộ cron chạy hai lượt, số bill/thông báo kỳ cũ trước/sau không đổi và lượt hai phát sinh 0.
- Phép thử phủ định: tạm bỏ bắt `ER_DUP_ENTRY` trong `notification.service.js`; suite đỏ với `SequelizeUniqueConstraintError`/`ER_DUP_ENTRY` tại reservation/contract/concurrent insert (5 test fail trong 41); helper đã khôi phục, không commit trạng thái hỏng.
- Frontend build theo chỉ thị F.0: **chưa chạy**.

## F.1 – báo cáo doanh thu/lợi nhuận

- BR-44 đã áp dụng trong `cashflowReport.service.js`: **Doanh thu trước giảm trừ; Lợi nhuận = Doanh thu − Giảm trừ − Chi phí. Với giá trị trước giảm G, giảm D, tổng thực trả N = G − D > 0, mỗi lần thu p phân bổ doanh thu p × G/N và giảm trừ p × D/N; làm tròn đến đồng, dồn sai số vào lần thu cuối để tổng doanh thu − tổng giảm trừ = tổng tiền thực thu. Nếu N = 0 thì không có doanh thu từ khoản này; theo dõi giảm trừ đã cấp riêng, không trừ lần hai vào lợi nhuận tiền mặt.**
- FR-132: lọc tháng/quý/năm và khoảng ngày; FR-133/135: doanh thu, giảm trừ, chi phí, lợi nhuận; FR-136/142: thêm `byBuilding` để so sánh từng căn/toàn chuỗi; FR-137: `receiptDetails` gồm dòng thu và chi với nguồn, căn, phòng (khi có), ngày.
- Test mới `BR-44 allocates gross revenue and discount across partial receipts with final rounding`; unit **49/49**, integration **41/41**, invariants **0** sau thay đổi.
- Commit: `f87b28b feat(FR-133): allocate gross revenue and discounts`, `8787516 fix(FR-133): preserve revenue for detailless receipts`, `536e429 feat(FR-136): add building report comparison details`.

## Xác minh lại sau migration 014

- TCP MySQL `127.0.0.1:3307`: `8.0.46`; MariaDB `127.0.0.1:3306`: `10.4.32-MariaDB`.
- `verify-migrations.js`: MySQL8 **2/2 pass**, MariaDB **2/2 pass**, migrations 004→014, **37 bảng**, legacy backfill không phát notification.
- Unit **48/48**; integration MySQL8 **31/31**.
- Migration 014 đã commit `f32c876`; escape tenant search đã commit `9cd875b`.
- Frontend: `npm ci` lỗi nguyên văn `npm error code EPERM ... spawn EPERM`; `npm run build` lỗi `Cannot find module ...\\node_modules\\vite\\bin\\vite.js`.
- Chưa chạy clone sạch, cron seed cũ riêng và bộ SQL invariants sau integration; DB test bị runner dọn sau khi chạy.

### Bật test/bổ sung sau đợt E

- Unit: **48 → 48** (không thêm unit); integration: **31 → 40**, **40/40 pass**.
- `notification-integrity.integration.test.js`: legacy NULL event key; reservation expiry race; contract expiry race; broadcast retry; DB unique-key race. Phép thử phủ định ban đầu lội do fixture thiếu `nguoiThucHienId`/check constraint, đã sửa fixture; sau đó pass.
- `management-integrity.integration.test.js`: ba trạng thái phòng `DANG_THUE/DA_GIU/DANG_XU_LY_TRA_PHONG` bị chặn, `TRONG` cho phép; asset liên kết settlement bị chặn.
- `audit-matrix.integration.test.js`: 25 operation audit count=1, snapshot không secret, rollback khi audit lỗi. Phép thử ban đầu phát hiện snapshot còn password/hash; đã vá trong commit `d5b5a0c`.
- `scripts/check-invariants.js` được hook vào integration trước khi dọn DB; kết quả cuối: bill detail **0**, duplicate bill **0**, capacity **0**, deposit **0**, notification key **0**, incident branch bị trùng **0**.
- Commit test: `ec0d2d5`, `e1b58c6`, `586e500`, `ac17b97`; fix audit: `d5b5a0c`; invariants: `b6a16f8`.
