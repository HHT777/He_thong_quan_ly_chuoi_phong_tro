# DATABASE — HỆ THỐNG QUẢN LÝ PHÒNG TRỌ

> Tài liệu thiết kế cơ sở dữ liệu PTUD. Cập nhật ngày 12/10/2026. Phạm vi chính: **24 Entity nghiệp vụ, hiện thực thành 25 bảng** (thêm bảng liên kết `SuCoTaiSan`).

## Mục lục

1. [Nguồn và phạm vi](#1-nguồn-và-phạm-vi)
2. [Quy ước và điểm đã thống nhất](#2-quy-ước-và-điểm-đã-thống-nhất)
3. [Danh mục bảng](#3-danh-mục-bảng)
4. [Từ điển dữ liệu](#4-từ-điển-dữ-liệu)
5. [Quan hệ và khóa ngoại](#5-quan-hệ-và-khóa-ngoại)
6. [Miền giá trị và trạng thái](#6-miền-giá-trị-và-trạng-thái)
7. [Ràng buộc nghiệp vụ](#7-ràng-buộc-nghiệp-vụ)
8. [Công thức và nguồn dữ liệu chuẩn](#8-công-thức-và-nguồn-dữ-liệu-chuẩn)
9. [Chỉ mục và giao dịch](#9-chỉ-mục-và-giao-dịch)
10. [Dữ liệu mẫu](#10-dữ-liệu-mẫu)
11. [Đối chiếu mô hình tham khảo và mở rộng](#11-đối-chiếu-mô-hình-tham-khảo-và-mở-rộng)
12. [Thứ tự tạo bảng và điểm cần chốt](#12-thứ-tự-tạo-bảng-và-điểm-cần-chốt)

## 1. Nguồn và phạm vi

| Nguồn                                           | Cách sử dụng                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `CSDL_DETAIL(1).docx`                           | Nguồn chính cho cột, kiểu, tính bắt buộc, khóa, giá trị mặc định và ý nghĩa bảng.                                                            |
| `ERD_QuanLyPhongTro (1).svg`                    | Đối chiếu cấu trúc 24 Entity, bảng nối và các quan hệ vật lý. SVG đã được đọc trực tiếp dưới dạng XML.                                       |
| `PTUD_DacTa_Class_24_Entity_6_Nhom_BanMoi.docx` | Đối chiếu 6 nhóm chức năng, UC và các lưu ý nghiệp vụ; bổ sung người lập biên bản.                                                           |
| `Pasted text(3).txt`                            | Tài liệu tham khảo cấu trúc DATABASE theo SRS v0.4, 56 bảng; tham khảo cách trình bày, kiểm tra, công thức, dữ liệu mẫu và khả năng mở rộng. |

**Về `data.md`:** không có file tên `data.md` trong các tệp đính kèm hoặc kết quả tìm kiếm hiện tại. Tài liệu này sử dụng nội dung DATABASE trong `Pasted text(3).txt` làm nguồn tham khảo thay thế; không khẳng định đã đọc `data.md`.

Mô hình 56 bảng thuộc phiên bản khác, dùng tên snake_case và khóa số. Mô hình chính ở đây giữ tên bảng/cột của ERD và khóa chuỗi 36 ký tự. Không sao chép mã UC/BR/FR của phiên bản cũ như thể chúng thuộc phiên bản hiện tại. Các bảng mở rộng được ghi riêng ở mục 11, chưa tính vào 25 bảng chính.

## 2. Quy ước và điểm đã thống nhất

### 2.1. Quy ước chung

| Nội dung         | Quy ước                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Tên bảng / cột   | PascalCase theo Entity / camelCase theo thuộc tính của ERD.                                                                      |
| Khóa định danh   | `varchar(36)`; mã UUID do ứng dụng cấp là đề xuất kỹ thuật, không dùng auto_increment.                                           |
| Khóa kế thừa     | Bảng con của `YeuCau` dùng `maYeuCau` vừa là PK vừa là FK.                                                                       |
| Số tiền          | `decimal(18,2)`, đơn vị VND theo bản Word/ERD; đề xuất chỉ nhận số tiền nguyên VND ở tầng nghiệp vụ.                             |
| Diện tích / điện | `decimal(18,2)`; không thay bằng float để tránh sai số.                                                                          |
| Ngày / thời gian | `date` cho ngày nghiệp vụ, `timestamp` theo nguồn cho thời điểm; thống nhất múi giờ ứng dụng và kết nối CSDL `Asia/Ho_Chi_Minh`. |
| Boolean          | `true` / `false`; triển khai kiểu tương đương theo hệ quản trị được chọn.                                                        |
| NULL             | Có = được để trống; Không = `not null`. PK luôn không NULL.                                                                      |
| Không có default | Ứng dụng phải cấp giá trị nếu cột không NULL; nếu được NULL có thể để trống. FK không tự sinh như PK.                            |
| Trạng thái       | Giữ cột `varchar`, chuẩn hóa bằng miền giá trị ở mục 6. Các mã bổ sung là đề xuất thiết kế.                                      |
| PK / FK / UQ     | Khóa chính / khóa ngoại / ràng buộc duy nhất.                                                                                    |
| Dữ liệu mẫu      | Giả lập phục vụ giải thích; không phải dữ liệu thật hoặc script seed dùng trực tiếp.                                             |

SQL minh họa dùng từ khóa chữ thường. Tài liệu chưa giả định hệ quản trị đã được nhóm chốt; cú pháp check, boolean, default thời gian và cơ chế unique có điều kiện phải chuyển theo hệ quản trị triển khai.

### 2.2. Chênh lệch nguồn và cách giải quyết

| Điểm                          | Trong nguồn                                                                    | Phương án dùng trong tài liệu                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Hash mật khẩu                 | `matKhauHash varchar(36)`                                                      | Tăng thành `varchar(255)` để chứa hash cùng salt/tham số; cần cập nhật ERD/Word tương ứng.                                          |
| Người gửi sự cố               | Word CSDL: `maKhachThue`; ERD: `maNguoiGui`; Class mới: người gửi là tài khoản | Chọn `SuCo.maNguoiGui` FK → `TaiKhoan`; truy hồ sơ qua `KhachThue.maTaiKhoan`, kiểm tra vai trò khách thuê.                         |
| Biên bản–yêu cầu trả phòng    | ERD có `maYeuCauTraPhong`; bảng Word thiếu                                     | Bổ sung FK unique, có thể NULL khi thanh lý trực tiếp. Bắt buộc nếu thực hiện theo yêu cầu trả phòng.                               |
| Người lập biên bản            | Lưu ý Class có `nguoiLapId`; ERD/Word CSDL thiếu                               | Bổ sung FK tới `TaiKhoan`, không NULL; người lập có vai trò chủ trọ.                                                                |
| ID người ghi/xác nhận/xóa/hủy | Word và ERD có cột ID, chưa khai báo FK                                        | Bổ sung FK vật lý đến `TaiKhoan`; không tự thêm Entity nghiệp vụ.                                                                   |
| Khách chưa có hợp đồng        | Một lưu ý Class dùng 1..\*; UC05 cho tạo hồ sơ trước                           | Khách có 0..\* hợp đồng; mỗi hợp đồng thuộc đúng một khách.                                                                         |
| Thành viên hợp đồng           | Lưu ý Class dùng 1..\*                                                         | Cho 0..\* khi mới lập; khi đã nhận phòng phải có ít nhất một thành viên đang ở, kể cả người đứng tên.                               |
| Hồ sơ cọc                     | Word CSDL nói tối đa một; Class mới thống nhất đúng một                        | unique FK đảm bảo tối đa một ở CSDL; tạo hợp đồng và hồ sơ cọc cùng transaction để đảm bảo đúng một. Chưa nhận tiền dùng CHUA_NHAN. |
| Tổng đã trả và minh chứng     | UC11 cập nhật tổng; UC12 chỉ lưu minh chứng, chưa chốt nguồn chuẩn             | Đề xuất lấy giao dịch đã xác nhận, chưa hủy làm nguồn chuẩn. UC12 không tự cộng tiền. Chi tiết tại mục 8.                           |
| Tên bảng nối                  | Word: `SuCo_TaiSan`; ERD: `SuCoTaiSan`                                         | Dùng `SuCoTaiSan` theo ERD; cùng một bảng, không tạo cả hai.                                                                        |

### 2.3. Cột kiểm toán chung (tùy chọn kỹ thuật)

Các cột sau được tham khảo từ file text; **chưa có trong ERD**, không tự tính là cột gốc trong từ điển dữ liệu. Có thể thêm vào bảng nghiệp vụ khi cần truy vết:

| Cột       | Kiểu        | NULL  | Mặc định / ý nghĩa                                            |
| --------- | ----------- | ----- | ------------------------------------------------------------- |
| createdAt | timestamp   | Không | current_timestamp; thời điểm tạo.                             |
| updatedAt | timestamp   | Không | current_timestamp khi tạo; cập nhật bởi ứng dụng mỗi lần sửa. |
| createdBy | varchar(36) | Có    | FK → TaiKhoan; NULL nếu hệ thống tạo.                         |
| updatedBy | varchar(36) | Có    | FK → TaiKhoan; NULL nếu hệ thống sửa.                         |

Nếu đã có cột thời điểm chuyên biệt thì quy định rõ mục đích từng cột để tránh trùng nghĩa. Nhật ký bất biến chỉ cần thời điểm ghi sự kiện; không sửa nội dung lịch sử.

## 3. Danh mục bảng

Các Entity dùng chung giữa nhiều nhóm chỉ hiện thực một lần.

| STT | Bảng                 | Nhóm chính                 | Mục đích                                                                 |
| --- | -------------------- | -------------------------- | ------------------------------------------------------------------------ |
| 1   | `TaiKhoan`           | 1. Người dùng và phòng trọ | Thông tin đăng nhập, mật khẩu và trạng thái truy cập.                    |
| 2   | `ChuTro`             | 1. Người dùng và phòng trọ | Hồ sơ chủ trọ, người quản lý căn trọ và cấp tài khoản cho khách thuê.    |
| 3   | `KhachThue`          | 1. Người dùng và phòng trọ | Hồ sơ người đứng tên hợp đồng; có thể được tạo trước hợp đồng/tài khoản. |
| 4   | `CanTro`             | 1. Người dùng và phòng trọ | Thông tin một căn trọ do chủ trọ quản lý.                                |
| 5   | `PhongTro`           | 1. Người dùng và phòng trọ | Phòng thuộc một căn; giá thuê, sức chứa, trạng thái.                     |
| 6   | `ThanhVienPhong`     | 1. Người dùng và phòng trọ | Ghi nhận từng người cư trú theo phòng/hợp đồng và thời gian.             |
| 7   | `TaiSan`             | 1. Người dùng và phòng trọ | Tài sản, trang bị và tình trạng tại phòng.                               |
| 8   | `HopDong`            | 2. Hợp đồng và yêu cầu     | Hợp đồng thuê; thông tin thuê, gia hạn, thanh lý.                        |
| 9   | `TienCoc`            | 2. Hợp đồng và yêu cầu     | Số tiền cọc, số đã hoàn và khấu trừ gắn với hợp đồng.                    |
| 10  | `YeuCau`             | 2. Hợp đồng và yêu cầu     | Lớp cha trừu tượng cho quy trình gửi và xét duyệt yêu cầu.               |
| 11  | `YeuCauGiaHan`       | 2. Hợp đồng và yêu cầu     | Yêu cầu đề xuất gia hạn của một hợp đồng.                                |
| 12  | `YeuCauTraPhong`     | 2. Hợp đồng và yêu cầu     | Yêu cầu trả phòng được phê duyệt trước xử lý thanh lý.                   |
| 13  | `DeXuatBanCungPhong` | 2. Hợp đồng và yêu cầu     | Đề xuất thêm người ở cùng phòng.                                         |
| 14  | `ViPhamHopDong`      | 2. Hợp đồng và yêu cầu     | Vi phạm, căn cứ và khoản phạt theo hợp đồng.                             |
| 15  | `ChiSoDien`          | 3. Chỉ số điện             | Chỉ số công tơ điện theo kỳ, kiểm tra và xác nhận.                       |
| 16  | `ThanhToan`          | 4. Thanh toán và tài chính | Kỳ thanh toán và tổng phải trả, đã trả, còn nợ.                          |
| 17  | `ChiTietThanhToan`   | 4. Thanh toán và tài chính | Các dòng phải trả: tiền phòng, điện, dịch vụ, sửa chữa.                  |
| 18  | `GiaoDichThanhToan`  | 4. Thanh toán và tài chính | Minh chứng/lần giao dịch; trạng thái xét xác nhận.                       |
| 19  | `KhoanThu`           | 4. Thanh toán và tài chính | Khoản thu phục vụ theo dõi doanh thu.                                    |
| 20  | `KhoanChi`           | 4. Thanh toán và tài chính | Chi phí thuộc căn hoặc chi phí chung toàn chuỗi.                         |
| 21  | `BienBanTraPhong`    | 5. Trả phòng và thanh lý   | Ghi nhận kiểm tra phòng và kết quả tính hoàn cọc.                        |
| 22  | `KhoanKhauTru`       | 5. Trả phòng và thanh lý   | Từng hạng mục khấu trừ khi trả phòng.                                    |
| 23  | `SuCo`               | 6. Sự cố và thông báo      | Báo cáo sự cố, phân loại, tiếp nhận, xử lý và xóa mềm.                   |
| 24  | `ThongBao`           | 6. Sự cố và thông báo      | Thông báo đến người dùng và trạng thái đã đọc.                           |
| 25  | `SuCoTaiSan`         | 6. Sự cố và thông báo      | Bảng liên kết quan hệ nhiều–nhiều giữa sự cố và tài sản.                 |

## 4. Từ điển dữ liệu

Các kiểu, NULL và default kế thừa từ Word; phần bổ sung/điều chỉnh được ghi tại mục 2.2. Default có nhãn “đề xuất” trong nguồn tiếp tục là lựa chọn thiết kế.

### 4.1. `TaiKhoan`

**Mục đích:** Thông tin đăng nhập, mật khẩu và trạng thái truy cập.

| Cột                 | Kiểu dữ liệu   | NULL  | Default             | Khóa / kiểm tra  | Diễn giải                                                                                   |
| ------------------- | -------------- | ----- | ------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `maTaiKhoan`        | `varchar(36)`  | Không | —                   | PK               | Mã định danh duy nhất của tài khoản.                                                        |
| `tenDangNhap`       | `varchar(15)`  | Không | —                   | unique (đề xuất) | Thông tin ten dang nhap của TaiKhoan.                                                       |
| `matKhauHash`       | `varchar(255)` | Không | —                   | —                | Chuỗi hash mật khẩu; 255 ký tự là điều chỉnh kỹ thuật để chứa chuỗi hash cùng salt/tham số. |
| `vaiTro`            | `varchar(30)`  | Không | —                   | —                | Thông tin vai tro của TaiKhoan.                                                             |
| `trangThai`         | `varchar(30)`  | Không | HOAT_DONG (đề xuất) | —                | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.                                    |
| `batBuocDoiMatKhau` | `boolean`      | Không | TRUE (đề xuất)      | —                | Đánh dấu người dùng phải đổi mật khẩu sau khi được cấp/tạm đặt lại.                         |

- Tên đăng nhập phải được chuẩn hóa khoảng trắng và quy tắc hoa/thường trước khi kiểm tra unique. Không dùng mật khẩu gốc làm dữ liệu mẫu.

### 4.2. `ChuTro`

**Mục đích:** Hồ sơ chủ trọ, người quản lý căn trọ và cấp tài khoản cho khách thuê.

| Cột           | Kiểu dữ liệu   | NULL  | Default | Khóa / kiểm tra                   | Diễn giải                                                   |
| ------------- | -------------- | ----- | ------- | --------------------------------- | ----------------------------------------------------------- |
| `maChuTro`    | `varchar(36)`  | Không | —       | PK                                | Mã định danh ChuTro; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `hoTen`       | `varchar(100)` | Không | —       | —                                 | Thông tin ho ten của ChuTro.                                |
| `soDienThoai` | `varchar(15)`  | Không | —       | —                                 | Thông tin so dien thoai của ChuTro.                         |
| `maTaiKhoan`  | `varchar(36)`  | Không | —       | FK → TaiKhoan(maTaiKhoan); unique | Tài khoản đăng nhập của chủ trọ.                            |

### 4.3. `KhachThue`

**Mục đích:** Hồ sơ người đứng tên hợp đồng; có thể được tạo trước hợp đồng/tài khoản.

| Cột           | Kiểu dữ liệu   | NULL  | Default | Khóa / kiểm tra                   | Diễn giải                                                      |
| ------------- | -------------- | ----- | ------- | --------------------------------- | -------------------------------------------------------------- |
| `maKhachThue` | `varchar(36)`  | Không | —       | PK                                | Mã định danh KhachThue; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `hoTen`       | `varchar(100)` | Không | —       | —                                 | Thông tin ho ten của KhachThue.                                |
| `soDienThoai` | `varchar(15)`  | Không | —       | —                                 | Thông tin so dien thoai của KhachThue.                         |
| `soGiayTo`    | `varchar(20)`  | Không | —       | unique (đề xuất)                  | Thông tin so giay to của KhachThue.                            |
| `maTaiKhoan`  | `varchar(36)`  | Có    | —       | FK → TaiKhoan(maTaiKhoan); unique | Tài khoản khách thuê; có thể chưa được chủ trọ cấp.            |

### 4.4. `CanTro`

**Mục đích:** Thông tin một căn trọ do chủ trọ quản lý.

| Cột                  | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra       | Diễn giải                                                   |
| -------------------- | --------------- | ----- | ------- | --------------------- | ----------------------------------------------------------- |
| `maCan`              | `varchar(36)`   | Không | —       | PK                    | Mã định danh CanTro; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `tenCan`             | `varchar(100)`  | Không | —       | —                     | Thông tin ten can của CanTro.                               |
| `diaChi`             | `varchar(255)`  | Không | —       | —                     | Thông tin dia chi của CanTro.                               |
| `moTa`               | `varchar(1000)` | Có    | —       | —                     | Thông tin mo ta của CanTro.                                 |
| `quyDinhChung`       | `varchar(255)`  | Có    | —       | —                     | Thông tin quy dinh chung của CanTro.                        |
| `hinhAnhTongQuanUrl` | `varchar(500)`  | Có    | —       | —                     | Thông tin hinh anh tong quan url của CanTro.                |
| `trangThai`          | `varchar(30)`   | Không | —       | —                     | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.    |
| `maChuTro`           | `varchar(36)`   | Không | —       | FK → ChuTro(maChuTro) | Liên kết tới ChuTro theo sheet Quan he.                     |

### 4.5. `PhongTro`

**Mục đích:** Phòng thuộc một căn; giá thuê, sức chứa, trạng thái.

| Cột            | Kiểu dữ liệu    | NULL  | Default         | Khóa / kiểm tra    | Diễn giải                                                     |
| -------------- | --------------- | ----- | --------------- | ------------------ | ------------------------------------------------------------- |
| `maPhong`      | `varchar(36)`   | Không | —               | PK                 | Mã định danh PhongTro; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `soPhong`      | `varchar(255)`  | Không | —               | —                  | Thông tin so phong của PhongTro.                              |
| `dienTich`     | `decimal(18,2)` | Không | —               | —                  | Thông tin dien tich của PhongTro.                             |
| `giaThue`      | `decimal(18,2)` | Không | —               | check (>= 0)       | Thông tin gia thue của PhongTro.                              |
| `soNguoiToiDa` | `integer`       | Không | —               | check (>= 0)       | Thông tin so nguoi toi da của PhongTro.                       |
| `noiThatMoTa`  | `varchar(1000)` | Có    | —               | —                  | Thông tin noi that mo ta của PhongTro.                        |
| `trangThai`    | `varchar(30)`   | Không | TRONG (đề xuất) | —                  | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.      |
| `maCan`        | `varchar(36)`   | Không | —               | FK → CanTro(maCan) | Liên kết tới CanTro theo sheet Quan he.                       |

- Bổ sung `unique (maCan, soPhong)`.

- Bổ sung `check (dienTich > 0)`.

- Bổ sung `check (soNguoiToiDa > 0)`.

### 4.6. `ThanhVienPhong`

**Mục đích:** Ghi nhận từng người cư trú theo phòng/hợp đồng và thời gian.

| Cột                | Kiểu dữ liệu   | NULL  | Default | Khóa / kiểm tra         | Diễn giải                                                           |
| ------------------ | -------------- | ----- | ------- | ----------------------- | ------------------------------------------------------------------- |
| `maThanhVienPhong` | `varchar(36)`  | Không | —       | PK                      | Mã định danh ThanhVienPhong; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `hoTen`            | `varchar(100)` | Không | —       | —                       | Thông tin ho ten của ThanhVienPhong.                                |
| `soDienThoai`      | `varchar(15)`  | Không | —       | —                       | Thông tin so dien thoai của ThanhVienPhong.                         |
| `ngayVao`          | `date`         | Không | —       | —                       | Ngày hoặc thời điểm ngay vao.                                       |
| `ngayRoi`          | `date`         | Có    | —       | —                       | Ngày người ở rời khỏi phòng, bỏ trống nếu chưa rời.                 |
| `trangThaiCuTru`   | `varchar(50)`  | Không | —       | —                       | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.            |
| `maPhong`          | `varchar(36)`  | Không | —       | FK → PhongTro(maPhong)  | Liên kết tới PhongTro theo sheet Quan he.                           |
| `maHopDong`        | `varchar(36)`  | Không | —       | FK → HopDong(maHopDong) | Liên kết tới HopDong theo sheet Quan he.                            |

- Bổ sung `check (ngayRoi is null or ngayRoi >= ngayVao)`.

### 4.7. `TaiSan`

**Mục đích:** Tài sản, trang bị và tình trạng tại phòng.

| Cột         | Kiểu dữ liệu    | NULL  | Default     | Khóa / kiểm tra        | Diễn giải                                                   |
| ----------- | --------------- | ----- | ----------- | ---------------------- | ----------------------------------------------------------- |
| `maTaiSan`  | `varchar(36)`   | Không | —           | PK                     | Mã định danh TaiSan; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `tenTaiSan` | `varchar(100)`  | Không | —           | —                      | Thông tin ten tai san của TaiSan.                           |
| `soLuong`   | `integer`       | Không | 1 (đề xuất) | check (>= 0)           | Thông tin so luong của TaiSan.                              |
| `tinhTrang` | `varchar(1000)` | Có    | —           | —                      | Thông tin tinh trang của TaiSan.                            |
| `ghiChu`    | `varchar(1000)` | Có    | —           | —                      | Thông tin ghi chu của TaiSan.                               |
| `maPhong`   | `varchar(36)`   | Không | —           | FK → PhongTro(maPhong) | Liên kết tới PhongTro theo sheet Quan he.                   |

### 4.8. `HopDong`

**Mục đích:** Hợp đồng thuê; thông tin thuê, gia hạn, thanh lý.

| Cột           | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra             | Diễn giải                                                    |
| ------------- | --------------- | ----- | ------- | --------------------------- | ------------------------------------------------------------ |
| `maHopDong`   | `varchar(36)`   | Không | —       | PK                          | Mã định danh HopDong; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `ngayBatDau`  | `date`          | Không | —       | —                           | Ngày hoặc thời điểm ngay bat dau.                            |
| `ngayKetThuc` | `date`          | Không | —       | —                           | Ngày hoặc thời điểm ngay ket thuc.                           |
| `giaThue`     | `decimal(18,2)` | Không | —       | check (>= 0)                | Thông tin gia thue của HopDong.                              |
| `donGiaDien`  | `decimal(18,2)` | Không | —       | check (>= 0)                | Thông tin don gia dien của HopDong.                          |
| `donGiaNuoc`  | `decimal(18,2)` | Không | —       | check (>= 0)                | Thông tin don gia nuoc của HopDong.                          |
| `dieuKhoan`   | `varchar(255)`  | Không | —       | —                           | Thông tin dieu khoan của HopDong.                            |
| `trangThai`   | `varchar(30)`   | Không | —       | —                           | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.     |
| `ngayThanhLy` | `date`          | Có    | —       | —                           | Ngày hợp đồng được thanh lý.                                 |
| `maKhachThue` | `varchar(36)`   | Không | —       | FK → KhachThue(maKhachThue) | Liên kết tới KhachThue theo sheet Quan he.                   |
| `maPhong`     | `varchar(36)`   | Không | —       | FK → PhongTro(maPhong)      | Liên kết tới PhongTro theo sheet Quan he.                    |

- Bổ sung `check (ngayKetThuc > ngayBatDau)`.

- Bổ sung `check (ngayThanhLy is null or ngayThanhLy >= ngayBatDau)`.

### 4.9. `TienCoc`

**Mục đích:** Số tiền cọc, số đã hoàn và khấu trừ gắn với hợp đồng.

| Cột               | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra                 | Diễn giải                                                                     |
| ----------------- | --------------- | ----- | ------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `maTienCoc`       | `varchar(36)`   | Không | —       | PK                              | Mã định danh TienCoc; sử dụng để tìm kiếm/đối chiếu bản ghi.                  |
| `soTienCoc`       | `decimal(18,2)` | Không | —       | check (>= 0)                    | Số tiền so tien coc được ghi nhận, tính theo đơn vị tiền tệ hệ thống.         |
| `ngayNhanCoc`     | `date`          | Có    | —       | —                               | Ngày hoặc thời điểm ngay nhan coc.                                            |
| `trangThai`       | `varchar(30)`   | Không | —       | —                               | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.                      |
| `soTienDaHoan`    | `decimal(18,2)` | Không | 0       | check (>= 0)                    | Số tiền so tien da hoan được ghi nhận, tính theo đơn vị tiền tệ hệ thống.     |
| `soTienDaKhauTru` | `decimal(18,2)` | Không | 0       | check (>= 0)                    | Số tiền so tien da khau tru được ghi nhận, tính theo đơn vị tiền tệ hệ thống. |
| `maHopDong`       | `varchar(36)`   | Không | —       | FK → HopDong(maHopDong); unique | Liên kết tới HopDong theo sheet Quan he.                                      |

- Bổ sung `check (soTienDaHoan + soTienDaKhauTru <= soTienCoc)`.

- Hồ sơ cọc luôn được tạo cùng hợp đồng; `ngayNhanCoc` NULL khi chưa nhận tiền. Không xem tiền cọc chưa nhận là tiền có thể hoàn.

### 4.10. `YeuCau`

**Mục đích:** Lớp cha trừu tượng cho quy trình gửi và xét duyệt yêu cầu.

| Cột           | Kiểu dữ liệu    | NULL  | Default             | Khóa / kiểm tra             | Diễn giải                                                   |
| ------------- | --------------- | ----- | ------------------- | --------------------------- | ----------------------------------------------------------- |
| `maYeuCau`    | `varchar(36)`   | Không | —                   | PK                          | Mã định danh YeuCau; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `ngayGui`     | `timestamp`     | Không | CURRENT_TIMESTAMP   | —                           | Ngày hoặc thời điểm ngay gui.                               |
| `noiDung`     | `varchar(1000)` | Không | —                   | —                           | Thông tin noi dung của YeuCau.                              |
| `trangThai`   | `varchar(30)`   | Không | CHO_XU_LY (đề xuất) | —                           | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.    |
| `loaiYeuCau`  | `varchar(30)`   | Không | —                   | —                           | Thông tin loai yeu cau của YeuCau.                          |
| `maKhachThue` | `varchar(36)`   | Không | —                   | FK → KhachThue(maKhachThue) | Liên kết tới KhachThue theo sheet Quan he.                  |

- Mỗi yêu cầu phải có đúng một bản ghi ở một trong ba bảng con, phù hợp `loaiYeuCau`; FK riêng lẻ không đủ bảo đảm điều này.

### 4.11. `YeuCauGiaHan`

**Mục đích:** Yêu cầu đề xuất gia hạn của một hợp đồng.

| Cột                 | Kiểu dữ liệu  | NULL  | Default | Khóa / kiểm tra           | Diễn giải                                                            |
| ------------------- | ------------- | ----- | ------- | ------------------------- | -------------------------------------------------------------------- |
| `ngayKetThucDeXuat` | `date`        | Không | —       | —                         | Ngày hoặc thời điểm ngay ket thuc de xuat.                           |
| `maYeuCau`          | `varchar(36)` | Không | —       | PK; FK → YeuCau(maYeuCau) | Mã yêu cầu đồng thời là khóa chính của bảng con (kế thừa từ YeuCau). |
| `maHopDong`         | `varchar(36)` | Không | —       | FK → HopDong(maHopDong)   | Liên kết tới HopDong theo sheet Quan he.                             |

### 4.12. `YeuCauTraPhong`

**Mục đích:** Yêu cầu trả phòng được phê duyệt trước xử lý thanh lý.

| Cột         | Kiểu dữ liệu  | NULL  | Default | Khóa / kiểm tra           | Diễn giải                                                            |
| ----------- | ------------- | ----- | ------- | ------------------------- | -------------------------------------------------------------------- |
| `maYeuCau`  | `varchar(36)` | Không | —       | PK; FK → YeuCau(maYeuCau) | Mã yêu cầu đồng thời là khóa chính của bảng con (kế thừa từ YeuCau). |
| `maHopDong` | `varchar(36)` | Không | —       | FK → HopDong(maHopDong)   | Liên kết tới HopDong theo sheet Quan he.                             |

### 4.13. `DeXuatBanCungPhong`

**Mục đích:** Đề xuất thêm người ở cùng phòng.

| Cột                      | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra           | Diễn giải                                                            |
| ------------------------ | --------------- | ----- | ------- | ------------------------- | -------------------------------------------------------------------- |
| `hoTenNguoiDeXuat`       | `varchar(255)`  | Không | —       | —                         | Thông tin ho ten nguoi de xuat của DeXuatBanCungPhong.               |
| `soDienThoaiNguoiDeXuat` | `varchar(15)`   | Không | —       | —                         | Thông tin so dien thoai nguoi de xuat của DeXuatBanCungPhong.        |
| `noiDungBoSung`          | `varchar(1000)` | Có    | —       | —                         | Thông tin noi dung bo sung của DeXuatBanCungPhong.                   |
| `maYeuCau`               | `varchar(36)`   | Không | —       | PK; FK → YeuCau(maYeuCau) | Mã yêu cầu đồng thời là khóa chính của bảng con (kế thừa từ YeuCau). |
| `maPhong`                | `varchar(36)`   | Không | —       | FK → PhongTro(maPhong)    | Liên kết tới PhongTro theo sheet Quan he.                            |

### 4.14. `ViPhamHopDong`

**Mục đích:** Vi phạm, căn cứ và khoản phạt theo hợp đồng.

| Cột                 | Kiểu dữ liệu    | NULL  | Default           | Khóa / kiểm tra         | Diễn giải                                                          |
| ------------------- | --------------- | ----- | ----------------- | ----------------------- | ------------------------------------------------------------------ |
| `maViPham`          | `varchar(36)`   | Không | —                 | PK                      | Mã định danh ViPhamHopDong; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `noiDung`           | `varchar(1000)` | Không | —                 | —                       | Thông tin noi dung của ViPhamHopDong.                              |
| `ngayGhiNhan`       | `timestamp`     | Không | CURRENT_TIMESTAMP | —                       | Ngày hoặc thời điểm ngay ghi nhan.                                 |
| `dieuKhoanLienQuan` | `varchar(255)`  | Không | —                 | —                       | Thông tin dieu khoan lien quan của ViPhamHopDong.                  |
| `mucPhat`           | `decimal(18,2)` | Có    | —                 | check (>= 0)            | Thông tin muc phat của ViPhamHopDong.                              |
| `maHopDong`         | `varchar(36)`   | Không | —                 | FK → HopDong(maHopDong) | Liên kết tới HopDong theo sheet Quan he.                           |

### 4.15. `ChiSoDien`

**Mục đích:** Chỉ số công tơ điện theo kỳ, kiểm tra và xác nhận.

| Cột                | Kiểu dữ liệu    | NULL  | Default           | Khóa / kiểm tra                              | Diễn giải                                                      |
| ------------------ | --------------- | ----- | ----------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `maChiSo`          | `varchar(36)`   | Không | —                 | PK                                           | Mã định danh ChiSoDien; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `thang`            | `integer`       | Không | —                 | check (1..12)                                | Thông tin thang của ChiSoDien.                                 |
| `nam`              | `integer`       | Không | —                 | —                                            | Thông tin nam của ChiSoDien.                                   |
| `chiSoMoi`         | `decimal(18,2)` | Không | —                 | —                                            | Thông tin chi so moi của ChiSoDien.                            |
| `anhCongToUrl`     | `varchar(500)`  | Có    | —                 | —                                            | Thông tin anh cong to url của ChiSoDien.                       |
| `donGiaApDung`     | `decimal(18,2)` | Không | —                 | check (>= 0)                                 | Thông tin don gia ap dung của ChiSoDien.                       |
| `trangThaiXacNhan` | `varchar(30)`   | Không | —                 | —                                            | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.       |
| `ngayGhiNhan`      | `timestamp`     | Không | CURRENT_TIMESTAMP | —                                            | Ngày hoặc thời điểm ngay ghi nhan.                             |
| `nguoiGhiNhanId`   | `varchar(36)`   | Không | —                 | FK → TaiKhoan(maTaiKhoan) (bổ sung kỹ thuật) | Thông tin nguoi ghi nhan id của ChiSoDien.                     |
| `nguoiXacNhanId`   | `varchar(36)`   | Có    | —                 | FK → TaiKhoan(maTaiKhoan) (bổ sung kỹ thuật) | Mã người đã xác nhận chỉ số.                                   |
| `ngayXacNhan`      | `timestamp`     | Có    | —                 | —                                            | Thời điểm chỉ số được xác nhận.                                |
| `maPhong`          | `varchar(36)`   | Không | —                 | FK → PhongTro(maPhong)                       | Liên kết tới PhongTro theo sheet Quan he.                      |

- Bổ sung `unique (maPhong, thang, nam)`.

- Bổ sung `check (chiSoMoi >= 0)`.

- Bổ sung `check (nam > 0)`.

### 4.16. `ThanhToan`

**Mục đích:** Kỳ thanh toán và tổng phải trả, đã trả, còn nợ.

| Cột               | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra         | Diễn giải                                                                |
| ----------------- | --------------- | ----- | ------- | ----------------------- | ------------------------------------------------------------------------ |
| `maThanhToan`     | `varchar(36)`   | Không | —       | PK                      | Mã định danh ThanhToan; sử dụng để tìm kiếm/đối chiếu bản ghi.           |
| `thang`           | `integer`       | Không | —       | check (1..12)           | Thông tin thang của ThanhToan.                                           |
| `nam`             | `integer`       | Không | —       | —                       | Thông tin nam của ThanhToan.                                             |
| `tongPhaiTra`     | `decimal(18,2)` | Không | —       | —                       | Thông tin tong phai tra của ThanhToan.                                   |
| `tongDaThanhToan` | `decimal(18,2)` | Không | —       | —                       | Thông tin tong da thanh toan của ThanhToan.                              |
| `soTienConNo`     | `decimal(18,2)` | Không | —       | check (>= 0)            | Số tiền so tien con no được ghi nhận, tính theo đơn vị tiền tệ hệ thống. |
| `trangThai`       | `varchar(30)`   | Không | —       | —                       | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.                 |
| `maHopDong`       | `varchar(36)`   | Không | —       | FK → HopDong(maHopDong) | Liên kết tới HopDong theo sheet Quan he.                                 |

- Bổ sung `unique (maHopDong, thang, nam)`.

- Bổ sung `check (nam > 0)`.

- Bổ sung `check (tongPhaiTra >= 0)`.

- Bổ sung `check (tongDaThanhToan >= 0)`.

- Bổ sung `check (tongDaThanhToan <= tongPhaiTra)`.

- Bổ sung `check (soTienConNo = tongPhaiTra - tongDaThanhToan)`.

### 4.17. `ChiTietThanhToan`

**Mục đích:** Các dòng phải trả: tiền phòng, điện, dịch vụ, sửa chữa.

| Cột           | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra             | Diễn giải                                                             |
| ------------- | --------------- | ----- | ------- | --------------------------- | --------------------------------------------------------------------- |
| `maChiTiet`   | `varchar(36)`   | Không | —       | PK                          | Mã định danh ChiTietThanhToan; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `loaiKhoan`   | `varchar(30)`   | Không | —       | —                           | Thông tin loai khoan của ChiTietThanhToan.                            |
| `soTien`      | `decimal(18,2)` | Không | —       | check (>= 0)                | Số tiền so tien được ghi nhận, tính theo đơn vị tiền tệ hệ thống.     |
| `dienGiai`    | `varchar(255)`  | Không | —       | —                           | Thông tin dien giai của ChiTietThanhToan.                             |
| `maThanhToan` | `varchar(36)`   | Không | —       | FK → ThanhToan(maThanhToan) | Liên kết tới ThanhToan theo sheet Quan he.                            |
| `maSuCo`      | `varchar(36)`   | Có    | —       | FK → SuCo(maSuCo); unique   | Liên kết tới SuCo theo sheet Quan he.                                 |

### 4.18. `GiaoDichThanhToan`

**Mục đích:** Minh chứng/lần giao dịch; trạng thái xét xác nhận.

| Cột                | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra                              | Diễn giải                                                              |
| ------------------ | --------------- | ----- | ------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| `maGiaoDich`       | `varchar(36)`   | Không | —       | PK                                           | Mã định danh GiaoDichThanhToan; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `soTien`           | `decimal(18,2)` | Có    | —       | check (>= 0)                                 | Số tiền so tien được ghi nhận, tính theo đơn vị tiền tệ hệ thống.      |
| `thoiDiemGhiNhan`  | `timestamp`     | Không | —       | —                                            | Thông tin thoi diem ghi nhan của GiaoDichThanhToan.                    |
| `minhChungUrl`     | `varchar(500)`  | Có    | —       | —                                            | Thông tin minh chung url của GiaoDichThanhToan.                        |
| `trangThaiXacNhan` | `varchar(30)`   | Không | —       | —                                            | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.               |
| `thoiDiemXacNhan`  | `timestamp`     | Có    | —       | —                                            | Thông tin thoi diem xac nhan của GiaoDichThanhToan.                    |
| `lyDoHuy`          | `varchar(1000)` | Có    | —       | —                                            | Thông tin ly do huy của GiaoDichThanhToan.                             |
| `ngayHuy`          | `timestamp`     | Có    | —       | —                                            | Ngày hoặc thời điểm ngay huy.                                          |
| `nguoiHuyId`       | `varchar(36)`   | Có    | —       | FK → TaiKhoan(maTaiKhoan) (bổ sung kỹ thuật) | Thông tin nguoi huy id của GiaoDichThanhToan.                          |
| `maThanhToan`      | `varchar(36)`   | Không | —       | FK → ThanhToan(maThanhToan)                  | Liên kết tới ThanhToan theo sheet Quan he.                             |

- `soTien` có thể NULL khi mới nộp minh chứng. Khi xác nhận phải có số tiền > 0 và thời điểm xác nhận; giao dịch hủy phải có lý do, người hủy, ngày hủy. Các mã TU_CHOI/DA_HUY là đề xuất cần chốt quy trình.

### 4.19. `KhoanThu`

**Mục đích:** Khoản thu phục vụ theo dõi doanh thu.

| Cột                   | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra                            | Diễn giải                                                         |
| --------------------- | --------------- | ----- | ------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `maKhoanThu`          | `varchar(36)`   | Không | —       | PK                                         | Mã định danh KhoanThu; sử dụng để tìm kiếm/đối chiếu bản ghi.     |
| `loaiKhoanThu`        | `varchar(50)`   | Không | —       | —                                          | Thông tin loai khoan thu của KhoanThu.                            |
| `soTien`              | `decimal(18,2)` | Không | —       | check (>= 0)                               | Số tiền so tien được ghi nhận, tính theo đơn vị tiền tệ hệ thống. |
| `ngayGhiNhan`         | `date`          | Không | —       | —                                          | Ngày hoặc thời điểm ngay ghi nhan.                                |
| `ghiChu`              | `varchar(1000)` | Có    | —       | —                                          | Thông tin ghi chu của KhoanThu.                                   |
| `trangThaiGhiNhan`    | `varchar(50)`   | Không | —       | —                                          | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.          |
| `lyDoHuy`             | `varchar(1000)` | Có    | —       | —                                          | Thông tin ly do huy của KhoanThu.                                 |
| `ngayHuy`             | `timestamp`     | Có    | —       | —                                          | Ngày hoặc thời điểm ngay huy.                                     |
| `maGiaoDichThanhToan` | `varchar(36)`   | Có    | —       | FK → GiaoDichThanhToan(maGiaoDich); unique | Liên kết tới GiaoDichThanhToan theo sheet Quan he.                |
| `maCan`               | `varchar(36)`   | Không | —       | FK → CanTro(maCan)                         | Liên kết tới CanTro theo sheet Quan he.                           |

### 4.20. `KhoanChi`

**Mục đích:** Chi phí thuộc căn hoặc chi phí chung toàn chuỗi.

| Cột            | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra           | Diễn giải                                                         |
| -------------- | --------------- | ----- | ------- | ------------------------- | ----------------------------------------------------------------- |
| `maKhoanChi`   | `varchar(36)`   | Không | —       | PK                        | Mã định danh KhoanChi; sử dụng để tìm kiếm/đối chiếu bản ghi.     |
| `loaiKhoanChi` | `varchar(50)`   | Không | —       | —                         | Thông tin loai khoan chi của KhoanChi.                            |
| `soTien`       | `decimal(18,2)` | Không | —       | check (>= 0)              | Số tiền so tien được ghi nhận, tính theo đơn vị tiền tệ hệ thống. |
| `ngayPhatSinh` | `date`          | Không | —       | —                         | Ngày hoặc thời điểm ngay phat sinh.                               |
| `phamVi`       | `varchar(30)`   | Không | —       | —                         | Thông tin pham vi của KhoanChi.                                   |
| `ghiChu`       | `varchar(1000)` | Có    | —       | —                         | Thông tin ghi chu của KhoanChi.                                   |
| `maCan`        | `varchar(36)`   | Có    | —       | FK → CanTro(maCan)        | Liên kết tới CanTro theo sheet Quan he.                           |
| `maSuCo`       | `varchar(36)`   | Có    | —       | FK → SuCo(maSuCo); unique | Liên kết tới SuCo theo sheet Quan he.                             |

### 4.21. `BienBanTraPhong`

**Mục đích:** Ghi nhận kiểm tra phòng và kết quả tính hoàn cọc.

| Cột                 | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra                              | Diễn giải                                                                       |
| ------------------- | --------------- | ----- | ------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| `maBienBan`         | `varchar(36)`   | Không | —       | PK                                           | Mã định danh BienBanTraPhong; sử dụng để tìm kiếm/đối chiếu bản ghi.            |
| `ngayKiemTra`       | `date`          | Không | —       | —                                            | Ngày hoặc thời điểm ngay kiem tra.                                              |
| `tinhTrangPhong`    | `varchar(1000)` | Không | —       | —                                            | Thông tin tinh trang phong của BienBanTraPhong.                                 |
| `ghiChu`            | `varchar(1000)` | Có    | —       | —                                            | Thông tin ghi chu của BienBanTraPhong.                                          |
| `tongKhoanKhauTru`  | `decimal(18,2)` | Không | —       | —                                            | Thông tin tong khoan khau tru của BienBanTraPhong.                              |
| `soTienCocDuocHoan` | `decimal(18,2)` | Không | —       | check (>= 0)                                 | Số tiền so tien coc duoc hoan được ghi nhận, tính theo đơn vị tiền tệ hệ thống. |
| `maHopDong`         | `varchar(36)`   | Không | —       | FK → HopDong(maHopDong); unique              | Liên kết tới HopDong theo sheet Quan he.                                        |
| `maYeuCauTraPhong`  | `varchar(36)`   | Có    | —       | FK → YeuCauTraPhong(maYeuCau); unique        | Bổ sung theo ERD. NULL khi thanh lý trực tiếp, không qua yêu cầu trả phòng.     |
| `nguoiLapId`        | `varchar(36)`   | Không | —       | FK → TaiKhoan(maTaiKhoan) (bổ sung kỹ thuật) | Bổ sung theo lưu ý trong đặc tả Class: tài khoản chủ trọ lập biên bản.          |

- Bổ sung `check (tongKhoanKhauTru >= 0)`.

- Biên bản chỉ lưu kết quả tính hoàn cọc; không tự chứng minh tiền đã được hoàn thực tế. Cập nhật `TienCoc.soTienDaHoan` sau khi hoàn thực tế.

### 4.22. `KhoanKhauTru`

**Mục đích:** Từng hạng mục khấu trừ khi trả phòng.

| Cột                 | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra                 | Diễn giải                                                         |
| ------------------- | --------------- | ----- | ------- | ------------------------------- | ----------------------------------------------------------------- |
| `maKhauTru`         | `varchar(36)`   | Không | —       | PK                              | Mã định danh KhoanKhauTru; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `loaiKhauTru`       | `varchar(50)`   | Không | —       | —                               | Thông tin loai khau tru của KhoanKhauTru.                         |
| `lyDo`              | `varchar(1000)` | Không | —       | —                               | Thông tin ly do của KhoanKhauTru.                                 |
| `soTien`            | `decimal(18,2)` | Không | —       | check (>= 0)                    | Số tiền so tien được ghi nhận, tính theo đơn vị tiền tệ hệ thống. |
| `ghiChu`            | `varchar(1000)` | Có    | —       | —                               | Thông tin ghi chu của KhoanKhauTru.                               |
| `maBienBanTraPhong` | `varchar(36)`   | Không | —       | FK → BienBanTraPhong(maBienBan) | Liên kết tới BienBanTraPhong theo sheet Quan he.                  |
| `maTaiSan`          | `varchar(36)`   | Có    | —       | FK → TaiSan(maTaiSan)           | Liên kết tới TaiSan theo sheet Quan he.                           |
| `maViPham`          | `varchar(36)`   | Có    | —       | FK → ViPhamHopDong(maViPham)    | Liên kết tới ViPhamHopDong theo sheet Quan he.                    |

### 4.23. `SuCo`

**Mục đích:** Báo cáo sự cố, phân loại, tiếp nhận, xử lý và xóa mềm.

| Cột               | Kiểu dữ liệu    | NULL  | Default           | Khóa / kiểm tra                              | Diễn giải                                                                |
| ----------------- | --------------- | ----- | ----------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `maSuCo`          | `varchar(36)`   | Không | —                 | PK                                           | Mã định danh SuCo; sử dụng để tìm kiếm/đối chiếu bản ghi.                |
| `loaiSuCo`        | `varchar(50)`   | Không | —                 | —                                            | Thông tin loai su co của SuCo.                                           |
| `mucDoUuTien`     | `varchar(255)`  | Không | —                 | —                                            | Thông tin muc do uu tien của SuCo.                                       |
| `moTa`            | `varchar(1000)` | Có    | —                 | —                                            | Thông tin mo ta của SuCo.                                                |
| `hinhAnhUrl`      | `varchar(500)`  | Có    | —                 | —                                            | Thông tin hinh anh url của SuCo.                                         |
| `trangThai`       | `varchar(30)`   | Không | —                 | —                                            | Trạng thái xử lý hoặc tình trạng hiện tại của đối tượng.                 |
| `ngayGui`         | `timestamp`     | Không | CURRENT_TIMESTAMP | —                                            | Ngày hoặc thời điểm ngay gui.                                            |
| `ngayChinhSua`    | `timestamp`     | Có    | —                 | —                                            | Ngày hoặc thời điểm ngay chinh sua.                                      |
| `ngayTiepNhan`    | `timestamp`     | Có    | —                 | —                                            | Ngày hoặc thời điểm ngay tiep nhan.                                      |
| `ketQuaXuLy`      | `varchar(1000)` | Có    | —                 | —                                            | Thông tin ket qua xu ly của SuCo.                                        |
| `thietBiThayThe`  | `varchar(255)`  | Có    | —                 | —                                            | Thông tin thiet bi thay the của SuCo.                                    |
| `chiPhiSuaChua`   | `decimal(18,2)` | Có    | —                 | —                                            | Thông tin chi phi sua chua của SuCo.                                     |
| `doiTuongChiuPhi` | `varchar(255)`  | Có    | —                 | —                                            | Thông tin doi tuong chiu phi của SuCo.                                   |
| `ngayHoanTat`     | `timestamp`     | Có    | —                 | —                                            | Ngày hoặc thời điểm ngay hoan tat.                                       |
| `daXoa`           | `boolean`       | Không | —                 | —                                            | Thông tin da xoa của SuCo.                                               |
| `lyDoXoa`         | `varchar(1000)` | Có    | —                 | —                                            | Thông tin ly do xoa của SuCo.                                            |
| `ngayXoa`         | `timestamp`     | Có    | —                 | —                                            | Ngày hoặc thời điểm ngay xoa.                                            |
| `nguoiTiepNhanId` | `varchar(36)`   | Có    | —                 | FK → TaiKhoan(maTaiKhoan) (bổ sung kỹ thuật) | Thông tin nguoi tiep nhan id của SuCo.                                   |
| `nguoiXoaId`      | `varchar(36)`   | Có    | —                 | FK → TaiKhoan(maTaiKhoan) (bổ sung kỹ thuật) | Thông tin nguoi xoa id của SuCo.                                         |
| `maNguoiGui`      | `varchar(36)`   | Không | —                 | FK → TaiKhoan(maTaiKhoan)                    | Tài khoản gửi báo cáo, vai trò KHACH_THUE; khớp ERD và đặc tả Class mới. |
| `maPhong`         | `varchar(36)`   | Không | —                 | FK → PhongTro(maPhong)                       | Liên kết tới PhongTro theo sheet Quan he.                                |

- Bổ sung `check (chiPhiSuaChua is null or chiPhiSuaChua >= 0)`.

- `maNguoiGui` phải là tài khoản khách thuê đang thuê phòng báo sự cố. Mô hình chính chưa hỗ trợ báo sự cố khu vực chung/chủ trọ tự tạo; phương án đó thuộc mở rộng.

### 4.24. `ThongBao`

**Mục đích:** Thông báo đến người dùng và trạng thái đã đọc.

| Cột            | Kiểu dữ liệu    | NULL  | Default | Khóa / kiểm tra           | Diễn giải                                                     |
| -------------- | --------------- | ----- | ------- | ------------------------- | ------------------------------------------------------------- |
| `maThongBao`   | `varchar(36)`   | Không | —       | PK                        | Mã định danh ThongBao; sử dụng để tìm kiếm/đối chiếu bản ghi. |
| `loaiThongBao` | `varchar(50)`   | Không | —       | —                         | Thông tin loai thong bao của ThongBao.                        |
| `noiDung`      | `varchar(1000)` | Không | —       | —                         | Thông tin noi dung của ThongBao.                              |
| `thoiDiemTao`  | `timestamp`     | Không | —       | —                         | Thông tin thoi diem tao của ThongBao.                         |
| `daDoc`        | `boolean`       | Không | —       | —                         | Thông tin da doc của ThongBao.                                |
| `maSuCo`       | `varchar(36)`   | Có    | —       | FK → SuCo(maSuCo)         | Liên kết tới SuCo theo sheet Quan he.                         |
| `maTaiKhoan`   | `varchar(36)`   | Không | —       | FK → TaiKhoan(maTaiKhoan) | Liên kết tới TaiKhoan theo sheet Quan he.                     |

### 4.25. `SuCoTaiSan`

**Mục đích:** Bảng liên kết quan hệ nhiều–nhiều giữa sự cố và tài sản.

| Cột        | Kiểu dữ liệu  | NULL  | Default | Khóa / kiểm tra                | Diễn giải                                                 |
| ---------- | ------------- | ----- | ------- | ------------------------------ | --------------------------------------------------------- |
| `maSuCo`   | `varchar(36)` | Không | —       | PK ghép; FK → SuCo(maSuCo)     | Sự cố liên quan.                                          |
| `maTaiSan` | `varchar(36)` | Không | —       | PK ghép; FK → TaiSan(maTaiSan) | Tài sản liên quan; không được lặp cặp (maSuCo, maTaiSan). |

## 5. Quan hệ và khóa ngoại

### 5.1. Danh mục FK đầy đủ

Bội số được đọc từ bảng cha sang bảng con. “0..1” = tối đa một; “0..\*” = nhiều hoặc chưa có. Cột NULL chỉ quyết định một bản ghi con có bắt buộc tham chiếu cha hay không.

| Bảng con             | Cột FK                | Tham chiếu                     | NULL  | Số bản ghi con trên một cha |
| -------------------- | --------------------- | ------------------------------ | ----- | --------------------------- |
| `ChuTro`             | `maTaiKhoan`          | `TaiKhoan.maTaiKhoan`          | Không | 0..1                        |
| `KhachThue`          | `maTaiKhoan`          | `TaiKhoan.maTaiKhoan`          | Có    | 0..1                        |
| `CanTro`             | `maChuTro`            | `ChuTro.maChuTro`              | Không | 0..\*                       |
| `PhongTro`           | `maCan`               | `CanTro.maCan`                 | Không | 0..\*                       |
| `ThanhVienPhong`     | `maPhong`             | `PhongTro.maPhong`             | Không | 0..\*                       |
| `ThanhVienPhong`     | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..\*                       |
| `TaiSan`             | `maPhong`             | `PhongTro.maPhong`             | Không | 0..\*                       |
| `HopDong`            | `maKhachThue`         | `KhachThue.maKhachThue`        | Không | 0..\*                       |
| `HopDong`            | `maPhong`             | `PhongTro.maPhong`             | Không | 0..\*                       |
| `TienCoc`            | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..1                        |
| `YeuCau`             | `maKhachThue`         | `KhachThue.maKhachThue`        | Không | 0..\*                       |
| `YeuCauGiaHan`       | `maYeuCau`            | `YeuCau.maYeuCau`              | Không | 0..1                        |
| `YeuCauGiaHan`       | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..\*                       |
| `YeuCauTraPhong`     | `maYeuCau`            | `YeuCau.maYeuCau`              | Không | 0..1                        |
| `YeuCauTraPhong`     | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..\*                       |
| `DeXuatBanCungPhong` | `maYeuCau`            | `YeuCau.maYeuCau`              | Không | 0..1                        |
| `DeXuatBanCungPhong` | `maPhong`             | `PhongTro.maPhong`             | Không | 0..\*                       |
| `ViPhamHopDong`      | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..\*                       |
| `ChiSoDien`          | `nguoiGhiNhanId`      | `TaiKhoan.maTaiKhoan`          | Không | 0..\*                       |
| `ChiSoDien`          | `nguoiXacNhanId`      | `TaiKhoan.maTaiKhoan`          | Có    | 0..\*                       |
| `ChiSoDien`          | `maPhong`             | `PhongTro.maPhong`             | Không | 0..\*                       |
| `ThanhToan`          | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..\*                       |
| `ChiTietThanhToan`   | `maThanhToan`         | `ThanhToan.maThanhToan`        | Không | 0..\*                       |
| `ChiTietThanhToan`   | `maSuCo`              | `SuCo.maSuCo`                  | Có    | 0..1                        |
| `GiaoDichThanhToan`  | `nguoiHuyId`          | `TaiKhoan.maTaiKhoan`          | Có    | 0..\*                       |
| `GiaoDichThanhToan`  | `maThanhToan`         | `ThanhToan.maThanhToan`        | Không | 0..\*                       |
| `KhoanThu`           | `maGiaoDichThanhToan` | `GiaoDichThanhToan.maGiaoDich` | Có    | 0..1                        |
| `KhoanThu`           | `maCan`               | `CanTro.maCan`                 | Không | 0..\*                       |
| `KhoanChi`           | `maCan`               | `CanTro.maCan`                 | Có    | 0..\*                       |
| `KhoanChi`           | `maSuCo`              | `SuCo.maSuCo`                  | Có    | 0..1                        |
| `BienBanTraPhong`    | `maHopDong`           | `HopDong.maHopDong`            | Không | 0..1                        |
| `BienBanTraPhong`    | `maYeuCauTraPhong`    | `YeuCauTraPhong.maYeuCau`      | Có    | 0..1                        |
| `BienBanTraPhong`    | `nguoiLapId`          | `TaiKhoan.maTaiKhoan`          | Không | 0..\*                       |
| `KhoanKhauTru`       | `maBienBanTraPhong`   | `BienBanTraPhong.maBienBan`    | Không | 0..\*                       |
| `KhoanKhauTru`       | `maTaiSan`            | `TaiSan.maTaiSan`              | Có    | 0..\*                       |
| `KhoanKhauTru`       | `maViPham`            | `ViPhamHopDong.maViPham`       | Có    | 0..\*                       |
| `SuCo`               | `nguoiTiepNhanId`     | `TaiKhoan.maTaiKhoan`          | Có    | 0..\*                       |
| `SuCo`               | `nguoiXoaId`          | `TaiKhoan.maTaiKhoan`          | Có    | 0..\*                       |
| `SuCo`               | `maNguoiGui`          | `TaiKhoan.maTaiKhoan`          | Không | 0..\*                       |
| `SuCo`               | `maPhong`             | `PhongTro.maPhong`             | Không | 0..\*                       |
| `ThongBao`           | `maSuCo`              | `SuCo.maSuCo`                  | Có    | 0..\*                       |
| `ThongBao`           | `maTaiKhoan`          | `TaiKhoan.maTaiKhoan`          | Không | 0..\*                       |
| `SuCoTaiSan`         | `maSuCo`              | `SuCo.maSuCo`                  | Không | 0..1                        |
| `SuCoTaiSan`         | `maTaiSan`            | `TaiSan.maTaiSan`              | Không | 0..1                        |

### 5.2. Quan hệ nghiệp vụ quan trọng

| Quan hệ                          | Bội số / điều kiện                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| TaiKhoan–ChuTro                  | 1–0..1; mỗi chủ trọ có đúng một tài khoản.                                                                                                 |
| TaiKhoan–KhachThue               | Mỗi tài khoản gắn tối đa một hồ sơ khách; khách có 0..1 tài khoản. Tài khoản không đồng thời là chủ và khách trong phương án hiện tại.     |
| ChuTro–CanTro                    | 1–0..\*.                                                                                                                                   |
| CanTro–PhongTro                  | 1–0..\*; phòng thuộc đúng một căn.                                                                                                         |
| KhachThue–HopDong                | 1–0..\*; cho phép lập hồ sơ trước khi ký hợp đồng.                                                                                         |
| PhongTro–HopDong                 | 1–0..\* theo lịch sử; không được có hai hợp đồng chưa thanh lý cùng chiếm phòng.                                                           |
| HopDong–ThanhVienPhong           | 1–0..\* trước nhận phòng; khi cư trú phải có ít nhất một người đang ở.                                                                     |
| HopDong–TienCoc                  | 1–1 ở nghiệp vụ; FK unique chỉ đảm bảo phần “tối đa một”.                                                                                  |
| YeuCau–các lớp con               | Mỗi bảng con 0..1 trên yêu cầu cha; tổng ba bảng con phải đúng một.                                                                        |
| HopDong–ThanhToan                | 1–0..\*; một kỳ tháng/năm có tối đa một hồ sơ thanh toán.                                                                                  |
| ThanhToan–ChiTietThanhToan       | 1–0..\* khi soạn; kỳ đã phát hành phải có các dòng cần thu. Composition ở mô hình lớp không mặc nhiên cho phép xóa tài chính đã phát sinh. |
| CanTro–KhoanThu                  | 1–0..\*; mỗi khoản thu thuộc một căn.                                                                                                      |
| CanTro–KhoanChi                  | Một căn có 0..\* khoản chi; khoản chi có 0..1 căn vì có chi chung toàn chuỗi.                                                              |
| SuCo–TaiSan                      | N–N qua SuCoTaiSan. Tài sản phải thuộc phòng xảy ra sự cố.                                                                                 |
| SuCo–KhoanChi / ChiTietThanhToan | Tối đa một mỗi nhánh ở CSDL; nghiệp vụ bắt buộc chọn đúng nhánh theo người chịu phí, không tạo cả hai.                                     |
| BienBanTraPhong–KhoanKhauTru     | 1–0..\*; không có khấu trừ là trường hợp hợp lệ.                                                                                           |

### 5.3. Chính sách cập nhật và xóa

- Mã định danh bất biến. Mặc định khóa ngoại dùng `on update restrict`, `on delete restrict` hoặc cơ chế tương đương.
- Không xóa cứng hợp đồng, giao dịch, khoản thu, biên bản đã phát sinh nghiệp vụ tài chính. Hủy bằng trạng thái và dấu vết theo quy trình.
- Sự cố dùng `daXoa`, `lyDoXoa`, `ngayXoa`, `nguoiXoaId`; vẫn giữ bản ghi và FK.
- Các bảng con yêu cầu và bảng nối có thể xóa cùng bản nháp trong một transaction nếu chưa phát sinh nghiệp vụ; không áp dụng cascade toàn hệ thống.
- Người dùng đã có lịch sử được khóa tài khoản; không xóa để tránh mất nguồn tham chiếu.

## 6. Miền giá trị và trạng thái

Các mã dưới đây là phương án chuẩn hóa từ Word, Class và file tham khảo. Nhãn hiển thị có thể là tiếng Việt; dữ liệu lưu dùng mã thống nhất. Không thêm trạng thái giữ phòng của mô hình cũ vì chưa có Entity giữ phòng trong mô hình chính.

| Bảng                | Cột                | Giá trị                                                                          |
| ------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `TaiKhoan`          | `vaiTro`           | `CHU_TRO`, `KHACH_THUE`                                                          |
| `TaiKhoan`          | `trangThai`        | `HOAT_DONG`, `DA_KHOA`                                                           |
| `CanTro`            | `trangThai`        | `HOAT_DONG`, `NGUNG_HOAT_DONG`                                                   |
| `PhongTro`          | `trangThai`        | `TRONG`, `DANG_THUE`, `DANG_XU_LY_TRA_PHONG`, `NGUNG_SU_DUNG`                    |
| `ThanhVienPhong`    | `trangThaiCuTru`   | `DANG_O`, `DA_ROI`                                                               |
| `HopDong`           | `trangThai`        | `DANG_HIEU_LUC`, `SAP_HET_HAN`, `HET_HAN`, `DA_THANH_LY`                         |
| `TienCoc`           | `trangThai`        | `CHUA_NHAN`, `DA_NHAN`, `DA_HOAN`, `DA_KHAU_TRU_MOT_PHAN`, `DA_KHAU_TRU_TOAN_BO` |
| `YeuCau`            | `trangThai`        | `CHO_XU_LY`, `DA_PHE_DUYET`, `TU_CHOI`                                           |
| `YeuCau`            | `loaiYeuCau`       | `GIA_HAN`, `TRA_PHONG`, `DE_XUAT_BAN_CUNG_PHONG`                                 |
| `ChiSoDien`         | `trangThaiXacNhan` | `CHO_XAC_NHAN`, `DA_XAC_NHAN`                                                    |
| `ThanhToan`         | `trangThai`        | `CHUA_THANH_TOAN`, `THANH_TOAN_MOT_PHAN`, `DA_THANH_TOAN`                        |
| `ChiTietThanhToan`  | `loaiKhoan`        | `TIEN_PHONG`, `TIEN_DIEN`, `TIEN_NUOC`, `DICH_VU`, `SUA_CHUA`, `PHAT_SINH`       |
| `GiaoDichThanhToan` | `trangThaiXacNhan` | `CHO_XAC_NHAN`, `DA_XAC_NHAN`, `TU_CHOI`, `DA_HUY`                               |
| `KhoanThu`          | `trangThaiGhiNhan` | `HIEU_LUC`, `DA_HUY`                                                             |
| `KhoanChi`          | `phamVi`           | `CAN_TRO`, `TOAN_CHUOI`                                                          |
| `KhoanKhauTru`      | `loaiKhauTru`      | `HU_HONG_TAI_SAN`, `VI_PHAM_HOP_DONG`, `CONG_NO`, `KHAC`                         |
| `SuCo`              | `trangThai`        | `CHO_TIEP_NHAN`, `DANG_XU_LY`, `DA_XU_LY`                                        |
| `SuCo`              | `doiTuongChiuPhi`  | `CHU_TRO`, `KHACH_THUE`                                                          |
| `SuCo`              | `mucDoUuTien`      | `THAP`, `TRUNG_BINH`, `CAO`, `KHAN_CAP`                                          |

`loaiSuCo`, `loaiKhoanThu`, `loaiKhoanChi`, `loaiThongBao` hiện là chuỗi phân loại. Cần có danh sách cấu hình hợp lệ; không khóa cứng các loại chưa được đặc tả. Ví dụ loại sự cố: DIEN, NUOC, CUA_KHOA, THIET_BI, INTERNET, KHAC.

| Đối tượng   | Quy tắc chuyển trạng thái                                                                                                                                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sự cố       | CHO_TIEP_NHAN → DANG_XU_LY → DA_XU_LY. Xóa mềm chỉ khi còn chờ tiếp nhận và chưa có phát sinh tài chính.                                                          |
| Yêu cầu     | CHO_XU_LY → DA_PHE_DUYET hoặc TU_CHOI; yêu cầu đã xử lý được giữ lịch sử.                                                                                         |
| Chỉ số điện | CHO_XAC_NHAN → DA_XAC_NHAN; sửa số đã dùng tính tiền phải kiểm tra kỳ liên quan và tính lại có kiểm soát.                                                         |
| Giao dịch   | CHO_XAC_NHAN → DA_XAC_NHAN hoặc TU_CHOI; DA_XAC_NHAN → DA_HUY khi có lý do hợp lệ. Đây là quy trình đề xuất, không suy ra rằng UC12 đã bao gồm thao tác xác nhận. |
| Thanh toán  | Trạng thái được tính từ phải trả/đã trả/còn nợ, không tự nhập tùy ý.                                                                                              |
| Tiền cọc    | CHUA_NHAN → DA_NHAN; sau quyết toán cập nhật trạng thái theo số đã khấu trừ/đã hoàn. Cọc khấu trừ một phần vẫn có thể đang chờ hoàn phần còn lại.                 |

## 7. Ràng buộc nghiệp vụ

### 7.1. Khóa duy nhất

Ngoài PK và các FK unique đã ghi ở mục 4–5:

| Bảng      | Ràng buộc                                                           | Ý nghĩa                                                                                                                                     |
| --------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| PhongTro  | unique(maCan, soPhong)                                              | Số phòng chỉ không trùng trong cùng căn.                                                                                                    |
| ChiSoDien | unique(maPhong, thang, nam)                                         | Không tạo hai chỉ số cho cùng phòng/kỳ.                                                                                                     |
| ThanhToan | unique(maHopDong, thang, nam)                                       | Không tạo hai hồ sơ thanh toán cùng hợp đồng/kỳ.                                                                                            |
| HopDong   | Một hợp đồng chưa thanh lý trên mỗi phòng                           | Áp dụng transaction khóa phòng hoặc unique có điều kiện theo hệ quản trị; unique(maPhong) thông thường sẽ chặn cả lịch sử và không phù hợp. |
| YeuCau    | Tối đa một yêu cầu cùng loại đang chờ trên cùng đối tượng (đề xuất) | Đối tượng là hợp đồng cho gia hạn/trả phòng, phòng cho đề xuất ở cùng; không áp unique(maKhachThue, loaiYeuCau) cho toàn bộ lịch sử.        |

### 7.2. Điều kiện liên bảng

| Mã nội bộ | Điều kiện                                                                                                                                                | Nơi thực thi                                                        |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| DB-01     | Tài khoản của ChuTro có vai trò CHU_TRO; tài khoản của KhachThue có vai trò KHACH_THUE; không gắn cùng tài khoản vào cả hai hồ sơ.                       | Service/trigger, transaction.                                       |
| DB-02     | Khách có thể chưa có tài khoản/hợp đồng; khi hợp đồng bắt đầu cư trú phải có tài khoản hợp lệ.                                                           | Service.                                                            |
| DB-03     | Không ngừng hoạt động căn khi còn hợp đồng chưa thanh lý; không cho phòng ngừng sử dụng khi còn bị chiếm bởi hợp đồng.                                   | Khóa căn/phòng và kiểm tra hợp đồng trong transaction.              |
| DB-04     | ThanhVienPhong.maPhong phải bằng HopDong.maPhong; số người DANG_O không vượt sức chứa; ngày rời không trước ngày vào.                                    | Check nội hàng + Service liên bảng.                                 |
| DB-05     | Yêu cầu gia hạn/trả phòng thuộc hợp đồng của người gửi; đề xuất ở cùng thuộc phòng mà khách đang thuê.                                                   | Service/trigger.                                                    |
| DB-06     | Mỗi YeuCau có đúng một bảng con và mã loại phù hợp; ghi cha/con đồng thời.                                                                               | Transaction.                                                        |
| DB-07     | Chỉ số điện đã xác nhận có người/thời điểm xác nhận; khi so với kỳ trước phải dùng đúng công tơ.                                                         | Service.                                                            |
| DB-08     | Không xác nhận giao dịch chưa có số tiền dương; tổng giao dịch hợp lệ không vượt tổng phải trả theo phương án chưa hỗ trợ trả dư.                        | Khóa ThanhToan và giao dịch, kiểm tra tổng.                         |
| DB-09     | UC11.3 đặt đã trả về 0 bằng cách hủy các giao dịch hợp lệ và khoản thu liên quan, giữ nguyên hồ sơ kỳ và minh chứng lịch sử.                             | Transaction; không chỉ sửa một cột tổng.                            |
| DB-10     | KhoanThu gắn giao dịch phải có cùng số tiền đã ghi nhận và thuộc căn của phòng/hợp đồng tương ứng; chỉ ghi một lần khi giao dịch được xác nhận.          | unique FK + Service.                                                |
| DB-11     | KhoanChi.phamVi = CAN_TRO thì maCan không NULL; TOAN_CHUOI thì maCan NULL. Chi chung toàn chuỗi cần phạm vi chủ sở hữu rõ ràng khi triển khai nhiều chủ. | Check + phân quyền.                                                 |
| DB-12     | Sự cố đã hoàn tất có kết quả, chi phí không âm, người chịu phí, ngày hoàn tất; chi phí > 0 đi vào đúng một nhánh tài chính.                              | Transaction UC17.2.                                                 |
| DB-13     | Khách gửi sự cố bằng tài khoản đang thuê phòng; người tiếp nhận/xóa là chủ trọ quản lý căn tương ứng.                                                    | Kiểm tra quyền và liên kết hồ sơ.                                   |
| DB-14     | KhoanChi gắn sự cố phải thuộc căn của phòng sự cố; dòng phí sửa chữa phải thuộc đúng hợp đồng chịu phí tại thời điểm xử lý.                              | Service, không chọn theo người thuê hiện tại sau chuyển giao phòng. |
| DB-15     | BienBanTraPhong và YeuCauTraPhong nếu liên kết phải cùng hợp đồng; yêu cầu đã được duyệt trước xử lý theo yêu cầu.                                       | Service.                                                            |
| DB-16     | Tài sản/vi phạm trong khấu trừ phải thuộc đúng phòng/hợp đồng; không thu lại khoản sửa chữa đã được thanh toán.                                          | Service; xem mục 8.                                                 |
| DB-17     | Tổng khấu trừ và số cọc hoàn khớp các dòng biên bản; số thực khấu trừ cộng số thực hoàn không vượt cọc đã nhận.                                          | Transaction quyết toán.                                             |
| DB-18     | Thanh lý phải đồng bộ hợp đồng, trạng thái phòng, cư trú, hồ sơ cọc, công nợ và thông báo. Không khóa tài khoản khách nếu họ còn hợp đồng hợp lệ khác.   | Transaction hoặc quy trình nhất quán nếu tách dịch vụ.              |
| DB-19     | ThongBao.maTaiKhoan là người nhận; chỉ người nhận được đánh dấu đã đọc.                                                                                  | Phân quyền truy vấn.                                                |

Các mã DB-\* chỉ là mã tổ chức trong tài liệu này, không phải mã yêu cầu gốc. Ràng buộc tổng hợp/liên bảng không thể thay bằng check đơn giản chỉ nhìn một hàng.

## 8. Công thức và nguồn dữ liệu chuẩn

### 8.1. Kỳ thanh toán

Giữ `thang`, `nam` theo mô hình chính. Khóa kỳ thanh toán là `(maHopDong, thang, nam)`, khóa chỉ số là `(maPhong, thang, nam)`. Không thêm `ky date` song song nếu chưa có nhu cầu.

Quy ước file tham khảo thu điện tháng trước trong kỳ hiện tại là **tham khảo**, chưa áp cứng cho mô hình mới. Cần chốt kỳ điện nào được tính vào kỳ thanh toán nào và lưu dấu vết trên dòng tiền điện.

### 8.2. Tiền điện, nước và dịch vụ

```text
sanLuongDien = chiSoMoiDaXacNhan - chiSoDauKy
 tienDien = sanLuongDien × donGiaApDung
 tongPhaiTra = tổng ChiTietThanhToan.soTien của kỳ
```

- Đơn giá trên hợp đồng là điều khoản hiện tại; `ChiSoDien.donGiaApDung` giữ đơn giá của kỳ. Khi tạo dòng tiền điện phải dùng đơn giá đã chốt, không tự thay đổi theo giá hợp đồng được sửa sau đó.
- Mô hình hiện chỉ có `chiSoMoi`, chưa lưu riêng số đầu kỳ. Có thể lấy chỉ số đã xác nhận kỳ trước trên cùng công tơ. Kỳ đầu tiên và thay công tơ chưa đủ dữ liệu để tính an toàn: cần bổ sung số đầu kỳ/lịch sử công tơ trước khi tự động tính (mục 11).
- Chưa có Entity chỉ số nước. `HopDong.donGiaNuoc` không đủ xác định tiền nước. Nếu thu theo đầu người: đơn giá × số người tính phí; nếu theo m³ cần thêm chỉ số nước. Chọn cách tính và chốt số lượng tính phí theo kỳ.
- Dòng dịch vụ/sửa chữa/phát sinh lưu số tiền đã chốt và diễn giải. Mô hình chính chưa có số lượng/đơn giá dòng chi tiết hoặc dòng giảm trừ; không lưu số âm trái check hiện tại để giả lập giảm trừ.
- Đề xuất làm tròn tổng tiền VND về số nguyên theo một quy tắc duy nhất sau tính toán.

### 8.3. Thanh toán và công nợ

Phương án đề xuất: giao dịch đã xác nhận và chưa hủy là nguồn sự thật cho đã trả. UC11.2 ghi thanh toán trực tiếp cũng tạo giao dịch xác nhận; UC12 nộp ảnh chỉ tạo giao dịch chờ xác nhận, số tiền có thể chưa xác định.

```text
tongDaThanhToan = tổng GiaoDichThanhToan.soTien
                  với trangThaiXacNhan = DA_XAC_NHAN
soTienConNo = tongPhaiTra - tongDaThanhToan
```

| Điều kiện                                 | ThanhToan.trangThai |
| ----------------------------------------- | ------------------- |
| tongPhaiTra = 0 hoặc đã trả bằng phải trả | DA_THANH_TOAN       |
| tongPhaiTra > 0 và đã trả = 0             | CHUA_THANH_TOAN     |
| 0 < đã trả < phải trả                     | THANH_TOAN_MOT_PHAN |

`tongPhaiTra`, `tongDaThanhToan`, `soTienConNo` là tổng lưu sẵn để truy vấn; cập nhật cùng transaction với nguồn chi tiết. Không dùng `greatest(..., 0)` để che việc trả quá số phải thu; từ chối hoặc bổ sung quy trình tiền dư.

Công nợ hiện được thể hiện bằng `ThanhToan.soTienConNo`; tổng công nợ khách là tổng dư nợ các kỳ thuộc hợp đồng của khách, kể cả hợp đồng đã thanh lý còn nợ. Biên bản khấu trừ cọc để trả nợ phải đồng thời ghi một giao dịch xác nhận trên kỳ nợ tương ứng; nên bổ sung nguồn giao dịch để phân biệt tiền mặt/chuyển khoản/bù cọc. Nếu chưa bổ sung, chưa tự động cấn trừ nợ bằng cọc.

### 8.4. Thu, chi và báo cáo

```text
tongThu = tổng KhoanThu.soTien với trangThaiGhiNhan = HIEU_LUC
tongChi = tổng KhoanChi.soTien trong phạm vi báo cáo
chenhLechThuChi = tongThu - tongChi
```

- Báo cáo thu dùng `ngayGhiNhan`; báo cáo chi dùng `ngayPhatSinh`. Tổng phải trả của kỳ chưa phải tiền đã thu.
- Không cộng cả `tongDaThanhToan` và `KhoanThu` vào tổng thu; hai nguồn cùng phản ánh một giao dịch.
- Tiền cọc là tiền giữ để bảo đảm, cần báo cáo riêng; không mặc nhiên coi toàn bộ cọc đã nhận là doanh thu thuê.
- `KhoanThu` tạo từ giao dịch phải được hủy đồng bộ khi giao dịch hủy. Khoản thu thủ công không có giao dịch được báo cáo riêng để tránh hiểu nhầm là tiền thanh toán hợp đồng.
- Chi phí khách chịu trong UC17.2 tạo `ChiTietThanhToan`, chủ chịu tạo `KhoanChi`; không đồng thời ghi cả hai. Sửa chữa miễn phí không sinh dòng tiền.
- `KhoanChi` hiện thiếu trạng thái hủy; trước khi hỗ trợ hủy chi phải bổ sung dấu vết hủy hoặc nhật ký. Chênh lệch thu–chi là chỉ tiêu theo dõi tiền, chưa đủ để kết luận lợi nhuận kế toán.

### 8.5. Quyết toán và hoàn cọc

```text
tongKhoanKhauTru = tổng KhoanKhauTru.soTien trong biên bản
cocKhaDung = số cọc thực nhận - số đã hoàn trước đó - số đã khấu trừ trước đó
khauTruThucTe = min(cocKhaDung, tongKhoanKhauTru)
soTienCocDuocHoan = max(cocKhaDung - tongKhoanKhauTru, 0)
phanVuotCoc = max(tongKhoanKhauTru - cocKhaDung, 0)
```

`cocKhaDung` phải được chụp trước khi cập nhật kết quả quyết toán. Không cộng khấu trừ lần nữa khi chạy lại cùng biên bản. Nếu chưa nhận cọc thì cọc khả dụng bằng 0.

Các khoản còn phải trả như điện cuối kỳ phải được lập thành khoản nợ/dòng chi tiết trước quyết toán, rồi khấu trừ phần chưa trả. Không vừa đưa cùng khoản vào công nợ vừa cộng thêm một khoản khấu trừ sửa chữa riêng. Nếu khấu trừ tiền cọc để thanh toán nợ, cần giao dịch bù cọc như mục 8.3 để dư nợ không bị giữ nguyên.

`BienBanTraPhong.soTienCocDuocHoan` là kết quả dự kiến hoàn; `TienCoc.soTienDaHoan` là số đã hoàn thực tế. `phanVuotCoc` cần được giữ trong kỳ thanh toán còn nợ hoặc bảng công nợ/quyết toán mở rộng, không mất khi hợp đồng thanh lý. Hoàn tiền thuê trả trước, nhiều đợt hoàn cọc và thu tiền vượt cọc chưa có hồ sơ riêng trong 24 Entity; xem mục 11.

## 9. Chỉ mục và giao dịch

### 9.1. Chỉ mục đề xuất

PK/unique đã có chỉ mục tương ứng; không tạo index trùng. Kiểm tra hệ quản trị có tự tạo chỉ mục cho FK hay cần bổ sung.

| Bảng              | Cột chỉ mục                                                              | Truy vấn phục vụ                              |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| CanTro            | (maChuTro, trangThai)                                                    | Căn thuộc chủ đang hoạt động.                 |
| PhongTro          | (maCan, trangThai)                                                       | Phòng theo căn/trạng thái.                    |
| HopDong           | (maPhong, trangThai); (maKhachThue, trangThai); (ngayKetThuc, trangThai) | Phòng đang thuê; hợp đồng khách; sắp hết hạn. |
| ThanhVienPhong    | (maHopDong, trangThaiCuTru); (maPhong, trangThaiCuTru)                   | Cư trú và kiểm tra sức chứa.                  |
| ChiSoDien         | unique(maPhong, thang, nam)                                              | Chỉ số cùng phòng/kỳ.                         |
| ThanhToan         | unique(maHopDong, thang, nam); (trangThai, nam, thang)                   | Kỳ thu và danh sách còn nợ.                   |
| ChiTietThanhToan  | (maThanhToan, loaiKhoan)                                                 | Tổng phải trả và phân loại khoản.             |
| GiaoDichThanhToan | (maThanhToan, trangThaiXacNhan); (thoiDiemGhiNhan)                       | Tổng đã trả và lịch sử thu.                   |
| KhoanThu          | (maCan, ngayGhiNhan, trangThaiGhiNhan)                                   | Thu theo căn/khoảng ngày.                     |
| KhoanChi          | (maCan, ngayPhatSinh); (phamVi, ngayPhatSinh)                            | Chi theo căn và chi chung.                    |
| YeuCau            | (maKhachThue, trangThai, loaiYeuCau)                                     | Lịch sử và yêu cầu chờ xử lý.                 |
| SuCo              | (maPhong, daXoa, trangThai); (maNguoiGui, ngayGui)                       | Sự cố cần xử lý và báo cáo khách.             |
| ThongBao          | (maTaiKhoan, daDoc, thoiDiemTao)                                         | Thông báo chưa đọc.                           |
| SuCoTaiSan        | PK(maSuCo, maTaiSan); index(maTaiSan) nếu cần                            | Tài sản trong sự cố và lịch sử sự cố tài sản. |

### 9.2. Transaction bắt buộc

| Nghiệp vụ            | Những dữ liệu phải ghi nhất quán                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tạo hợp đồng         | Khóa phòng, kiểm tra hợp đồng còn chiếm phòng; tạo HopDong và TienCoc; tạo người cư trú khi nhận phòng; cập nhật phòng.              |
| Gửi/duyệt yêu cầu    | YeuCau + đúng bảng con; phê duyệt và tác động gia hạn/trả phòng/thêm cư trú.                                                         |
| Xác nhận thanh toán  | Khóa ThanhToan; kiểm tra giao dịch chưa xác nhận; cập nhật giao dịch, tổng, trạng thái; tạo KhoanThu tối đa một lần.                 |
| Hủy/reset thanh toán | Hủy giao dịch và KhoanThu liên quan; tính lại tổng và nợ; giữ kỳ và lịch sử.                                                         |
| Hoàn tất sửa chữa    | Cập nhật SuCo; sinh đúng KhoanChi hoặc ChiTietThanhToan; tính lại kỳ nếu có; tạo ThongBao.                                           |
| Quyết toán           | Khóa hợp đồng/cọc/kỳ nợ; tạo biên bản và khấu trừ; bù nợ bằng cọc nếu hỗ trợ; cập nhật số cọc, hợp đồng, cư trú, phòng và thông báo. |

Chạy lại cùng yêu cầu nghiệp vụ phải không tạo trùng giao dịch, khoản thu, phí sửa chữa hoặc biên bản. Cột unique hiện có bảo vệ một phần; các API ghi tiền cần thêm khóa idempotency (chống ghi lặp) nếu hỗ trợ gửi lại yêu cầu từ client.

## 10. Dữ liệu mẫu

### 10.1. Kịch bản chung

Dữ liệu bên dưới là **một mẫu cho từng bảng** trong cùng kịch bản giả lập: khách Mai thuê phòng 101 từ 01/04/2026; có một thành viên ở cùng rời ngày 30/09; một đề xuất ở cùng khác bị từ chối; yêu cầu gia hạn bị từ chối, yêu cầu trả phòng được duyệt. Khách báo sự cố ngày 01/09, sửa xong ngày 03/09 với phí khách chịu 200.000 VND. Kỳ 09/2026 có 3.000.000 tiền phòng, 300.000 tiền điện, 200.000 sửa chữa, tổng 3.500.000 VND và đã trả đủ ngày 05/09. Một khoản chi chủ trọ độc lập là 150.000 VND. Khi trả phòng ngày 30/09, phạt vi phạm riêng 100.000 VND được khấu trừ cọc 3.000.000; hoàn thực tế 2.900.000 VND. Phí sửa chữa đã trả không bị khấu trừ lần nữa.

Mã TK01/HD01… là mã ngắn minh họa trong cột varchar(36), không phải UUID chuẩn. Số giấy tờ, điện thoại và đường dẫn đều giả lập. Mẫu chỉ liệt kê các cột phục vụ kịch bản; các cột tùy chọn không liệt kê có thể NULL. Đây không phải lệnh insert thực thi.

### 10.2. `TaiKhoan`

| maTaiKhoan | tenDangNhap  | matKhauHash           | vaiTro     | trangThai | batBuocDoiMatKhau |
| ---------- | ------------ | --------------------- | ---------- | --------- | ----------------- |
| TK01       | chu_tro_demo | HASH_DO_UNG_DUNG_SINH | CHU_TRO    | HOAT_DONG | false             |
| TK02       | 0900000002   | HASH_DO_UNG_DUNG_SINH | KHACH_THUE | HOAT_DONG | false             |

### 10.3. `ChuTro`

| maChuTro | hoTen           | soDienThoai | maTaiKhoan |
| -------- | --------------- | ----------- | ---------- |
| CT01     | Nguyễn Văn Hùng | 0900000001  | TK01       |

### 10.4. `KhachThue`

| maKhachThue | hoTen        | soDienThoai | soGiayTo     | maTaiKhoan |
| ----------- | ------------ | ----------- | ------------ | ---------- |
| KT01        | Trần Thị Mai | 0900000002  | 079000000001 | TK02       |

### 10.5. `CanTro`

| maCan | tenCan      | diaChi                   | trangThai | maChuTro |
| ----- | ----------- | ------------------------ | --------- | -------- |
| CAN01 | Căn Hoa Sen | Địa chỉ minh họa, TP.HCM | HOAT_DONG | CT01     |

### 10.6. `PhongTro`

| maPhong | soPhong | dienTich | giaThue | soNguoiToiDa | trangThai | maCan |
| ------- | ------- | -------- | ------- | ------------ | --------- | ----- |
| P101    | 101     | 25       | 3000000 | 2            | TRONG     | CAN01 |

### 10.7. `ThanhVienPhong`

| maThanhVienPhong | hoTen         | soDienThoai | ngayVao    | ngayRoi    | trangThaiCuTru | maPhong | maHopDong |
| ---------------- | ------------- | ----------- | ---------- | ---------- | -------------- | ------- | --------- |
| TV01             | Trần Thị Mai  | 0900000002  | 2026-04-01 | 2026-09-30 | DA_ROI         | P101    | HD01      |
| TV02             | Nguyễn Thị An | 0900000003  | 2026-04-01 | 2026-09-30 | DA_ROI         | P101    | HD01      |

### 10.8. `TaiSan`

| maTaiSan | tenTaiSan  | soLuong | tinhTrang   | maPhong |
| -------- | ---------- | ------- | ----------- | ------- |
| TS01     | Ổ cắm điện | 1       | Đã thay mới | P101    |

### 10.9. `HopDong`

| maHopDong | ngayBatDau | ngayKetThuc | giaThue | donGiaDien | donGiaNuoc | dieuKhoan           | trangThai   | ngayThanhLy | maKhachThue | maPhong |
| --------- | ---------- | ----------- | ------- | ---------- | ---------- | ------------------- | ----------- | ----------- | ----------- | ------- |
| HD01      | 2026-04-01 | 2026-09-30  | 3000000 | 3000       | 100000     | Điều khoản minh họa | DA_THANH_LY | 2026-09-30  | KT01        | P101    |

### 10.10. `TienCoc`

| maTienCoc | soTienCoc | ngayNhanCoc | trangThai | soTienDaHoan | soTienDaKhauTru | maHopDong |
| --------- | --------- | ----------- | --------- | ------------ | --------------- | --------- |
| COC01     | 3000000   | 2026-04-01  | DA_HOAN   | 2900000      | 100000          | HD01      |

### 10.11. `YeuCau`

| maYeuCau | ngayGui             | noiDung                     | trangThai    | loaiYeuCau             | maKhachThue |
| -------- | ------------------- | --------------------------- | ------------ | ---------------------- | ----------- |
| YC01     | 2026-08-10 10:00:00 | Đề nghị gia hạn             | TU_CHOI      | GIA_HAN                | KT01        |
| YC02     | 2026-08-30 10:00:00 | Xin trả phòng cuối tháng 9  | DA_PHE_DUYET | TRA_PHONG              | KT01        |
| YC03     | 2026-08-01 10:00:00 | Đề xuất thêm bạn cùng phòng | TU_CHOI      | DE_XUAT_BAN_CUNG_PHONG | KT01        |

### 10.12. `YeuCauGiaHan`

| maYeuCau | ngayKetThucDeXuat | maHopDong |
| -------- | ----------------- | --------- |
| YC01     | 2027-03-31        | HD01      |

### 10.13. `YeuCauTraPhong`

| maYeuCau | maHopDong |
| -------- | --------- |
| YC02     | HD01      |

### 10.14. `DeXuatBanCungPhong`

| maYeuCau | hoTenNguoiDeXuat | soDienThoaiNguoiDeXuat | maPhong |
| -------- | ---------------- | ---------------------- | ------- |
| YC03     | Lê Văn Bình      | 0900000004             | P101    |

### 10.15. `ViPhamHopDong`

| maViPham | noiDung                                             | ngayGhiNhan         | dieuKhoanLienQuan  | mucPhat | maHopDong |
| -------- | --------------------------------------------------- | ------------------- | ------------------ | ------- | --------- |
| VP01     | Vi phạm nội quy riêng, không liên quan phí sửa chữa | 2026-09-20 10:00:00 | Điều khoản nội quy | 100000  | HD01      |

### 10.16. `ChiSoDien`

| maChiSo | thang | nam  | chiSoMoi | donGiaApDung | trangThaiXacNhan | ngayGhiNhan         | nguoiGhiNhanId | nguoiXacNhanId | ngayXacNhan         | maPhong |
| ------- | ----- | ---- | -------- | ------------ | ---------------- | ------------------- | -------------- | -------------- | ------------------- | ------- |
| CS08    | 8     | 2026 | 1000     | 3000         | DA_XAC_NHAN      | 2026-08-31 08:00:00 | TK02           | TK01           | 2026-08-31 09:00:00 | P101    |
| CS09    | 9     | 2026 | 1100     | 3000         | DA_XAC_NHAN      | 2026-09-01 08:00:00 | TK02           | TK01           | 2026-09-01 09:00:00 | P101    |

### 10.17. `ThanhToan`

| maThanhToan | thang | nam  | tongPhaiTra | tongDaThanhToan | soTienConNo | trangThai     | maHopDong |
| ----------- | ----- | ---- | ----------- | --------------- | ----------- | ------------- | --------- |
| TT09        | 9     | 2026 | 3500000     | 3500000         | 0           | DA_THANH_TOAN | HD01      |

### 10.18. `ChiTietThanhToan`

| maChiTiet | loaiKhoan  | soTien  | dienGiai                                    | maThanhToan | maSuCo |
| --------- | ---------- | ------- | ------------------------------------------- | ----------- | ------ |
| CTTT01    | TIEN_PHONG | 3000000 | Tiền phòng kỳ 09/2026                       | TT09        | NULL   |
| CTTT02    | TIEN_DIEN  | 300000  | 100 kWh × 3.000 VND; mẫu không chốt lệch kỳ | TT09        | NULL   |
| CTTT03    | SUA_CHUA   | 200000  | Thay ổ cắm, khách chịu phí                  | TT09        | SC01   |

### 10.19. `GiaoDichThanhToan`

| maGiaoDich | soTien  | thoiDiemGhiNhan     | minhChungUrl                 | trangThaiXacNhan | thoiDiemXacNhan     | maThanhToan |
| ---------- | ------- | ------------------- | ---------------------------- | ---------------- | ------------------- | ----------- |
| GD01       | 3500000 | 2026-09-05 08:00:00 | /uploads/demo/minh-chung.png | DA_XAC_NHAN      | 2026-09-05 09:00:00 | TT09        |

### 10.20. `KhoanThu`

| maKhoanThu | loaiKhoanThu  | soTien  | ngayGhiNhan | trangThaiGhiNhan | maGiaoDichThanhToan | maCan |
| ---------- | ------------- | ------- | ----------- | ---------------- | ------------------- | ----- |
| THU01      | THANH_TOAN_KY | 3500000 | 2026-09-05  | HIEU_LUC         | GD01                | CAN01 |

### 10.21. `KhoanChi`

| maKhoanChi | loaiKhoanChi | soTien | ngayPhatSinh | phamVi  | ghiChu                           | maCan | maSuCo |
| ---------- | ------------ | ------ | ------------ | ------- | -------------------------------- | ----- | ------ |
| CHI01      | BAO_TRI      | 150000 | 2026-09-10   | CAN_TRO | Bảo trì độc lập, không phải SC01 | CAN01 | NULL   |

### 10.22. `BienBanTraPhong`

| maBienBan | ngayKiemTra | tinhTrangPhong          | tongKhoanKhauTru | soTienCocDuocHoan | maHopDong | maYeuCauTraPhong | nguoiLapId |
| --------- | ----------- | ----------------------- | ---------------- | ----------------- | --------- | ---------------- | ---------- |
| BB01      | 2026-09-30  | Đã kiểm tra và bàn giao | 100000           | 2900000           | HD01      | YC02             | TK01       |

### 10.23. `KhoanKhauTru`

| maKhauTru | loaiKhauTru      | lyDo                  | soTien | maBienBanTraPhong | maTaiSan | maViPham |
| --------- | ---------------- | --------------------- | ------ | ----------------- | -------- | -------- |
| KTR01     | VI_PHAM_HOP_DONG | Khấu trừ vi phạm VP01 | 100000 | BB01              | NULL     | VP01     |

### 10.24. `SuCo`

| maSuCo | loaiSuCo | mucDoUuTien | moTa       | trangThai | ngayGui             | ngayTiepNhan        | ketQuaXuLy    | chiPhiSuaChua | doiTuongChiuPhi | ngayHoanTat         | daXoa | nguoiTiepNhanId | maNguoiGui | maPhong |
| ------ | -------- | ----------- | ---------- | --------- | ------------------- | ------------------- | ------------- | ------------- | --------------- | ------------------- | ----- | --------------- | ---------- | ------- |
| SC01   | DIEN     | CAO         | Ổ cắm hỏng | DA_XU_LY  | 2026-09-01 07:00:00 | 2026-09-01 09:00:00 | Đã thay ổ cắm | 200000        | KHACH_THUE      | 2026-09-03 10:00:00 | false | TK01            | TK02       | P101    |

### 10.25. `ThongBao`

| maThongBao | loaiThongBao   | noiDung                         | thoiDiemTao         | daDoc | maSuCo | maTaiKhoan |
| ---------- | -------------- | ------------------------------- | ------------------- | ----- | ------ | ---------- |
| TB01       | SU_CO_DA_XU_LY | Sự cố đã xử lý, phí 200.000 VND | 2026-09-03 10:00:00 | true  | SC01   | TK02       |

### 10.26. `SuCoTaiSan`

| maSuCo | maTaiSan |
| ------ | -------- |
| SC01   | TS01     |

Kiểm tra mẫu: 3.000.000 + 300.000 + 200.000 = 3.500.000 phải trả; giao dịch xác nhận và khoản thu cùng 3.500.000; còn nợ 0; cọc 3.000.000 = khấu trừ 100.000 + hoàn 2.900.000. Chênh lệch thu–chi của các bản ghi mẫu là 3.350.000 VND, không bao gồm cọc nhận/hoàn. Các kỳ và khoản thu khác của hợp đồng không được liệt kê trong mẫu thu gọn.

## 11. Đối chiếu mô hình tham khảo và mở rộng

### 11.1. Ánh xạ ý nghĩa, không sao chép tên/khóa

| Mô hình 56 bảng tham khảo                   | Mô hình chính                       | Khác biệt cần lưu ý                                                              |
| ------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| tai_khoan, chu_tro, khach_thue              | TaiKhoan, ChuTro, KhachThue         | FK hồ sơ → tài khoản; không sao chép hướng FK mô hình cũ.                        |
| can_tro, phong, noi_that                    | CanTro, PhongTro, TaiSan            | TaiSan là tài sản phòng; noiThatMoTa chỉ là mô tả.                               |
| hop_dong, tien_coc, vi_pham_hop_dong        | HopDong, TienCoc, ViPhamHopDong     | Khóa chuỗi, hồ sơ cọc duy nhất; gia hạn có yêu cầu riêng.                        |
| nguoi_o_cung                                | ThanhVienPhong + DeXuatBanCungPhong | Tách người cư trú thực tế và đề xuất chưa được duyệt.                            |
| chi_so_dien                                 | ChiSoDien                           | Tháng/năm riêng; chưa có hồ sơ công tơ/thay công tơ.                             |
| khoan_phai_thu, tinh_trang_thanh_toan       | ThanhToan                           | ThanhToan mới là hồ sơ kỳ phải trả, không phải từng lần trả.                     |
| thanh_toan, minh_chung_thanh_toan           | GiaoDichThanhToan                   | Một bản ghi lần thanh toán/minh chứng; ảnh chờ xác nhận không đồng nghĩa đã thu. |
| phan_bo_doanh_thu, thu_khac                 | KhoanThu                            | Mới ghi thu thực tế, chưa có phân bổ doanh thu giảm trừ như bản cũ.              |
| cong_no                                     | ThanhToan.soTienConNo               | Chưa có bảng nợ độc lập, hạn thanh toán hoặc lịch nhắc nợ.                       |
| yeu_cau, yeu_cau_gia_han, yeu_cau_tra_phong | YeuCau và hai bảng con tương ứng    | Loại thứ ba của mô hình mới là đề xuất ở cùng, không phải đặt lại mật khẩu.      |
| su_co, khoan_chi                            | SuCo, KhoanChi, ChiTietThanhToan    | Phân nhánh chi phí theo UC17.2 hiện tại.                                         |
| quyet_toan_tra_phong, quyet_toan_chi_tiet   | BienBanTraPhong, KhoanKhauTru       | Chưa lưu đầy đủ công nợ vượt cọc/hoàn tiền trả trước như mô hình cũ.             |
| thong_bao                                   | ThongBao                            | Chưa có outbox/Kafka; không suy ra kiến trúc từ bản tham khảo.                   |

### 11.2. Những phần còn thiếu nếu muốn triển khai đầy đủ tự động hóa

Các mục dưới đây là **đề xuất mở rộng**, chưa nằm trong ERD 25 bảng. Chỉ thêm khi chức năng tương ứng thuộc phạm vi đã chốt; không xem toàn bộ 56 bảng là yêu cầu hiện tại.

| Nhu cầu                          | Thiết kế bổ sung tối thiểu                                                                                   | Lý do                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Chỉ số đầu kỳ / thay công tơ     | Thêm chiSoDauKy, maCongTo hoặc hồ sơ CongTo và ThayCongTo lưu phòng, thời điểm thay, số chốt cũ, số đầu mới. | Không tính sai kỳ đầu hoặc công tơ reset.                              |
| Dấu vết tính phí                 | Thêm maChiSoDien vào dòng tiền điện hoặc hồ sơ tham chiếu; số lượng, đơn giá và kỳ tiêu thụ đã chốt.         | Truy được nguồn số tiền, không dựa vào chuỗi diễn giải.                |
| Tính tiền nước theo m³           | ChiSoNuoc có phòng, kỳ, số đầu/cuối, đơn giá, trạng thái xác nhận.                                           | Mô hình hiện không có số nước.                                         |
| Tính nước theo người / phòng     | Cấu hình cách thu và lưu số người/đơn giá/số tiền snapshot theo kỳ.                                          | Cư trú thay đổi không làm đổi khoản đã chốt.                           |
| Giao dịch bù cọc / thu trực tiếp | Thêm nguonThanhToan, nguoiXacNhanId, khoaChongTrung; tham chiếu biên bản khi bù cọc.                         | Có nguồn tiền rõ ràng và chống ghi trùng khi UC11/UC12 cùng hoạt động. |
| Khấu trừ công nợ                 | Thêm maThanhToan vào KhoanKhauTru hoặc bảng phân bổ biên bản–kỳ nợ.                                          | Biết cọc đã thanh toán cho kỳ nào; không khấu trừ hai lần.             |
| Công nợ vượt cọc / sau thanh lý  | Hồ sơ CongNo/QuyetToan bổ sung số nợ còn lại, nguồn khoản nợ, số đã thu, trạng thái.                         | Không mất dư nợ khi kết thúc hợp đồng.                                 |
| Hoàn cọc nhiều đợt               | HoanTienCoc lưu biên bản, số tiền, ngày, người ghi nhận, hình thức và minh chứng.                            | TienCoc hiện chỉ có tổng đã hoàn, không có lịch sử từng lần.           |
| Lịch sử sửa đổi                  | AuditLog hoặc bảng LichSuHopDong, LichSuChiSoDien, LichSuTrangThaiSuCo lưu cũ/mới, người, thời điểm, lý do.  | Có thể truy vết giá, số điện và thao tác nhạy cảm.                     |
| Hủy khoản chi                    | Thêm trangThai, lyDoHuy, ngayHuy, nguoiHuyId cho KhoanChi.                                                   | Báo cáo loại trừ chi đã hủy và vẫn giữ dấu vết.                        |
| Tệp đính kèm nhiều ảnh           | TepDinhKem lưu mã, URL/key, MIME, dung lượng, checksum, người tải, thời điểm; bảng nối cho sự cố.            | URL đơn chưa quản lý loại/dung lượng và nhiều ảnh.                     |
| Giữ phòng / chuyển phòng         | GiuPhong, ChuyenPhong theo nghiệp vụ được duyệt.                                                             | Không dùng trạng thái ngầm thay cho hồ sơ lịch sử.                     |
| Gia hạn / ngày trả dự kiến       | LichSuGiaHan và thêm ngayTraDuKien vào YeuCauTraPhong khi UC yêu cầu.                                        | Bảng hiện tại không có các dữ liệu này.                                |
| Phí phát sinh / giảm trừ         | KhoanDieuChinh và liên kết đến kỳ; lưu loại dấu cộng/trừ riêng.                                              | Check hiện tại của dòng chi tiết chỉ cho số tiền không âm.             |
| Phiếu thu chính thức             | PhieuThu, ghi chú và trạng thái phát hành/khóa; tham chiếu kỳ thanh toán.                                    | ThanhToan là hồ sơ kỳ, không mặc nhiên là chứng từ đã phát hành.       |
| Danh mục cấu hình                | DmLoaiSuCo, DmMucUuTien, DmLoaiChi.                                                                          | Khi cần sửa danh mục không phải sửa mã nguồn.                          |
| Đăng nhập / khóa tạm             | NhatKyDangNhap, LichSuTrangThaiTaiKhoan.                                                                     | Tài khoản hiện chỉ giữ trạng thái hiện tại.                            |
| Thông báo bất đồng bộ            | SuKienThongBao/outbox với khóa sự kiện duy nhất, trạng thái gửi, số lần thử.                                 | Đảm bảo sự kiện được gửi sau commit nếu chọn kiến trúc này.            |
| Tác vụ tự động / nhắc nợ         | CauHinhHeThong, LichPhieuTuDong, NhatKyTacVu, NhatKyTacVuLoi, NhacNo.                                        | Chỉ cần khi có lập kỳ/nhắc nợ tự động.                                 |
| Nhiều chủ trọ độc lập            | Gắn maChuTro/tenantId cho dữ liệu chi chung và hồ sơ khách, hoặc bảng quyền quản lý.                         | Phạm vi TOAN_CHUOI hiện không xác định chủ của khoản chi chung.        |

## 12. Thứ tự tạo bảng và điểm cần chốt

### 12.1. Thứ tự tạo bảng theo FK

1. TaiKhoan.
2. ChuTro, KhachThue.
3. CanTro → PhongTro → TaiSan, HopDong.
4. TienCoc, ThanhVienPhong, ViPhamHopDong, ChiSoDien, YeuCau, ThanhToan, SuCo.
5. YeuCauGiaHan, YeuCauTraPhong, DeXuatBanCungPhong, GiaoDichThanhToan, ChiTietThanhToan, KhoanChi, ThongBao, SuCoTaiSan.
6. BienBanTraPhong, KhoanThu.
7. KhoanKhauTru.

Các bảng trong cùng bước chỉ được tạo sau khi bảng cha trực tiếp đã tồn tại. Khi nhập mẫu, giữ cùng thứ tự phụ thuộc; tạo SuCo trước dòng phí sửa chữa, GiaoDichThanhToan trước KhoanThu.

### 12.2. Các quyết định cần nhóm chốt trước viết migration

| Điểm cần chốt                          | Phương án hiện tại trong tài liệu                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Hệ quản trị CSDL                       | Chưa xác định; kiểu SQL mô tả logic, cần chuyển cú pháp khi tạo migration.                    |
| Nguồn số đã trả                        | Đề xuất tổng giao dịch xác nhận chưa hủy; UC11 tạo giao dịch khi ghi trực tiếp.               |
| Quy trình xác nhận minh chứng          | Chờ xác nhận không tăng tổng; cần chốt thao tác xác nhận/từ chối và quyền.                    |
| Tính nước và lệch kỳ điện              | Chưa có đủ nguồn để chốt; không tự áp công thức bản SRS cũ.                                   |
| Thời điểm áp dụng thành viên tối thiểu | Sau nhận phòng; hợp đồng nháp có thể chưa có người cư trú.                                    |
| Một hồ sơ cọc / hợp đồng               | Tạo đồng thời kể cả khi chưa nhận tiền; thu nhiều đợt cần hồ sơ giao dịch cọc riêng.          |
| Thanh lý trực tiếp không yêu cầu       | FK maYeuCauTraPhong cho NULL để hỗ trợ UC06.4; có yêu cầu thì phải cùng hợp đồng và đã duyệt. |
| Khấu trừ nợ bằng cọc                   | Chưa tự động nếu chưa có nguồn giao dịch bù cọc/tham chiếu kỳ nợ; đề xuất ở mục 11.           |
| Phạm vi chuỗi / nhiều chủ              | Phải chọn một chủ cho toàn hệ thống hoặc bổ sung phạm vi sở hữu trước dùng chi chung.         |

Tài liệu đã bao phủ cấu trúc của 24 Entity và bảng nối, đồng thời tách rõ dữ liệu gốc, điều chỉnh kỹ thuật và các chức năng còn thiếu của mô hình. Đây là đặc tả thiết kế để phát triển migration; không phải xác nhận rằng hệ thống đã triển khai các ràng buộc hoặc đã bổ sung các bảng mở rộng.
