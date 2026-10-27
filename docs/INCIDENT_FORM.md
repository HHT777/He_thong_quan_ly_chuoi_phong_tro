# Biểu mẫu sự cố của Chủ trọ

Phạm vi này chỉ thay đổi giao diện và kiểm tra phía trình duyệt. Backend và schema không đổi.

## Quy tắc nghiệp vụ

SRS là nguồn chuẩn. Các câu liên quan:

- UC-17, nhánh A6: “Khách chịu chi phí → ghi khoản chờ khấu trừ gắn hợp đồng; không ghi chi phí vận hành, không cộng vào phiếu thu; sẽ khấu trừ ở UC-15 (Q-04, BR-48).”
- FR-122: “Khi Khách chịu, hệ thống phải không ghi vào chi phí vận hành và không tự cộng vào phiếu thu (BR-18) `CON-02`”
- FR-123: “Khi hoàn tất, hệ thống phải chuyển _Đã xử lý_ và thông báo khách đã báo (kể cả trường hợp không phát hiện sự cố, chi phí 0)”
- BR-48: “Chi phí hư hỏng khách chịu: ghi _chờ khấu trừ_, trừ vào cọc khi trả phòng; không cộng vào phiếu thu”
- CON-02: “Chi phí khách chịu khấu trừ vào cọc khi trả phòng; sửa UC-18 bỏ phần \"kỳ thanh toán\" (BR-48)”

`phantich.md` FR-CT-11.8 còn ghi cách cũ là cộng chi phí khách chịu vào kỳ thanh toán gần nhất. Nội dung đó mâu thuẫn với SRS; theo SRS và lựa chọn A đã được Chủ trọ xác nhận, khoản này chờ khấu trừ tiền cọc lúc trả phòng, không thêm vào chi phí vận hành hoặc phiếu thu.

## Dữ liệu biểu mẫu và API

| Giao diện | Nguồn / gửi đi | Giới hạn |
|---|---|---|
| Căn, phòng | `GET /phong?limit=100&page=n`; phòng được lọc theo căn | Không có lựa chọn khu vực chung; API sự cố bắt buộc phòng |
| Người đứng tên | `GET /hop-dong?limit=100&page=n`, trạng thái `DANG_HIEU_LUC` hoặc `SAP_HET_HAN` | Hợp đồng/khách được dùng để lọc người đang ở; POST sự cố không nhận tenant ID |
| Người ở cùng | `GET /v1/co-tenants`, ghép với hồ sơ `GET /management/khach-thue?limit=100&page=n` bằng số điện thoại đã chuẩn hóa | API người ở cùng không trả tenant ID; chỉ hồ sơ ghép được với khách trong hệ thống có thể chọn |
| Loại sự cố | `GET /v1/incident-categories` | Giao diện lấy mã và tên loại từ API |
| Tạo sự cố | `POST /api/v1/incidents`: `roomId`, `type`, `priority`, `description` | UI không gửi trường người ở vì endpoint không hỗ trợ trường này |
| Hoàn tất | `PATCH /api/v1/incidents/:id`: `status`, `responsible`, `cost`, `note`, tùy chọn `replacement`; khi khách chịu thêm `responsibleTenantId` và `responsibilityBasis` | Backend kiểm tra người chịu trách nhiệm có hợp đồng cùng phòng bao phủ ngày báo sự cố; nếu không, trả `RESPONSIBLE_CONTRACT_NOT_FOUND` |

Chọn người thuê sẽ tự suy ra căn/phòng. Nếu người đó có nhiều hợp đồng đang hiệu lực, Chủ trọ chọn đúng phòng. Khi hoàn tất và chọn Chủ trọ chịu, trường khách và căn cứ trách nhiệm được ẩn, xóa khỏi trạng thái chọn và không gửi lên API. Khi chọn Khách thuê chịu, giao diện yêu cầu chọn người đang ở phòng và nhập căn cứ; backend vẫn là nơi kiểm tra cuối cùng.

## Trải nghiệm sử dụng

- Danh sách căn/phòng/người thuê có tìm kiếm không dấu, điều khiển bằng bàn phím và nhãn dễ đọc; UUID chỉ được giữ nội bộ để gọi API.
- Căn và phòng không khớp, hoặc người không ở trong phòng được chọn, sẽ chặn gửi form.
- Dữ liệu chọn được tải khi mở form; nút gửi bị khóa trong lúc tải. Lỗi tải có thông báo và nút thử lại.
- Trang danh sách sự cố và trả phòng tải hết các trang phòng/hợp đồng để ánh xạ ID nội bộ thành tên phòng, tên căn và khách.
- Backend hiện không cung cấp tên phòng/căn lồng trong danh sách sự cố; frontend ghép từ API phòng. Danh sách người ở cùng không cung cấp ID khách; frontend ghép bằng số điện thoại. Các quan hệ không ghép được sẽ không được hiển thị như một khách có thể chọn.

## Kiểm thử

`phong-tro-frontend/tests/incident-form.test.mjs` kiểm tra tìm kiếm không dấu, nhãn không lộ UUID, hợp đồng/người ở cùng, kiểm tra quan hệ căn-phòng-khách, payload, chuyển trách nhiệm và tải hết trang. `tests/dashboard-render.test.mjs` khóa hiển thị sự cố trên dashboard không đưa UUID vào tìm kiếm. Các thay đổi được kiểm tra bằng Node test runner và `node --check`; build giao diện chưa chạy theo yêu cầu.
