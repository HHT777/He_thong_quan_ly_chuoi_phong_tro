# DATABASE — HỆ THỐNG QUẢN LÝ CHUỖI PHÒNG TRỌ (theo SRS v0.4)

## 0. Quy ước

| Mục                 | Quy ước                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tên bảng/cột        | snake_case tiếng Việt không dấu                                                                             |
| Khóa chính          | `id BIGINT AUTO_INCREMENT` (trừ bảng 1–1 dùng khóa chính là khóa ngoại)                                     |
| Kiểu tiền           | `DECIMAL(15,0)` — VND, số nguyên không âm (AST-03)                                                          |
| Kiểu ngày giờ       | `DATE`, `DATETIME` (múi giờ Asia/Ho_Chi_Minh)                                                               |
| Kỳ (`ky`)           | Lưu `DATE` là **ngày mùng 1 của tháng lập phiếu** (vd. `2026-10-01` = kỳ 10/2026)                           |
| NN / UQ / PK / FK   | NOT NULL / UNIQUE / Primary Key / Foreign Key                                                               |
| Dữ liệu mẫu         | Giả lập, thời điểm "hôm nay" = 2026-10-04                                                                   |
| Nguồn tham chiếu UC | Theo 25 UC liên tục của SRS v0.4; giữ phòng thuộc UC-04, chuyển phòng (P1) thuộc UC-06, công nợ thuộc UC-11 |

**Cột chung** (có ở mọi bảng nghiệp vụ, không lặp lại ở từng bảng; bảng nhật ký chỉ-ghi-thêm như `lich_su_*`, `nhat_ky_*`, `audit_log` dùng cột `thoi_gian` riêng):

| Cột        | Kiểu     | Ràng buộc               | Mô tả                                        |
| ---------- | -------- | ----------------------- | -------------------------------------------- |
| created_at | DATETIME | NN                      | Thời điểm tạo                                |
| updated_at | DATETIME | NN                      | Thời điểm sửa gần nhất                       |
| created_by | BIGINT   | FK → tai_khoan.id, NULL | Người tạo (NULL = hệ thống/tác vụ định thời) |
| updated_by | BIGINT   | FK → tai_khoan.id, NULL | Người sửa gần nhất                           |

**Đồng bộ với SRS v0.4.** Giữ 56 bảng và tên vật lý đã mô tả. Tên `quyet_toan_tra_phong` biểu diễn bảng quyết toán dùng trong UC-15 “Xử lý trả phòng” và nghiệp vụ thanh lý hợp đồng. Việc gộp UC chỉ đổi nguồn truy vết, không xóa các bảng `giu_phong`, `chuyen_phong` hoặc `cong_no`. Trong tài liệu này `UC-21` là Quản lý phí phát sinh và khoản giảm trừ; UC-21 cũ về xác nhận minh chứng đã bị bỏ ở v0.2.

**Lịch sử cập nhật:** 04/10/2026 — đối chiếu với SRS v0.4; ánh xạ UC-26→UC-04, UC-27→UC-06, UC-23→UC-11, UC-22→UC-21, UC-24→UC-22, UC-25→UC-23, UC-28→UC-24, UC-29→UC-25; giữ nguyên khóa, kiểu, công thức, dữ liệu mẫu và toàn bộ quan hệ.

## 0.1 Danh mục toàn bộ bảng (56 bảng)

| STT | Nhóm                  | Bảng                         | Mô tả                                    | Nguồn SRS                  |
| --- | --------------------- | ---------------------------- | ---------------------------------------- | -------------------------- |
| 1   | A. Tệp & danh mục     | tep_dinh_kem                 | Mọi ảnh/tệp tải lên                      | NFR-019, SEC-09            |
| 2   | A                     | dm_loai_su_co                | Danh mục loại sự cố (cấu hình)           | FR-191                     |
| 3   | A                     | dm_muc_uu_tien               | Danh mục mức ưu tiên sự cố               | FR-191                     |
| 4   | A                     | dm_loai_chi                  | Danh mục loại khoản chi                  | UC-19                      |
| 5   | B. Người dùng         | chu_tro                      | Hồ sơ Chủ trọ (ACT-01)                   | UC-22                      |
| 6   | B                     | khach_thue                   | Hồ sơ khách thuê (người đứng tên)        | UC-05                      |
| 7   | B                     | tai_khoan                    | Tài khoản đăng nhập Chủ trọ/Khách        | UC-02, UC-22               |
| 8   | B                     | lich_su_trang_thai_tai_khoan | Lịch sử khóa/mở khóa                     | FR-010, BR-49              |
| 9   | B                     | nhat_ky_dang_nhap            | Nhật ký đăng nhập, đếm sai, khóa tạm     | SEC-08                     |
| 10  | C. Căn–Phòng          | can_tro                      | Căn trọ                                  | UC-03                      |
| 11  | C                     | phong                        | Phòng                                    | UC-04                      |
| 12  | C                     | noi_that                     | Nội thất (thuộc tính phòng)              | Q-25                       |
| 13  | D. Giữ phòng–Hợp đồng | giu_phong                    | Giữ phòng + tiền giữ chỗ                 | UC-04, BR-41               |
| 14  | D                     | hop_dong                     | Hợp đồng điện tử                         | UC-06                      |
| 15  | D                     | hop_dong_goi_gia_han         | Gói gia hạn cho phép (6/12 tháng)        | Q-18                       |
| 16  | D                     | tien_coc                     | Tiền cọc                                 | UC-06                      |
| 17  | D                     | lich_su_hop_dong             | Lịch sử thay đổi hợp đồng                | AUD-03, BR-11              |
| 18  | D                     | lich_su_gia_han              | Lịch sử gia hạn                          | BR-21                      |
| 19  | D                     | vi_pham_hop_dong             | Vi phạm hợp đồng                         | FR-199, BR-24              |
| 20  | D                     | nguoi_o_cung                 | Người ở cùng + đề xuất                   | UC-08, UC-24               |
| 21  | D                     | chuyen_phong                 | Lịch sử chuyển phòng (P1)                | UC-06, BR-16               |
| 22  | E. Điện               | chi_so_dien                  | Chỉ số điện theo phòng/kỳ                | UC-09, UC-10               |
| 23  | E                     | lich_su_chi_so_dien          | Lịch sử sửa/ghi đè chỉ số                | BR-35, AUD-01              |
| 24  | E                     | thay_cong_to                 | Ghi nhận thay công tơ                    | UC-10 A4                   |
| 25  | E                     | ocr_yeu_cau                  | Nhật ký gọi dịch vụ OCR                  | INT-01                     |
| 26  | F. Thu tiền–Công nợ   | khoan_dieu_chinh             | Phí phát sinh / giảm trừ                 | UC-21, BR-42               |
| 27  | F                     | khoan_phai_thu               | Khoản phải thu theo phòng/kỳ             | BR-03                      |
| 28  | F                     | khoan_phai_thu_dieu_chinh    | Điều chỉnh đã áp vào khoản phải thu      | UC-21                      |
| 29  | F                     | phieu_thu                    | Phiếu thu                                | UC-20, BR-26               |
| 30  | F                     | phieu_thu_ghi_chu            | Ghi chú thêm vào phiếu đã khóa           | BR-47                      |
| 31  | F                     | tinh_trang_thanh_toan        | Tình trạng thanh toán của khoản phải thu | BR-19, SM-04               |
| 32  | F                     | thanh_toan                   | Bản ghi từng lần thanh toán              | BR-34                      |
| 33  | F                     | minh_chung_thanh_toan        | Minh chứng khách tải lên                 | BR-25, SM-09               |
| 34  | F                     | cong_no                      | Công nợ                                  | UC-11, BR-19               |
| 35  | F                     | nhac_no                      | Lịch sử nhắc nợ                          | UC-11 A1, SYS-02           |
| 36  | F                     | phan_bo_doanh_thu            | Phân bổ doanh thu/giảm trừ theo lần thu  | BR-44                      |
| 37  | F                     | thu_khac                     | Thu khác (tiền giữ chỗ không hoàn)       | WF-10, BR-44               |
| 38  | G. Yêu cầu            | yeu_cau                      | Yêu cầu chung (3 loại)                   | UC-13, UC-14, UC-16, UC-01 |
| 39  | G                     | yeu_cau_gia_han              | Chi tiết yêu cầu gia hạn                 | UC-13                      |
| 40  | G                     | yeu_cau_tra_phong            | Chi tiết yêu cầu trả phòng               | UC-14                      |
| 41  | G                     | yeu_cau_dat_lai_mat_khau     | Chi tiết yêu cầu đặt lại mật khẩu        | UC-01                      |
| 42  | H. Sự cố–Chi phí      | su_co                        | Sự cố                                    | UC-17, UC-18               |
| 43  | H                     | su_co_anh                    | Ảnh của sự cố                            | UC-18                      |
| 44  | H                     | su_co_lich_su_trang_thai     | Lịch sử trạng thái sự cố                 | BR-50                      |
| 45  | H                     | khoan_cho_khau_tru           | Chi phí khách chịu chờ khấu trừ cọc      | BR-48                      |
| 46  | H                     | khoan_chi                    | Khoản chi (tay + từ sự cố)               | UC-19, BR-07               |
| 47  | I. Trả phòng          | quyet_toan_tra_phong         | Bảng quyết toán trả phòng/thanh lý       | UC-15, BR-39               |
| 48  | I                     | quyet_toan_chi_tiet          | Từng dòng cộng/trừ của quyết toán        | BR-39                      |
| 49  | I                     | hoan_tien_coc                | Ghi nhận đã hoàn cọc (ngoài hệ thống)    | FR-188                     |
| 50  | J. Hệ thống           | thong_bao                    | Thông báo trong ứng dụng                 | UC-23                      |
| 51  | J                     | su_kien_thong_bao            | Sự kiện phát qua Kafka (outbox)          | Q-08, NFR-021              |
| 52  | J                     | cau_hinh_he_thong            | Cấu hình mốc ngày, giới hạn              | NFR-013, FR-200            |
| 53  | J                     | lich_phieu_tu_dong           | Lịch lập phiếu tự động (chung chuỗi)     | BR-28                      |
| 54  | J                     | nhat_ky_tac_vu               | Log mỗi lần chạy tác vụ định thời        | UC-25, OPS-04              |
| 55  | J                     | nhat_ky_tac_vu_loi           | Lỗi theo từng đối tượng của tác vụ       | BR-29, NFR-014             |
| 56  | J                     | audit_log                    | Nhật ký kiểm toán                        | AUD-01…10                  |

---

# NHÓM A — TỆP & DANH MỤC

## 1. `tep_dinh_kem` — mọi tệp/ảnh tải lên

| Cột               | Kiểu         | Ràng buộc             | Mô tả                                           |
| ----------------- | ------------ | --------------------- | ----------------------------------------------- |
| id                | BIGINT       | PK                    |                                                 |
| loai_tep          | ENUM         | NN                    | ANH_CONG_TO, MINH_CHUNG, ANH_SU_CO, ANH_CAN_TRO |
| ten_goc           | VARCHAR(255) | NN                    | Tên tệp gốc                                     |
| duong_dan_luu     | VARCHAR(500) | NN, UQ                | Đường dẫn lưu ngoài thư mục chạy mã (SEC-09)    |
| mime_type         | VARCHAR(50)  | NN                    | image/jpeg, image/png (kiểm tra loại thật)      |
| dung_luong_byte   | INT          | NN                    | ≤ 10 485 760 (NFR-019)                          |
| checksum_sha256   | CHAR(64)     | NN                    |                                                 |
| nguoi_tai_len_id  | BIGINT       | FK → tai_khoan.id, NN |                                                 |
| thoi_gian_tai_len | DATETIME     | NN                    |                                                 |

Dữ liệu mẫu:

| id  | loai_tep    | ten_goc               | duong_dan_luu                            | mime_type  | dung_luong_byte | checksum_sha256 | nguoi_tai_len_id | thoi_gian_tai_len   |
| --- | ----------- | --------------------- | ---------------------------------------- | ---------- | --------------- | --------------- | ---------------- | ------------------- |
| 1   | ANH_CONG_TO | IMG_2031.jpg          | /data/uploads/dien/2026/10/p101_a1f3.jpg | image/jpeg | 2154300         | 9f2c…a1         | 2                | 2026-10-01 07:42:10 |
| 2   | ANH_CONG_TO | cong_to_p201.jpg      | /data/uploads/dien/2026/10/p201_b7c2.jpg | image/jpeg | 1873200         | 3be1…07         | 3                | 2026-10-01 09:15:44 |
| 3   | MINH_CHUNG  | ck_03_10.png          | /data/uploads/mc/2026/10/k1_c9d4.png     | image/png  | 412800          | 77aa…3c         | 2                | 2026-10-03 20:11:02 |
| 4   | MINH_CHUNG  | chuyen_khoan.jpg      | /data/uploads/mc/2026/09/k2_d1e5.jpg     | image/jpeg | 530100          | 1c4d…9e         | 3                | 2026-09-05 18:20:31 |
| 5   | ANH_SU_CO   | o_cam_chay.jpg        | /data/uploads/sc/2026/09/sc1_e2f6.jpg    | image/jpeg | 1290400         | 5d8e…b2         | 2                | 2026-09-14 08:29:50 |
| 6   | ANH_SU_CO   | kinh_vo.jpg           | /data/uploads/sc/2026/09/sc3_f3a7.jpg    | image/jpeg | 980100          | a0b9…44         | 4                | 2026-09-18 10:02:12 |
| 7   | ANH_SU_CO   | voi_nuoc_ri.jpg       | /data/uploads/sc/2026/10/sc2_a4b8.jpg    | image/jpeg | 1450000         | 6e1f…d5         | 3                | 2026-10-02 07:14:40 |
| 8   | ANH_CAN_TRO | hoa_sen_tong_quan.jpg | /data/uploads/can/ct01_b5c9.jpg          | image/jpeg | 3010200         | c7d2…18         | 1                | 2026-01-05 10:00:00 |
| 9   | MINH_CHUNG  | ck_bo_sung.png        | /data/uploads/mc/2026/10/k1_c6d7.png     | image/png  | 398700          | 2f9a…60         | 2                | 2026-10-04 09:30:15 |
| 10  | ANH_CONG_TO | anh_mo.jpg            | /data/uploads/dien/2026/10/p201_x9y1.jpg | image/jpeg | 760400          | 8b3c…e1         | 3                | 2026-10-01 09:10:02 |

## 2. `dm_loai_su_co` — loại sự cố (cấu hình được)

| Cột          | Kiểu         | Ràng buộc | Mô tả           |
| ------------ | ------------ | --------- | --------------- |
| id           | BIGINT       | PK        |                 |
| ma           | VARCHAR(20)  | NN, UQ    |                 |
| ten          | VARCHAR(100) | NN        |                 |
| thu_tu       | INT          | NN        | Thứ tự hiển thị |
| dang_su_dung | BOOLEAN      | NN        |                 |

| id  | ma       | ten               | thu_tu | dang_su_dung |
| --- | -------- | ----------------- | ------ | ------------ |
| 1   | DIEN     | Điện              | 1      | true         |
| 2   | NUOC     | Nước/ống nước     | 2      | true         |
| 3   | CUA_KHOA | Cửa/khóa          | 3      | true         |
| 4   | THIET_BI | Thiết bị/nội thất | 4      | true         |
| 5   | INTERNET | Internet          | 5      | true         |
| 6   | VE_SINH  | Vệ sinh/côn trùng | 6      | true         |
| 7   | KHAC     | Khác              | 7      | true         |

## 3. `dm_muc_uu_tien` — mức ưu tiên sự cố

| Cột    | Kiểu        | Ràng buộc | Mô tả         |
| ------ | ----------- | --------- | ------------- |
| id     | BIGINT      | PK        |               |
| ma     | VARCHAR(20) | NN, UQ    |               |
| ten    | VARCHAR(50) | NN        |               |
| thu_tu | INT         | NN        | 1 = thấp nhất |

| id  | ma         | ten        | thu_tu |
| --- | ---------- | ---------- | ------ |
| 1   | THAP       | Thấp       | 1      |
| 2   | TRUNG_BINH | Trung bình | 2      |
| 3   | CAO        | Cao        | 3      |
| 4   | KHAN_CAP   | Khẩn cấp   | 4      |

## 4. `dm_loai_chi` — loại khoản chi

| Cột          | Kiểu         | Ràng buộc | Mô tả |
| ------------ | ------------ | --------- | ----- |
| id           | BIGINT       | PK        |       |
| ma           | VARCHAR(30)  | NN, UQ    |       |
| ten          | VARCHAR(100) | NN        |       |
| dang_su_dung | BOOLEAN      | NN        |       |

| id  | ma                | ten                 | dang_su_dung |
| --- | ----------------- | ------------------- | ------------ |
| 1   | SUA_CHUA          | Sửa chữa            | true         |
| 2   | THAY_THE_THIET_BI | Thay thế thiết bị   | true         |
| 3   | HOA_HONG          | Hoa hồng giới thiệu | true         |
| 4   | KHAC              | Khác                | true         |

---

# NHÓM B — NGƯỜI DÙNG & TÀI KHOẢN

## 5. `chu_tro`

| Cột           | Kiểu         | Ràng buộc | Mô tả |
| ------------- | ------------ | --------- | ----- |
| id            | BIGINT       | PK        |       |
| ho_ten        | VARCHAR(100) | NN        |       |
| so_dien_thoai | VARCHAR(15)  | NN, UQ    |       |
| email         | VARCHAR(150) | NULL      |       |
| ghi_chu       | VARCHAR(255) | NULL      |       |

| id  | ho_ten          | so_dien_thoai | email               | ghi_chu         |
| --- | --------------- | ------------- | ------------------- | --------------- |
| 1   | Nguyễn Văn Hùng | 0901000001    | hung.nv@example.com | Chủ chuỗi 3 căn |

## 6. `khach_thue` — hồ sơ người đứng tên hợp đồng

| Cột                | Kiểu         | Ràng buộc | Mô tả                                         |
| ------------------ | ------------ | --------- | --------------------------------------------- |
| id                 | BIGINT       | PK        |                                               |
| ma_khach           | VARCHAR(20)  | NN, UQ    | Mã tự sinh KT0001…                            |
| ho_ten             | VARCHAR(100) | NN        |                                               |
| so_dien_thoai      | VARCHAR(15)  | NN, UQ    | Trùng khách xác định theo SĐT (BR-49)         |
| cccd               | VARCHAR(20)  | NN        | **Restricted**, che bớt khi hiển thị (SEC-10) |
| ngay_sinh          | DATE         | NULL      |                                               |
| gioi_tinh          | ENUM         | NULL      | NAM, NU, KHAC                                 |
| dia_chi_thuong_tru | VARCHAR(255) | NULL      |                                               |
| trang_thai         | ENUM         | NN        | CHUA_CO_HOP_DONG, DANG_THUE, DA_TRA_PHONG     |
| ghi_chu            | VARCHAR(255) | NULL      |                                               |

| id  | ma_khach | ho_ten         | so_dien_thoai | cccd         | ngay_sinh  | gioi_tinh | dia_chi_thuong_tru | trang_thai       | ghi_chu                  |
| --- | -------- | -------------- | ------------- | ------------ | ---------- | --------- | ------------------ | ---------------- | ------------------------ |
| 1   | KT0001   | Trần Thị Mai   | 0912345601    | 079301000111 | 1998-04-12 | NU        | Long An            | DANG_THUE        | NULL                     |
| 2   | KT0002   | Lê Văn Nam     | 0912345602    | 079201000222 | 1996-09-30 | NAM       | Đồng Nai           | DANG_THUE        | NULL                     |
| 3   | KT0003   | Phạm Quốc Bảo  | 0912345603    | 079095000333 | 1995-01-20 | NAM       | Bình Dương         | DANG_THUE        | Đã xin trả phòng         |
| 4   | KT0004   | Võ Thị Lan     | 0912345604    | 079300000444 | 2000-07-08 | NU        | Tiền Giang         | DANG_THUE        | Người quản lý căn 3      |
| 5   | KT0005   | Đặng Minh Tuấn | 0912345605    | 079097000555 | 1997-11-15 | NAM       | Tây Ninh           | DA_TRA_PHONG     | NULL                     |
| 6   | KT0006   | Bùi Thanh Sơn  | 0912345606    | 079099000666 | 1999-03-03 | NAM       | Bến Tre            | DA_TRA_PHONG     | Còn công nợ sau thanh lý |
| 7   | KT0007   | Ngô Thị Hạnh   | 0912345607    | 079302000777 | 2002-12-25 | NU        | Vĩnh Long          | CHUA_CO_HOP_DONG | Hồ sơ mới, chưa ký       |

## 7. `tai_khoan`

| Cột                   | Kiểu         | Ràng buộc                    | Mô tả                                                     |
| --------------------- | ------------ | ---------------------------- | --------------------------------------------------------- |
| id                    | BIGINT       | PK                           |                                                           |
| ten_dang_nhap         | VARCHAR(50)  | NN, UQ                       | Khách: = SĐT                                              |
| mat_khau_bam          | VARCHAR(255) | NN                           | Băm có muối (SEC-04)                                      |
| vai_tro               | ENUM         | NN                           | CHU_TRO, KHACH_THUE                                       |
| chu_tro_id            | BIGINT       | FK → chu_tro.id, NULL        | Có khi vai_tro = CHU_TRO                                  |
| khach_thue_id         | BIGINT       | FK → khach_thue.id, NULL, UQ | Có khi vai_tro = KHACH_THUE; mỗi khách tối đa 1 tài khoản |
| trang_thai            | ENUM         | NN                           | HOAT_DONG, DA_KHOA                                        |
| bat_buoc_doi_mat_khau | BOOLEAN      | NN                           | true khi mật khẩu là "1" (BR-37)                          |
| so_lan_sai_lien_tiep  | INT          | NN                           | Mặc định 0                                                |
| khoa_tam_den          | DATETIME     | NULL                         | Khóa tạm 15 phút sau 5 lần sai                            |
| lan_dang_nhap_cuoi    | DATETIME     | NULL                         |                                                           |

| id  | ten_dang_nhap | mat_khau_bam        | vai_tro    | chu_tro_id | khach_thue_id | trang_thai | bat_buoc_doi_mat_khau | so_lan_sai_lien_tiep | khoa_tam_den | lan_dang_nhap_cuoi  |
| --- | ------------- | ------------------- | ---------- | ---------- | ------------- | ---------- | --------------------- | -------------------- | ------------ | ------------------- |
| 1   | chutro        | $2b$12$Qk…(rút gọn) | CHU_TRO    | 1          | NULL          | HOAT_DONG  | false                 | 0                    | NULL         | 2026-10-04 07:55:00 |
| 2   | 0912345601    | $2b$12$Lm…(rút gọn) | KHACH_THUE | NULL       | 1             | HOAT_DONG  | false                 | 0                    | NULL         | 2026-10-04 09:29:40 |
| 3   | 0912345602    | $2b$12$Zp…(rút gọn) | KHACH_THUE | NULL       | 2             | HOAT_DONG  | false                 | 2                    | NULL         | 2026-10-02 07:10:22 |
| 4   | 0912345603    | $2b$12$Tr…(rút gọn) | KHACH_THUE | NULL       | 3             | HOAT_DONG  | false                 | 0                    | NULL         | 2026-09-18 10:00:05 |
| 5   | 0912345604    | $2b$12$Yw…(rút gọn) | KHACH_THUE | NULL       | 4             | HOAT_DONG  | false                 | 0                    | NULL         | 2026-09-04 19:40:11 |
| 6   | 0912345605    | $2b$12$Ab…(rút gọn) | KHACH_THUE | NULL       | 5             | DA_KHOA    | true                  | 0                    | NULL         | 2026-05-30 21:00:00 |
| 7   | 0912345606    | $2b$12$Cd…(rút gọn) | KHACH_THUE | NULL       | 6             | DA_KHOA    | true                  | 0                    | NULL         | 2026-08-30 18:05:09 |

## 8. `lich_su_trang_thai_tai_khoan`

| Cột            | Kiểu         | Ràng buộc             | Mô tả            |
| -------------- | ------------ | --------------------- | ---------------- |
| id             | BIGINT       | PK                    |                  |
| tai_khoan_id   | BIGINT       | FK → tai_khoan.id, NN |                  |
| trang_thai_cu  | ENUM         | NULL                  | NULL khi mới tạo |
| trang_thai_moi | ENUM         | NN                    |                  |
| ly_do          | VARCHAR(255) | NULL                  |                  |
| thuc_hien_boi  | BIGINT       | FK → tai_khoan.id, NN |                  |
| thoi_gian      | DATETIME     | NN                    |                  |

| id  | tai_khoan_id | trang_thai_cu | trang_thai_moi | ly_do                                   | thuc_hien_boi | thoi_gian           |
| --- | ------------ | ------------- | -------------- | --------------------------------------- | ------------- | ------------------- |
| 1   | 2            | NULL          | HOAT_DONG      | Tạo tài khoản sau khi nhận cọc          | 1             | 2026-01-01 10:20:00 |
| 2   | 6            | HOAT_DONG     | DA_KHOA        | Thanh lý hợp đồng HD-CT01-P102-2025-001 | 1             | 2026-05-31 17:00:00 |
| 3   | 7            | HOAT_DONG     | DA_KHOA        | Thanh lý hợp đồng HD-CT01-P102-2026-001 | 1             | 2026-08-31 17:30:00 |

## 9. `nhat_ky_dang_nhap`

| Cột                | Kiểu         | Ràng buộc               | Mô tả                                              |
| ------------------ | ------------ | ----------------------- | -------------------------------------------------- |
| id                 | BIGINT       | PK                      |                                                    |
| ten_dang_nhap_nhap | VARCHAR(50)  | NN                      | Giá trị người dùng nhập                            |
| tai_khoan_id       | BIGINT       | FK → tai_khoan.id, NULL | NULL nếu không tồn tại                             |
| ket_qua            | ENUM         | NN                      | THANH_CONG, SAI_MAT_KHAU, TAI_KHOAN_KHOA, KHOA_TAM |
| dia_chi_ip         | VARCHAR(45)  | NN                      |                                                    |
| user_agent         | VARCHAR(255) | NULL                    |                                                    |
| thoi_gian          | DATETIME     | NN                      |                                                    |

| id  | ten_dang_nhap_nhap | tai_khoan_id | ket_qua        | dia_chi_ip   | user_agent            | thoi_gian           |
| --- | ------------------ | ------------ | -------------- | ------------ | --------------------- | ------------------- |
| 1   | 0912345601         | 2            | THANH_CONG     | 113.161.20.5 | Mozilla/5.0 (iPhone)  | 2026-10-04 09:29:40 |
| 2   | 0912345602         | 3            | SAI_MAT_KHAU   | 27.72.10.18  | Mozilla/5.0 (Android) | 2026-10-02 07:09:50 |
| 3   | 0912345605         | 6            | TAI_KHOAN_KHOA | 14.241.8.77  | Mozilla/5.0 (Windows) | 2026-06-10 20:01:11 |

---

# NHÓM C — CĂN & PHÒNG

## 10. `can_tro`

| Cột                  | Kiểu         | Ràng buộc                  | Mô tả                                                                                 |
| -------------------- | ------------ | -------------------------- | ------------------------------------------------------------------------------------- |
| id                   | BIGINT       | PK                         |                                                                                       |
| ma_can               | VARCHAR(20)  | NN, UQ                     | Tự sinh                                                                               |
| chu_tro_id           | BIGINT       | FK → chu_tro.id, NN        |                                                                                       |
| ten_can              | VARCHAR(150) | NN                         |                                                                                       |
| dia_chi              | VARCHAR(255) | NN                         |                                                                                       |
| mo_ta                | TEXT         | NULL                       |                                                                                       |
| quy_dinh_chung       | TEXT         | NULL                       |                                                                                       |
| tep_anh_tong_quan_id | BIGINT       | FK → tep_dinh_kem.id, NULL |                                                                                       |
| trang_thai_hoat_dong | ENUM         | NN                         | HOAT_DONG, NGUNG_HOAT_DONG (chặn khi còn phòng Đang thuê/Đã giữ/Đang xử lý trả phòng) |

| id  | ma_can | chu_tro_id | ten_can       | dia_chi                                       | mo_ta                  | quy_dinh_chung              | tep_anh_tong_quan_id | trang_thai_hoat_dong |
| --- | ------ | ---------- | ------------- | --------------------------------------------- | ---------------------- | --------------------------- | -------------------- | -------------------- |
| 1   | CT01   | 1          | Trọ Hoa Sen   | 12 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức      | 30 phòng, có thang máy | Giữ yên lặng sau 22:00      | 8                    | HOAT_DONG            |
| 2   | CT02   | 1          | Trọ Ánh Dương | 45 Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức | 30 phòng, có bãi xe    | Không nuôi thú cưng         | NULL                 | HOAT_DONG            |
| 3   | CT03   | 1          | Trọ Bình An   | 8 Đường 385, P. Tăng Nhơn Phú A, TP. Thủ Đức  | 30 phòng               | Không hút thuốc trong phòng | NULL                 | HOAT_DONG            |

## 11. `phong`

| Cột               | Kiểu          | Ràng buộc           | Mô tả                                                                 |
| ----------------- | ------------- | ------------------- | --------------------------------------------------------------------- |
| id                | BIGINT        | PK                  |                                                                       |
| can_tro_id        | BIGINT        | FK → can_tro.id, NN |                                                                       |
| so_phong          | VARCHAR(20)   | NN                  | UQ(can_tro_id, so_phong)                                              |
| dien_tich         | DECIMAL(6,2)  | NN                  | m², > 0                                                               |
| gia_thue_niem_yet | DECIMAL(15,0) | NN                  | Giá gợi ý khi lập hợp đồng (Q-16)                                     |
| so_nguoi_toi_da   | INT           | NN                  | ≥ 1                                                                   |
| so_nguoi_dang_o   | INT           | NN                  | Cache = người đứng tên + người ở cùng _Đang ở_                        |
| trang_thai        | ENUM          | NN                  | TRONG, DA_GIU, DANG_THUE, DANG_XU_LY_TRA_PHONG, NGUNG_SU_DUNG (SM-01) |
| ghi_chu           | VARCHAR(255)  | NULL                |                                                                       |

| id  | can_tro_id | so_phong | dien_tich | gia_thue_niem_yet | so_nguoi_toi_da | so_nguoi_dang_o | trang_thai           | ghi_chu                         |
| --- | ---------- | -------- | --------- | ----------------- | --------------- | --------------- | -------------------- | ------------------------------- |
| 1   | 1          | P101     | 20.00     | 2500000           | 2               | 2               | DANG_THUE            | NULL                            |
| 2   | 1          | P102     | 18.00     | 2300000           | 2               | 0               | TRONG                | NULL                            |
| 3   | 1          | P103     | 20.00     | 2400000           | 2               | 0               | DA_GIU               | Giữ cho Hoàng Anh Thư (quá hạn) |
| 4   | 2          | P201     | 25.00     | 3000000           | 3               | 2               | DANG_THUE            | Có máy lạnh                     |
| 5   | 2          | P202     | 22.00     | 2800000           | 2               | 1               | DANG_XU_LY_TRA_PHONG | Khách đã đến ngày trả           |
| 6   | 3          | P301     | 18.00     | 2200000           | 2               | 0               | NGUNG_SU_DUNG        | Sửa chữa lớn                    |
| 7   | 3          | P302     | 20.00     | 2400000           | 2               | 1               | DANG_THUE            | NULL                            |

## 12. `noi_that`

| Cột        | Kiểu         | Ràng buộc         | Mô tả                          |
| ---------- | ------------ | ----------------- | ------------------------------ |
| id         | BIGINT       | PK                |                                |
| phong_id   | BIGINT       | FK → phong.id, NN |                                |
| ten        | VARCHAR(100) | NN                |                                |
| so_luong   | INT          | NN                | ≥ 1                            |
| tinh_trang | VARCHAR(50)  | NULL              | Tốt, Hư hỏng nhẹ, Đã thay mới… |
| ghi_chu    | VARCHAR(255) | NULL              |                                |

| id  | phong_id | ten          | so_luong | tinh_trang  | ghi_chu              |
| --- | -------- | ------------ | -------- | ----------- | -------------------- |
| 1   | 1        | Giường đơn   | 1        | Tốt         | NULL                 |
| 2   | 1        | Tủ quần áo   | 1        | Tốt         | NULL                 |
| 3   | 4        | Máy lạnh     | 1        | Tốt         | Daikin 1HP           |
| 4   | 5        | Giường đơn   | 1        | Tốt         | NULL                 |
| 5   | 5        | Cửa sổ kính  | 1        | Đã thay mới | Thay ngày 2026-09-19 |
| 6   | 5        | Ghế sofa     | 1        | Hư hỏng nhẹ | Rách tay vịn         |
| 7   | 7        | Quạt trần    | 1        | Tốt         | NULL                 |
| 8   | 2        | Tủ lạnh mini | 1        | Tốt         | NULL                 |

---

# NHÓM D — GIỮ PHÒNG & HỢP ĐỒNG

## 13. `giu_phong`

| Cột              | Kiểu          | Ràng buộc                | Mô tả                                                                      |
| ---------------- | ------------- | ------------------------ | -------------------------------------------------------------------------- |
| id               | BIGINT        | PK                       |                                                                            |
| phong_id         | BIGINT        | FK → phong.id, NN        | Mỗi phòng tối đa 1 giữ phòng _Đang giữ_                                    |
| khach_thue_id    | BIGINT        | FK → khach_thue.id, NULL | Có khi người giữ đã có hồ sơ                                               |
| ho_ten_nguoi_giu | VARCHAR(100)  | NN                       |                                                                            |
| so_dien_thoai    | VARCHAR(15)   | NN                       |                                                                            |
| tien_giu_cho     | DECIMAL(15,0) | NN                       | ≥ 0                                                                        |
| ngay_nhan        | DATE          | NN                       |                                                                            |
| han_giu          | DATE          | NN                       | Mặc định ngày nhận + 7                                                     |
| trang_thai       | ENUM          | NN                       | DANG_GIU, DA_CHUYEN_THANH_HOP_DONG, DA_HUY_HOAN, DA_HUY_KHONG_HOAN (SM-13) |
| hop_dong_id      | BIGINT        | FK → hop_dong.id, NULL   | Khi chuyển thành hợp đồng                                                  |
| ngay_huy         | DATE          | NULL                     |                                                                            |
| ly_do_huy        | VARCHAR(255)  | NULL                     |                                                                            |
| so_tien_hoan     | DECIMAL(15,0) | NULL                     | Khi hủy hoàn                                                               |
| ngay_hoan        | DATE          | NULL                     |                                                                            |
| ghi_chu          | VARCHAR(255)  | NULL                     |                                                                            |

| id  | phong_id | khach_thue_id | ho_ten_nguoi_giu | so_dien_thoai | tien_giu_cho | ngay_nhan  | han_giu    | trang_thai               | hop_dong_id | ngay_huy   | ly_do_huy                   | so_tien_hoan | ngay_hoan  | ghi_chu                             |
| --- | -------- | ------------- | ---------------- | ------------- | ------------ | ---------- | ---------- | ------------------------ | ----------- | ---------- | --------------------------- | ------------ | ---------- | ----------------------------------- |
| 1   | 3        | NULL          | Hoàng Anh Thư    | 0987000001    | 1000000      | 2026-09-20 | 2026-09-27 | DANG_GIU                 | NULL        | NULL       | NULL                        | NULL         | NULL       | Quá hạn 7 ngày, đã cảnh báo Chủ trọ |
| 2   | 2        | NULL          | Nguyễn Hải       | 0987000002    | 500000       | 2026-09-10 | 2026-09-17 | DA_HUY_KHONG_HOAN        | NULL        | 2026-09-25 | Người giữ bỏ cọc            | 0            | NULL       | NULL                                |
| 3   | 7        | 4             | Võ Thị Lan       | 0912345604    | 1000000      | 2026-05-25 | 2026-06-01 | DA_CHUYEN_THANH_HOP_DONG | 4           | NULL       | NULL                        | NULL         | NULL       | Trừ vào cọc                         |
| 4   | 2        | NULL          | Nguyễn Văn Dũng  | 0987000004    | 1000000      | 2026-06-01 | 2026-06-08 | DA_HUY_HOAN              | NULL        | 2026-06-05 | Chủ trọ hủy do đổi kế hoạch | 1000000      | 2026-06-06 | NULL                                |

## 14. `hop_dong`

| Cột                    | Kiểu          | Ràng buộc               | Mô tả                                                    |
| ---------------------- | ------------- | ----------------------- | -------------------------------------------------------- |
| id                     | BIGINT        | PK                      |                                                          |
| ma_hop_dong            | VARCHAR(40)   | NN, UQ                  |                                                          |
| phong_id               | BIGINT        | FK → phong.id, NN       | Mỗi phòng tối đa 1 hợp đồng hiệu lực (FR-038)            |
| khach_thue_id          | BIGINT        | FK → khach_thue.id, NN  | Người đứng tên                                           |
| giu_phong_id           | BIGINT        | FK → giu_phong.id, NULL |                                                          |
| ngay_lap               | DATE          | NN                      | Ngày chốt chỉ số điện đầu                                |
| ngay_bat_dau           | DATE          | NN                      |                                                          |
| ngay_ket_thuc          | DATE          | NN                      | > ngay_bat_dau; cộng dồn khi gia hạn                     |
| gia_thue               | DECIMAL(15,0) | NN                      | Giá áp dụng (khác giá niêm yết, Q-16)                    |
| don_gia_dien           | DECIMAL(10,0) | NN                      | đ/kWh                                                    |
| don_gia_nuoc_dau_nguoi | DECIMAL(10,0) | NN                      | đ/người/tháng (BR-23)                                    |
| phi_dich_vu            | DECIMAL(15,0) | NN                      |                                                          |
| da_co_ban_giay_ky      | BOOLEAN       | NN                      | Bắt buộc true mới lưu (BR-40)                            |
| dieu_khoan             | TEXT          | NULL                    |                                                          |
| trang_thai             | ENUM          | NN                      | DANG_HIEU_LUC, SAP_HET_HAN, HET_HAN, DA_THANH_LY (SM-02) |
| da_canh_bao_het_han    | BOOLEAN       | NN                      | Mỗi hợp đồng cảnh báo 1 lần (BR-02)                      |
| ngay_canh_bao          | DATE          | NULL                    |                                                          |
| ngay_thanh_ly          | DATE          | NULL                    |                                                          |

| id  | ma_hop_dong           | phong_id | khach_thue_id | giu_phong_id | ngay_lap   | ngay_bat_dau | ngay_ket_thuc | gia_thue | don_gia_dien | don_gia_nuoc_dau_nguoi | phi_dich_vu | da_co_ban_giay_ky | dieu_khoan | trang_thai    | da_canh_bao_het_han | ngay_canh_bao | ngay_thanh_ly |
| --- | --------------------- | -------- | ------------- | ------------ | ---------- | ------------ | ------------- | -------- | ------------ | ---------------------- | ----------- | ----------------- | ---------- | ------------- | ------------------- | ------------- | ------------- |
| 1   | HD-CT01-P101-2026-001 | 1        | 1             | NULL         | 2026-01-01 | 2026-01-01   | 2026-12-31    | 2500000  | 3500         | 100000                 | 150000      | true              | Điều 1–12  | DANG_HIEU_LUC | false               | NULL          | NULL          |
| 2   | HD-CT02-P201-2026-001 | 4        | 2             | NULL         | 2026-03-15 | 2026-03-15   | 2026-10-31    | 3000000  | 3800         | 100000                 | 150000      | true              | Điều 1–12  | SAP_HET_HAN   | true                | 2026-10-01    | NULL          |
| 3   | HD-CT02-P202-2025-001 | 5        | 3             | NULL         | 2025-11-01 | 2025-11-01   | 2027-04-30    | 2800000  | 3500         | 100000                 | 150000      | true              | Điều 1–12  | DANG_HIEU_LUC | true                | 2026-03-30    | NULL          |
| 4   | HD-CT03-P302-2026-001 | 7        | 4             | 3            | 2026-06-01 | 2026-06-01   | 2027-05-31    | 2200000  | 3500         | 100000                 | 150000      | true              | Điều 1–12  | DANG_HIEU_LUC | false               | NULL          | NULL          |
| 5   | HD-CT01-P102-2025-001 | 2        | 5             | NULL         | 2025-06-01 | 2025-06-01   | 2026-05-31    | 2300000  | 3500         | 100000                 | 150000      | true              | Điều 1–12  | DA_THANH_LY   | true                | 2026-05-01    | 2026-05-31    |
| 6   | HD-CT01-P102-2026-001 | 2        | 6             | NULL         | 2026-06-15 | 2026-06-15   | 2026-12-14    | 2300000  | 3500         | 100000                 | 150000      | true              | Điều 1–12  | DA_THANH_LY   | false               | NULL          | 2026-08-31    |

## 15. `hop_dong_goi_gia_han`

| Cột         | Kiểu   | Ràng buộc            | Mô tả                     |
| ----------- | ------ | -------------------- | ------------------------- |
| id          | BIGINT | PK                   |                           |
| hop_dong_id | BIGINT | FK → hop_dong.id, NN | UQ(hop_dong_id, so_thang) |
| so_thang    | INT    | NN                   | Chỉ 6 hoặc 12             |

| id  | hop_dong_id | so_thang |
| --- | ----------- | -------- |
| 1   | 1           | 6        |
| 2   | 1           | 12       |
| 3   | 2           | 6        |
| 4   | 2           | 12       |
| 5   | 3           | 6        |
| 6   | 3           | 12       |
| 7   | 4           | 12       |

## 16. `tien_coc`

| Cột                 | Kiểu          | Ràng buộc                | Mô tả                                                                          |
| ------------------- | ------------- | ------------------------ | ------------------------------------------------------------------------------ |
| id                  | BIGINT        | PK                       |                                                                                |
| hop_dong_id         | BIGINT        | FK → hop_dong.id, NN, UQ | 1 hợp đồng – 1 khoản cọc                                                       |
| so_tien             | DECIMAL(15,0) | NN                       | > 0, ghi trong hợp đồng                                                        |
| so_tien_tu_giu_cho  | DECIMAL(15,0) | NN                       | Phần trừ từ tiền giữ chỗ (mặc định 0)                                          |
| so_tien_da_nhan     | DECIMAL(15,0) | NN                       | Tiền thực nhận thêm                                                            |
| ngay_nhan           | DATE          | NULL                     |                                                                                |
| trang_thai          | ENUM          | NN                       | CHUA_NHAN, DA_NHAN, DA_HOAN, DA_KHAU_TRU_MOT_PHAN, DA_KHAU_TRU_TOAN_BO (SM-11) |
| so_tien_da_hoan     | DECIMAL(15,0) | NN                       | Mặc định 0                                                                     |
| so_tien_da_khau_tru | DECIMAL(15,0) | NN                       | Mặc định 0                                                                     |

| id  | hop_dong_id | so_tien | so_tien_tu_giu_cho | so_tien_da_nhan | ngay_nhan  | trang_thai           | so_tien_da_hoan | so_tien_da_khau_tru |
| --- | ----------- | ------- | ------------------ | --------------- | ---------- | -------------------- | --------------- | ------------------- |
| 1   | 1           | 5000000 | 0                  | 5000000         | 2026-01-01 | DA_NHAN              | 0               | 0                   |
| 2   | 2           | 6000000 | 0                  | 6000000         | 2026-03-15 | DA_NHAN              | 0               | 0                   |
| 3   | 3           | 5000000 | 0                  | 5000000         | 2025-11-01 | DA_NHAN              | 0               | 0                   |
| 4   | 4           | 4400000 | 1000000            | 3400000         | 2026-06-01 | DA_NHAN              | 0               | 0                   |
| 5   | 5           | 4000000 | 0                  | 4000000         | 2025-06-01 | DA_KHAU_TRU_MOT_PHAN | 3860000         | 140000              |
| 6   | 6           | 4000000 | 0                  | 4000000         | 2026-06-15 | DA_KHAU_TRU_TOAN_BO  | 0               | 4000000             |

## 17. `lich_su_hop_dong`

| Cột            | Kiểu         | Ràng buộc               | Mô tả                                                                                              |
| -------------- | ------------ | ----------------------- | -------------------------------------------------------------------------------------------------- |
| id             | BIGINT       | PK                      |                                                                                                    |
| hop_dong_id    | BIGINT       | FK → hop_dong.id, NN    |                                                                                                    |
| loai_thay_doi  | ENUM         | NN                      | GIA_THUE, DON_GIA_DIEN, DON_GIA_NUOC, PHI_DICH_VU, TIEN_COC, NGAY_KET_THUC, DIEU_KHOAN, TRANG_THAI |
| gia_tri_cu     | VARCHAR(255) | NULL                    |                                                                                                    |
| gia_tri_moi    | VARCHAR(255) | NN                      |                                                                                                    |
| hieu_luc_tu_ky | DATE         | NULL                    | Kỳ chưa lập phiếu bắt đầu áp dụng (UC-06 A2)                                                       |
| ly_do          | VARCHAR(255) | NULL                    |                                                                                                    |
| thuc_hien_boi  | BIGINT       | FK → tai_khoan.id, NULL | NULL = hệ thống                                                                                    |
| thoi_gian      | DATETIME     | NN                      |                                                                                                    |

| id  | hop_dong_id | loai_thay_doi | gia_tri_cu    | gia_tri_moi | hieu_luc_tu_ky | ly_do                                        | thuc_hien_boi | thoi_gian           |
| --- | ----------- | ------------- | ------------- | ----------- | -------------- | -------------------------------------------- | ------------- | ------------------- |
| 1   | 1           | DON_GIA_DIEN  | 3300          | 3500        | 2026-07-01     | Điện lực tăng giá, thỏa thuận ngoài hệ thống | 1             | 2026-06-28 09:00:00 |
| 2   | 3           | NGAY_KET_THUC | 2026-04-30    | 2027-04-30  | NULL           | Gia hạn 12 tháng theo yêu cầu #5             | 1             | 2026-04-01 10:00:00 |
| 3   | 2           | TRANG_THAI    | DANG_HIEU_LUC | SAP_HET_HAN | NULL           | Còn ≤ 1 tháng (SYS-01)                       | NULL          | 2026-10-01 00:05:00 |
| 4   | 3           | GIA_THUE      | 2200000       | 2800000     | 2026-03-01     | Chuyển phòng P301 → P202                     | 1             | 2026-03-01 08:00:00 |

## 18. `lich_su_gia_han`

| Cột                 | Kiểu     | Ràng buộc             | Mô tả                                  |
| ------------------- | -------- | --------------------- | -------------------------------------- |
| id                  | BIGINT   | PK                    |                                        |
| hop_dong_id         | BIGINT   | FK → hop_dong.id, NN  |                                        |
| yeu_cau_id          | BIGINT   | FK → yeu_cau.id, NN   |                                        |
| ngay_ket_thuc_cu    | DATE     | NN                    |                                        |
| so_thang_gia_han    | INT      | NN                    | 6 hoặc 12                              |
| ngay_ket_thuc_moi   | DATE     | NN                    | = cũ + gói (Chủ trọ không chỉnh, Q-18) |
| phe_duyet_boi       | BIGINT   | FK → tai_khoan.id, NN |                                        |
| thoi_gian_phe_duyet | DATETIME | NN                    |                                        |

| id  | hop_dong_id | yeu_cau_id | ngay_ket_thuc_cu | so_thang_gia_han | ngay_ket_thuc_moi | phe_duyet_boi | thoi_gian_phe_duyet |
| --- | ----------- | ---------- | ---------------- | ---------------- | ----------------- | ------------- | ------------------- |
| 1   | 3           | 5          | 2026-04-30       | 12               | 2027-04-30        | 1             | 2026-04-01 10:00:00 |

## 19. `vi_pham_hop_dong`

| Cột                  | Kiểu         | Ràng buộc             | Mô tả                           |
| -------------------- | ------------ | --------------------- | ------------------------------- |
| id                   | BIGINT       | PK                    |                                 |
| hop_dong_id          | BIGINT       | FK → hop_dong.id, NN  |                                 |
| noi_dung             | VARCHAR(500) | NN                    |                                 |
| dieu_khoan_lien_quan | VARCHAR(100) | NN                    | Bắt buộc gắn điều khoản (BR-24) |
| ngay_vi_pham         | DATE         | NN                    |                                 |
| ghi_nhan_boi         | BIGINT       | FK → tai_khoan.id, NN |                                 |
| ghi_chu              | VARCHAR(255) | NULL                  |                                 |

| id  | hop_dong_id | noi_dung                   | dieu_khoan_lien_quan | ngay_vi_pham | ghi_nhan_boi | ghi_chu        |
| --- | ----------- | -------------------------- | -------------------- | ------------ | ------------ | -------------- |
| 1   | 3           | Hút thuốc trong phòng      | Điều 7               | 2026-08-20   | 1            | Nhắc nhở lần 1 |
| 2   | 2           | Để xe sai khu vực quy định | Điều 5               | 2026-07-11   | 1            | Không khấu trừ |

## 20. `nguoi_o_cung` — người ở cùng và đề xuất

| Cột                        | Kiểu         | Ràng buộc               | Mô tả                                      |
| -------------------------- | ------------ | ----------------------- | ------------------------------------------ |
| id                         | BIGINT       | PK                      |                                            |
| phong_id                   | BIGINT       | FK → phong.id, NN       |                                            |
| hop_dong_id                | BIGINT       | FK → hop_dong.id, NN    |                                            |
| ho_ten                     | VARCHAR(100) | NN                      |                                            |
| so_dien_thoai              | VARCHAR(15)  | NULL                    | Không có tài khoản (Q-13)                  |
| cccd                       | VARCHAR(20)  | NN                      | **Restricted** (PII người thứ ba)          |
| ngay_sinh                  | DATE         | NULL                    |                                            |
| gioi_tinh                  | ENUM         | NULL                    | NAM, NU, KHAC                              |
| dia_chi_thuong_tru         | VARCHAR(255) | NULL                    |                                            |
| quan_he_voi_nguoi_dung_ten | VARCHAR(50)  | NULL                    |                                            |
| ngay_bat_dau_o             | DATE         | NN                      |                                            |
| ngay_roi_di                | DATE         | NULL                    |                                            |
| trang_thai                 | ENUM         | NN                      | CHO_XU_LY, DANG_O, TU_CHOI, DA_ROI (SM-10) |
| ly_do_tu_choi              | VARCHAR(255) | NULL                    |                                            |
| xu_ly_boi                  | BIGINT       | FK → tai_khoan.id, NULL |                                            |
| thoi_gian_xu_ly            | DATETIME     | NULL                    |                                            |
| ghi_chu                    | VARCHAR(255) | NULL                    |                                            |

| id  | phong_id | hop_dong_id | ho_ten          | so_dien_thoai | cccd         | ngay_sinh  | gioi_tinh | dia_chi_thuong_tru | quan_he_voi_nguoi_dung_ten | ngay_bat_dau_o | ngay_roi_di | trang_thai | ly_do_tu_choi            | xu_ly_boi | thoi_gian_xu_ly     | ghi_chu                 |
| --- | -------- | ----------- | --------------- | ------------- | ------------ | ---------- | --------- | ------------------ | -------------------------- | -------------- | ----------- | ---------- | ------------------------ | --------- | ------------------- | ----------------------- |
| 1   | 1        | 1           | Trần Văn Khoa   | 0933111001    | 079305000101 | 2003-02-14 | NAM       | Long An            | Em trai                    | 2026-01-01     | NULL        | DANG_O     | NULL                     | 1         | 2026-01-02 09:00:00 | NULL                    |
| 2   | 4        | 2           | Lê Thị Hoa      | 0933111002    | 079300000202 | 2001-08-19 | NU        | Đồng Nai           | Em gái                     | 2026-10-10     | NULL        | CHO_XU_LY  | NULL                     | NULL      | NULL                | Đề xuất ngày 2026-10-03 |
| 3   | 1        | 1           | Nguyễn Thị Bích | NULL          | 079302000303 | 2000-05-05 | NU        | Bình Phước         | Bạn                        | 2026-05-01     | NULL        | TU_CHOI    | Vượt thỏa thuận số người | 1         | 2026-04-28 08:30:00 | NULL                    |
| 4   | 4        | 2           | Lê Văn Phúc     | 0933111004    | 079098000404 | 1998-10-10 | NAM       | Đồng Nai           | Anh trai                   | 2026-03-15     | NULL        | DANG_O     | NULL                     | 1         | 2026-03-16 10:00:00 | NULL                    |
| 5   | 5        | 3           | Phạm Thu Hà     | 0933111005    | 079301000505 | 2001-01-22 | NU        | Bình Dương         | Chị gái                    | 2025-11-01     | 2026-07-31  | DA_ROI     | NULL                     | 1         | 2025-11-02 09:00:00 | Đã rời                  |

## 21. `chuyen_phong` (P1)

| Cột                       | Kiểu          | Ràng buộc                      | Mô tả                                             |
| ------------------------- | ------------- | ------------------------------ | ------------------------------------------------- |
| id                        | BIGINT        | PK                             |                                                   |
| hop_dong_id               | BIGINT        | FK → hop_dong.id, NN           | Giữ nguyên hợp đồng (Q-12)                        |
| phong_cu_id               | BIGINT        | FK → phong.id, NN              |                                                   |
| phong_moi_id              | BIGINT        | FK → phong.id, NN              |                                                   |
| ngay_chuyen               | DATE          | NN                             |                                                   |
| gia_thue_cu               | DECIMAL(15,0) | NN                             |                                                   |
| gia_thue_moi              | DECIMAL(15,0) | NN                             |                                                   |
| chi_so_dien_cuoi_phong_cu | INT           | NN                             |                                                   |
| chi_so_dien_dau_phong_moi | INT           | NN                             |                                                   |
| tien_dien_phong_cu        | DECIMAL(15,0) | NN                             | Tính tới ngày chuyển                              |
| khoan_dieu_chinh_id       | BIGINT        | FK → khoan_dieu_chinh.id, NULL | Điều chỉnh tiền phòng theo ngày cho phiếu kế tiếp |
| thuc_hien_boi             | BIGINT        | FK → tai_khoan.id, NN          |                                                   |
| ghi_chu                   | VARCHAR(255)  | NULL                           |                                                   |

| id  | hop_dong_id | phong_cu_id | phong_moi_id | ngay_chuyen | gia_thue_cu | gia_thue_moi | chi_so_dien_cuoi_phong_cu | chi_so_dien_dau_phong_moi | tien_dien_phong_cu | khoan_dieu_chinh_id | thuc_hien_boi | ghi_chu                          |
| --- | ----------- | ----------- | ------------ | ----------- | ----------- | ------------ | ------------------------- | ------------------------- | ------------------ | ------------------- | ------------- | -------------------------------- |
| 1   | 3           | 6           | 5            | 2026-03-01  | 2200000     | 2800000      | 800                       | 3000                      | 105000             | NULL                | 1             | Khách xin đổi sang phòng lớn hơn |

---

# NHÓM E — ĐIỆN

## 22. `chi_so_dien`

| Cột                | Kiểu         | Ràng buộc                  | Mô tả                                               |
| ------------------ | ------------ | -------------------------- | --------------------------------------------------- |
| id                 | BIGINT       | PK                         |                                                     |
| phong_id           | BIGINT       | FK → phong.id, NN          | UQ(phong_id, ky)                                    |
| hop_dong_id        | BIGINT       | FK → hop_dong.id, NN       | Hợp đồng hiệu lực lúc ghi                           |
| ky                 | DATE         | NN                         | Mùng 1 của tháng ghi chỉ số                         |
| ngay_ghi           | DATE         | NN                         |                                                     |
| chi_so             | INT          | NN                         | ≥ chỉ số kỳ trước (trừ thay công tơ)                |
| chi_so_ocr         | INT          | NULL                       | Giá trị OCR đọc được                                |
| do_tin_cay_ocr     | DECIMAL(4,2) | NULL                       | 0–1                                                 |
| da_sua_tay         | BOOLEAN      | NN                         | Khách sửa tay khi OCR sai (Q-09)                    |
| nguon              | ENUM         | NN                         | DAU_HOP_DONG, KHACH_GUI, CHU_TRO_NHAP, CHUYEN_PHONG |
| trang_thai         | ENUM         | NN                         | CHO_XAC_NHAN, DA_XAC_NHAN (SM-03)                   |
| tep_anh_id         | BIGINT       | FK → tep_dinh_kem.id, NULL | Ảnh công tơ                                         |
| nguoi_gui_id       | BIGINT       | FK → tai_khoan.id, NULL    |                                                     |
| thoi_gian_gui      | DATETIME     | NULL                       |                                                     |
| nguoi_xac_nhan_id  | BIGINT       | FK → tai_khoan.id, NULL    |                                                     |
| thoi_gian_xac_nhan | DATETIME     | NULL                       |                                                     |
| ghi_chu            | VARCHAR(255) | NULL                       |                                                     |

| id  | phong_id | hop_dong_id | ky         | ngay_ghi   | chi_so | chi_so_ocr | do_tin_cay_ocr | da_sua_tay | nguon        | trang_thai   | tep_anh_id | nguoi_gui_id | thoi_gian_gui       | nguoi_xac_nhan_id | thoi_gian_xac_nhan  | ghi_chu                                    |
| --- | -------- | ----------- | ---------- | ---------- | ------ | ---------- | -------------- | ---------- | ------------ | ------------ | ---------- | ------------ | ------------------- | ----------------- | ------------------- | ------------------------------------------ |
| 1   | 1        | 1           | 2026-01-01 | 2026-01-01 | 1000   | NULL       | NULL           | false      | DAU_HOP_DONG | DA_XAC_NHAN  | NULL       | 1            | 2026-01-01 10:10:00 | 1                 | 2026-01-01 10:10:00 | Chốt cùng khách                            |
| 2   | 1        | 1           | 2026-08-01 | 2026-08-01 | 1150   | 1150       | 0.96           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 2            | 2026-08-01 07:30:00 | 1                 | 2026-08-01 08:10:00 | NULL                                       |
| 3   | 1        | 1           | 2026-09-01 | 2026-09-01 | 1180   | 1180       | 0.95           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 2            | 2026-09-01 07:25:00 | 1                 | 2026-09-01 08:00:00 | NULL                                       |
| 4   | 1        | 1           | 2026-10-01 | 2026-10-01 | 1215   | 1215       | 0.97           | false      | KHACH_GUI    | DA_XAC_NHAN  | 1          | 2            | 2026-10-01 07:42:10 | 1                 | 2026-10-01 08:05:00 | NULL                                       |
| 5   | 4        | 2           | 2026-03-01 | 2026-03-15 | 1500   | NULL       | NULL           | false      | DAU_HOP_DONG | DA_XAC_NHAN  | NULL       | 1            | 2026-03-15 11:00:00 | 1                 | 2026-03-15 11:00:00 | Chốt cùng khách                            |
| 6   | 4        | 2           | 2026-08-01 | 2026-08-01 | 2000   | 2000       | 0.94           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 3            | 2026-08-01 08:00:00 | 1                 | 2026-08-01 09:00:00 | NULL                                       |
| 7   | 4        | 2           | 2026-09-01 | 2026-09-01 | 2050   | 2050       | 0.93           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 3            | 2026-09-01 08:20:00 | 1                 | 2026-09-01 09:10:00 | NULL                                       |
| 8   | 4        | 2           | 2026-10-01 | 2026-10-01 | 2092   | 2029       | 0.62           | true       | KHACH_GUI    | CHO_XAC_NHAN | 2          | 3            | 2026-10-01 09:15:44 | NULL              | NULL                | Khách sửa tay, tô nổi cho Chủ trọ kiểm tra |
| 9   | 7        | 4           | 2026-06-01 | 2026-06-01 | 500    | NULL       | NULL           | false      | DAU_HOP_DONG | DA_XAC_NHAN  | NULL       | 1            | 2026-06-01 09:00:00 | 1                 | 2026-06-01 09:00:00 | NULL                                       |
| 10  | 7        | 4           | 2026-08-01 | 2026-08-01 | 590    | 590        | 0.95           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 5            | 2026-08-01 18:00:00 | 1                 | 2026-08-02 08:00:00 | NULL                                       |
| 11  | 7        | 4           | 2026-09-01 | 2026-09-01 | 640    | 640        | 0.96           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 5            | 2026-09-01 18:10:00 | 1                 | 2026-09-02 08:00:00 | NULL                                       |
| 12  | 5        | 3           | 2026-08-01 | 2026-08-01 | 3270   | 3270       | 0.92           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 4            | 2026-08-01 19:00:00 | 1                 | 2026-08-02 08:00:00 | NULL                                       |
| 13  | 5        | 3           | 2026-09-01 | 2026-09-01 | 3320   | 3320       | 0.94           | false      | KHACH_GUI    | DA_XAC_NHAN  | NULL       | 4            | 2026-09-01 19:05:00 | 1                 | 2026-09-02 08:00:00 | NULL                                       |
| 14  | 5        | 3           | 2026-03-01 | 2026-03-01 | 3000   | NULL       | NULL           | false      | CHUYEN_PHONG | DA_XAC_NHAN  | NULL       | 1            | 2026-03-01 08:00:00 | 1                 | 2026-03-01 08:00:00 | Chỉ số đầu phòng mới khi chuyển            |

## 23. `lich_su_chi_so_dien`

| Cột            | Kiểu     | Ràng buộc               | Mô tả                                                                  |
| -------------- | -------- | ----------------------- | ---------------------------------------------------------------------- |
| id             | BIGINT   | PK                      |                                                                        |
| chi_so_dien_id | BIGINT   | FK → chi_so_dien.id, NN |                                                                        |
| chi_so_cu      | INT      | NULL                    |                                                                        |
| chi_so_moi     | INT      | NN                      |                                                                        |
| trang_thai_cu  | ENUM     | NULL                    |                                                                        |
| trang_thai_moi | ENUM     | NN                      |                                                                        |
| ly_do          | ENUM     | NN                      | KHACH_GUI, KHACH_GUI_LAI, KHACH_SUA_TAY, CHU_TRO_SUA, CHU_TRO_XAC_NHAN |
| thuc_hien_boi  | BIGINT   | FK → tai_khoan.id, NN   |                                                                        |
| thoi_gian      | DATETIME | NN                      |                                                                        |

| id  | chi_so_dien_id | chi_so_cu | chi_so_moi | trang_thai_cu | trang_thai_moi | ly_do            | thuc_hien_boi | thoi_gian           |
| --- | -------------- | --------- | ---------- | ------------- | -------------- | ---------------- | ------------- | ------------------- |
| 1   | 8              | NULL      | 2029       | NULL          | CHO_XAC_NHAN   | KHACH_GUI        | 3             | 2026-10-01 09:15:44 |
| 2   | 8              | 2029      | 2092       | CHO_XAC_NHAN  | CHO_XAC_NHAN   | KHACH_SUA_TAY    | 3             | 2026-10-01 09:16:30 |
| 3   | 4              | 1215      | 1215       | CHO_XAC_NHAN  | DA_XAC_NHAN    | CHU_TRO_XAC_NHAN | 1             | 2026-10-01 08:05:00 |

## 24. `thay_cong_to`

| Cột                    | Kiểu         | Ràng buộc                 | Mô tả               |
| ---------------------- | ------------ | ------------------------- | ------------------- |
| id                     | BIGINT       | PK                        |                     |
| phong_id               | BIGINT       | FK → phong.id, NN         |                     |
| chi_so_cuoi_cong_to_cu | INT          | NN                        |                     |
| chi_so_dau_cong_to_moi | INT          | NN                        |                     |
| ngay_thay              | DATE         | NN                        |                     |
| chi_so_dien_id         | BIGINT       | FK → chi_so_dien.id, NULL | Chỉ số kỳ liên quan |
| ghi_nhan_boi           | BIGINT       | FK → tai_khoan.id, NN     | Chỉ Chủ trọ         |
| ghi_chu                | VARCHAR(255) | NULL                      |                     |

| id  | phong_id | chi_so_cuoi_cong_to_cu | chi_so_dau_cong_to_moi | ngay_thay  | chi_so_dien_id | ghi_nhan_boi | ghi_chu                |
| --- | -------- | ---------------------- | ---------------------- | ---------- | -------------- | ------------ | ---------------------- |
| 1   | 6        | 1250                   | 0                      | 2026-02-10 | NULL           | 1            | Công tơ hỏng, thay mới |

## 25. `ocr_yeu_cau`

| Cột                   | Kiểu         | Ràng buộc                 | Mô tả                                        |
| --------------------- | ------------ | ------------------------- | -------------------------------------------- |
| id                    | BIGINT       | PK                        |                                              |
| tep_anh_id            | BIGINT       | FK → tep_dinh_kem.id, NN  |                                              |
| chi_so_dien_id        | BIGINT       | FK → chi_so_dien.id, NULL | NULL nếu khách chưa xác nhận                 |
| nha_cung_cap          | VARCHAR(30)  | NN                        | Vd. MOCK (NFR-022)                           |
| chi_so_nhan_dang      | INT          | NULL                      |                                              |
| do_tin_cay            | DECIMAL(4,2) | NULL                      |                                              |
| trang_thai            | ENUM         | NN                        | THANH_CONG, KHONG_DOC_DUOC, TIMEOUT, ANH_LOI |
| thoi_gian_phan_hoi_ms | INT          | NULL                      | Timeout > 30000                              |
| so_lan_thu            | INT          | NN                        | Retry ≤ 1                                    |
| thoi_gian             | DATETIME     | NN                        |                                              |

| id  | tep_anh_id | chi_so_dien_id | nha_cung_cap | chi_so_nhan_dang | do_tin_cay | trang_thai | thoi_gian_phan_hoi_ms | so_lan_thu | thoi_gian           |
| --- | ---------- | -------------- | ------------ | ---------------- | ---------- | ---------- | --------------------- | ---------- | ------------------- |
| 1   | 1          | 4              | MOCK         | 1215             | 0.97       | THANH_CONG | 2300                  | 1          | 2026-10-01 07:42:12 |
| 2   | 2          | 8              | MOCK         | 2029             | 0.62       | THANH_CONG | 3100                  | 1          | 2026-10-01 09:15:48 |
| 3   | 10         | NULL           | MOCK         | NULL             | NULL       | TIMEOUT    | 30000                 | 2          | 2026-10-01 09:10:35 |

---

# NHÓM F — THU TIỀN, THANH TOÁN, CÔNG NỢ

## 26. `khoan_dieu_chinh`

| Cột           | Kiểu          | Ràng buộc            | Mô tả                    |
| ------------- | ------------- | -------------------- | ------------------------ |
| id            | BIGINT        | PK                   |                          |
| hop_dong_id   | BIGINT        | FK → hop_dong.id, NN |                          |
| phong_id      | BIGINT        | FK → phong.id, NN    |                          |
| loai          | ENUM          | NN                   | PHI_PHAT_SINH, GIAM_TRU  |
| ten_ly_do     | VARCHAR(200)  | NN                   |                          |
| so_tien       | DECIMAL(15,0) | NN                   | > 0                      |
| che_do        | ENUM          | NN                   | CO_DINH, THEO_KY (BR-42) |
| ky_ap_dung    | DATE          | NULL                 | Khi THEO_KY              |
| ngay_bat_dau  | DATE          | NULL                 | Khi CO_DINH              |
| ngay_ket_thuc | DATE          | NULL                 | Khi tắt/hết hợp đồng     |
| trang_thai    | ENUM          | NN                   | DANG_AP_DUNG, DA_TAT     |
| ly_do_tat     | VARCHAR(255)  | NULL                 |                          |

| id  | hop_dong_id | phong_id | loai          | ten_ly_do                             | so_tien | che_do  | ky_ap_dung | ngay_bat_dau | ngay_ket_thuc | trang_thai   | ly_do_tat    |
| --- | ----------- | -------- | ------------- | ------------------------------------- | ------- | ------- | ---------- | ------------ | ------------- | ------------ | ------------ |
| 1   | 1           | 1        | PHI_PHAT_SINH | Phí gửi xe máy                        | 50000   | CO_DINH | NULL       | 2026-10-01   | NULL          | DANG_AP_DUNG | NULL         |
| 2   | 4           | 7        | GIAM_TRU      | Giảm tiền phòng cho Người quản lý căn | 300000  | CO_DINH | NULL       | 2026-06-01   | NULL          | DANG_AP_DUNG | NULL         |
| 3   | 2           | 4        | PHI_PHAT_SINH | Phí vệ sinh phát sinh                 | 100000  | THEO_KY | 2026-11-01 | NULL         | NULL          | DANG_AP_DUNG | NULL         |
| 4   | 5           | 2        | PHI_PHAT_SINH | Phí giữ xe ô tô                       | 200000  | CO_DINH | NULL       | 2025-06-01   | 2026-03-01    | DA_TAT       | Khách bán xe |

## 27. `khoan_phai_thu` — theo phòng/kỳ (BR-03)

Công thức: `tong_phai_thu = tien_phong + tien_dien + tien_nuoc + phi_dich_vu + tong_phi_phat_sinh − tong_giam_tru` (không âm). Điện của kỳ T là điện tháng T−1.

| Cột                  | Kiểu          | Ràng buộc                 | Mô tả                              |
| -------------------- | ------------- | ------------------------- | ---------------------------------- |
| id                   | BIGINT        | PK                        |                                    |
| phong_id             | BIGINT        | FK → phong.id, NN         | UQ(phong_id, ky)                   |
| hop_dong_id          | BIGINT        | FK → hop_dong.id, NN      |                                    |
| ky                   | DATE          | NN                        | Mùng 1 tháng lập phiếu             |
| loai_ky              | ENUM          | NN                        | THUONG, LE_DAU, LE_CUOI (BR-38)    |
| chi_so_dien_cu_id    | BIGINT        | FK → chi_so_dien.id, NULL | Chỉ số 01/T−1; NULL ở kỳ lẻ đầu    |
| chi_so_dien_moi_id   | BIGINT        | FK → chi_so_dien.id, NULL | Chỉ số 01/T                        |
| luong_dien           | INT           | NN                        |                                    |
| don_gia_dien_ap_dung | DECIMAL(10,0) | NN                        | Chụp từ hợp đồng hiệu lực (BR-11)  |
| tien_phong           | DECIMAL(15,0) | NN                        | Trả trước tháng T                  |
| tien_dien            | DECIMAL(15,0) | NN                        |                                    |
| so_nguoi_o           | INT           | NN                        | Tại ngày lập phiếu                 |
| don_gia_nuoc_ap_dung | DECIMAL(10,0) | NN                        |                                    |
| tien_nuoc            | DECIMAL(15,0) | NN                        | = đơn giá × số người               |
| phi_dich_vu          | DECIMAL(15,0) | NN                        |                                    |
| tong_phi_phat_sinh   | DECIMAL(15,0) | NN                        |                                    |
| tong_giam_tru        | DECIMAL(15,0) | NN                        |                                    |
| tong_truoc_giam_tru  | DECIMAL(15,0) | NN                        | Dùng cho BR-44                     |
| tong_phai_thu        | DECIMAL(15,0) | NN                        |                                    |
| ngay_han_thanh_toan  | DATE          | NN                        | Ngày 05 (cấu hình)                 |
| bi_khoa_so_tien      | BOOLEAN       | NN                        | true khi có ≥ 1 thanh toán (BR-47) |

| id  | phong_id | hop_dong_id | ky         | loai_ky | chi_so_dien_cu_id | chi_so_dien_moi_id | luong_dien | don_gia_dien_ap_dung | tien_phong | tien_dien | so_nguoi_o | don_gia_nuoc_ap_dung | tien_nuoc | phi_dich_vu | tong_phi_phat_sinh | tong_giam_tru | tong_truoc_giam_tru | tong_phai_thu | ngay_han_thanh_toan | bi_khoa_so_tien |
| --- | -------- | ----------- | ---------- | ------- | ----------------- | ------------------ | ---------- | -------------------- | ---------- | --------- | ---------- | -------------------- | --------- | ----------- | ------------------ | ------------- | ------------------- | ------------- | ------------------- | --------------- |
| 1   | 1        | 1           | 2026-10-01 | THUONG  | 3                 | 4                  | 35         | 3500                 | 2500000    | 122500    | 2          | 100000               | 200000    | 150000      | 50000              | 0             | 3022500             | 3022500       | 2026-10-05          | true            |
| 2   | 4        | 2           | 2026-09-01 | THUONG  | 6                 | 7                  | 50         | 3800                 | 3000000    | 190000    | 2          | 100000               | 200000    | 150000      | 0                  | 0             | 3540000             | 3540000       | 2026-09-05          | true            |
| 3   | 7        | 4           | 2026-09-01 | THUONG  | 10                | 11                 | 50         | 3500                 | 2200000    | 175000    | 1          | 100000               | 100000    | 150000      | 0                  | 300000        | 2625000             | 2325000       | 2026-09-05          | true            |
| 4   | 5        | 3           | 2026-09-01 | THUONG  | 12                | 13                 | 50         | 3500                 | 2800000    | 175000    | 1          | 100000               | 100000    | 150000      | 0                  | 0             | 3225000             | 3225000       | 2026-09-05          | false           |
| 5   | 1        | 1           | 2026-09-01 | THUONG  | 2                 | 3                  | 30         | 3500                 | 2500000    | 105000    | 2          | 100000               | 200000    | 150000      | 0                  | 0             | 2955000             | 2955000       | 2026-09-05          | true            |

## 28. `khoan_phai_thu_dieu_chinh`

| Cột                 | Kiểu          | Ràng buộc                    | Mô tả                                                    |
| ------------------- | ------------- | ---------------------------- | -------------------------------------------------------- |
| id                  | BIGINT        | PK                           |                                                          |
| khoan_phai_thu_id   | BIGINT        | FK → khoan_phai_thu.id, NN   |                                                          |
| khoan_dieu_chinh_id | BIGINT        | FK → khoan_dieu_chinh.id, NN | UQ(khoan_phai_thu_id, khoan_dieu_chinh_id)               |
| loai                | ENUM          | NN                           | PHI_PHAT_SINH, GIAM_TRU (chụp lại)                       |
| so_tien_ap_dung     | DECIMAL(15,0) | NN                           | Giá trị tại thời điểm lập (không đổi sau khi thanh toán) |

| id  | khoan_phai_thu_id | khoan_dieu_chinh_id | loai          | so_tien_ap_dung |
| --- | ----------------- | ------------------- | ------------- | --------------- |
| 1   | 1                 | 1                   | PHI_PHAT_SINH | 50000           |
| 2   | 3                 | 2                   | GIAM_TRU      | 300000          |

## 29. `phieu_thu`

| Cột               | Kiểu        | Ràng buộc                  | Mô tả                                          |
| ----------------- | ----------- | -------------------------- | ---------------------------------------------- |
| id                | BIGINT      | PK                         |                                                |
| khoan_phai_thu_id | BIGINT      | FK → khoan_phai_thu.id, NN |                                                |
| ma_phieu          | VARCHAR(30) | NN, UQ                     |                                                |
| phong_id          | BIGINT      | FK → phong.id, NN          | UQ(phong_id, ky) WHERE hieu_luc = true (BR-26) |
| ky                | DATE        | NN                         |                                                |
| trang_thai        | ENUM        | NN                         | DA_LAP, DA_GUI (SM-07)                         |
| kieu_tao          | ENUM        | NN                         | TU_DONG, THU_CONG                              |
| hieu_luc          | BOOLEAN     | NN                         | Phiếu hợp lệ của phòng/kỳ                      |
| thoi_gian_lap     | DATETIME    | NN                         |                                                |
| thoi_gian_gui     | DATETIME    | NULL                       | Chỉ gửi sau khi lưu thành công (BR-29)         |

| id  | khoan_phai_thu_id | ma_phieu       | phong_id | ky         | trang_thai | kieu_tao | hieu_luc | thoi_gian_lap       | thoi_gian_gui       |
| --- | ----------------- | -------------- | -------- | ---------- | ---------- | -------- | -------- | ------------------- | ------------------- |
| 1   | 1                 | PT-202610-P101 | 1        | 2026-10-01 | DA_GUI     | TU_DONG  | true     | 2026-10-02 08:00:05 | 2026-10-02 08:00:07 |
| 2   | 2                 | PT-202609-P201 | 4        | 2026-09-01 | DA_GUI     | TU_DONG  | true     | 2026-09-02 08:00:03 | 2026-09-02 08:00:05 |
| 3   | 3                 | PT-202609-P302 | 7        | 2026-09-01 | DA_GUI     | TU_DONG  | true     | 2026-09-02 08:00:06 | 2026-09-02 08:00:08 |
| 4   | 4                 | PT-202609-P202 | 5        | 2026-09-01 | DA_GUI     | THU_CONG | true     | 2026-09-03 10:20:00 | 2026-09-03 10:20:02 |
| 5   | 5                 | PT-202609-P101 | 1        | 2026-09-01 | DA_GUI     | TU_DONG  | true     | 2026-09-02 08:00:01 | 2026-09-02 08:00:03 |

## 30. `phieu_thu_ghi_chu`

| Cột          | Kiểu         | Ràng buộc             | Mô tả |
| ------------ | ------------ | --------------------- | ----- |
| id           | BIGINT       | PK                    |       |
| phieu_thu_id | BIGINT       | FK → phieu_thu.id, NN |       |
| noi_dung     | VARCHAR(500) | NN                    |       |
| tao_boi      | BIGINT       | FK → tai_khoan.id, NN |       |
| thoi_gian    | DATETIME     | NN                    |       |

| id  | phieu_thu_id | noi_dung                                                                       | tao_boi | thoi_gian           |
| --- | ------------ | ------------------------------------------------------------------------------ | ------- | ------------------- |
| 1   | 1            | Khách báo đã chuyển 1.500.000 ngày 03/10, sẽ chuyển phần còn lại trước ngày 05 | 1       | 2026-10-04 08:10:00 |
| 2   | 2            | Khách xin trễ 3 ngày (thỏa thuận ngoài hệ thống)                               | 1       | 2026-09-05 20:00:00 |

## 31. `tinh_trang_thanh_toan` — 1–1 với khoản phải thu

| Cột                | Kiểu          | Ràng buộc                  | Mô tả                                                       |
| ------------------ | ------------- | -------------------------- | ----------------------------------------------------------- |
| khoan_phai_thu_id  | BIGINT        | PK, FK → khoan_phai_thu.id |                                                             |
| tong_phai_thu      | DECIMAL(15,0) | NN                         | Bản chụp                                                    |
| tong_da_thanh_toan | DECIMAL(15,0) | NN                         | Tổng bản ghi _Hiệu lực_ (BR-34)                             |
| con_no             | DECIMAL(15,0) | NN                         | = tổng phải thu − đã thanh toán (≥ 0, BR-46)                |
| trang_thai         | ENUM          | NN                         | CHUA_THANH_TOAN, THANH_TOAN_MOT_PHAN, DA_THANH_TOAN (SM-04) |
| la_qua_han         | BOOLEAN       | NN                         | Từ ngày 06 khi còn nợ                                       |
| da_ghi_cong_no     | BOOLEAN       | NN                         | Hết ngày 10                                                 |
| ngay_ghi_cong_no   | DATE          | NULL                       |                                                             |
| cap_nhat_luc       | DATETIME      | NN                         |                                                             |

| khoan_phai_thu_id | tong_phai_thu | tong_da_thanh_toan | con_no  | trang_thai          | la_qua_han | da_ghi_cong_no | ngay_ghi_cong_no | cap_nhat_luc        |
| ----------------- | ------------- | ------------------ | ------- | ------------------- | ---------- | -------------- | ---------------- | ------------------- |
| 1                 | 3022500       | 1500000            | 1522500 | THANH_TOAN_MOT_PHAN | false      | false          | NULL             | 2026-10-03 20:30:00 |
| 2                 | 3540000       | 2000000            | 1540000 | THANH_TOAN_MOT_PHAN | true       | true           | 2026-09-10       | 2026-09-10 23:59:30 |
| 3                 | 2325000       | 2325000            | 0       | DA_THANH_TOAN       | false      | false          | NULL             | 2026-09-04 19:45:00 |
| 4                 | 3225000       | 0                  | 3225000 | CHUA_THANH_TOAN     | true       | true           | 2026-09-10       | 2026-09-10 23:59:31 |
| 5                 | 2955000       | 2955000            | 0       | DA_THANH_TOAN       | false      | false          | NULL             | 2026-09-02 12:00:00 |

## 32. `thanh_toan` — từng lần thanh toán

| Cột               | Kiểu          | Ràng buộc                  | Mô tả                                            |
| ----------------- | ------------- | -------------------------- | ------------------------------------------------ |
| id                | BIGINT        | PK                         |                                                  |
| khoan_phai_thu_id | BIGINT        | FK → khoan_phai_thu.id, NN | Thu nợ cũ cũng ghi vào phiếu kỳ gốc (UC-11)      |
| cong_no_id        | BIGINT        | FK → cong_no.id, NULL      | Khi thanh toán là thu nợ                         |
| ngay_thanh_toan   | DATE          | NN                         | Ngày thu → dùng cho báo cáo (BR-44)              |
| so_tien           | DECIMAL(15,0) | NN                         | > 0, không vượt còn lại (BR-46)                  |
| hinh_thuc         | ENUM          | NN                         | CHUYEN_KHOAN, TIEN_MAT, DANH_DAU_DA_DONG, THU_NO |
| trang_thai        | ENUM          | NN                         | HIEU_LUC, DA_HUY                                 |
| ghi_nhan_boi      | BIGINT        | FK → tai_khoan.id, NN      |                                                  |
| ghi_nhan_luc      | DATETIME      | NN                         |                                                  |
| huy_boi           | BIGINT        | FK → tai_khoan.id, NULL    |                                                  |
| huy_luc           | DATETIME      | NULL                       |                                                  |
| ly_do_huy         | VARCHAR(255)  | NULL                       | Bắt buộc khi hủy (không xóa)                     |
| ghi_chu           | VARCHAR(255)  | NULL                       |                                                  |

| id  | khoan_phai_thu_id | cong_no_id | ngay_thanh_toan | so_tien | hinh_thuc    | trang_thai | ghi_nhan_boi | ghi_nhan_luc        | huy_boi | huy_luc             | ly_do_huy      | ghi_chu             |
| --- | ----------------- | ---------- | --------------- | ------- | ------------ | ---------- | ------------ | ------------------- | ------- | ------------------- | -------------- | ------------------- |
| 1   | 5                 | NULL       | 2026-09-02      | 2955000 | CHUYEN_KHOAN | HIEU_LUC   | 1            | 2026-09-02 12:00:00 | NULL    | NULL                | NULL           | NULL                |
| 2   | 3                 | NULL       | 2026-09-04      | 2325000 | CHUYEN_KHOAN | HIEU_LUC   | 1            | 2026-09-04 19:45:00 | NULL    | NULL                | NULL           | NULL                |
| 3   | 2                 | NULL       | 2026-09-05      | 2000000 | CHUYEN_KHOAN | HIEU_LUC   | 1            | 2026-09-05 21:00:00 | NULL    | NULL                | NULL           | Thanh toán một phần |
| 4   | 1                 | NULL       | 2026-10-03      | 1500000 | CHUYEN_KHOAN | HIEU_LUC   | 1            | 2026-10-03 20:30:00 | NULL    | NULL                | NULL           | NULL                |
| 5   | 4                 | NULL       | 2026-09-08      | 500000  | CHUYEN_KHOAN | DA_HUY     | 1            | 2026-09-08 09:00:00 | 1       | 2026-09-08 09:30:00 | Ghi nhầm phòng | NULL                |

## 33. `minh_chung_thanh_toan`

| Cột               | Kiểu         | Ràng buộc                  | Mô tả                                                |
| ----------------- | ------------ | -------------------------- | ---------------------------------------------------- |
| id                | BIGINT       | PK                         |                                                      |
| khoan_phai_thu_id | BIGINT       | FK → khoan_phai_thu.id, NN |                                                      |
| tep_anh_id        | BIGINT       | FK → tep_dinh_kem.id, NN   |                                                      |
| thanh_toan_id     | BIGINT       | FK → thanh_toan.id, NULL   | Bản ghi dùng để đối chiếu                            |
| ghi_chu_khach     | VARCHAR(255) | NULL                       |                                                      |
| trang_thai        | ENUM         | NN                         | CHO_XAC_NHAN, DA_DOI_CHIEU (SM-09; không có từ chối) |
| tai_len_boi       | BIGINT       | FK → tai_khoan.id, NN      |                                                      |
| tai_len_luc       | DATETIME     | NN                         |                                                      |
| doi_chieu_luc     | DATETIME     | NULL                       |                                                      |

| id  | khoan_phai_thu_id | tep_anh_id | thanh_toan_id | ghi_chu_khach     | trang_thai   | tai_len_boi | tai_len_luc         | doi_chieu_luc       |
| --- | ----------------- | ---------- | ------------- | ----------------- | ------------ | ----------- | ------------------- | ------------------- |
| 1   | 1                 | 3          | 4             | Chuyển đợt 1      | DA_DOI_CHIEU | 2           | 2026-10-03 20:11:02 | 2026-10-03 20:30:00 |
| 2   | 2                 | 4          | 3             | Chuyển một phần   | DA_DOI_CHIEU | 3           | 2026-09-05 18:20:31 | 2026-09-05 21:00:00 |
| 3   | 1                 | 9          | NULL          | Chuyển thêm đợt 2 | CHO_XAC_NHAN | 2           | 2026-10-04 09:30:15 | NULL                |

## 34. `cong_no`

| Cột               | Kiểu          | Ràng buộc                          | Mô tả                                             |
| ----------------- | ------------- | ---------------------------------- | ------------------------------------------------- |
| id                | BIGINT        | PK                                 |                                                   |
| loai              | ENUM          | NN                                 | KY_GOC, SAU_THANH_LY                              |
| khoan_phai_thu_id | BIGINT        | FK → khoan_phai_thu.id, NULL       | Có khi KY_GOC                                     |
| quyet_toan_id     | BIGINT        | FK → quyet_toan_tra_phong.id, NULL | Có khi SAU_THANH_LY                               |
| khach_thue_id     | BIGINT        | FK → khach_thue.id, NN             |                                                   |
| phong_id          | BIGINT        | FK → phong.id, NN                  |                                                   |
| hop_dong_id       | BIGINT        | FK → hop_dong.id, NN               |                                                   |
| ky_goc            | DATE          | NN                                 |                                                   |
| so_tien_ghi_no    | DECIMAL(15,0) | NN                                 | Ghi hết ngày 10 (BR-19); chạy lại không ghi trùng |
| so_tien_da_thu    | DECIMAL(15,0) | NN                                 |                                                   |
| so_tien_con_no    | DECIMAL(15,0) | NN                                 |                                                   |
| ngay_ghi_no       | DATE          | NN                                 |                                                   |
| trang_thai        | ENUM          | NN                                 | CON_NO, DA_THU_DU                                 |

| id  | loai         | khoan_phai_thu_id | quyet_toan_id | khach_thue_id | phong_id | hop_dong_id | ky_goc     | so_tien_ghi_no | so_tien_da_thu | so_tien_con_no | ngay_ghi_no | trang_thai |
| --- | ------------ | ----------------- | ------------- | ------------- | -------- | ----------- | ---------- | -------------- | -------------- | -------------- | ----------- | ---------- |
| 1   | KY_GOC       | 2                 | NULL          | 2             | 4        | 2           | 2026-09-01 | 1540000        | 0              | 1540000        | 2026-09-10  | CON_NO     |
| 2   | KY_GOC       | 4                 | NULL          | 3             | 5        | 3           | 2026-09-01 | 3225000        | 0              | 3225000        | 2026-09-10  | CON_NO     |
| 3   | SAU_THANH_LY | NULL              | 3             | 6             | 2        | 6           | 2026-08-01 | 710000         | 0              | 710000         | 2026-08-31  | CON_NO     |

## 35. `nhac_no`

| Cột               | Kiểu     | Ràng buộc                  | Mô tả                                          |
| ----------------- | -------- | -------------------------- | ---------------------------------------------- |
| id                | BIGINT   | PK                         |                                                |
| khoan_phai_thu_id | BIGINT   | FK → khoan_phai_thu.id, NN |                                                |
| cong_no_id        | BIGINT   | FK → cong_no.id, NULL      |                                                |
| khach_thue_id     | BIGINT   | FK → khach_thue.id, NN     |                                                |
| loai              | ENUM     | NN                         | TU_DONG_NGAY_05, TU_DONG_GHI_CONG_NO, THU_CONG |
| thong_bao_id      | BIGINT   | FK → thong_bao.id, NULL    |                                                |
| gui_boi           | BIGINT   | FK → tai_khoan.id, NULL    | NULL = hệ thống                                |
| thoi_gian         | DATETIME | NN                         |                                                |

| id  | khoan_phai_thu_id | cong_no_id | khach_thue_id | loai                | thong_bao_id | gui_boi | thoi_gian           |
| --- | ----------------- | ---------- | ------------- | ------------------- | ------------ | ------- | ------------------- |
| 1   | 2                 | NULL       | 2             | TU_DONG_NGAY_05     | 3            | NULL    | 2026-09-05 08:00:00 |
| 2   | 4                 | 2          | 3             | TU_DONG_GHI_CONG_NO | 4            | NULL    | 2026-09-10 23:59:40 |

## 36. `phan_bo_doanh_thu` — BR-44

Mỗi lần thu `p`, khoản có `G` = tổng trước giảm trừ, `D` = giảm trừ, `N = G − D`: `doanh_thu += p × G/N`, `giam_tru += p × D/N`.

| Cột                      | Kiểu          | Ràng buộc                  | Mô tả                    |
| ------------------------ | ------------- | -------------------------- | ------------------------ |
| id                       | BIGINT        | PK                         |                          |
| thanh_toan_id            | BIGINT        | FK → thanh_toan.id, NN, UQ |                          |
| khoan_phai_thu_id        | BIGINT        | FK → khoan_phai_thu.id, NN |                          |
| can_tro_id               | BIGINT        | FK → can_tro.id, NN        | Phục vụ báo cáo theo căn |
| ngay_thu                 | DATE          | NN                         |                          |
| so_tien_thu              | DECIMAL(15,0) | NN                         |                          |
| doanh_thu_truoc_giam_tru | DECIMAL(15,0) | NN                         |                          |
| giam_tru                 | DECIMAL(15,0) | NN                         |                          |

| id  | thanh_toan_id | khoan_phai_thu_id | can_tro_id | ngay_thu   | so_tien_thu | doanh_thu_truoc_giam_tru | giam_tru |
| --- | ------------- | ----------------- | ---------- | ---------- | ----------- | ------------------------ | -------- |
| 1   | 1             | 5                 | 1          | 2026-09-02 | 2955000     | 2955000                  | 0        |
| 2   | 2             | 3                 | 3          | 2026-09-04 | 2325000     | 2625000                  | 300000   |
| 3   | 3             | 2                 | 2          | 2026-09-05 | 2000000     | 2000000                  | 0        |
| 4   | 4             | 1                 | 1          | 2026-10-03 | 1500000     | 1500000                  | 0        |

## 37. `thu_khac`

| Cột          | Kiểu          | Ràng buộc               | Mô tả                         |
| ------------ | ------------- | ----------------------- | ----------------------------- |
| id           | BIGINT        | PK                      |                               |
| can_tro_id   | BIGINT        | FK → can_tro.id, NN     |                               |
| loai         | ENUM          | NN                      | TIEN_GIU_CHO_KHONG_HOAN, KHAC |
| giu_phong_id | BIGINT        | FK → giu_phong.id, NULL |                               |
| so_tien      | DECIMAL(15,0) | NN                      | > 0                           |
| ngay_thu     | DATE          | NN                      | Ngày hủy giữ (UC-04 A3)       |
| ky           | DATE          | NN                      | Kỳ ghi nhận                   |
| ghi_chu      | VARCHAR(255)  | NULL                    |                               |

| id  | can_tro_id | loai                    | giu_phong_id | so_tien | ngay_thu   | ky         | ghi_chu               |
| --- | ---------- | ----------------------- | ------------ | ------- | ---------- | ---------- | --------------------- |
| 1   | 1          | TIEN_GIU_CHO_KHONG_HOAN | 2            | 500000  | 2026-09-25 | 2026-09-01 | Người giữ bỏ cọc P102 |

---

# NHÓM G — YÊU CẦU

## 38. `yeu_cau`

| Cột           | Kiểu         | Ràng buộc               | Mô tả                                                 |
| ------------- | ------------ | ----------------------- | ----------------------------------------------------- |
| id            | BIGINT       | PK                      |                                                       |
| loai          | ENUM         | NN                      | GIA_HAN, TRA_PHONG, DAT_LAI_MAT_KHAU                  |
| khach_thue_id | BIGINT       | FK → khach_thue.id, NN  | Mỗi khách 1 yêu cầu cùng loại đang chờ (BR-30)        |
| hop_dong_id   | BIGINT       | FK → hop_dong.id, NULL  | NULL với đặt lại mật khẩu                             |
| noi_dung      | VARCHAR(500) | NULL                    |                                                       |
| trang_thai    | ENUM         | NN                      | CHO_PHE_DUYET, DA_PHE_DUYET, TU_CHOI (SM-05)          |
| ly_do_tu_choi | VARCHAR(255) | NULL                    | Bắt buộc khi từ chối (BR-36)                          |
| ngay_gui      | DATE         | NN                      |                                                       |
| xu_ly_boi     | BIGINT       | FK → tai_khoan.id, NULL |                                                       |
| ngay_xu_ly    | DATETIME     | NULL                    |                                                       |
| phien_ban     | INT          | NN                      | Khóa lạc quan chống 2 phiên duyệt đồng thời (NFR-017) |

| id  | loai             | khach_thue_id | hop_dong_id | noi_dung                     | trang_thai    | ly_do_tu_choi                        | ngay_gui   | xu_ly_boi | ngay_xu_ly          | phien_ban |
| --- | ---------------- | ------------- | ----------- | ---------------------------- | ------------- | ------------------------------------ | ---------- | --------- | ------------------- | --------- |
| 1   | GIA_HAN          | 2             | 2           | Xin gia hạn thêm 6 tháng     | CHO_PHE_DUYET | NULL                                 | 2026-10-02 | NULL      | NULL                | 1         |
| 2   | TRA_PHONG        | 3             | 3           | Chuyển công tác              | DA_PHE_DUYET  | NULL                                 | 2026-08-25 | 1         | 2026-08-26 09:00:00 | 2         |
| 3   | DAT_LAI_MAT_KHAU | 1             | NULL        | Quên mật khẩu                | DA_PHE_DUYET  | NULL                                 | 2026-09-12 | 1         | 2026-09-12 10:05:00 | 2         |
| 4   | TRA_PHONG        | 4             | 4           | Muốn trả phòng cuối tháng 10 | TU_CHOI       | Ngày trả chưa thống nhất với Chủ trọ | 2026-09-20 | 1         | 2026-09-21 08:30:00 | 2         |
| 5   | GIA_HAN          | 3             | 3           | Gia hạn 12 tháng             | DA_PHE_DUYET  | NULL                                 | 2026-03-28 | 1         | 2026-04-01 10:00:00 | 2         |

## 39. `yeu_cau_gia_han`

| Cột                    | Kiểu   | Ràng buộc           | Mô tả                                 |
| ---------------------- | ------ | ------------------- | ------------------------------------- |
| yeu_cau_id             | BIGINT | PK, FK → yeu_cau.id |                                       |
| so_thang_goi           | INT    | NN                  | 6 hoặc 12, thuộc hop_dong_goi_gia_han |
| ngay_ket_thuc_hien_tai | DATE   | NN                  |                                       |
| ngay_ket_thuc_du_kien  | DATE   | NN                  | = hiện tại + gói                      |

| yeu_cau_id | so_thang_goi | ngay_ket_thuc_hien_tai | ngay_ket_thuc_du_kien |
| ---------- | ------------ | ---------------------- | --------------------- |
| 1          | 6            | 2026-10-31             | 2027-04-30            |
| 5          | 12           | 2026-04-30             | 2027-04-30            |

## 40. `yeu_cau_tra_phong`

| Cột                | Kiểu         | Ràng buộc           | Mô tả                   |
| ------------------ | ------------ | ------------------- | ----------------------- |
| yeu_cau_id         | BIGINT       | PK, FK → yeu_cau.id |                         |
| ngay_tra_du_kien   | DATE         | NN                  | ≥ ngày gửi + 30 (BR-45) |
| ngay_tra_toi_thieu | DATE         | NN                  | = ngày gửi + 30         |
| ly_do              | VARCHAR(255) | NULL                |                         |

| yeu_cau_id | ngay_tra_du_kien | ngay_tra_toi_thieu | ly_do            |
| ---------- | ---------------- | ------------------ | ---------------- |
| 2          | 2026-09-30       | 2026-09-24         | Chuyển công tác  |
| 4          | 2026-10-25       | 2026-10-20         | Hết nhu cầu thuê |

## 41. `yeu_cau_dat_lai_mat_khau`

| Cột                | Kiểu        | Ràng buộc             | Mô tả                               |
| ------------------ | ----------- | --------------------- | ----------------------------------- |
| yeu_cau_id         | BIGINT      | PK, FK → yeu_cau.id   |                                     |
| tai_khoan_id       | BIGINT      | FK → tai_khoan.id, NN | Chỉ tài khoản _Hoạt động_           |
| so_dien_thoai_nhap | VARCHAR(15) | NN                    |                                     |
| dia_chi_ip         | VARCHAR(45) | NN                    | Giới hạn 3 yêu cầu/giờ/SĐT (SEC-07) |
| da_dat_lai         | BOOLEAN     | NN                    | Mật khẩu về "1"                     |
| thoi_gian_dat_lai  | DATETIME    | NULL                  |                                     |

| yeu_cau_id | tai_khoan_id | so_dien_thoai_nhap | dia_chi_ip   | da_dat_lai | thoi_gian_dat_lai   |
| ---------- | ------------ | ------------------ | ------------ | ---------- | ------------------- |
| 3          | 2            | 0912345601         | 113.161.20.5 | true       | 2026-09-12 10:05:00 |

---

# NHÓM H — SỰ CỐ & CHI PHÍ

## 42. `su_co`

| Cột                     | Kiểu          | Ràng buộc                  | Mô tả                                               |
| ----------------------- | ------------- | -------------------------- | --------------------------------------------------- |
| id                      | BIGINT        | PK                         |                                                     |
| ma_su_co                | VARCHAR(20)   | NN, UQ                     |                                                     |
| vi_tri_loai             | ENUM          | NN                         | PHONG, KHU_VUC_CHUNG                                |
| can_tro_id              | BIGINT        | FK → can_tro.id, NN        |                                                     |
| phong_id                | BIGINT        | FK → phong.id, NULL        | NULL khi khu vực chung                              |
| nguoi_bao_khach_thue_id | BIGINT        | FK → khach_thue.id, NULL   | NULL khi Chủ trọ tự tạo                             |
| loai_su_co_id           | BIGINT        | FK → dm_loai_su_co.id, NN  |                                                     |
| muc_uu_tien_id          | BIGINT        | FK → dm_muc_uu_tien.id, NN |                                                     |
| noi_that_id             | BIGINT        | FK → noi_that.id, NULL     | Tài sản liên quan                                   |
| mo_ta                   | TEXT          | NN                         |                                                     |
| trang_thai              | ENUM          | NN                         | CHO_TIEP_NHAN, DANG_XU_LY, DA_XU_LY, DA_HUY (SM-06) |
| thoi_gian_bao           | DATETIME      | NN                         |                                                     |
| thoi_gian_tiep_nhan     | DATETIME      | NULL                       |                                                     |
| thoi_gian_hoan_tat      | DATETIME      | NULL                       |                                                     |
| ket_qua_xu_ly           | TEXT          | NULL                       |                                                     |
| thiet_bi_thay_the       | VARCHAR(200)  | NULL                       |                                                     |
| chi_phi                 | DECIMAL(15,0) | NULL                       | ≥ 0                                                 |
| doi_tuong_chiu_phi      | ENUM          | NULL                       | CHU_TRO (mặc định), KHACH_THUE (BR-18)              |
| ly_do_huy               | VARCHAR(255)  | NULL                       |                                                     |
| phien_ban               | INT           | NN                         | Khóa lạc quan (UC-17 E2, UC-18 E3)                  |

| id  | ma_su_co | vi_tri_loai   | can_tro_id | phong_id | nguoi_bao_khach_thue_id | loai_su_co_id | muc_uu_tien_id | noi_that_id | mo_ta                           | trang_thai    | thoi_gian_bao       | thoi_gian_tiep_nhan | thoi_gian_hoan_tat  | ket_qua_xu_ly  | thiet_bi_thay_the   | chi_phi | doi_tuong_chiu_phi | ly_do_huy             | phien_ban |
| --- | -------- | ------------- | ---------- | -------- | ----------------------- | ------------- | -------------- | ----------- | ------------------------------- | ------------- | ------------------- | ------------------- | ------------------- | -------------- | ------------------- | ------- | ------------------ | --------------------- | --------- |
| 1   | SC-0001  | PHONG         | 1          | 1        | 1                       | 1             | 2              | NULL        | Ổ cắm phòng ngủ bị cháy         | DA_XU_LY      | 2026-09-14 08:30:00 | 2026-09-14 09:00:00 | 2026-09-15 16:00:00 | Thay ổ cắm mới | Ổ cắm đôi Panasonic | 150000  | CHU_TRO            | NULL                  | 3         |
| 2   | SC-0002  | PHONG         | 2          | 4        | 2                       | 2             | 3              | NULL        | Vòi nước nhà vệ sinh rò rỉ      | DANG_XU_LY    | 2026-10-02 07:15:00 | 2026-10-02 09:00:00 | NULL                | NULL           | NULL                | NULL    | CHU_TRO            | NULL                  | 2         |
| 3   | SC-0003  | PHONG         | 2          | 5        | 3                       | 4             | 1              | 5           | Vỡ kính cửa sổ do khách va chạm | DA_XU_LY      | 2026-09-18 10:00:00 | 2026-09-18 11:00:00 | 2026-09-19 15:00:00 | Thay kính mới  | Kính cường lực 5mm  | 200000  | KHACH_THUE         | NULL                  | 3         |
| 4   | SC-0004  | KHU_VUC_CHUNG | 1          | NULL     | 1                       | 5             | 2              | NULL        | Wifi hành lang tầng 1 chập chờn | CHO_TIEP_NHAN | 2026-10-03 21:00:00 | NULL                | NULL                | NULL           | NULL                | NULL    | NULL               | NULL                  | 1         |
| 5   | SC-0005  | PHONG         | 3          | 7        | 4                       | 6             | 1              | NULL        | Có kiến trong bếp               | DA_HUY        | 2026-08-10 09:00:00 | NULL                | NULL                | NULL           | NULL                | NULL    | NULL               | Báo nhầm, đã tự xử lý | 2         |

## 43. `su_co_anh`

| Cột             | Kiểu   | Ràng buộc                | Mô tả            |
| --------------- | ------ | ------------------------ | ---------------- |
| id              | BIGINT | PK                       |                  |
| su_co_id        | BIGINT | FK → su_co.id, NN        |                  |
| tep_dinh_kem_id | BIGINT | FK → tep_dinh_kem.id, NN |                  |
| loai            | ENUM   | NN                       | BAO_CAO, KET_QUA |

| id  | su_co_id | tep_dinh_kem_id | loai    |
| --- | -------- | --------------- | ------- |
| 1   | 1        | 5               | BAO_CAO |
| 2   | 3        | 6               | BAO_CAO |
| 3   | 2        | 7               | BAO_CAO |

## 44. `su_co_lich_su_trang_thai`

| Cột            | Kiểu         | Ràng buộc             | Mô tả                           |
| -------------- | ------------ | --------------------- | ------------------------------- |
| id             | BIGINT       | PK                    |                                 |
| su_co_id       | BIGINT       | FK → su_co.id, NN     |                                 |
| trang_thai_cu  | ENUM         | NULL                  |                                 |
| trang_thai_moi | ENUM         | NN                    |                                 |
| ly_do          | VARCHAR(255) | NULL                  | Bắt buộc khi hủy/mở lại (BR-50) |
| thuc_hien_boi  | BIGINT       | FK → tai_khoan.id, NN |                                 |
| thoi_gian      | DATETIME     | NN                    |                                 |

| id  | su_co_id | trang_thai_cu | trang_thai_moi | ly_do                 | thuc_hien_boi | thoi_gian           |
| --- | -------- | ------------- | -------------- | --------------------- | ------------- | ------------------- |
| 1   | 1        | NULL          | CHO_TIEP_NHAN  | Khách gửi             | 2             | 2026-09-14 08:30:00 |
| 2   | 1        | CHO_TIEP_NHAN | DANG_XU_LY     | Tiếp nhận             | 1             | 2026-09-14 09:00:00 |
| 3   | 1        | DANG_XU_LY    | DA_XU_LY       | Hoàn tất              | 1             | 2026-09-15 16:00:00 |
| 4   | 5        | CHO_TIEP_NHAN | DA_HUY         | Báo nhầm, đã tự xử lý | 5             | 2026-08-10 09:20:00 |

## 45. `khoan_cho_khau_tru` — chi phí khách chịu (BR-48)

| Cột           | Kiểu          | Ràng buộc                          | Mô tả                                                     |
| ------------- | ------------- | ---------------------------------- | --------------------------------------------------------- |
| id            | BIGINT        | PK                                 |                                                           |
| su_co_id      | BIGINT        | FK → su_co.id, NN, UQ              |                                                           |
| hop_dong_id   | BIGINT        | FK → hop_dong.id, NN               |                                                           |
| so_tien       | DECIMAL(15,0) | NN                                 | > 0; không cộng vào phiếu thu, không vào chi phí vận hành |
| trang_thai    | ENUM          | NN                                 | CHO_KHAU_TRU, DA_KHAU_TRU, DA_HUY                         |
| quyet_toan_id | BIGINT        | FK → quyet_toan_tra_phong.id, NULL | Khi đã khấu trừ                                           |
| mo_ta         | VARCHAR(255)  | NULL                               |                                                           |

| id  | su_co_id | hop_dong_id | so_tien | trang_thai   | quyet_toan_id | mo_ta                 |
| --- | -------- | ----------- | ------- | ------------ | ------------- | --------------------- |
| 1   | 3        | 3           | 200000  | CHO_KHAU_TRU | NULL          | Thay kính cửa sổ P202 |

## 46. `khoan_chi`

| Cột         | Kiểu          | Ràng buộc               | Mô tả                                         |
| ----------- | ------------- | ----------------------- | --------------------------------------------- |
| id          | BIGINT        | PK                      |                                               |
| can_tro_id  | BIGINT        | FK → can_tro.id, NULL   | NULL = chi chung toàn chuỗi (BR-07)           |
| phong_id    | BIGINT        | FK → phong.id, NULL     |                                               |
| loai_chi_id | BIGINT        | FK → dm_loai_chi.id, NN |                                               |
| so_tien     | DECIMAL(15,0) | NN                      | > 0                                           |
| ngay_chi    | DATE          | NN                      |                                               |
| nguon       | ENUM          | NN                      | TAY, SU_CO                                    |
| su_co_id    | BIGINT        | FK → su_co.id, NULL     | Khi nguon = SU_CO (Chủ trọ chịu, chi phí > 0) |
| ghi_chu     | VARCHAR(255)  | NULL                    |                                               |
| trang_thai  | ENUM          | NN                      | HIEU_LUC, DA_HUY                              |
| ly_do_huy   | VARCHAR(255)  | NULL                    |                                               |
| huy_boi     | BIGINT        | FK → tai_khoan.id, NULL |                                               |

| id  | can_tro_id | phong_id | loai_chi_id | so_tien | ngay_chi   | nguon | su_co_id | ghi_chu                              | trang_thai | ly_do_huy  | huy_boi |
| --- | ---------- | -------- | ----------- | ------- | ---------- | ----- | -------- | ------------------------------------ | ---------- | ---------- | ------- |
| 1   | 1          | 1        | 1           | 150000  | 2026-09-15 | SU_CO | 1        | Thay ổ cắm P101                      | HIEU_LUC   | NULL       | NULL    |
| 2   | 3          | 7        | 3           | 500000  | 2026-06-02 | TAY   | NULL     | Hoa hồng giới thiệu khách Võ Thị Lan | HIEU_LUC   | NULL       | NULL    |
| 3   | NULL       | NULL     | 4           | 200000  | 2026-09-30 | TAY   | NULL     | Chi phí hạ tầng hệ thống             | HIEU_LUC   | NULL       | NULL    |
| 4   | 2          | NULL     | 2           | 1200000 | 2026-09-01 | TAY   | NULL     | Máy bơm nước                         | DA_HUY     | Nhập trùng | 1       |

---

# NHÓM I — TRẢ PHÒNG & THANH LÝ

## 47. `quyet_toan_tra_phong` — quyết toán để thanh lý hợp đồng (UC-15)

Công thức (BR-39): `coc_con_hoan = tien_coc_da_nhan − tong_no_con_lai − tien_dien_cuoi − tien_nuoc_dv_le_con_thieu − tong_chi_phi_hu_hong_khach_chiu − tong_boi_thuong_khau_tru + hoan_tien_phong_tra_truoc`. Nếu < 0 → hoàn 0, phần âm là `cong_no_sau_thanh_ly`.

| Cột                             | Kiểu          | Ràng buộc                | Mô tả                             |
| ------------------------------- | ------------- | ------------------------ | --------------------------------- |
| id                              | BIGINT        | PK                       |                                   |
| hop_dong_id                     | BIGINT        | FK → hop_dong.id, NN, UQ |                                   |
| yeu_cau_id                      | BIGINT        | FK → yeu_cau.id, NULL    | Yêu cầu trả phòng đã duyệt        |
| ngay_tra                        | DATE          | NN                       |                                   |
| chi_so_dien_gan_nhat            | INT           | NN                       |                                   |
| chi_so_dien_cuoi                | INT           | NN                       | ≥ chỉ số gần nhất                 |
| luong_dien_cuoi                 | INT           | NN                       |                                   |
| tien_dien_cuoi                  | DECIMAL(15,0) | NN                       |                                   |
| tien_nuoc_dv_le_con_thieu       | DECIMAL(15,0) | NN                       | Tính theo ngày (BR-38)            |
| tong_no_con_lai                 | DECIMAL(15,0) | NN                       | Công nợ + khoản phải thu chưa trả |
| tong_chi_phi_hu_hong_khach_chiu | DECIMAL(15,0) | NN                       | Từ khoan_cho_khau_tru             |
| tong_boi_thuong_khau_tru        | DECIMAL(15,0) | NN                       | Bồi thường/khấu trừ theo hợp đồng |
| hoan_tien_phong_tra_truoc       | DECIMAL(15,0) | NN                       | Ngày chưa ở                       |
| tien_coc_da_nhan                | DECIMAL(15,0) | NN                       |                                   |
| coc_con_hoan                    | DECIMAL(15,0) | NN                       | ≥ 0                               |
| cong_no_sau_thanh_ly            | DECIMAL(15,0) | NN                       | ≥ 0                               |
| ket_qua_kiem_tra_phong          | TEXT          | NULL                     |                                   |
| trang_thai                      | ENUM          | NN                       | DANG_XU_LY, DA_THANH_LY           |
| ngay_thanh_ly                   | DATE          | NULL                     |                                   |
| thuc_hien_boi                   | BIGINT        | FK → tai_khoan.id, NN    |                                   |

| id  | hop_dong_id | yeu_cau_id | ngay_tra   | chi_so_dien_gan_nhat | chi_so_dien_cuoi | luong_dien_cuoi | tien_dien_cuoi | tien_nuoc_dv_le_con_thieu | tong_no_con_lai | tong_chi_phi_hu_hong_khach_chiu | tong_boi_thuong_khau_tru | hoan_tien_phong_tra_truoc | tien_coc_da_nhan | coc_con_hoan | cong_no_sau_thanh_ly | ket_qua_kiem_tra_phong                        | trang_thai  | ngay_thanh_ly | thuc_hien_boi |
| --- | ----------- | ---------- | ---------- | -------------------- | ---------------- | --------------- | -------------- | ------------------------- | --------------- | ------------------------------- | ------------------------ | ------------------------- | ---------------- | ------------ | -------------------- | --------------------------------------------- | ----------- | ------------- | ------------- |
| 1   | 3           | 2          | 2026-09-30 | 3320                 | 3360             | 40              | 140000         | 0                         | 3225000         | 200000                          | 300000                   | 0                         | 5000000          | 1135000      | 0                    | Kính cửa sổ vỡ đã thay; ghế sofa rách tay vịn | DANG_XU_LY  | NULL          | 1             |
| 2   | 5           | NULL       | 2026-05-31 | 2900                 | 2940             | 40              | 140000         | 0                         | 0               | 0                               | 0                        | 0                         | 4000000          | 3860000      | 0                    | Phòng sạch, không hư hỏng                     | DA_THANH_LY | 2026-05-31    | 1             |
| 3   | 6           | NULL       | 2026-08-31 | 4100                 | 4160             | 60              | 210000         | 0                         | 2000000         | 0                               | 2500000                  | 0                         | 4000000          | 0            | 710000               | Hỏng tường và cửa tủ                          | DA_THANH_LY | 2026-08-31    | 1             |

## 48. `quyet_toan_chi_tiet`

| Cột             | Kiểu          | Ràng buộc                        | Mô tả                                                                                                       |
| --------------- | ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| id              | BIGINT        | PK                               |                                                                                                             |
| quyet_toan_id   | BIGINT        | FK → quyet_toan_tra_phong.id, NN |                                                                                                             |
| loai            | ENUM          | NN                               | NO_CON_LAI, DIEN_CUOI, NUOC_DV_LE, HU_HONG_KHACH_CHIU, BOI_THUONG, KHAU_TRU_KHAC, HOAN_TIEN_PHONG_TRA_TRUOC |
| dau             | ENUM          | NN                               | CONG, TRU                                                                                                   |
| so_tien         | DECIMAL(15,0) | NN                               |                                                                                                             |
| mo_ta           | VARCHAR(255)  | NULL                             |                                                                                                             |
| tham_chieu_bang | VARCHAR(50)   | NULL                             | Bảng nguồn (cong_no, khoan_cho_khau_tru…)                                                                   |
| tham_chieu_id   | BIGINT        | NULL                             |                                                                                                             |
| noi_that_id     | BIGINT        | FK → noi_that.id, NULL           |                                                                                                             |
| dieu_khoan      | VARCHAR(100)  | NULL                             | Căn cứ hợp đồng (BR-24)                                                                                     |

| id  | quyet_toan_id | loai               | dau | so_tien | mo_ta                 | tham_chieu_bang    | tham_chieu_id | noi_that_id | dieu_khoan |
| --- | ------------- | ------------------ | --- | ------- | --------------------- | ------------------ | ------------- | ----------- | ---------- |
| 1   | 1             | NO_CON_LAI         | TRU | 3225000 | Công nợ kỳ 09/2026    | cong_no            | 2             | NULL        | NULL       |
| 2   | 1             | DIEN_CUOI          | TRU | 140000  | 40 kWh × 3.500        | NULL               | NULL          | NULL        | NULL       |
| 3   | 1             | HU_HONG_KHACH_CHIU | TRU | 200000  | Thay kính cửa sổ      | khoan_cho_khau_tru | 1             | 5           | NULL       |
| 4   | 1             | BOI_THUONG         | TRU | 300000  | Rách tay vịn ghế sofa | NULL               | NULL          | 6           | Điều 8     |
| 5   | 3             | BOI_THUONG         | TRU | 2500000 | Sửa tường và cửa tủ   | NULL               | NULL          | NULL        | Điều 8     |
| 6   | 3             | NO_CON_LAI         | TRU | 2000000 | Nợ tiền phòng còn lại | NULL               | NULL          | NULL        | NULL       |

## 49. `hoan_tien_coc`

| Cột           | Kiểu          | Ràng buộc                        | Mô tả                                    |
| ------------- | ------------- | -------------------------------- | ---------------------------------------- |
| id            | BIGINT        | PK                               |                                          |
| quyet_toan_id | BIGINT        | FK → quyet_toan_tra_phong.id, NN |                                          |
| so_tien_hoan  | DECIMAL(15,0) | NN                               | ≤ coc_con_hoan                           |
| ngay_hoan     | DATE          | NN                               | Tiền chuyển ngoài hệ thống, chỉ ghi nhận |
| ghi_nhan_boi  | BIGINT        | FK → tai_khoan.id, NN            |                                          |
| ghi_chu       | VARCHAR(255)  | NULL                             |                                          |

| id  | quyet_toan_id | so_tien_hoan | ngay_hoan  | ghi_nhan_boi | ghi_chu                |
| --- | ------------- | ------------ | ---------- | ------------ | ---------------------- |
| 1   | 2             | 3860000      | 2026-06-02 | 1            | Chuyển khoản trả khách |

---

# NHÓM J — THÔNG BÁO & HỆ THỐNG

## 50. `thong_bao`

| Cột              | Kiểu         | Ràng buộc             | Mô tả                              |
| ---------------- | ------------ | --------------------- | ---------------------------------- |
| id               | BIGINT       | PK                    |                                    |
| nguoi_nhan_id    | BIGINT       | FK → tai_khoan.id, NN | Chỉ người nhận được xem (SEC-14)   |
| ma_loai          | VARCHAR(10)  | NN                    | NTF-01…NTF-15                      |
| tieu_de          | VARCHAR(200) | NN                    |                                    |
| noi_dung         | VARCHAR(500) | NN                    |                                    |
| doi_tuong_loai   | VARCHAR(50)  | NULL                  | phieu_thu, yeu_cau, su_co…         |
| doi_tuong_id     | BIGINT       | NULL                  |                                    |
| khoa_chong_trung | VARCHAR(120) | NN, UQ                | Không gửi trùng 1 sự kiện (FR-159) |
| da_doc           | BOOLEAN      | NN                    |                                    |
| doc_luc          | DATETIME     | NULL                  |                                    |
| het_han_luc      | DATETIME     | NN                    | Lưu 12 tháng                       |

| id  | nguoi_nhan_id | ma_loai | tieu_de                  | noi_dung                                          | doi_tuong_loai | doi_tuong_id | khoa_chong_trung           | da_doc | doc_luc             | het_han_luc         |
| --- | ------------- | ------- | ------------------------ | ------------------------------------------------- | -------------- | ------------ | -------------------------- | ------ | ------------------- | ------------------- |
| 1   | 2             | NTF-04  | Phiếu thu kỳ 10/2026     | Phòng P101 cần thanh toán 3.022.500đ trước 05/10  | phieu_thu      | 1            | NTF-04:phieu_thu:1         | true   | 2026-10-02 08:30:00 | 2027-10-02 08:00:07 |
| 2   | 1             | NTF-03  | Chỉ số điện cần xác nhận | P201 kỳ 10/2026 (khách đã sửa tay)                | chi_so_dien    | 8            | NTF-03:chi_so_dien:8:v2    | false  | NULL                | 2027-10-01 09:16:30 |
| 3   | 3             | NTF-12  | Nhắc thanh toán          | Phòng P201 còn nợ 1.540.000đ kỳ 09/2026           | khoan_phai_thu | 2            | NTF-12:khoan_phai_thu:2:05 | true   | 2026-09-05 09:00:00 | 2027-09-05 08:00:00 |
| 4   | 4             | NTF-12  | Đã ghi công nợ           | Khoản 3.225.000đ kỳ 09/2026 đã ghi vào công nợ    | cong_no        | 2            | NTF-12:cong_no:2           | false  | NULL                | 2027-09-10 23:59:40 |
| 5   | 3             | NTF-05  | Hợp đồng sắp hết hạn     | Hợp đồng HD-CT02-P201-2026-001 hết hạn 31/10/2026 | hop_dong       | 2            | NTF-05:hop_dong:2:3        | true   | 2026-10-01 07:00:00 | 2027-10-01 00:05:00 |
| 6   | 1             | NTF-13  | Giữ phòng quá hạn        | P103 – Hoàng Anh Thư quá hạn giữ từ 27/09         | giu_phong      | 1            | NTF-13:giu_phong:1         | false  | NULL                | 2027-09-28 00:05:00 |

## 51. `su_kien_thong_bao` — outbox phát lên Kafka (Q-08)

| Cột          | Kiểu         | Ràng buộc | Mô tả                                                  |
| ------------ | ------------ | --------- | ------------------------------------------------------ |
| id           | BIGINT       | PK        |                                                        |
| topic        | VARCHAR(100) | NN        |                                                        |
| khoa_su_kien | VARCHAR(120) | NN, UQ    | Idempotency                                            |
| ma_loai      | VARCHAR(10)  | NN        |                                                        |
| payload      | JSON         | NN        |                                                        |
| trang_thai   | ENUM         | NN        | CHO_GUI, DA_GUI, LOI                                   |
| so_lan_thu   | INT          | NN        |                                                        |
| tao_luc      | DATETIME     | NN        |                                                        |
| gui_luc      | DATETIME     | NULL      |                                                        |
| tieu_thu_luc | DATETIME     | NULL      | Bộ tiêu thụ xử lý xong (NFR-021 ≤ 5 phút sau phục hồi) |

| id  | topic         | khoa_su_kien            | ma_loai | payload                             | trang_thai | so_lan_thu | tao_luc             | gui_luc             | tieu_thu_luc        |
| --- | ------------- | ----------------------- | ------- | ----------------------------------- | ---------- | ---------- | ------------------- | ------------------- | ------------------- |
| 1   | tro.thong-bao | NTF-04:phieu_thu:1      | NTF-04  | {"phieu_thu_id":1,"nguoi_nhan":2}   | DA_GUI     | 1          | 2026-10-02 08:00:07 | 2026-10-02 08:00:08 | 2026-10-02 08:00:09 |
| 2   | tro.thong-bao | NTF-03:chi_so_dien:8:v2 | NTF-03  | {"chi_so_dien_id":8,"nguoi_nhan":1} | DA_GUI     | 1          | 2026-10-01 09:16:30 | 2026-10-01 09:16:31 | 2026-10-01 09:16:32 |
| 3   | tro.thong-bao | NTF-12:cong_no:2        | NTF-12  | {"cong_no_id":2,"nguoi_nhan":4}     | CHO_GUI    | 0          | 2026-09-10 23:59:40 | NULL                | NULL                |

## 52. `cau_hinh_he_thong` (NFR-013, FR-200)

| Cột          | Kiểu         | Ràng buộc               | Mô tả                      |
| ------------ | ------------ | ----------------------- | -------------------------- |
| id           | BIGINT       | PK                      |                            |
| khoa         | VARCHAR(60)  | NN, UQ                  |                            |
| gia_tri      | VARCHAR(255) | NN                      |                            |
| kieu         | ENUM         | NN                      | INT, STRING, TIME, BOOLEAN |
| mo_ta        | VARCHAR(255) | NULL                    |                            |
| cap_nhat_boi | BIGINT       | FK → tai_khoan.id, NULL |                            |

| id  | khoa                           | gia_tri      | kieu   | mo_ta                                            | cap_nhat_boi |
| --- | ------------------------------ | ------------ | ------ | ------------------------------------------------ | ------------ |
| 1   | NGAY_GHI_CHI_SO                | 1            | INT    | Ngày hằng tháng khách gửi chỉ số                 | 1            |
| 2   | HAN_THANH_TOAN_NGAY            | 5            | INT    | Hạn thanh toán, từ ngày kế tiếp hiển thị Quá hạn | 1            |
| 3   | NGAY_GHI_CONG_NO               | 10           | INT    | Hết ngày này ghi phần còn thiếu vào công nợ      | 1            |
| 4   | NGUONG_CANH_BAO_HOP_DONG_THANG | 1            | INT    | Cảnh báo hợp đồng sắp hết hạn                    | 1            |
| 5   | HAN_GIU_PHONG_MAC_DINH_NGAY    | 7            | INT    | Hạn giữ phòng mặc định                           | 1            |
| 6   | SO_NGAY_BAO_TRUOC_TRA_PHONG    | 30           | INT    | Báo trước tối thiểu khi trả phòng                | 1            |
| 7   | ANH_TOI_DA_MB                  | 10           | INT    | Dung lượng ảnh tối đa                            | 1            |
| 8   | ANH_DINH_DANG                  | JPG,JPEG,PNG | STRING | Định dạng ảnh cho phép                           | 1            |
| 9   | OCR_TIMEOUT_GIAY               | 30           | INT    | Quá thời gian coi là timeout                     | 1            |
| 10  | SO_LAN_SAI_TOI_DA              | 5            | INT    | Số lần sai trong 15 phút                         | 1            |
| 11  | THOI_GIAN_KHOA_TAM_PHUT        | 15           | INT    | Khóa đăng nhập tạm                               | 1            |
| 12  | PHIEN_HET_HAN_PHUT             | 30           | INT    | Phiên không hoạt động                            | 1            |
| 13  | YEU_CAU_QUEN_MK_TOI_DA_MOI_GIO | 3            | INT    | Chống lạm dụng quên mật khẩu                     | 1            |
| 14  | THONG_BAO_LUU_THANG            | 12           | INT    | Thời gian lưu thông báo                          | 1            |

## 53. `lich_phieu_tu_dong` — một lịch chung toàn chuỗi (BR-28)

| Cột              | Kiểu     | Ràng buộc             | Mô tả                     |
| ---------------- | -------- | --------------------- | ------------------------- |
| id               | BIGINT   | PK                    | Chỉ có 1 bản ghi hiệu lực |
| ngay_trong_thang | INT      | NN                    | 1–28                      |
| gio_chay         | TIME     | NN                    |                           |
| dang_bat         | BOOLEAN  | NN                    |                           |
| cap_nhat_boi     | BIGINT   | FK → tai_khoan.id, NN |                           |
| cap_nhat_luc     | DATETIME | NN                    |                           |

| id  | ngay_trong_thang | gio_chay | dang_bat | cap_nhat_boi | cap_nhat_luc        |
| --- | ---------------- | -------- | -------- | ------------ | ------------------- |
| 1   | 2                | 08:00:00 | true     | 1            | 2026-01-03 09:00:00 |

## 54. `nhat_ky_tac_vu` (UC-25, OPS-04)

| Cột                | Kiểu     | Ràng buộc | Mô tả                                                                |
| ------------------ | -------- | --------- | -------------------------------------------------------------------- |
| id                 | BIGINT   | PK        |                                                                      |
| ma_tac_vu          | ENUM     | NN        | SYS-01 … SYS-06                                                      |
| ky_xu_ly           | DATE     | NULL      | Kỳ hoặc ngày xử lý — UQ(ma_tac_vu, ky_xu_ly) để chạy lại không trùng |
| bat_dau_luc        | DATETIME | NN        |                                                                      |
| ket_thuc_luc       | DATETIME | NULL      |                                                                      |
| so_doi_tuong_xu_ly | INT      | NN        |                                                                      |
| so_thanh_cong      | INT      | NN        |                                                                      |
| so_loi             | INT      | NN        |                                                                      |
| trang_thai         | ENUM     | NN        | DANG_CHAY, THANH_CONG, MOT_PHAN, THAT_BAI                            |

| id  | ma_tac_vu | ky_xu_ly   | bat_dau_luc         | ket_thuc_luc        | so_doi_tuong_xu_ly | so_thanh_cong | so_loi | trang_thai |
| --- | --------- | ---------- | ------------------- | ------------------- | ------------------ | ------------- | ------ | ---------- |
| 1   | SYS-06    | 2026-10-01 | 2026-10-02 08:00:00 | 2026-10-02 08:00:09 | 3                  | 2             | 1      | MOT_PHAN   |
| 2   | SYS-03    | 2026-09-01 | 2026-09-10 23:59:30 | 2026-09-10 23:59:41 | 4                  | 4             | 0      | THANH_CONG |
| 3   | SYS-01    | 2026-10-01 | 2026-10-01 00:05:00 | 2026-10-01 00:05:02 | 5                  | 5             | 0      | THANH_CONG |
| 4   | SYS-04    | 2026-09-30 | 2026-09-30 00:10:00 | 2026-09-30 00:10:01 | 1                  | 1             | 0      | THANH_CONG |

## 55. `nhat_ky_tac_vu_loi`

| Cột               | Kiểu         | Ràng buộc                  | Mô tả                            |
| ----------------- | ------------ | -------------------------- | -------------------------------- |
| id                | BIGINT       | PK                         |                                  |
| nhat_ky_tac_vu_id | BIGINT       | FK → nhat_ky_tac_vu.id, NN |                                  |
| doi_tuong_loai    | VARCHAR(50)  | NN                         |                                  |
| doi_tuong_id      | BIGINT       | NN                         |                                  |
| thong_diep_loi    | VARCHAR(500) | NN                         |                                  |
| ma_tuong_quan     | VARCHAR(40)  | NN                         | Đối chiếu log ứng dụng (NFR-014) |
| thoi_gian         | DATETIME     | NN                         |                                  |

| id  | nhat_ky_tac_vu_id | doi_tuong_loai | doi_tuong_id | thong_diep_loi                                            | ma_tuong_quan      | thoi_gian           |
| --- | ----------------- | -------------- | ------------ | --------------------------------------------------------- | ------------------ | ------------------- |
| 1   | 1                 | phong          | 7            | Chưa có chỉ số điện Đã xác nhận kỳ 10/2026 — bỏ qua phòng | corr-20261002-0007 | 2026-10-02 08:00:06 |

## 56. `audit_log`

| Cột            | Kiểu         | Ràng buộc               | Mô tả                             |
| -------------- | ------------ | ----------------------- | --------------------------------- |
| id             | BIGINT       | PK                      |                                   |
| thoi_gian      | DATETIME     | NN                      |                                   |
| tai_khoan_id   | BIGINT       | FK → tai_khoan.id, NULL | NULL = hệ thống                   |
| ma_audit       | VARCHAR(10)  | NN                      | AUD-01 … AUD-10                   |
| hanh_dong      | VARCHAR(100) | NN                      |                                   |
| doi_tuong_loai | VARCHAR(50)  | NN                      |                                   |
| doi_tuong_id   | BIGINT       | NN                      |                                   |
| gia_tri_cu     | JSON         | NULL                    | Không chứa CCCD/mật khẩu (SEC-10) |
| gia_tri_moi    | JSON         | NULL                    |                                   |
| ket_qua        | ENUM         | NN                      | THANH_CONG, THAT_BAI              |
| dia_chi_ip     | VARCHAR(45)  | NULL                    |                                   |
| ma_tuong_quan  | VARCHAR(40)  | NULL                    |                                   |

| id  | thoi_gian           | tai_khoan_id | ma_audit | hanh_dong               | doi_tuong_loai | doi_tuong_id | gia_tri_cu                    | gia_tri_moi                                      | ket_qua    | dia_chi_ip   | ma_tuong_quan      |
| --- | ------------------- | ------------ | -------- | ----------------------- | -------------- | ------------ | ----------------------------- | ------------------------------------------------ | ---------- | ------------ | ------------------ |
| 1   | 2026-10-01 08:05:00 | 1            | AUD-01   | Xác nhận chỉ số điện    | chi_so_dien    | 4            | {"trang_thai":"CHO_XAC_NHAN"} | {"trang_thai":"DA_XAC_NHAN"}                     | THANH_CONG | 113.161.1.10 | corr-20261001-0102 |
| 2   | 2026-10-03 20:30:00 | 1            | AUD-02   | Ghi nhận thanh toán     | thanh_toan     | 4            | NULL                          | {"so_tien":1500000}                              | THANH_CONG | 113.161.1.10 | corr-20261003-0210 |
| 3   | 2026-09-08 09:30:00 | 1            | AUD-02   | Hủy ghi nhận thanh toán | thanh_toan     | 5            | {"trang_thai":"HIEU_LUC"}     | {"trang_thai":"DA_HUY","ly_do":"Ghi nhầm phòng"} | THANH_CONG | 113.161.1.10 | corr-20260908-0044 |
| 4   | 2026-06-28 09:00:00 | 1            | AUD-03   | Đổi đơn giá điện        | hop_dong       | 1            | {"don_gia_dien":3300}         | {"don_gia_dien":3500}                            | THANH_CONG | 113.161.1.10 | corr-20260628-0007 |
| 5   | 2026-09-12 10:05:00 | 1            | AUD-06   | Đặt lại mật khẩu        | tai_khoan      | 2            | NULL                          | {"bat_buoc_doi_mat_khau":true}                   | THANH_CONG | 113.161.1.10 | corr-20260912-0015 |

---

# QUAN HỆ GIỮA CÁC BẢNG (khóa ngoại)

Ký hiệu: `1–N` = một cha có nhiều con; `1–1` = một cha có tối đa một con; `N–1 (tuỳ chọn)` = FK cho phép NULL.

| #   | Bảng con                     | Cột FK                                | Bảng cha                    | Quan hệ                | Ý nghĩa                                             |
| --- | ---------------------------- | ------------------------------------- | --------------------------- | ---------------------- | --------------------------------------------------- |
| 1   | tep_dinh_kem                 | nguoi_tai_len_id                      | tai_khoan                   | N–1                    | Người tải tệp                                       |
| 2   | tai_khoan                    | chu_tro_id                            | chu_tro                     | 1–1 (tuỳ chọn)         | Tài khoản của Chủ trọ                               |
| 3   | tai_khoan                    | khach_thue_id                         | khach_thue                  | 1–1 (tuỳ chọn)         | Mỗi khách tối đa 1 tài khoản                        |
| 4   | lich_su_trang_thai_tai_khoan | tai_khoan_id                          | tai_khoan                   | 1–N                    | Lịch sử khóa/mở khóa                                |
| 5   | lich_su_trang_thai_tai_khoan | thuc_hien_boi                         | tai_khoan                   | N–1                    | Người thao tác                                      |
| 6   | nhat_ky_dang_nhap            | tai_khoan_id                          | tai_khoan                   | N–1 (tuỳ chọn)         | Lần đăng nhập                                       |
| 7   | can_tro                      | chu_tro_id                            | chu_tro                     | 1–N                    | Chủ trọ sở hữu nhiều căn                            |
| 8   | can_tro                      | tep_anh_tong_quan_id                  | tep_dinh_kem                | N–1 (tuỳ chọn)         | Ảnh tổng quan                                       |
| 9   | phong                        | can_tro_id                            | can_tro                     | 1–N                    | Căn gồm nhiều phòng                                 |
| 10  | noi_that                     | phong_id                              | phong                       | 1–N                    | Phòng có nhiều nội thất                             |
| 11  | giu_phong                    | phong_id                              | phong                       | 1–N                    | Phòng được giữ nhiều lần theo thời gian             |
| 12  | giu_phong                    | khach_thue_id                         | khach_thue                  | N–1 (tuỳ chọn)         | Người giữ đã có hồ sơ                               |
| 13  | giu_phong                    | hop_dong_id                           | hop_dong                    | 1–1 (tuỳ chọn)         | Giữ phòng chuyển thành hợp đồng                     |
| 14  | hop_dong                     | phong_id                              | phong                       | 1–N                    | Phòng có nhiều hợp đồng theo thời gian (1 hiệu lực) |
| 15  | hop_dong                     | khach_thue_id                         | khach_thue                  | 1–N                    | Khách ký nhiều hợp đồng                             |
| 16  | hop_dong                     | giu_phong_id                          | giu_phong                   | N–1 (tuỳ chọn)         | Tiền giữ chỗ trừ vào cọc                            |
| 17  | hop_dong_goi_gia_han         | hop_dong_id                           | hop_dong                    | 1–N                    | Gói gia hạn cho phép                                |
| 18  | tien_coc                     | hop_dong_id                           | hop_dong                    | 1–1                    | Cọc của hợp đồng                                    |
| 19  | lich_su_hop_dong             | hop_dong_id                           | hop_dong                    | 1–N                    | Lịch sử thay đổi                                    |
| 20  | lich_su_hop_dong             | thuc_hien_boi                         | tai_khoan                   | N–1 (tuỳ chọn)         | Người thay đổi                                      |
| 21  | lich_su_gia_han              | hop_dong_id                           | hop_dong                    | 1–N                    | Hợp đồng được gia hạn nhiều lần                     |
| 22  | lich_su_gia_han              | yeu_cau_id                            | yeu_cau                     | 1–1                    | Yêu cầu gia hạn được duyệt                          |
| 23  | vi_pham_hop_dong             | hop_dong_id                           | hop_dong                    | 1–N                    | Vi phạm của hợp đồng                                |
| 24  | nguoi_o_cung                 | phong_id                              | phong                       | 1–N                    | Người ở trong phòng                                 |
| 25  | nguoi_o_cung                 | hop_dong_id                           | hop_dong                    | 1–N                    | Thuộc hợp đồng người đứng tên                       |
| 26  | chuyen_phong                 | hop_dong_id                           | hop_dong                    | 1–N                    | Hợp đồng có thể chuyển phòng nhiều lần              |
| 27  | chuyen_phong                 | phong_cu_id, phong_moi_id             | phong                       | N–1 (hai FK)           | Phòng đi / phòng đến                                |
| 28  | chuyen_phong                 | khoan_dieu_chinh_id                   | khoan_dieu_chinh            | N–1 (tuỳ chọn)         | Điều chỉnh tiền phòng theo ngày                     |
| 29  | chi_so_dien                  | phong_id                              | phong                       | 1–N                    | Chỉ số theo kỳ                                      |
| 30  | chi_so_dien                  | hop_dong_id                           | hop_dong                    | 1–N                    | Hợp đồng hiệu lực lúc ghi                           |
| 31  | chi_so_dien                  | tep_anh_id                            | tep_dinh_kem                | N–1 (tuỳ chọn)         | Ảnh công tơ                                         |
| 32  | chi_so_dien                  | nguoi_gui_id, nguoi_xac_nhan_id       | tai_khoan                   | N–1 (hai FK)           | Người gửi / xác nhận                                |
| 33  | lich_su_chi_so_dien          | chi_so_dien_id                        | chi_so_dien                 | 1–N                    | Các lần sửa/ghi đè                                  |
| 34  | thay_cong_to                 | phong_id                              | phong                       | 1–N                    | Lần thay công tơ                                    |
| 35  | ocr_yeu_cau                  | tep_anh_id                            | tep_dinh_kem                | N–1                    | Ảnh gửi OCR                                         |
| 36  | ocr_yeu_cau                  | chi_so_dien_id                        | chi_so_dien                 | N–1 (tuỳ chọn)         | Chỉ số được tạo từ kết quả OCR                      |
| 37  | khoan_dieu_chinh             | hop_dong_id                           | hop_dong                    | 1–N                    | Phí phát sinh/giảm trừ của hợp đồng                 |
| 38  | khoan_dieu_chinh             | phong_id                              | phong                       | 1–N                    | Phòng áp dụng                                       |
| 39  | khoan_phai_thu               | phong_id                              | phong                       | 1–N                    | Mỗi phòng/kỳ 1 khoản                                |
| 40  | khoan_phai_thu               | hop_dong_id                           | hop_dong                    | 1–N                    | Hợp đồng nguồn của giá                              |
| 41  | khoan_phai_thu               | chi_so_dien_cu_id, chi_so_dien_moi_id | chi_so_dien                 | N–1 (hai FK, tuỳ chọn) | Chỉ số 01/T−1 và 01/T                               |
| 42  | khoan_phai_thu_dieu_chinh    | khoan_phai_thu_id                     | khoan_phai_thu              | 1–N                    | Điều chỉnh đã áp                                    |
| 43  | khoan_phai_thu_dieu_chinh    | khoan_dieu_chinh_id                   | khoan_dieu_chinh            | N–1                    | Nguồn điều chỉnh                                    |
| 44  | phieu_thu                    | khoan_phai_thu_id                     | khoan_phai_thu              | 1–1                    | Phiếu lập từ khoản phải thu                         |
| 45  | phieu_thu                    | phong_id                              | phong                       | 1–N                    | Tối đa 1 phiếu hợp lệ/phòng/kỳ                      |
| 46  | phieu_thu_ghi_chu            | phieu_thu_id                          | phieu_thu                   | 1–N                    | Ghi chú thêm                                        |
| 47  | tinh_trang_thanh_toan        | khoan_phai_thu_id                     | khoan_phai_thu              | 1–1                    | Tình trạng thanh toán                               |
| 48  | thanh_toan                   | khoan_phai_thu_id                     | khoan_phai_thu              | 1–N                    | Nhiều lần thanh toán                                |
| 49  | thanh_toan                   | cong_no_id                            | cong_no                     | N–1 (tuỳ chọn)         | Lần thu nợ                                          |
| 50  | minh_chung_thanh_toan        | khoan_phai_thu_id                     | khoan_phai_thu              | 1–N                    | Minh chứng của khoản                                |
| 51  | minh_chung_thanh_toan        | tep_anh_id                            | tep_dinh_kem                | 1–1                    | Ảnh minh chứng                                      |
| 52  | minh_chung_thanh_toan        | thanh_toan_id                         | thanh_toan                  | N–1 (tuỳ chọn)         | Đối chiếu với bản ghi thanh toán                    |
| 53  | cong_no                      | khoan_phai_thu_id                     | khoan_phai_thu              | N–1 (tuỳ chọn)         | Công nợ kỳ gốc                                      |
| 54  | cong_no                      | quyet_toan_id                         | quyet_toan_tra_phong        | N–1 (tuỳ chọn)         | Công nợ sau thanh lý                                |
| 55  | cong_no                      | khach_thue_id, phong_id, hop_dong_id  | khach_thue, phong, hop_dong | N–1                    | Chủ nợ/đối tượng                                    |
| 56  | nhac_no                      | khoan_phai_thu_id                     | khoan_phai_thu              | 1–N                    | Lần nhắc nợ                                         |
| 57  | nhac_no                      | cong_no_id                            | cong_no                     | N–1 (tuỳ chọn)         |                                                     |
| 58  | nhac_no                      | khach_thue_id                         | khach_thue                  | N–1                    | Người được nhắc                                     |
| 59  | nhac_no                      | thong_bao_id                          | thong_bao                   | N–1 (tuỳ chọn)         | Thông báo đã gửi                                    |
| 60  | phan_bo_doanh_thu            | thanh_toan_id                         | thanh_toan                  | 1–1                    | Phân bổ mỗi lần thu                                 |
| 61  | phan_bo_doanh_thu            | khoan_phai_thu_id                     | khoan_phai_thu              | N–1                    |                                                     |
| 62  | phan_bo_doanh_thu            | can_tro_id                            | can_tro                     | N–1                    | Báo cáo theo căn                                    |
| 63  | thu_khac                     | can_tro_id                            | can_tro                     | N–1                    |                                                     |
| 64  | thu_khac                     | giu_phong_id                          | giu_phong                   | N–1 (tuỳ chọn)         | Tiền giữ chỗ không hoàn                             |
| 65  | yeu_cau                      | khach_thue_id                         | khach_thue                  | 1–N                    | Khách gửi yêu cầu                                   |
| 66  | yeu_cau                      | hop_dong_id                           | hop_dong                    | N–1 (tuỳ chọn)         |                                                     |
| 67  | yeu_cau                      | xu_ly_boi                             | tai_khoan                   | N–1 (tuỳ chọn)         | Chủ trọ xử lý                                       |
| 68  | yeu_cau_gia_han              | yeu_cau_id                            | yeu_cau                     | 1–1                    | Chi tiết gia hạn                                    |
| 69  | yeu_cau_tra_phong            | yeu_cau_id                            | yeu_cau                     | 1–1                    | Chi tiết trả phòng                                  |
| 70  | yeu_cau_dat_lai_mat_khau     | yeu_cau_id                            | yeu_cau                     | 1–1                    | Chi tiết đặt lại mật khẩu                           |
| 71  | yeu_cau_dat_lai_mat_khau     | tai_khoan_id                          | tai_khoan                   | N–1                    | Tài khoản được đặt lại                              |
| 72  | su_co                        | can_tro_id                            | can_tro                     | 1–N                    | Sự cố thuộc căn                                     |
| 73  | su_co                        | phong_id                              | phong                       | N–1 (tuỳ chọn)         | NULL = khu vực chung                                |
| 74  | su_co                        | nguoi_bao_khach_thue_id               | khach_thue                  | N–1 (tuỳ chọn)         | NULL = Chủ trọ tự tạo                               |
| 75  | su_co                        | loai_su_co_id                         | dm_loai_su_co               | N–1                    |                                                     |
| 76  | su_co                        | muc_uu_tien_id                        | dm_muc_uu_tien              | N–1                    |                                                     |
| 77  | su_co                        | noi_that_id                           | noi_that                    | N–1 (tuỳ chọn)         | Tài sản liên quan                                   |
| 78  | su_co_anh                    | su_co_id                              | su_co                       | 1–N                    | Ảnh sự cố                                           |
| 79  | su_co_anh                    | tep_dinh_kem_id                       | tep_dinh_kem                | 1–1                    |                                                     |
| 80  | su_co_lich_su_trang_thai     | su_co_id                              | su_co                       | 1–N                    | Lịch sử trạng thái                                  |
| 81  | khoan_cho_khau_tru           | su_co_id                              | su_co                       | 1–1                    | Sự cố khách chịu chi phí                            |
| 82  | khoan_cho_khau_tru           | hop_dong_id                           | hop_dong                    | N–1                    |                                                     |
| 83  | khoan_cho_khau_tru           | quyet_toan_id                         | quyet_toan_tra_phong        | N–1 (tuỳ chọn)         | Đã khấu trừ ở quyết toán nào                        |
| 84  | khoan_chi                    | can_tro_id                            | can_tro                     | N–1 (tuỳ chọn)         | NULL = chi chung toàn chuỗi                         |
| 85  | khoan_chi                    | phong_id                              | phong                       | N–1 (tuỳ chọn)         |                                                     |
| 86  | khoan_chi                    | loai_chi_id                           | dm_loai_chi                 | N–1                    |                                                     |
| 87  | khoan_chi                    | su_co_id                              | su_co                       | 1–1 (tuỳ chọn)         | Chi phí tự sinh từ sự cố                            |
| 88  | quyet_toan_tra_phong         | hop_dong_id                           | hop_dong                    | 1–1                    | Mỗi hợp đồng 1 quyết toán                           |
| 89  | quyet_toan_tra_phong         | yeu_cau_id                            | yeu_cau                     | N–1 (tuỳ chọn)         | Yêu cầu trả phòng đã duyệt                          |
| 90  | quyet_toan_chi_tiet          | quyet_toan_id                         | quyet_toan_tra_phong        | 1–N                    | Dòng cộng/trừ                                       |
| 91  | quyet_toan_chi_tiet          | noi_that_id                           | noi_that                    | N–1 (tuỳ chọn)         | Hạng mục hư hỏng                                    |
| 92  | hoan_tien_coc                | quyet_toan_id                         | quyet_toan_tra_phong        | 1–N                    | Ghi nhận hoàn cọc                                   |
| 93  | thong_bao                    | nguoi_nhan_id                         | tai_khoan                   | 1–N                    | Người nhận                                          |
| 94  | lich_phieu_tu_dong           | cap_nhat_boi                          | tai_khoan                   | N–1                    |                                                     |
| 95  | cau_hinh_he_thong            | cap_nhat_boi                          | tai_khoan                   | N–1 (tuỳ chọn)         |                                                     |
| 96  | nhat_ky_tac_vu_loi           | nhat_ky_tac_vu_id                     | nhat_ky_tac_vu              | 1–N                    | Lỗi từng đối tượng                                  |
| 97  | audit_log                    | tai_khoan_id                          | tai_khoan                   | N–1 (tuỳ chọn)         | NULL = hệ thống                                     |
| 98  | (mọi bảng nghiệp vụ)         | created_by, updated_by                | tai_khoan                   | N–1 (tuỳ chọn)         | Cột chung                                           |

## Quan hệ liên kết bằng tham chiếu đa hình (không có FK cứng)

| Bảng                | Cột                             | Trỏ tới                                                                              | Ghi chú                     |
| ------------------- | ------------------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| thong_bao           | doi_tuong_loai + doi_tuong_id   | phieu_thu, yeu_cau, su_co, chi_so_dien, hop_dong, giu_phong, cong_no, khoan_phai_thu | Điều hướng khi mở thông báo |
| audit_log           | doi_tuong_loai + doi_tuong_id   | mọi bảng nghiệp vụ                                                                   |                             |
| nhat_ky_tac_vu_loi  | doi_tuong_loai + doi_tuong_id   | phong, khoan_phai_thu, hop_dong, giu_phong                                           |                             |
| quyet_toan_chi_tiet | tham_chieu_bang + tham_chieu_id | cong_no, khoan_cho_khau_tru                                                          |                             |

---

# RÀNG BUỘC DUY NHẤT, KIỂM TRA VÀ CHỈ MỤC

| Bảng                 | Loại              | Cột / Điều kiện                                                                                                                                                                                                          | Nguồn                    |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| khach_thue           | UNIQUE            | so_dien_thoai                                                                                                                                                                                                            | BR-49                    |
| tai_khoan            | UNIQUE            | ten_dang_nhap; khach_thue_id                                                                                                                                                                                             | UC-02                    |
| phong                | UNIQUE            | (can_tro_id, so_phong)                                                                                                                                                                                                   | UC-04                    |
| phong                | CHECK             | dien_tich > 0; gia_thue_niem_yet ≥ 0; so_nguoi_dang_o ≤ so_nguoi_toi_da                                                                                                                                                  | UC-04, UC-24             |
| hop_dong             | CHECK             | ngay_ket_thuc > ngay_bat_dau; da_co_ban_giay_ky = true                                                                                                                                                                   | BR-40                    |
| hop_dong             | UNIQUE (một phần) | phong_id WHERE trang_thai ≠ DA_THANH_LY                                                                                                                                                                                  | FR-038                   |
| giu_phong            | UNIQUE (một phần) | phong_id WHERE trang_thai = DANG_GIU                                                                                                                                                                                     | WF-10                    |
| hop_dong_goi_gia_han | CHECK / UNIQUE    | so_thang IN (6, 12); (hop_dong_id, so_thang)                                                                                                                                                                             | Q-18                     |
| tien_coc             | UNIQUE            | hop_dong_id                                                                                                                                                                                                              |                          |
| chi_so_dien          | UNIQUE            | (phong_id, ky)                                                                                                                                                                                                           | Data dict.               |
| chi_so_dien          | CHECK             | chi_so ≥ chỉ số kỳ trước (trừ thay công tơ)                                                                                                                                                                              | BR-04                    |
| khoan_phai_thu       | UNIQUE            | (phong_id, ky)                                                                                                                                                                                                           |                          |
| khoan_phai_thu       | CHECK             | tong_phai_thu ≥ 0                                                                                                                                                                                                        | UC21-AC3                 |
| phieu_thu            | UNIQUE (một phần) | (phong_id, ky) WHERE hieu_luc = true                                                                                                                                                                                     | BR-26, NFR-007           |
| thanh_toan           | CHECK             | so_tien > 0; tổng bản ghi HIEU_LUC ≤ tong_phai_thu                                                                                                                                                                       | BR-46                    |
| thanh_toan           | RULE              | Không DELETE; chỉ chuyển DA_HUY kèm ly_do_huy                                                                                                                                                                            | BR-34                    |
| phan_bo_doanh_thu    | UNIQUE            | thanh_toan_id                                                                                                                                                                                                            |                          |
| cong_no              | UNIQUE (một phần) | khoan_phai_thu_id WHERE loai = KY_GOC                                                                                                                                                                                    | Chạy lại không ghi trùng |
| yeu_cau              | UNIQUE (một phần) | (khach_thue_id, loai) WHERE trang_thai = CHO_PHE_DUYET                                                                                                                                                                   | BR-30                    |
| yeu_cau_tra_phong    | CHECK             | ngay_tra_du_kien ≥ ngay_tra_toi_thieu                                                                                                                                                                                    | BR-45                    |
| su_co                | CHECK             | chi_phi ≥ 0                                                                                                                                                                                                              | UC-17                    |
| khoan_chi            | CHECK             | so_tien > 0; nguon = SU_CO thì su_co_id NOT NULL                                                                                                                                                                         | UC-19                    |
| quyet_toan_tra_phong | UNIQUE            | hop_dong_id                                                                                                                                                                                                              |                          |
| quyet_toan_tra_phong | CHECK             | coc_con_hoan ≥ 0; cong_no_sau_thanh_ly ≥ 0                                                                                                                                                                               | BR-39                    |
| thong_bao            | UNIQUE            | khoa_chong_trung                                                                                                                                                                                                         | FR-159                   |
| su_kien_thong_bao    | UNIQUE            | khoa_su_kien                                                                                                                                                                                                             | NFR-021                  |
| nhat_ky_tac_vu       | UNIQUE            | (ma_tac_vu, ky_xu_ly)                                                                                                                                                                                                    | OPS-04                   |
| cau_hinh_he_thong    | UNIQUE            | khoa                                                                                                                                                                                                                     |                          |
| Chỉ mục              | INDEX             | khoan_phai_thu(ky, phong_id); thanh_toan(ngay_thanh_toan); cong_no(khach_thue_id, trang_thai); thong_bao(nguoi_nhan_id, da_doc); audit_log(doi_tuong_loai, doi_tuong_id, thoi_gian); hop_dong(ngay_ket_thuc, trang_thai) | NFR-001, NFR-002         |

---

# DANH MỤC GIÁ TRỊ ENUM TỔNG HỢP

| Thực thể              | Cột                    | Giá trị                                                                | State machine |
| --------------------- | ---------------------- | ---------------------------------------------------------------------- | ------------- |
| phong                 | trang_thai             | TRONG, DA_GIU, DANG_THUE, DANG_XU_LY_TRA_PHONG, NGUNG_SU_DUNG          | SM-01         |
| hop_dong              | trang_thai             | DANG_HIEU_LUC, SAP_HET_HAN, HET_HAN, DA_THANH_LY                       | SM-02         |
| chi_so_dien           | trang_thai             | CHO_XAC_NHAN, DA_XAC_NHAN                                              | SM-03         |
| tinh_trang_thanh_toan | trang_thai             | CHUA_THANH_TOAN, THANH_TOAN_MOT_PHAN, DA_THANH_TOAN                    | SM-04         |
| yeu_cau               | trang_thai             | CHO_PHE_DUYET, DA_PHE_DUYET, TU_CHOI                                   | SM-05         |
| su_co                 | trang_thai             | CHO_TIEP_NHAN, DANG_XU_LY, DA_XU_LY, DA_HUY                            | SM-06         |
| phieu_thu             | trang_thai             | DA_LAP, DA_GUI                                                         | SM-07         |
| tai_khoan             | trang_thai             | HOAT_DONG, DA_KHOA                                                     | SM-08         |
| minh_chung_thanh_toan | trang_thai             | CHO_XAC_NHAN, DA_DOI_CHIEU                                             | SM-09         |
| nguoi_o_cung          | trang_thai             | CHO_XU_LY, DANG_O, TU_CHOI, DA_ROI                                     | SM-10         |
| tien_coc              | trang_thai             | CHUA_NHAN, DA_NHAN, DA_HOAN, DA_KHAU_TRU_MOT_PHAN, DA_KHAU_TRU_TOAN_BO | SM-11         |
| can_tro               | trang_thai_hoat_dong   | HOAT_DONG, NGUNG_HOAT_DONG                                             | SM-12         |
| giu_phong             | trang_thai             | DANG_GIU, DA_CHUYEN_THANH_HOP_DONG, DA_HUY_HOAN, DA_HUY_KHONG_HOAN     | SM-13         |
| yeu_cau               | loai                   | GIA_HAN, TRA_PHONG, DAT_LAI_MAT_KHAU                                   | —             |
| khoan_dieu_chinh      | loai / che_do          | PHI_PHAT_SINH, GIAM_TRU / CO_DINH, THEO_KY                             | BR-42         |
| khoan_phai_thu        | loai_ky                | THUONG, LE_DAU, LE_CUOI                                                | BR-38         |
| thanh_toan            | trang_thai / hinh_thuc | HIEU_LUC, DA_HUY / CHUYEN_KHOAN, TIEN_MAT, DANH_DAU_DA_DONG, THU_NO    | BR-34         |
| su_co                 | doi_tuong_chiu_phi     | CHU_TRO, KHACH_THUE                                                    | BR-18         |
| khoan_cho_khau_tru    | trang_thai             | CHO_KHAU_TRU, DA_KHAU_TRU, DA_HUY                                      | BR-48         |
| cong_no               | loai / trang_thai      | KY_GOC, SAU_THANH_LY / CON_NO, DA_THU_DU                               | BR-19         |
| khoan_chi             | nguon / trang_thai     | TAY, SU_CO / HIEU_LUC, DA_HUY                                          | UC-19         |
| quyet_toan_tra_phong  | trang_thai             | DANG_XU_LY, DA_THANH_LY                                                | UC-15         |
| su_kien_thong_bao     | trang_thai             | CHO_GUI, DA_GUI, LOI                                                   | Q-08          |
| nhat_ky_tac_vu        | trang_thai             | DANG_CHAY, THANH_CONG, MOT_PHAN, THAT_BAI                              | UC-25         |
