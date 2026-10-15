# AUDIT QA/QC CHỨC NĂNG CHỦ TRỌ

## 1. Thông tin kiểm thử

| Thuộc tính | Giá trị |
|---|---|
| Ngày kiểm thử | 13/10/2026 |
| Phạm vi | Chức năng Chủ trọ trên SPA mới `phong-tro-frontend/src`, backend `phong-tro-backend/src` và database hiện tại |
| Nguồn yêu cầu | `phantich.md` (116 yêu cầu `FR-CT-*`) |
| Nguồn mô hình dữ liệu | `data1.md` (thiết kế 25 bảng) và `data2.md` (DDL/seed MySQL) |
| Tài liệu không dùng làm chuẩn hiện hành | `.agent` vì đã cũ theo xác nhận của chủ dự án |
| Dữ liệu kiểm thử | Bộ dữ liệu 21 tài khoản, 3 căn, 30 phòng, 20 khách, 18 hợp đồng theo `data2.md` |
| Phương pháp | Build, unit/schema test, HTTP smoke test, RBAC, CRUD có dọn dữ liệu, kiểm tra bất biến database, đọc mã và đối chiếu yêu cầu |
| Kết luận phát hành | **CHƯA ĐẠT để nghiệm thu toàn bộ chức năng Chủ trọ**; phần xem dữ liệu và CRUD cơ bản hoạt động, nhưng còn lỗi chặn ở trả phòng, điện, sự cố và báo cáo |

### Quy ước trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| PASS | Đã chạy và kết quả đúng |
| PARTIAL | Có một phần chức năng nhưng thiếu thao tác hoặc thiếu quy tắc |
| FAIL | Đã tái hiện lỗi hoặc logic trái nguồn chuẩn |
| BLOCKED | Chưa thể chạy vì bộ test/tiền điều kiện không còn phù hợp |
| NOT IMPLEMENTED | Không có thao tác tương ứng trên SPA/API hiện tại |

## 2. Tóm tắt điều hành

| Hạng mục | Kết quả | Nhận xét ngắn |
|---|---:|---|
| Backend khởi động và kết nối DB | PASS | `/health`, `/ready` trả 200; không tự sync schema |
| Đăng nhập Chủ trọ | PASS | Tài khoản demo mới đăng nhập thành công |
| Phân quyền | PASS | Khách thuê gọi API chỉ dành cho Chủ trọ nhận 403 |
| API đọc phục vụ Chủ trọ | 19/19 PASS | Đọc được đúng số lượng seed chính |
| CRUD cơ bản | 5/5 PASS | Tạo căn, phòng, tài sản, khách, khoản chi thành công |
| Dọn dữ liệu QA | 5/5 PASS | Chỉ xóa các bản ghi QA vừa tạo; dữ liệu mẫu không bị sửa |
| Bất biến dữ liệu | 9/9 PASS | Không có lệch tổng tiền, sai sức chứa, sai subtype, sai nhánh sự cố hoặc sai tổng khấu trừ |
| Backend test mặc định | 3/3 PASS | Công thức BR-03, BR-23 và mapping 25 bảng |
| Toàn bộ integration test hiện có | BLOCKED | 14 test dừng ngay tại đăng nhập 401 vì fixture cũ dùng `123456`/username cũ, DB mới dùng bộ demo mới |
| Frontend build | PASS | Vite build 45 module thành công |
| JavaScript backend | PASS | 63/63 file qua `node --check` |
| Duyệt yêu cầu trả phòng | FAIL | HTTP 500 do ghi trạng thái hợp đồng ngoài miền DB |
| Bộ lọc báo cáo | FAIL | Query kỳ/căn bị bỏ qua; báo cáo tương lai vẫn trả toàn bộ số liệu |
| Màn hình chỉ số điện SPA | FAIL | Frontend đọc sai cấu trúc DTO của backend |

## 3. Kết quả thao tác thực tế

### 3.1. Smoke test API đọc và phân quyền

| STT | Thao tác | Kết quả mong đợi | Kết quả thực tế | Đánh giá |
|---:|---|---|---|---|
| 1 | `GET /health` | Backend hoạt động | 200 | PASS |
| 2 | `GET /ready` | Database sẵn sàng | 200 | PASS |
| 3 | Đăng nhập Chủ trọ | Nhận JWT hợp lệ | 200 | PASS |
| 4 | Xem hồ sơ | Trả hồ sơ tài khoản hiện tại | 200 | PASS |
| 5 | Xem căn trọ | 3 căn theo seed | 200, 3 dòng | PASS |
| 6 | Xem phòng | 30 phòng theo seed | 200, 30 dòng | PASS |
| 7 | Xem khách thuê | 20 khách theo seed | 200, 20 dòng | PASS |
| 8 | Xem hợp đồng | 18 hợp đồng theo seed | 200, 18 dòng | PASS |
| 9 | Xem cọc | 18 hồ sơ cọc | 200, 18 dòng | PASS |
| 10 | Xem kỳ phải trả | 32 kỳ thanh toán | 200, 32 dòng | PASS |
| 11 | Xem giao dịch | 45 giao dịch | 200, 45 dòng | PASS |
| 12 | Xem khoản chi | 11 khoản chi | 200, 11 dòng | PASS |
| 13 | Xem chỉ số điện | 90 bản ghi | 200, 90 dòng | PASS API |
| 14 | Xem yêu cầu | 9 yêu cầu | 200, 9 dòng | PASS |
| 15 | Xem sự cố chưa xóa | 5 sự cố | 200, 5 dòng | PASS |
| 16 | Xem người ở cùng | 30 thành viên | 200, 30 dòng | PASS |
| 17 | Xem công nợ | Chỉ kỳ còn nợ | 200, 13 dòng | PASS |
| 18 | Xem tài sản | 90 tài sản | 200, 90 dòng | PASS |
| 19 | Xem báo cáo dòng tiền | Có tổng thu/chi | 200 | PASS đọc cơ bản |
| 20 | Khách gọi API quản lý căn | Bị từ chối | 403 | PASS RBAC |

### 3.2. CRUD cơ bản có dọn dữ liệu

| Thao tác | Kết quả | Dọn dữ liệu |
|---|---|---|
| Tạo căn có tên tiền tố `QA_CAN_*` | PASS | PASS |
| Tạo phòng thuộc căn QA | PASS | PASS |
| Tạo tài sản thuộc phòng QA | PASS | PASS |
| Tạo hồ sơ khách QA | PASS | PASS |
| Tạo khoản chi QA cấp toàn chuỗi | PASS | PASS |

Không tạo hợp đồng, thanh toán hoặc quyết toán thử trên dữ liệu mẫu vì các nghiệp vụ đó không có API xóa an toàn và có thể làm thay đổi lịch sử tài chính.

### 3.3. Kiểm tra bất biến database

| Bất biến từ `data1.md`/`data2.md` | Số vi phạm | Đánh giá |
|---|---:|---|
| Tổng chi tiết bằng tổng phải trả | 0 | PASS |
| Tổng giao dịch xác nhận bằng tổng đã trả | 0 | PASS |
| Không phòng nào vượt sức chứa | 0 | PASS |
| Người ở cùng đúng phòng của hợp đồng | 0 | PASS |
| Mỗi hợp đồng có đúng hồ sơ cọc | 0 | PASS |
| Yêu cầu có đúng một subtype và đúng loại | 0 | PASS |
| Sự cố chỉ đi đúng một nhánh tài chính | 0 | PASS |
| Khoản thu đồng bộ với giao dịch | 0 | PASS |
| Tổng dòng khấu trừ khớp biên bản | 0 | PASS |

## 4. Ma trận đối chiếu chức năng Chủ trọ

| Nhóm chức năng trong `phantich.md` | Thao tác cần có | Hiện trạng SPA/API | Đánh giá |
|---|---|---|---|
| FR-CT-01 Tài khoản khách thuê | Xem, tạo sau đủ điều kiện, khóa/mở, reset, lịch sử trạng thái | SPA chỉ xem danh sách khách và mã tài khoản. API có tạo/khóa/mở/reset nhưng không có thao tác UI, không kiểm tra hợp đồng+cọc khi tạo và endpoint trạng thái có thể nhận ID của mọi tài khoản | PARTIAL / rủi ro cao |
| FR-CT-02 Căn trọ | Danh sách, tìm/lọc, chi tiết, thêm, sửa, ngừng hoạt động, bảo toàn lịch sử | Xem/tìm phía client và thêm hoạt động; backend có sửa/xóa căn trống. SPA chưa có sửa/chuyển trạng thái/chi tiết | PARTIAL |
| FR-CT-03 Phòng | Xem, thêm, sửa, quản lý tài sản, trạng thái, không xóa lịch sử | Xem/thêm phòng và tài sản hoạt động; backend chặn xóa phòng đã có hợp đồng. SPA chưa có sửa/ngừng sử dụng/xóa hoặc chi tiết lịch sử | PARTIAL |
| FR-CT-04 Khách thuê | Xem/tìm/chi tiết/lịch sử, thêm, sửa, giữ hồ sơ | Xem/tìm/thêm hoạt động; backend chặn xóa khi có hợp đồng. SPA không có sửa, chi tiết hồ sơ hoặc lịch sử thuê đầy đủ | PARTIAL |
| FR-CT-05 Hợp đồng và cọc | Tạo, cập nhật, gia hạn, cảnh báo, thanh lý, vi phạm, lịch sử | SPA mới chỉ xem hợp đồng/cọc. API create/update/renew có nhưng không có UI. Chưa có lịch sử gia hạn; luồng trả phòng ghi trạng thái hợp đồng sai miền | FAIL ở vòng đời |
| FR-CT-06 Tiền điện | Xem, xác nhận, thêm ảnh/OCR/thủ công, sửa/xóa, tính điện, lịch sử | API trả DTO chuẩn mới và có xác nhận/nhập tay; SPA dùng tên trường cũ nên hiển thị `undefined` và không tạo đúng nút xác nhận. SPA khách chỉ nhập số, chưa có ảnh/OCR | FAIL trên SPA |
| FR-CT-07 Thanh toán/công nợ | Xem chi tiết, cập nhật thực thu, xác nhận minh chứng, xóa/reset, tất cả đã đóng, lịch sử | SPA mới chỉ xem kỳ, giao dịch, công nợ. Không có UI ghi nhận thanh toán, xác nhận minh chứng, reset hoặc “Tất cả đã đóng” | PARTIAL / thiếu thao tác chính |
| FR-CT-08 Phiếu thu | Xem/tạo/chỉnh sửa, dòng phí/giảm trừ, lịch tự động, gửi khách | Schema 25 bảng không có Entity phiếu thu chính thức; `ThanhToan` chỉ là kỳ phải trả theo `data1.md`. Có điều chỉnh tổng nhưng chưa có lịch lập/gửi phiếu | NOT IMPLEMENTED theo phạm vi DB hiện tại |
| FR-CT-09 Phê duyệt yêu cầu | Xem chi tiết, duyệt và cập nhật đúng nghiệp vụ, thông báo | Danh sách, duyệt/từ chối có trên SPA. Duyệt trả phòng tái hiện HTTP 500; duyệt đề xuất bạn cùng phòng chưa tạo cư trú | FAIL |
| FR-CT-10 Trả phòng | Chốt điện/nước, kiểm tra tài sản/nợ, khấu trừ, thanh lý, khóa tài khoản, giữ lịch sử | SPA chỉ liệt kê yêu cầu. Không có form quyết toán trên SPA mới. API quyết toán không kiểm tra đủ tiền điện/tài sản/nợ và không cập nhật cư trú/tài khoản đầy đủ | FAIL |
| FR-CT-11 Sự cố | Tiếp nhận, tự tạo, liên kết tài sản, hoàn tất, sinh đúng nhánh tài chính, thông báo, xóa mềm | SPA Chủ trọ chỉ xem. API patch đổi trạng thái nhưng không chạy transaction tạo `KhoanChi`/`ChiTietThanhToan` và thông báo; không có API xóa mềm hoàn chỉnh | FAIL |
| FR-CT-12 Thu chi và báo cáo | Thu/chi theo kỳ/phạm vi/căn, lợi nhuận, so sánh căn, chi thủ công | CRUD khoản chi cơ bản đạt. Báo cáo chỉ cộng toàn bộ dữ liệu; không lọc kỳ/căn, không phân loại/so sánh | FAIL |
| Tài sản | CRUD tài sản theo phòng | Xem và thêm trên SPA; backend có sửa/xóa. SPA chưa có sửa/xóa | PARTIAL |
| Thông báo | Xem, đánh dấu đọc, phát thông báo | API có; SPA có xem và broadcast. Hộp thư Chủ trọ hiện không có dữ liệu seed | PARTIAL |

## 5. Danh sách lỗi và điểm không logic

### 5.1. Lỗi nghiêm trọng/chặn nghiệp vụ

| ID | Mức độ | Lỗi | Bằng chứng | Tác động | Đề xuất |
|---|---|---|---|---|---|
| CT-001 | Critical | Duyệt trả phòng ghi `HopDong.trang_thai = CHO_TRA_PHONG`, nhưng DB chỉ cho `DANG_HIEU_LUC`, `SAP_HET_HAN`, `HET_HAN`, `DA_THANH_LY` | HTTP thực tế 500: constraint `ck_HopDong_4`; request rollback vẫn `CHO_XU_LY`. Code: `mvp.routes.js:176`; DDL: `data2.md:138` | Chủ trọ không thể duyệt yêu cầu trả phòng | Không thêm trạng thái hợp đồng mới ngoài schema. Khi duyệt chỉ chuyển `PhongTro` sang `DANG_XU_LY_TRA_PHONG`, giữ hợp đồng ở trạng thái hợp lệ cho đến thanh lý |
| CT-002 | Critical | Quyết toán cố cập nhật yêu cầu thành `DA_HOAN_TAT`, ngoài miền `YeuCau` | `mvp.routes.js:200`; DB chỉ cho `CHO_XU_LY`, `DA_PHE_DUYET`, `TU_CHOI` tại `data2.md:230` | Truyền `moveOutRequestId` có thể làm cả transaction thanh lý rollback | Giữ yêu cầu `DA_PHE_DUYET`; trạng thái hoàn tất được suy ra từ biên bản/hợp đồng, hoặc phải migration miền trạng thái trước |
| CT-003 | High | SPA chỉ số điện dùng trường raw cũ, backend trả DTO mới | SPA đọc `ma_chi_so`, `thang`, `chi_so_moi`, `trang_thai_xac_nhan`; API thực tế trả `id`, `period`, `room`, `readingValue`, `status` | Bảng điện hiển thị sai và nút xác nhận không xuất hiện/URL sai | Đồng bộ module với DTO `meterReading.service.toDto()` và thêm contract test frontend/API |
| CT-004 | High | Quyết toán không ép hoàn thành chốt điện, tài sản, công nợ và không đồng bộ toàn bộ vòng đời | `mvp.routes.js:189-204`; đối chiếu DB-18 trong `data1.md` | Có thể thanh lý thiếu dữ liệu, cư trú vẫn `DANG_O`, tài khoản không xử lý đúng | Xây service quyết toán duy nhất, khóa contract/cọc/nợ/cư trú/phòng; validate checklist rồi commit một transaction |
| CT-005 | High | Hoàn tất sự cố không tạo đúng nhánh tài chính và thông báo trong transaction | `mvp.routes.js:210` chỉ update `SuCo` | Chi phí/lợi nhuận sai dù sự cố báo đã xử lý | Thực hiện DB-12/DB-14: Chủ trọ chịu → `KhoanChi`; khách chịu → `ChiTietThanhToan`; tạo thông báo cùng transaction |

### 5.2. Lỗi logic cao/trung bình

| ID | Mức độ | Lỗi/thiếu logic | Bằng chứng và ảnh hưởng |
|---|---|---|---|
| CT-006 | High | Báo cáo bỏ qua mọi bộ lọc | Gọi báo cáo toàn bộ và gọi với `2099-01-01..2099-12-31&buildingId=none` đều trả doanh thu `83.731.911`, chi phí `4.380.000`, 32 khoản thu và 11 khoản chi. Route `mvp.routes.js:229` không đọc query |
| CT-007 | High | Điều chỉnh hóa đơn làm lệch tổng chi tiết | `mvp.routes.js:68` chỉ tạo dòng khi `delta > 0`; giảm trừ âm chỉ sửa `tong_phai_tra`, khiến bất biến “tổng chi tiết = tổng phải trả” hỏng sau thao tác. Loại `DIEU_CHINH` cũng không thuộc miền loại dòng tại `data1.md` |
| CT-008 | High | Khách đề xuất người ở cùng bị ghi thẳng thành người `DANG_O` | `mvp.routes.js:212` tạo `ThanhVienPhong` trực tiếp, bỏ qua `YeuCau` + `DeXuatBanCungPhong` và bước Chủ trọ duyệt; trái DB-05/DB-06 |
| CT-009 | High | Tạo tài khoản không kiểm tra đủ điều kiện thuê/cọc và cho phép username tùy ý | `mvp.routes.js:32-43`; chỉ kiểm tra khách tồn tại/chưa có account. Trái FR-CT-01.3/01.5 và BR-01 trong `phantich.md` |
| CT-010 | High | Endpoint khóa/mở tài khoản nhận mọi ID tài khoản | `mvp.routes.js:45-47` không kiểm tra account là `KHACH_THUE`; Chủ trọ có thể tự khóa tài khoản Chủ trọ nếu gửi đúng ID |
| CT-011 | High | Tính kỳ đầu điện mặc định chỉ số trước = 0 | `meterReading.service.js:49`; `data1.md` mục 8.2 nói kỳ đầu/thay công tơ chưa đủ dữ liệu để tính an toàn, `phantich.md` BR-41 yêu cầu chỉ số ban đầu |
| CT-012 | High | Sinh hóa đơn áp cùng `waterAmount` và `serviceFee` từ request cho mọi hợp đồng | `mvp.routes.js:88`; không lấy snapshot số người/đơn giá nước theo hợp đồng, không có phí dịch vụ trên schema hiện tại | Tiền nước/dịch vụ có thể sai hàng loạt |
| CT-013 | Medium | Trạng thái phòng trên SPA sai mã | `view.js` và dashboard dùng `DANG_XU_LY_TRA`/`DANG_TRA`; DB dùng `DANG_XU_LY_TRA_PHONG` | Bộ lọc và số phòng đang xử lý trả bị sai |
| CT-014 | Medium | Mức ưu tiên sự cố mặc định không thuộc miền dữ liệu | SPA và API dùng `BINH_THUONG`; `data1.md` quy định `THAP`, `TRUNG_BINH`, `CAO`, `KHAN_CAP` | Sinh dữ liệu không chuẩn hóa; DB hiện chưa có check để chặn |
| CT-015 | Medium | Nhiều tab SPA chỉ có danh sách dù mô tả là “quản lý” | Tài khoản, hợp đồng, cọc, người ở cùng, thanh toán, công nợ, sự cố, trả phòng chỉ có read/list | Người dùng thấy chức năng nhưng không thể hoàn thành nghiệp vụ từ giao diện mới |
| CT-016 | Medium | Integration test không tương thích database mới | 14 test dùng `123456`, `nguyenvana` hoặc giả định cũ; DB mới dùng tài khoản số điện thoại và mật khẩu demo mới | CI mặc định chỉ chạy 3 test nên dễ tạo cảm giác hệ thống đã đủ coverage |
| CT-017 | Low | Phần truy vấn kiểm tra ở cuối `data2.md` có cú pháp hỏng | Ví dụ `count(_)`, `so*ban_ghi`, `count(\*)` tại dòng 1166 trở đi | Không thể copy toàn bộ file và chạy trọn vẹn phần verification; schema/seed đã commit trước đó nhưng bước kiểm tra sẽ lỗi |

## 6. Mâu thuẫn tài liệu cần chốt

Các mục dưới đây không nên quy ngay thành lỗi code vì `phantich.md` và mô hình 25 bảng đang mô tả phạm vi khác nhau.

| Chủ đề | `phantich.md` | `data1.md` / `data2.md` | Hệ thống hiện tại | Cần quyết định |
|---|---|---|---|---|
| Từ chối yêu cầu | BR-30 nói không triển khai từ chối | Có trạng thái `TU_CHOI` và luồng chờ → duyệt/từ chối | SPA/API có nút từ chối | Giữ theo DB hay sửa `phantich.md` |
| Giữ phòng | Có trạng thái `Đã giữ` | Ghi rõ không thêm trạng thái giữ phòng vì chưa có Entity | DB không có `DA_GIU` | Bỏ yêu cầu giữ phòng hoặc thêm Entity/migration |
| Phiếu thu chính thức | Có FR-CT-08 đầy đủ, lịch tự động/gửi | Mục 11.2 xác định `PhieuThu` là mở rộng chưa có | Dùng `ThanhToan` như kỳ phải trả | Chốt có triển khai chứng từ phiếu thu hay đổi thuật ngữ UI |
| Lịch sử hợp đồng/chỉ số/tài khoản | Bắt buộc lưu lịch sử | `AuditLog`/lịch sử là mở rộng chưa có trong 25 bảng | Không có nguồn lưu đầy đủ | Cần migration nếu vẫn giữ FR |
| Công nợ quá hạn ngày 05 | BR-35 quy định sau ngày 05 | Schema không có hạn thanh toán/lịch nhắc nợ | Service cũ dùng sau ngày 10 | Chốt ngày và bổ sung cấu hình/cột hạn |
| Nước và phí dịch vụ | Tiền nước theo số người; hợp đồng có phí dịch vụ | `HopDong` có đơn giá nước nhưng chưa đủ snapshot; không có phí dịch vụ | API nhận số tiền từ request | Chốt công thức và mở rộng schema trước tự động hóa |
| Trạng thái hoàn tất yêu cầu trả phòng | Có diễn tiến xử lý nghiệp vụ | DB không có `DA_HOAN_TAT` | Code đang cố ghi `DA_HOAN_TAT` | Không được dùng trạng thái ngoài schema; suy ra từ hợp đồng/biên bản hoặc migration |

## 7. Điểm đạt yêu cầu

| Điểm tốt | Bằng chứng |
|---|---|
| Mapping database đầy đủ | 25/25 bảng qua schema contract test |
| Dữ liệu mẫu nhất quán | 9 nhóm truy vấn bất biến đều 0 vi phạm |
| Phân quyền đọc cơ bản đúng | Khách gọi API Chủ trọ nhận 403 |
| Chống trùng phòng đang có hợp đồng | Có unique kỹ thuật `maPhongDangThue` trong `data2.md` |
| Tạo hợp đồng và cọc dùng transaction | Backend tạo `HopDong` + `TienCoc` và cập nhật phòng cùng transaction |
| Ghi nhận thanh toán có khóa và transaction | Tạo giao dịch, khoản thu và tính lại tổng trong cùng transaction |
| CRUD căn/phòng/tài sản/khách/chi cơ bản hoạt động | Đã test tạo và dọn dữ liệu QA thành công |
| Frontend mới đóng gói thành công | Vite build 45 module, không có lỗi compile |

## 8. Thứ tự khắc phục đề xuất

| Ưu tiên | Công việc | Điều kiện hoàn thành |
|---:|---|---|
| 1 | Sửa CT-001 và CT-002 | Duyệt trả phòng trả 200, phòng chuyển `DANG_XU_LY_TRA_PHONG`, hợp đồng/yêu cầu chỉ dùng trạng thái hợp lệ |
| 2 | Sửa CT-003 | Tab điện hiển thị đúng DTO và xác nhận được bản `CHO_XAC_NHAN` |
| 3 | Hoàn thiện transaction trả phòng CT-004 | Checklist điện/tài sản/nợ/cọc/cư trú/phòng/tài khoản được kiểm tra và rollback nguyên khối |
| 4 | Hoàn thiện sự cố CT-005 | Hai nhánh chi phí sinh đúng một bản ghi tài chính và thông báo |
| 5 | Sửa điều chỉnh tài chính CT-006/007/012 | Báo cáo lọc đúng; mọi điều chỉnh giữ tổng chi tiết khớp tổng kỳ; nước/dịch vụ có nguồn snapshot rõ |
| 6 | Hoàn thiện thao tác SPA Chủ trọ | Có create/update/state/detail cho tài khoản, hợp đồng, cọc, thanh toán, sự cố và trả phòng |
| 7 | Chốt mâu thuẫn tài liệu | Một quyết định duy nhất cho từ chối yêu cầu, giữ phòng, phiếu thu, nước/phí dịch vụ và hạn nợ |
| 8 | Cập nhật integration fixture | Dùng database test riêng, credential/config từ env, tự seed/reset; đưa integration test vào lệnh CI chính |

## 9. Kết luận QA/QC

Hệ thống mới **đã đọc và trình bày được phần lớn dữ liệu Chủ trọ**, kết nối đúng mô hình 25 bảng và dữ liệu seed hiện tại không có sai lệch bất biến. CRUD cơ bản cho căn, phòng, tài sản, hồ sơ khách và khoản chi hoạt động.

Tuy nhiên hệ thống **chưa đúng hoàn toàn với `phantich.md` và chưa đủ để nghiệm thu luồng Chủ trọ**. Lỗi chặn rõ nhất là không duyệt được trả phòng; tiếp theo là tab điện không khớp contract API, quy trình trả phòng/sự cố chưa đồng bộ tài chính, và báo cáo bỏ qua bộ lọc. Ngoài ra, một phần khoảng cách đến `phantich.md` đến từ việc `data1.md` chủ động giới hạn ở 25 bảng, chưa có các mở rộng mà FR yêu cầu. Cần chốt lại phạm vi tài liệu trước khi sửa toàn bộ để tránh tiếp tục xây code theo hai nguồn chuẩn mâu thuẫn.
