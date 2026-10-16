-- MYSQL DEMO — PTUD QUẢN LÝ PHÒNG TRỌ
-- Yêu cầu: MySQL 8.0.16 trở lên (thực thi check constraint); InnoDB; UTF-8.
-- Tạo database mới phong_tro_demo. Chạy một lần; không drop dữ liệu cũ.
-- Nếu database đã tồn tại, chọn tên mới ở create database và use; không chạy tiếp bỏ qua lỗi.
-- Mốc dữ liệu giả lập: 12/10/2026. Ngày tháng cố định, không phụ thuộc ngày import.
-- 1 chủ trọ + 20 hồ sơ khách thuê + 21 tài khoản đăng nhập.
-- Khách 01–16 đang thuê; 17–18 đã trả phòng; 19–20 mới có hồ sơ chưa ký hợp đồng.
-- 30 phòng / 3 căn; 16 phòng đang thuê (1 xử lý trả phòng), 12 trống, 2 ngừng sử dụng.
-- 26 người đang ở: 3 phòng × 3 người, 4 phòng × 2 người, 9 phòng × 1 người.
-- Người ở cùng lưu ThanhVienPhong, không phát sinh thêm tài khoản/KhachThue.
-- 2 hợp đồng mới: khách 15 nhận phòng 01/10, khách 16 nhận phòng 10/10; khách 16 chưa nộp cọc.
-- Mật khẩu demo mọi tài khoản: Demo@123; bcrypt $2b$ cost 12. Chủ: chutro; khách: 0912000001..0912000020.
-- Hash cần bộ xác thực bcrypt tương thích ở ứng dụng; tài khoản CSDL MySQL không được tạo bởi script này.
-- maPhongDangThue là cột kỹ thuật generated, không phải Entity/cột nghiệp vụ mới.
-- FK dùng hành vi mặc định NO ACTION/RESTRICT, không khai báo referential action trên cột có check.
-- Dữ liệu mở rộng đề xuất ở database.md không được thêm vào script này.
-- Đã kiểm tra seed bằng SQLite (DDL chuyển tương đương), khóa ngoại, unique/check và đối chiếu tổng.
-- Môi trường tạo file không có MySQL server; chưa thử import trực tiếp trên MySQL.
-- Quy tắc liên bảng (quyền, sức chứa, đúng subtype, nhánh chi phí, tính lại tổng) do Service thực hiện.
-- Có truy vấn đối chiếu cuối file để kiểm tra dữ liệu seed; chưa cài trigger tính tổng tự động.
-- Điện kỳ 10 thu tháng 9 trừ chỉ số tháng 8. Kỳ 9 dùng snapshot 75 kWh của tháng 8.
-- Không thu điện tháng 9 cho khách mới nhận phòng tháng 10; tiền nước 100000/người/kỳ.
-- Khách 16: tiền phòng 22/31 tháng, nước/dịch vụ khoán nguyên kỳ (giả định demo).
-- Ảnh /demo/images/... là URL minh họa, chưa có file ảnh thật.

set names utf8mb4;
set session time_zone = '+07:00';
set session sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION,NO_BACKSLASH_ESCAPES';
create database `quan_ly_phong_tro_demo` character set utf8mb4 collate utf8mb4_unicode_ci;
use `quan_ly_phong_tro_demo`;

-- 1. TẠO 36 BẢNG

create table `TaiKhoan` (
`maTaiKhoan` varchar(36) not null,
`tenDangNhap` varchar(15) not null,
unique key `uq_TaiKhoan_tenDangNhap` (`tenDangNhap`),
`matKhauHash` varchar(255) not null,
`vaiTro` varchar(30) not null,
`trangThai` varchar(30) not null default 'HOAT_DONG',
`batBuocDoiMatKhau` boolean not null default true,
primary key (`maTaiKhoan`),
constraint `ck_TaiKhoan_1` check (`vaiTro` in ('CHU_TRO', 'KHACH_THUE')),
constraint `ck_TaiKhoan_2` check (`trangThai` in ('HOAT_DONG', 'DA_KHOA'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ChuTro` (
`maChuTro` varchar(36) not null,
`hoTen` varchar(100) not null,
`soDienThoai` varchar(15) not null,
`maTaiKhoan` varchar(36) not null,
unique key `uq_ChuTro_maTaiKhoan` (`maTaiKhoan`),
constraint `fk_ChuTro_maTaiKhoan` foreign key (`maTaiKhoan`) references `TaiKhoan` (`maTaiKhoan`),
primary key (`maChuTro`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `KhachThue` (
`maKhachThue` varchar(36) not null,
`hoTen` varchar(100) not null,
`soDienThoai` varchar(15) not null,
`soGiayTo` varchar(20) not null,
unique key `uq_KhachThue_soGiayTo` (`soGiayTo`),
`maTaiKhoan` varchar(36) null,
unique key `uq_KhachThue_maTaiKhoan` (`maTaiKhoan`),
constraint `fk_KhachThue_maTaiKhoan` foreign key (`maTaiKhoan`) references `TaiKhoan` (`maTaiKhoan`),
primary key (`maKhachThue`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `CanTro` (
`maCan` varchar(36) not null,
`tenCan` varchar(100) not null,
`diaChi` varchar(255) not null,
`moTa` varchar(1000) null,
`quyDinhChung` varchar(255) null,
`hinhAnhTongQuanUrl` varchar(500) null,
`trangThai` varchar(30) not null,
`maChuTro` varchar(36) not null,
constraint `fk_CanTro_maChuTro` foreign key (`maChuTro`) references `ChuTro` (`maChuTro`),
primary key (`maCan`),
key `ix_CanTro_1` (`maChuTro`, `trangThai`),
constraint `ck_CanTro_1` check (`trangThai` in ('HOAT_DONG', 'NGUNG_HOAT_DONG'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `PhongTro` (
`maPhong` varchar(36) not null,
`soPhong` varchar(255) not null,
`dienTich` decimal(18,2) not null,
`giaThue` decimal(18,2) not null,
`soNguoiToiDa` integer not null,
`noiThatMoTa` varchar(1000) null,
`trangThai` varchar(30) not null default 'TRONG',
`maCan` varchar(36) not null,
constraint `fk_PhongTro_maCan` foreign key (`maCan`) references `CanTro` (`maCan`),
primary key (`maPhong`),
unique key `uq_PhongTro_ky1` (`maCan`, `soPhong`),
key `ix_PhongTro_1` (`maCan`, `trangThai`),
constraint `ck_PhongTro_1` check (`giaThue` >= 0),
constraint `ck_PhongTro_2` check (`soNguoiToiDa` >= 0),
constraint `ck_PhongTro_3` check (`trangThai` in ('TRONG', 'DA_GIU', 'DANG_THUE', 'DANG_XU_LY_TRA_PHONG', 'NGUNG_SU_DUNG')),
constraint `ck_PhongTro_4` check (`dienTich` > 0),
constraint `ck_PhongTro_5` check (`soNguoiToiDa` > 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `TaiSan` (
`maTaiSan` varchar(36) not null,
`tenTaiSan` varchar(100) not null,
`soLuong` integer not null default 1,
`tinhTrang` varchar(1000) null,
`ghiChu` varchar(1000) null,
`maPhong` varchar(36) not null,
constraint `fk_TaiSan_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
primary key (`maTaiSan`),
constraint `ck_TaiSan_1` check (`soLuong` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `HopDong` (
`maHopDong` varchar(36) not null,
`ngayBatDau` date not null,
`ngayKetThuc` date not null,
`giaThue` decimal(18,2) not null,
`donGiaDien` decimal(18,2) not null,
`donGiaNuoc` decimal(18,2) not null,
`dieuKhoan` varchar(255) not null,
`trangThai` varchar(30) not null,
`ngayThanhLy` date null,
`daCoBanGiayKy` boolean not null default false,
`phiDichVu` decimal(18,2) not null default 0,
`goiGiaHanChoPhep` varchar(20) null,
`maKhachThue` varchar(36) not null,
constraint `fk_HopDong_maKhachThue` foreign key (`maKhachThue`) references `KhachThue` (`maKhachThue`),
`maPhong` varchar(36) not null,
constraint `fk_HopDong_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
primary key (`maHopDong`),
`maPhongDangThue` varchar(36) generated always as (case when `trangThai` <> 'DA_THANH_LY' then `maPhong` else null end) stored,
unique key `uq_HopDong_maPhongDangThue` (`maPhongDangThue`),
key `ix_HopDong_1` (`maKhachThue`, `trangThai`),
key `ix_HopDong_2` (`ngayKetThuc`, `trangThai`),
constraint `ck_HopDong_1` check (`giaThue` >= 0),
constraint `ck_HopDong_2` check (`donGiaDien` >= 0),
constraint `ck_HopDong_3` check (`donGiaNuoc` >= 0),
constraint `ck_HopDong_4` check (`trangThai` in ('DANG_HIEU_LUC', 'SAP_HET_HAN', 'HET_HAN', 'DA_THANH_LY')),
constraint `ck_HopDong_5` check (`ngayKetThuc` > `ngayBatDau`),
constraint `ck_HopDong_6` check ((`trangThai` = 'DA_THANH_LY' and `ngayThanhLy` is not null and `ngayThanhLy` >= `ngayBatDau`) or (`trangThai` <> 'DA_THANH_LY' and `ngayThanhLy` is null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `TienCoc` (
`maTienCoc` varchar(36) not null,
`soTienCoc` decimal(18,2) not null,
`ngayNhanCoc` date null,
`trangThai` varchar(30) not null,
`soTienDaHoan` decimal(18,2) not null default 0,
`soTienDaKhauTru` decimal(18,2) not null default 0,
`maHopDong` varchar(36) not null,
unique key `uq_TienCoc_maHopDong` (`maHopDong`),
constraint `fk_TienCoc_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
primary key (`maTienCoc`),
constraint `ck_TienCoc_1` check (`soTienCoc` >= 0),
constraint `ck_TienCoc_2` check (`soTienDaHoan` >= 0),
constraint `ck_TienCoc_3` check (`soTienDaKhauTru` >= 0),
constraint `ck_TienCoc_4` check (`trangThai` in ('CHUA_NHAN', 'DA_NHAN', 'DA_HOAN', 'DA_KHAU_TRU_MOT_PHAN', 'DA_KHAU_TRU_TOAN_BO')),
constraint `ck_TienCoc_5` check (`soTienDaHoan` + `soTienDaKhauTru` <= `soTienCoc`),
constraint `ck_TienCoc_6` check ((`trangThai` = 'CHUA_NHAN' and `ngayNhanCoc` is null and `soTienDaHoan` = 0 and `soTienDaKhauTru` = 0) or (`trangThai` <> 'CHUA_NHAN' and `ngayNhanCoc` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ThanhVienPhong` (
`maThanhVienPhong` varchar(36) not null,
`hoTen` varchar(100) not null,
`soDienThoai` varchar(15) not null,
`ngayVao` date not null,
`ngayRoi` date null,
`trangThaiCuTru` varchar(50) not null,
`soGiayTo` varchar(50) null,
`ngaySinh` date null,
`gioiTinh` varchar(20) null,
`diaChiThuongTru` varchar(255) null,
`quanHe` varchar(80) null,
`maPhong` varchar(36) not null,
constraint `fk_ThanhVienPhong_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
`maHopDong` varchar(36) not null,
constraint `fk_ThanhVienPhong_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
primary key (`maThanhVienPhong`),
key `ix_ThanhVienPhong_1` (`maPhong`, `trangThaiCuTru`),
key `ix_ThanhVienPhong_2` (`maHopDong`, `trangThaiCuTru`),
constraint `ck_ThanhVienPhong_1` check (`trangThaiCuTru` in ('DANG_O', 'DA_ROI')),
constraint `ck_ThanhVienPhong_2` check (`ngayRoi` is null or `ngayRoi` >= `ngayVao`),
constraint `ck_ThanhVienPhong_3` check ((`trangThaiCuTru` = 'DANG_O' and `ngayRoi` is null) or (`trangThaiCuTru` = 'DA_ROI' and `ngayRoi` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ViPhamHopDong` (
`maViPham` varchar(36) not null,
`noiDung` varchar(1000) not null,
`ngayGhiNhan` timestamp not null default current_timestamp,
`dieuKhoanLienQuan` varchar(255) not null,
`mucPhat` decimal(18,2) null,
`maHopDong` varchar(36) not null,
constraint `fk_ViPhamHopDong_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
primary key (`maViPham`),
constraint `ck_ViPhamHopDong_1` check (`mucPhat` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ChiSoDien` (
`maChiSo` varchar(36) not null,
`thang` integer not null,
`nam` integer not null,
`loaiChiSo` varchar(30) not null default 'DINH_KY',
`khoaNghiepVu` varchar(100) not null default 'DINH_KY',
`chiSoMoi` decimal(18,2) not null,
`anhCongToUrl` varchar(500) null,
`donGiaApDung` decimal(18,2) not null,
`trangThaiXacNhan` varchar(30) not null,
`ngayGhiNhan` timestamp not null default current_timestamp,
`nguoiGhiNhanId` varchar(36) not null,
constraint `fk_ChiSoDien_nguoiGhiNhanId` foreign key (`nguoiGhiNhanId`) references `TaiKhoan` (`maTaiKhoan`),
`nguoiXacNhanId` varchar(36) null,
constraint `fk_ChiSoDien_nguoiXacNhanId` foreign key (`nguoiXacNhanId`) references `TaiKhoan` (`maTaiKhoan`),
`ngayXacNhan` timestamp null default null,
`maPhong` varchar(36) not null,
constraint `fk_ChiSoDien_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
`daXoa` boolean not null default false,
`lyDoXoa` varchar(1000) null,
`ngayXoa` timestamp null default null,
`nguoiXoaId` varchar(36) null,
constraint `fk_ChiSoDien_nguoiXoaId` foreign key (`nguoiXoaId`) references `TaiKhoan` (`maTaiKhoan`),
primary key (`maChiSo`),
-- uq_ChiSoDien_nghiepVu is added after legacy seed keys are normalized.
constraint `ck_ChiSoDien_1` check (`thang` between 1 and 12),
constraint `ck_ChiSoDien_2` check (`donGiaApDung` >= 0),
constraint `ck_ChiSoDien_3` check (`trangThaiXacNhan` in ('CHO_XAC_NHAN', 'DA_XAC_NHAN')),
constraint `ck_ChiSoDien_4` check (`nam` > 0),
constraint `ck_ChiSoDien_5` check (`chiSoMoi` >= 0),
constraint `ck_ChiSoDien_6` check ((`trangThaiXacNhan` = 'CHO_XAC_NHAN' and `nguoiXacNhanId` is null and `ngayXacNhan` is null) or (`trangThaiXacNhan` = 'DA_XAC_NHAN' and `nguoiXacNhanId` is not null and `ngayXacNhan` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `YeuCau` (
`maYeuCau` varchar(36) not null,
`ngayGui` timestamp not null default current_timestamp,
`noiDung` varchar(1000) not null,
`trangThai` varchar(30) not null default 'CHO_XU_LY',
`loaiYeuCau` varchar(30) not null,
`maKhachThue` varchar(36) not null,
constraint `fk_YeuCau_maKhachThue` foreign key (`maKhachThue`) references `KhachThue` (`maKhachThue`),
`lyDoXuLy` varchar(1000) null,
`ngayDuyet` timestamp null default null,
`ngayRutDuyet` timestamp null default null,
`nguoiXuLyId` varchar(36) null,
constraint `fk_YeuCau_nguoiXuLyId` foreign key (`nguoiXuLyId`) references `TaiKhoan` (`maTaiKhoan`),
primary key (`maYeuCau`),
key `ix_YeuCau_1` (`maKhachThue`, `trangThai`, `loaiYeuCau`),
constraint `ck_YeuCau_1` check (`loaiYeuCau` in ('GIA_HAN', 'TRA_PHONG', 'DE_XUAT_BAN_CUNG_PHONG')),
constraint `ck_YeuCau_2` check (`trangThai` in ('CHO_XU_LY', 'DA_PHE_DUYET', 'TU_CHOI', 'DA_RUT'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ThanhToan` (
`maThanhToan` varchar(36) not null,
`thang` integer not null,
`nam` integer not null,
`tongPhaiTra` decimal(18,2) not null,
`tongDaThanhToan` decimal(18,2) not null,
`soTienConNo` decimal(18,2) not null,
`trangThai` varchar(30) not null,
`maHopDong` varchar(36) not null,
constraint `fk_ThanhToan_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
`loaiThanhToan` varchar(30) not null default 'DINH_KY',
`maBienBanTraPhong` varchar(36) null,
`ngayLap` timestamp not null default current_timestamp,
`daGui` boolean not null default false,
`ngayGui` timestamp null default null,
`daNhacHan` boolean not null default false,
`ngayNhacHan` timestamp null default null,
`quaHan` boolean not null default false,
`ngayQuaHan` timestamp null default null,
`daChotCongNo` boolean not null default false,
`ngayChotCongNo` timestamp null default null,
`soTienChotCongNo` decimal(18,2) null,
primary key (`maThanhToan`),
unique key `uq_ThanhToan_ky_loai` (`maHopDong`, `thang`, `nam`, `loaiThanhToan`),
unique key `uq_ThanhToan_maBienBanTraPhong` (`maBienBanTraPhong`),
key `ix_ThanhToan_1` (`trangThai`, `nam`, `thang`),
key `ix_ThanhToan_tac_vu` (`loaiThanhToan`, `nam`, `thang`, `soTienConNo`, `daGui`, `daNhacHan`, `quaHan`, `daChotCongNo`),
constraint `ck_ThanhToan_1` check (`thang` between 1 and 12),
constraint `ck_ThanhToan_2` check (`soTienConNo` >= 0),
constraint `ck_ThanhToan_3` check (`trangThai` in ('CHUA_THANH_TOAN', 'THANH_TOAN_MOT_PHAN', 'DA_THANH_TOAN')),
constraint `ck_ThanhToan_4` check (`nam` > 0),
constraint `ck_ThanhToan_5` check (`tongPhaiTra` >= 0),
constraint `ck_ThanhToan_6` check (`tongDaThanhToan` >= 0),
constraint `ck_ThanhToan_7` check (`tongDaThanhToan` <= `tongPhaiTra`),
constraint `ck_ThanhToan_8` check (`soTienConNo` = `tongPhaiTra` - `tongDaThanhToan`),
constraint `ck_ThanhToan_9` check ((`tongDaThanhToan` = `tongPhaiTra` and `trangThai` = 'DA_THANH_TOAN') or (`tongPhaiTra` > 0 and `tongDaThanhToan` = 0 and `trangThai` = 'CHUA_THANH_TOAN') or (`tongDaThanhToan` > 0 and `tongDaThanhToan` < `tongPhaiTra` and `trangThai` = 'THANH_TOAN_MOT_PHAN')),
constraint `ck_ThanhToan_013_gui` check ((`daGui`=false and `ngayGui` is null) or (`daGui`=true and `ngayGui` is not null)),
constraint `ck_ThanhToan_013_nhac` check ((`daNhacHan`=false and `ngayNhacHan` is null) or (`daNhacHan`=true and `ngayNhacHan` is not null)),
constraint `ck_ThanhToan_013_qua_han` check ((`quaHan`=false and `ngayQuaHan` is null) or (`quaHan`=true and `ngayQuaHan` is not null)),
constraint `ck_ThanhToan_013_chot_no` check ((`daChotCongNo`=false and `ngayChotCongNo` is null and `soTienChotCongNo` is null) or (`daChotCongNo`=true and `ngayChotCongNo` is not null and `soTienChotCongNo` is not null and `soTienChotCongNo` >= 0))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `SuCo` (
`maSuCo` varchar(36) not null,
`loaiSuCo` varchar(50) not null,
`mucDoUuTien` varchar(255) not null,
`moTa` varchar(1000) null,
`hinhAnhUrl` varchar(500) null,
`trangThai` varchar(30) not null,
`ngayGui` timestamp not null default current_timestamp,
`ngayChinhSua` timestamp null default null,
`ngayTiepNhan` timestamp null default null,
`ketQuaXuLy` varchar(1000) null,
`thietBiThayThe` varchar(255) null,
`chiPhiSuaChua` decimal(18,2) null,
`doiTuongChiuPhi` varchar(255) null,
`ngayHoanTat` timestamp null default null,
`daXoa` boolean not null default false,
`lyDoXoa` varchar(1000) null,
`ngayXoa` timestamp null default null,
`nguoiTiepNhanId` varchar(36) null,
constraint `fk_SuCo_nguoiTiepNhanId` foreign key (`nguoiTiepNhanId`) references `TaiKhoan` (`maTaiKhoan`),
`nguoiXoaId` varchar(36) null,
constraint `fk_SuCo_nguoiXoaId` foreign key (`nguoiXoaId`) references `TaiKhoan` (`maTaiKhoan`),
`maNguoiGui` varchar(36) not null,
constraint `fk_SuCo_maNguoiGui` foreign key (`maNguoiGui`) references `TaiKhoan` (`maTaiKhoan`),
`maPhong` varchar(36) not null,
constraint `fk_SuCo_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
primary key (`maSuCo`),
key `ix_SuCo_1` (`maPhong`, `daXoa`, `trangThai`),
constraint `ck_SuCo_1` check (`trangThai` in ('CHO_TIEP_NHAN','DANG_XU_LY','DA_XU_LY')),
constraint `ck_SuCo_2` check (`chiPhiSuaChua` is null or `chiPhiSuaChua` >= 0),
constraint `ck_SuCo_3` check (`doiTuongChiuPhi` is null or `doiTuongChiuPhi` in ('CHU_TRO','KHACH_THUE')),
constraint `ck_SuCo_4` check (`trangThai` <> 'DA_XU_LY' or (`ketQuaXuLy` is not null and `chiPhiSuaChua` is not null and `doiTuongChiuPhi` is not null and `ngayHoanTat` is not null)),
constraint `ck_SuCo_5` check (`daXoa` = false or (`trangThai` = 'CHO_TIEP_NHAN' and `lyDoXoa` is not null and `ngayXoa` is not null and `nguoiXoaId` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `YeuCauGiaHan` (
`ngayKetThucDeXuat` date not null,
`maYeuCau` varchar(36) not null,
constraint `fk_YeuCauGiaHan_maYeuCau` foreign key (`maYeuCau`) references `YeuCau` (`maYeuCau`),
`maHopDong` varchar(36) not null,
constraint `fk_YeuCauGiaHan_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
primary key (`maYeuCau`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `YeuCauTraPhong` (
`maYeuCau` varchar(36) not null,
constraint `fk_YeuCauTraPhong_maYeuCau` foreign key (`maYeuCau`) references `YeuCau` (`maYeuCau`),
`maHopDong` varchar(36) not null,
constraint `fk_YeuCauTraPhong_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
`ngayTraDuKien` date null,
`ngayTraDaDuyet` date null,
`lyDoTraSom` varchar(1000) null,
primary key (`maYeuCau`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `DeXuatBanCungPhong` (
`hoTenNguoiDeXuat` varchar(255) not null,
`soDienThoaiNguoiDeXuat` varchar(15) not null,
`noiDungBoSung` varchar(1000) null,
`soGiayTo` varchar(50) null,
`ngaySinh` date null,
`gioiTinh` varchar(20) null,
`diaChiThuongTru` varchar(255) null,
`quanHe` varchar(80) null,
`ngayBatDauO` date null,
`lyDoTuChoi` varchar(1000) null,
`nguoiXuLyId` varchar(36) null,
constraint `fk_DeXuatBanCungPhong_nguoiXuLyId` foreign key (`nguoiXuLyId`) references `TaiKhoan` (`maTaiKhoan`),
`ngayXuLy` timestamp null default null,
`maYeuCau` varchar(36) not null,
constraint `fk_DeXuatBanCungPhong_maYeuCau` foreign key (`maYeuCau`) references `YeuCau` (`maYeuCau`),
`maPhong` varchar(36) not null,
constraint `fk_DeXuatBanCungPhong_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
primary key (`maYeuCau`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `GiaoDichThanhToan` (
`maGiaoDich` varchar(36) not null,
`soTien` decimal(18,2) null,
`thoiDiemGhiNhan` timestamp not null,
`minhChungUrl` varchar(500) null,
`trangThaiXacNhan` varchar(30) not null,
`thoiDiemXacNhan` timestamp null default null,
`lyDoHuy` varchar(1000) null,
`ngayHuy` timestamp null default null,
`nguoiHuyId` varchar(36) null,
constraint `fk_GiaoDichThanhToan_nguoiHuyId` foreign key (`nguoiHuyId`) references `TaiKhoan` (`maTaiKhoan`),
`maThanhToan` varchar(36) not null,
constraint `fk_GiaoDichThanhToan_maThanhToan` foreign key (`maThanhToan`) references `ThanhToan` (`maThanhToan`),
`nguonThanhToan` varchar(30) not null default 'THU_TIEN',
primary key (`maGiaoDich`),
key `ix_GiaoDichThanhToan_1` (`maThanhToan`, `trangThaiXacNhan`),
constraint `ck_GiaoDichThanhToan_1` check (`soTien` >= 0),
constraint `ck_GiaoDichThanhToan_2` check (`trangThaiXacNhan` in ('CHO_XAC_NHAN', 'DA_XAC_NHAN', 'TU_CHOI', 'DA_HUY')),
constraint `ck_GiaoDichThanhToan_3` check (`trangThaiXacNhan` not in ('DA_XAC_NHAN','DA_HUY') or (`soTien` is not null and `soTien` > 0 and `thoiDiemXacNhan` is not null)),
constraint `ck_GiaoDichThanhToan_4` check (`trangThaiXacNhan` <> 'DA_HUY' or (`lyDoHuy` is not null and `ngayHuy` is not null and `nguoiHuyId` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `KhoanDieuChinh` (
`maKhoanDieuChinh` varchar(36) not null,
`maHopDong` varchar(36) not null,
constraint `fk_KhoanDieuChinh_hopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
`loaiKhoan` varchar(30) not null,
`tenLyDo` varchar(255) not null,
`soTien` decimal(18,2) not null,
`cheDo` varchar(20) not null,
`thangApDung` integer null,
`namApDung` integer null,
`ngayBatDau` date null,
`trangThai` varchar(20) not null default 'DANG_AP_DUNG',
`ngayTao` timestamp not null default current_timestamp,
`ngayCapNhat` timestamp not null default current_timestamp,
`ngayTat` timestamp null default null,
`lyDoTat` varchar(1000) null,
`nguoiTaoId` varchar(36) not null,
constraint `fk_KhoanDieuChinh_nguoiTao` foreign key (`nguoiTaoId`) references `TaiKhoan` (`maTaiKhoan`),
`nguoiCapNhatId` varchar(36) null,
constraint `fk_KhoanDieuChinh_nguoiCapNhat` foreign key (`nguoiCapNhatId`) references `TaiKhoan` (`maTaiKhoan`),
primary key (`maKhoanDieuChinh`),
key `ix_KhoanDieuChinh_ap_dung` (`maHopDong`, `trangThai`, `cheDo`, `namApDung`, `thangApDung`),
constraint `ck_KhoanDieuChinh_1` check (`loaiKhoan` in ('PHI_PHAT_SINH','GIAM_TRU')),
constraint `ck_KhoanDieuChinh_2` check (`soTien` > 0),
constraint `ck_KhoanDieuChinh_3` check (`cheDo` in ('CO_DINH','THEO_KY')),
constraint `ck_KhoanDieuChinh_4` check ((`cheDo`='THEO_KY' and `thangApDung` between 1 and 12 and `namApDung` > 0 and `ngayBatDau` is null) or (`cheDo`='CO_DINH' and `thangApDung` is null and `namApDung` is null and `ngayBatDau` is not null)),
constraint `ck_KhoanDieuChinh_5` check (`trangThai` in ('DANG_AP_DUNG','DA_TAT')),
constraint `ck_KhoanDieuChinh_6` check ((`trangThai`='DANG_AP_DUNG' and `ngayTat` is null and `lyDoTat` is null) or (`trangThai`='DA_TAT' and `ngayTat` is not null and `lyDoTat` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ChiTietThanhToan` (
`maChiTiet` varchar(36) not null,
`loaiKhoan` varchar(30) not null,
`soTien` decimal(18,2) not null,
`dienGiai` varchar(255) not null,
`maThanhToan` varchar(36) not null,
constraint `fk_ChiTietThanhToan_maThanhToan` foreign key (`maThanhToan`) references `ThanhToan` (`maThanhToan`),
`maSuCo` varchar(36) null,
unique key `uq_ChiTietThanhToan_maSuCo` (`maSuCo`),
constraint `fk_ChiTietThanhToan_maSuCo` foreign key (`maSuCo`) references `SuCo` (`maSuCo`),
`maKhoanDieuChinh` varchar(36) null,
constraint `fk_ChiTietThanhToan_khoanDieuChinh` foreign key (`maKhoanDieuChinh`) references `KhoanDieuChinh` (`maKhoanDieuChinh`),
`nguoiThucHienId` varchar(36) null,
constraint `fk_ChiTietThanhToan_nguoiThucHien` foreign key (`nguoiThucHienId`) references `TaiKhoan` (`maTaiKhoan`),
`thoiDiemTao` timestamp not null default current_timestamp,
primary key (`maChiTiet`),
key `ix_ChiTietThanhToan_maThanhToan` (`maThanhToan`),
unique key `uq_ChiTietThanhToan_dieu_chinh` (`maThanhToan`, `maKhoanDieuChinh`),
constraint `ck_ChiTietThanhToan_013` check ((`loaiKhoan` in ('GIAM_TRU','DIEU_CHINH_GIAM') and `soTien` < 0) or (`loaiKhoan` in ('TIEN_PHONG','TIEN_DIEN','TIEN_NUOC','PHI_DICH_VU','PHI_PHAT_SINH','DIEU_CHINH_TANG','NO_SAU_THANH_LY','SUA_CHUA') and `soTien` >= 0))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `KhoanChi` (
`maKhoanChi` varchar(36) not null,
`loaiKhoanChi` varchar(50) not null,
`soTien` decimal(18,2) not null,
`ngayPhatSinh` date not null,
`phamVi` varchar(30) not null,
`ghiChu` varchar(1000) null,
`trangThai` varchar(30) not null default 'HIEU_LUC',
`lyDoHuy` varchar(1000) null,
`ngayHuy` timestamp null default null,
`nguoiHuyId` varchar(36) null,
constraint `fk_KhoanChi_nguoiHuyId` foreign key (`nguoiHuyId`) references `TaiKhoan` (`maTaiKhoan`),
`maCan` varchar(36) null,
constraint `fk_KhoanChi_maCan` foreign key (`maCan`) references `CanTro` (`maCan`),
`maSuCo` varchar(36) null,
unique key `uq_KhoanChi_maSuCo` (`maSuCo`),
constraint `fk_KhoanChi_maSuCo` foreign key (`maSuCo`) references `SuCo` (`maSuCo`),
primary key (`maKhoanChi`),
key `ix_KhoanChi_1` (`maCan`, `ngayPhatSinh`),
key `ix_KhoanChi_2` (`phamVi`, `ngayPhatSinh`),
constraint `ck_KhoanChi_1` check (`soTien` >= 0),
constraint `ck_KhoanChi_2` check (`phamVi` in ('CAN_TRO', 'TOAN_CHUOI')),
constraint `ck_KhoanChi_3` check ((`phamVi` = 'CAN_TRO' and `maCan` is not null) or (`phamVi` = 'TOAN_CHUOI' and `maCan` is null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ThongBao` (
`maThongBao` varchar(36) not null,
`loaiThongBao` varchar(50) not null,
`noiDung` varchar(1000) not null,
`thoiDiemTao` timestamp not null,
`daDoc` boolean not null default false,
`maSuCo` varchar(36) null,
constraint `fk_ThongBao_maSuCo` foreign key (`maSuCo`) references `SuCo` (`maSuCo`),
`maTaiKhoan` varchar(36) not null,
constraint `fk_ThongBao_maTaiKhoan` foreign key (`maTaiKhoan`) references `TaiKhoan` (`maTaiKhoan`),
`khoaSuKien` varchar(150) null,
primary key (`maThongBao`),
key `ix_ThongBao_1` (`maTaiKhoan`, `daDoc`, `thoiDiemTao`),
unique key `uq_ThongBao_maTaiKhoan_khoaSuKien` (`maTaiKhoan`, `khoaSuKien`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `SuCoTaiSan` (
`maSuCo` varchar(36) not null,
constraint `fk_SuCoTaiSan_maSuCo` foreign key (`maSuCo`) references `SuCo` (`maSuCo`),
`maTaiSan` varchar(36) not null,
constraint `fk_SuCoTaiSan_maTaiSan` foreign key (`maTaiSan`) references `TaiSan` (`maTaiSan`),
primary key (`maSuCo`, `maTaiSan`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `BienBanTraPhong` (
`maBienBan` varchar(36) not null,
`ngayKiemTra` date not null,
`tinhTrangPhong` varchar(1000) not null,
`ghiChu` varchar(1000) null,
`tongKhoanKhauTru` decimal(18,2) not null,
`soTienCocDuocHoan` decimal(18,2) not null,
`maHopDong` varchar(36) not null,
unique key `uq_BienBanTraPhong_maHopDong` (`maHopDong`),
constraint `fk_BienBanTraPhong_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
`maYeuCauTraPhong` varchar(36) null,
unique key `uq_BienBanTraPhong_maYeuCauTraPhong` (`maYeuCauTraPhong`),
constraint `fk_BienBanTraPhong_maYeuCauTraPhong` foreign key (`maYeuCauTraPhong`) references `YeuCauTraPhong` (`maYeuCau`),
`nguoiLapId` varchar(36) not null,
constraint `fk_BienBanTraPhong_nguoiLapId` foreign key (`nguoiLapId`) references `TaiKhoan` (`maTaiKhoan`),
`laDuLieuLegacy` boolean not null default false,
`ngayQuyetToan` date null,
`tienCocBanDau` decimal(18,2) null,
`tienPhongTraTruocDuocHoan` decimal(18,2) null,
`giaTriQuyetToanRong` decimal(18,2) null,
`soTienNoSauThanhLy` decimal(18,2) null,
`congThucQuyetToan` varchar(255) null,
`snapshotJson` json null,
primary key (`maBienBan`),
constraint `ck_BienBanTraPhong_1` check (`soTienCocDuocHoan` >= 0),
constraint `ck_BienBanTraPhong_2` check (`tongKhoanKhauTru` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `KhoanThu` (
`maKhoanThu` varchar(36) not null,
`loaiKhoanThu` varchar(50) not null,
`soTien` decimal(18,2) not null,
`ngayGhiNhan` date not null,
`ghiChu` varchar(1000) null,
`trangThaiGhiNhan` varchar(50) not null,
`lyDoHuy` varchar(1000) null,
`ngayHuy` timestamp null default null,
`maGiaoDichThanhToan` varchar(36) null,
unique key `uq_KhoanThu_maGiaoDichThanhToan` (`maGiaoDichThanhToan`),
constraint `fk_KhoanThu_maGiaoDichThanhToan` foreign key (`maGiaoDichThanhToan`) references `GiaoDichThanhToan` (`maGiaoDich`),
`maCan` varchar(36) not null,
constraint `fk_KhoanThu_maCan` foreign key (`maCan`) references `CanTro` (`maCan`),
primary key (`maKhoanThu`),
key `ix_KhoanThu_1` (`maCan`, `ngayGhiNhan`, `trangThaiGhiNhan`),
constraint `ck_KhoanThu_1` check (`soTien` >= 0),
constraint `ck_KhoanThu_2` check (`trangThaiGhiNhan` in ('HIEU_LUC', 'DA_HUY')),
constraint `ck_KhoanThu_3` check (`trangThaiGhiNhan` <> 'DA_HUY' or (`lyDoHuy` is not null and `ngayHuy` is not null))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `KhoanKhauTru` (
`maKhauTru` varchar(36) not null,
`loaiKhauTru` varchar(50) not null,
`lyDo` varchar(1000) not null,
`soTien` decimal(18,2) not null,
`ghiChu` varchar(1000) null,
`maBienBanTraPhong` varchar(36) not null,
constraint `fk_KhoanKhauTru_maBienBanTraPhong` foreign key (`maBienBanTraPhong`) references `BienBanTraPhong` (`maBienBan`),
`maTaiSan` varchar(36) null,
constraint `fk_KhoanKhauTru_maTaiSan` foreign key (`maTaiSan`) references `TaiSan` (`maTaiSan`),
`soLuongTaiSan` integer null,
`maViPham` varchar(36) null,
unique key `uq_KhoanKhauTru_maViPham` (`maViPham`),
constraint `fk_KhoanKhauTru_maViPham` foreign key (`maViPham`) references `ViPhamHopDong` (`maViPham`),
`maChiPhiSuCo` varchar(36) null,
unique key `uq_KhoanKhauTru_maChiPhiSuCo` (`maChiPhiSuCo`),
primary key (`maKhauTru`),
constraint `ck_KhoanKhauTru_1` check (`soTien` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `GiaoDichHoanCoc` (
`maGiaoDichHoanCoc` varchar(36) not null,
`maBienBanTraPhong` varchar(36) not null,
constraint `fk_GiaoDichHoanCoc_bienBan` foreign key (`maBienBanTraPhong`) references `BienBanTraPhong` (`maBienBan`),
`maTienCoc` varchar(36) not null,
constraint `fk_GiaoDichHoanCoc_tienCoc` foreign key (`maTienCoc`) references `TienCoc` (`maTienCoc`),
`ngayHoan` date not null,
`soTien` decimal(18,2) not null,
`nguoiGhiNhanId` varchar(36) not null,
constraint `fk_GiaoDichHoanCoc_nguoiGhiNhan` foreign key (`nguoiGhiNhanId`) references `TaiKhoan` (`maTaiKhoan`),
`khoaChongTrung` varchar(100) not null,
`thoiDiemTao` timestamp not null default current_timestamp,
primary key (`maGiaoDichHoanCoc`),
unique key `uq_GiaoDichHoanCoc_khoaChongTrung` (`khoaChongTrung`),
constraint `ck_GiaoDichHoanCoc_1` check (`soTien` > 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `LichSuGiaHanHopDong` (
`maLichSu` varchar(36) not null,
`maHopDong` varchar(36) not null,
`ngayKetThucCu` date not null,
`ngayKetThucMoi` date not null,
`soThang` integer not null,
`nguoiDuyetId` varchar(36) not null,
`thoiDiemDuyet` timestamp not null default current_timestamp,
primary key (`maLichSu`),
constraint `fk_LichSuGiaHanHopDong_hopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
constraint `fk_LichSuGiaHanHopDong_nguoiDuyet` foreign key (`nguoiDuyetId`) references `TaiKhoan` (`maTaiKhoan`),
constraint `ck_LichSuGiaHanHopDong_1` check (`soThang` in (6, 12))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `LichSuSuaHopDong` (
`maLichSu` varchar(36) not null,
`maHopDong` varchar(36) not null,
`truocJson` json null,
`sauJson` json not null,
`lyDo` varchar(1000) not null,
`nguoiSuaId` varchar(36) not null,
`thoiDiemSua` timestamp not null default current_timestamp,
primary key (`maLichSu`),
constraint `fk_LichSuSuaHopDong_hopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
constraint `fk_LichSuSuaHopDong_nguoiSua` foreign key (`nguoiSuaId`) references `TaiKhoan` (`maTaiKhoan`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `LichSuChuyenPhong` (
`maLichSu` varchar(36) not null,
`maHopDong` varchar(36) not null,
`maPhongCu` varchar(36) not null,
`maPhongMoi` varchar(36) not null,
`ngayChuyen` date not null,
`giaThueCu` decimal(18,2) not null,
`giaThueMoi` decimal(18,2) not null,
`chiSoDienCuoiPhongCu` decimal(18,2) not null,
`chiSoDienDauPhongMoi` decimal(18,2) not null,
`nguoiThucHienId` varchar(36) not null,
`thoiDiemTao` timestamp not null default current_timestamp,
primary key (`maLichSu`),
constraint `fk_LichSuChuyenPhong_hopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
constraint `fk_LichSuChuyenPhong_phongCu` foreign key (`maPhongCu`) references `PhongTro` (`maPhong`),
constraint `fk_LichSuChuyenPhong_phongMoi` foreign key (`maPhongMoi`) references `PhongTro` (`maPhong`),
constraint `fk_LichSuChuyenPhong_nguoiThucHien` foreign key (`nguoiThucHienId`) references `TaiKhoan` (`maTaiKhoan`),
constraint `ck_LichSuChuyenPhong_1` check (`maPhongCu` <> `maPhongMoi`),
constraint `ck_LichSuChuyenPhong_2` check (`chiSoDienCuoiPhongCu` >= 0 and `chiSoDienDauPhongMoi` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `LichSuChinhSuaChiSoDien` (
`maLichSu` varchar(36) not null,
`chiSoCu` decimal(18,2) not null,
`chiSoMoi` decimal(18,2) not null,
`lyDo` varchar(1000) not null,
`thoiDiemSua` timestamp not null default current_timestamp,
`nguoiSuaId` varchar(36) not null,
constraint `fk_LichSuChinhSuaChiSoDien_nguoiSuaId` foreign key (`nguoiSuaId`) references `TaiKhoan` (`maTaiKhoan`),
`maChiSo` varchar(36) not null,
constraint `fk_LichSuChinhSuaChiSoDien_maChiSo` foreign key (`maChiSo`) references `ChiSoDien` (`maChiSo`),
primary key (`maLichSu`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `ChiPhiSuCoKhachThue` (
`maChiPhiSuCo` varchar(36) not null,
`maSuCo` varchar(36) not null,
unique key `uq_ChiPhiSuCoKhachThue_maSuCo` (`maSuCo`),
constraint `fk_ChiPhiSuCoKhachThue_maSuCo` foreign key (`maSuCo`) references `SuCo` (`maSuCo`),
`maHopDong` varchar(36) not null,
constraint `fk_ChiPhiSuCoKhachThue_maHopDong` foreign key (`maHopDong`) references `HopDong` (`maHopDong`),
`soTien` decimal(18,2) not null,
`canCuTrachNhiem` varchar(1000) not null,
`trangThai` varchar(30) not null default 'CHO_KHAU_TRU',
`ngayGhiNhan` timestamp not null default current_timestamp,
`ngayKhauTru` timestamp null default null,
primary key (`maChiPhiSuCo`),
constraint `ck_ChiPhiSuCoKhachThue_1` check (`soTien` >= 0),
constraint `ck_ChiPhiSuCoKhachThue_2` check (`trangThai` in ('CHO_KHAU_TRU', 'DA_KHAU_TRU', 'DA_HUY'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `audit_log` (
`id` bigint not null auto_increment,
`actor_id` varchar(36) not null,
`action` varchar(100) not null,
`entity_type` varchar(100) not null,
`entity_id` varchar(100) not null,
`before_json` json null,
`after_json` json null,
`reason` text null,
`correlation_id` varchar(100) null,
`created_at` timestamp not null default current_timestamp,
primary key (`id`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `DatGiuPhong` (
`maDatGiu` varchar(36) not null,
`hoTenNguoiGiu` varchar(100) not null,
`soDienThoai` varchar(15) not null,
`soTienGiu` decimal(18,2) not null,
`ngayNhan` date not null,
`hanGiu` date not null,
`dieuKien` varchar(1000) not null,
`ghiChu` varchar(1000) null,
`trangThai` varchar(30) not null default 'DANG_GIU',
`soTienHoan` decimal(18,2) not null default 0,
`lyDoHuy` varchar(1000) null,
`ngayHuy` timestamp null default null,
`nguoiThucHienId` varchar(36) not null,
constraint `fk_DatGiuPhong_nguoiThucHienId` foreign key (`nguoiThucHienId`) references `TaiKhoan` (`maTaiKhoan`),
`maPhong` varchar(36) not null,
constraint `fk_DatGiuPhong_maPhong` foreign key (`maPhong`) references `PhongTro` (`maPhong`),
primary key (`maDatGiu`),
key `ix_DatGiuPhong_1` (`maPhong`, `trangThai`, `hanGiu`),
constraint `ck_DatGiuPhong_1` check (`soTienGiu` >= 0 and `soTienHoan` >= 0 and `soTienHoan` <= `soTienGiu`),
constraint `ck_DatGiuPhong_2` check (`hanGiu` > `ngayNhan`),
constraint `ck_DatGiuPhong_3` check (`trangThai` in ('DANG_GIU', 'DA_HUY', 'DA_CHUYEN_THANH_HOP_DONG'))
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `LichSuGiaHanGiuPhong` (
`maLichSu` varchar(36) not null,
`hanCu` date not null,
`hanMoi` date not null,
`lyDo` varchar(1000) null,
`thoiDiemTao` timestamp not null default current_timestamp,
`nguoiThucHienId` varchar(36) not null,
constraint `fk_LichSuGiaHanGiuPhong_nguoiThucHienId` foreign key (`nguoiThucHienId`) references `TaiKhoan` (`maTaiKhoan`),
`maDatGiu` varchar(36) not null,
constraint `fk_LichSuGiaHanGiuPhong_maDatGiu` foreign key (`maDatGiu`) references `DatGiuPhong` (`maDatGiu`),
primary key (`maLichSu`),
constraint `ck_LichSuGiaHanGiuPhong_1` check (`hanMoi` > `hanCu`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

alter table `ThanhToan` add constraint `fk_ThanhToan_maBienBanTraPhong` foreign key (`maBienBanTraPhong`) references `BienBanTraPhong` (`maBienBan`);
alter table `KhoanKhauTru` add constraint `fk_KhoanKhauTru_maChiPhiSuCo` foreign key (`maChiPhiSuCo`) references `ChiPhiSuCoKhachThue` (`maChiPhiSuCo`);

-- 2. NẠP DỮ LIỆU: nếu có lỗi, rollback; không commit tiếp phần dữ liệu lỗi.
create table `CauHinhHeThong` (
`maCauHinh` varchar(36) not null,
`khoa` varchar(100) not null,
`giaTri` json not null,
`moTa` varchar(500) null,
`ngayCapNhat` timestamp not null default current_timestamp,
`nguoiCapNhatId` varchar(36) not null,
constraint `fk_CauHinhHeThong_nguoiCapNhatId` foreign key (`nguoiCapNhatId`) references `TaiKhoan` (`maTaiKhoan`),
primary key (`maCauHinh`),
unique key `uq_CauHinhHeThong_khoa` (`khoa`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `DanhMucSuCo` (
`maDanhMuc` varchar(36) not null,
`ma` varchar(50) not null,
`ten` varchar(100) not null,
`dangHoatDong` boolean not null default true,
`thuTu` integer not null default 0,
primary key (`maDanhMuc`),
unique key `uq_DanhMucSuCo_ma` (`ma`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

start transaction;

-- TaiKhoan: 21 bản ghi
insert into `TaiKhoan` (`maTaiKhoan`, `tenDangNhap`, `matKhauHash`, `vaiTro`, `trangThai`, `batBuocDoiMatKhau`) values
('910fb605-b871-5141-8d96-1f8577508ac2', 'chutro', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'CHU_TRO', 'HOAT_DONG', false),
('492d371e-f8c5-53b7-8615-ffdb678575ab', '0912000001', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('c0257961-a1f1-5d31-a4b1-0b85155a48d1', '0912000002', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('903fd6e2-0a6f-5370-a49a-841492537834', '0912000003', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('39c3c547-4ab1-5838-bfc9-2d4a19938e51', '0912000004', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('4ca777c9-ae13-5b12-b28b-ed10e15c0be2', '0912000005', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('392586b8-d887-5c87-b0fb-72401eadb43a', '0912000006', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('df69c727-c0e2-5300-8b5e-fb8d21eaf2cb', '0912000007', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('e64073fe-9441-57a8-8752-d5944f870c3b', '0912000008', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('ca135837-b698-5ddf-81b4-66e8fffc7a8a', '0912000009', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('1d9db92c-9bda-5683-9fec-d03c7a8fe9f0', '0912000010', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('c651a2e0-88a7-578f-94ed-169d4cb2a965', '0912000011', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('99eb64a6-e245-5496-8be2-9f91deab711a', '0912000012', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('a7b851b0-1d1d-5604-b4d3-817723535c32', '0912000013', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('9041fc0e-5deb-5649-a261-9a47f8c6df60', '0912000014', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', false),
('c7f7effe-0fc9-572b-89f7-db54047361e1', '0912000015', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', true),
('57fba900-76fd-5347-add0-3a4bf77c9fb4', '0912000016', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', true),
('948a41e0-8356-5d89-9d6f-f10fb61d80e0', '0912000017', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', true),
('57d6f1e4-7637-5101-8929-ceddf71db988', '0912000018', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', true),
('602c614c-681e-501a-a21a-52828ee8f4db', '0912000019', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', true),
('4ab64ac9-ce1e-5ac8-83c1-e181703fb085', '0912000020', '$2b$12$abcdefghijklmnopqrstuuMFbMSzKJXFngvfpAr5Xc2pN9GMK7Y6S', 'KHACH_THUE', 'HOAT_DONG', true);

-- ChuTro: 1 bản ghi
insert into `ChuTro` (`maChuTro`, `hoTen`, `soDienThoai`, `maTaiKhoan`) values
('b88adb41-3d73-5b65-8edd-6c3a198d2746', 'Nguyễn Văn Hùng', '0901000001', '910fb605-b871-5141-8d96-1f8577508ac2');

-- KhachThue: 20 bản ghi
insert into `KhachThue` (`maKhachThue`, `hoTen`, `soDienThoai`, `soGiayTo`, `maTaiKhoan`) values
('6acd6669-d766-5fe0-92e9-b1aa196d9be2', 'Trần Thị Mai', '0912000001', '079900000001', '492d371e-f8c5-53b7-8615-ffdb678575ab'),
('0801a2df-3b8f-5f01-a7a7-999df263b9f1', 'Lê Văn Nam', '0912000002', '079900000002', 'c0257961-a1f1-5d31-a4b1-0b85155a48d1'),
('1d191cfa-bc32-5792-b294-b7c9642e6738', 'Phạm Quốc Bảo', '0912000003', '079900000003', '903fd6e2-0a6f-5370-a49a-841492537834'),
('81e447aa-394a-5a24-ad70-c26090aa0046', 'Võ Thị Lan', '0912000004', '079900000004', '39c3c547-4ab1-5838-bfc9-2d4a19938e51'),
('b35a8c46-67e0-5b9f-ae5a-66d5358784ad', 'Đặng Minh Tuấn', '0912000005', '079900000005', '4ca777c9-ae13-5b12-b28b-ed10e15c0be2'),
('f75a4a84-722d-5fab-abd5-cdc3bfd47776', 'Bùi Thanh Sơn', '0912000006', '079900000006', '392586b8-d887-5c87-b0fb-72401eadb43a'),
('c4c7e074-f65f-534a-9e0c-393f864a2712', 'Ngô Thị Hạnh', '0912000007', '079900000007', 'df69c727-c0e2-5300-8b5e-fb8d21eaf2cb'),
('e1593383-dc4f-5e38-88a9-7aa1efcb5ec5', 'Nguyễn Hoàng Minh', '0912000008', '079900000008', 'e64073fe-9441-57a8-8752-d5944f870c3b'),
('446f8eb0-3b6f-550a-9239-c6d13fe5ebbc', 'Lê Thị Ngọc', '0912000009', '079900000009', 'ca135837-b698-5ddf-81b4-66e8fffc7a8a'),
('e3b89704-9fae-5e06-a4e6-977af7910032', 'Trần Quốc Huy', '0912000010', '079900000010', '1d9db92c-9bda-5683-9fec-d03c7a8fe9f0'),
('7c7efab9-14e8-512f-9dfd-99ae7d93ecdd', 'Phạm Thị Linh', '0912000011', '079900000011', 'c651a2e0-88a7-578f-94ed-169d4cb2a965'),
('7837675d-1005-531a-a1de-35d0d7a883ae', 'Võ Minh Khang', '0912000012', '079900000012', '99eb64a6-e245-5496-8be2-9f91deab711a'),
('3d75397c-6405-577d-be98-61e5fccf2a57', 'Đỗ Thị Thảo', '0912000013', '079900000013', 'a7b851b0-1d1d-5604-b4d3-817723535c32'),
('4318a81c-c70c-58b0-879b-0e03e62cd951', 'Huỳnh Văn Phúc', '0912000014', '079900000014', '9041fc0e-5deb-5649-a261-9a47f8c6df60'),
('01c4b535-0c48-5983-a8ac-d926a3cace84', 'Nguyễn Thị Yến', '0912000015', '079900000015', 'c7f7effe-0fc9-572b-89f7-db54047361e1'),
('08d5ca82-b3dd-5c94-83dd-384c98fc78ec', 'Trần Minh Đức', '0912000016', '079900000016', '57fba900-76fd-5347-add0-3a4bf77c9fb4'),
('0ef1e9d9-dd04-5e11-9cca-09db54636c54', 'Lê Quốc An', '0912000017', '079900000017', '948a41e0-8356-5d89-9d6f-f10fb61d80e0'),
('d4049cbd-8856-5965-920e-95c337c4cc6a', 'Phạm Thị Thu', '0912000018', '079900000018', '57d6f1e4-7637-5101-8929-ceddf71db988'),
('ef32d28a-8b82-5923-b364-9b3af3053ea9', 'Bùi Hoàng Long', '0912000019', '079900000019', '602c614c-681e-501a-a21a-52828ee8f4db'),
('039bc024-0df4-5f6a-8c9d-ac23eddc1aed', 'Đặng Thị Hà', '0912000020', '079900000020', '4ab64ac9-ce1e-5ac8-83c1-e181703fb085');

-- CanTro: 3 bản ghi
insert into `CanTro` (`maCan`, `tenCan`, `diaChi`, `moTa`, `quyDinhChung`, `hinhAnhTongQuanUrl`, `trangThai`, `maChuTro`) values
('f8e9ba5c-1161-5b50-8b66-98dc672cc646', 'Căn trọ Hoa Sen', '100 Đường Demo, TP. Hồ Chí Minh', 'Địa chỉ và ảnh giả lập để thực hành', 'Giữ vệ sinh; không gây ồn sau 22 giờ; không tự ý sửa tài sản', '/demo/images/can-1.jpg', 'HOAT_DONG', 'b88adb41-3d73-5b65-8edd-6c3a198d2746'),
('c5c294c5-65c3-508e-ae56-3a4f28755fb9', 'Căn trọ An Bình', '200 Đường Demo, TP. Hồ Chí Minh', 'Địa chỉ và ảnh giả lập để thực hành', 'Giữ vệ sinh; không gây ồn sau 22 giờ; không tự ý sửa tài sản', '/demo/images/can-2.jpg', 'HOAT_DONG', 'b88adb41-3d73-5b65-8edd-6c3a198d2746'),
('f497891e-cb02-590b-bd80-de874320290f', 'Căn trọ Bình Minh', '300 Đường Demo, TP. Hồ Chí Minh', 'Địa chỉ và ảnh giả lập để thực hành', 'Giữ vệ sinh; không gây ồn sau 22 giờ; không tự ý sửa tài sản', '/demo/images/can-3.jpg', 'HOAT_DONG', 'b88adb41-3d73-5b65-8edd-6c3a198d2746');

-- PhongTro: 30 bản ghi
insert into `PhongTro` (`maPhong`, `soPhong`, `dienTich`, `giaThue`, `soNguoiToiDa`, `noiThatMoTa`, `trangThai`, `maCan`) values
('859d5d6b-750c-5471-8c33-9b9585fdfb8e', '101', 21.5, 2850000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('058a650b-1f98-5c0f-9354-d858660c7d30', '102', 23.0, 2900000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('92bb9c6e-ec9a-59c4-b6f4-10b984cbd280', '103', 24.5, 2950000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('c9a38be9-ac42-5e6b-94a6-62d746db1188', '104', 26.0, 3000000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_XU_LY_TRA_PHONG', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('f339a5fb-544b-52dd-a0ac-aa8f0236ee36', '105', 27.5, 3050000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('85e8da02-4014-52d8-886d-355fba7be7ca', '106', 29.0, 3100000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('5f2c51c9-a920-56f2-bd7b-cfa969b06244', '107', 30.5, 3150000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('5c85e9df-3f5b-5354-a565-588174785b3e', '108', 32.0, 3200000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('00a9eceb-70bc-515e-9f9e-4fee8ff6881f', '109', 33.5, 3250000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('3eeb770c-049b-5bec-85b6-e22a0ea6e524', '110', 35.0, 3300000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('ca9a183a-c188-5f24-89a0-614aafd7728a', '201', 21.5, 3150000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('1f22fc5d-6fca-5fd7-adc4-c998515b04a3', '202', 23.0, 3200000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('83a59a9c-63ab-5778-9fb0-3502420d8cc7', '203', 24.5, 3250000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('d86aab55-c4b0-55ac-9872-ff8e1f9bf36d', '204', 26.0, 3300000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('6b5f4efc-9356-52f8-ac72-08286bbf06fe', '205', 27.5, 3350000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('ee54a616-3908-5d4e-b728-65bb01cfb00e', '206', 29.0, 3400000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('e2a957b9-3ffe-5327-ac94-9fe398fabfe3', '207', 30.5, 3450000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('4fca7318-7836-5fdd-972a-319d505ef657', '208', 32.0, 3500000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('9d5d08e8-adf5-5161-b202-a8f872f0a6e1', '209', 33.5, 3550000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('97904c4d-3390-50c7-ad21-517bf97324b3', '210', 35.0, 3600000, 3, 'Giường, tủ quần áo, máy lạnh', 'NGUNG_SU_DUNG', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('99b7dc36-7888-5949-b5af-c12a1c71f72e', '301', 21.5, 3450000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f497891e-cb02-590b-bd80-de874320290f'),
('f44e0f30-4544-5a7b-a0f6-3ad24084b2fe', '302', 23.0, 3500000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f497891e-cb02-590b-bd80-de874320290f'),
('a4fa1ed3-c292-54f5-9050-fe831ff02d0f', '303', 24.5, 3550000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f497891e-cb02-590b-bd80-de874320290f'),
('3d86767e-486c-5922-bc54-3844d4a23bf6', '304', 26.0, 3600000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f497891e-cb02-590b-bd80-de874320290f'),
('497262a3-e035-5e8c-a340-468ccf44f240', '305', 27.5, 3650000, 3, 'Giường, tủ quần áo, máy lạnh', 'DANG_THUE', 'f497891e-cb02-590b-bd80-de874320290f'),
('9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad', '306', 29.0, 3700000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f497891e-cb02-590b-bd80-de874320290f'),
('7bdebb04-1395-5899-8c71-effc01a2d366', '307', 30.5, 3750000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f497891e-cb02-590b-bd80-de874320290f'),
('dbc308b2-1813-5109-8e40-5c418c58334b', '308', 32.0, 3800000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f497891e-cb02-590b-bd80-de874320290f'),
('b71f8651-9926-57df-a3c8-44e1cb2678d0', '309', 33.5, 3850000, 3, 'Giường, tủ quần áo, máy lạnh', 'TRONG', 'f497891e-cb02-590b-bd80-de874320290f'),
('64b6cdcf-a611-54fc-bc9a-2668faf8d9f1', '310', 35.0, 3900000, 3, 'Giường, tủ quần áo, máy lạnh', 'NGUNG_SU_DUNG', 'f497891e-cb02-590b-bd80-de874320290f');

-- TaiSan: 90 bản ghi
insert into `TaiSan` (`maTaiSan`, `tenTaiSan`, `soLuong`, `tinhTrang`, `ghiChu`, `maPhong`) values
('c181918c-1808-58ef-8e61-c094041d5f21', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('d8ad27b1-11e2-5198-98c1-eca35e5ef79c', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('a4d96536-d579-5388-b51f-e287fcdd3ab5', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('3edb2e0e-0743-546c-a707-2455f15bb437', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('c6000509-1c37-576f-84da-bac8b18c4605', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('05876cab-3a18-55b8-bbb9-cd3317cbecac', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('8406dac5-5adc-5704-9c7f-8b18cf7c122e', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('a9285de7-3d8e-591b-998d-061371dca962', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('b52752a0-6d08-5c20-9a0f-9ea0159c668e', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('9c1fac46-39f9-5b36-90f2-e7dbd7b45dc3', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('4019af16-b777-56f6-92eb-fdea6d4763be', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('02bf58c1-e368-5488-8fc4-7fb322309b92', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('72f16fc5-cd5e-5dae-9419-f6342359d0c1', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('7d6fab6f-c5b5-5de3-a0fc-61eaeedefac1', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('42b6b14f-dfca-5bd6-a6c4-3bcdb795130c', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('83f9521f-c349-5525-b334-b3b9a552df27', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('3b5ea461-db92-5731-ac82-ef286c34d2a9', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('4ad98ffd-d939-5f28-9338-0830c5213b8e', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('17f58cee-0d36-5ae0-afe3-1669f0bc1823', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('6a5c990f-dcc3-527b-9b59-a7d4b4c60857', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('c4b8347f-96e8-555b-81dd-84520be0b8dc', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('1bd62db4-77e5-543d-93c7-ef24b8528aa5', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '5c85e9df-3f5b-5354-a565-588174785b3e'),
('3b96f195-e4fd-5e96-9c76-7d36f3829fa5', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '5c85e9df-3f5b-5354-a565-588174785b3e'),
('c5ff09b4-9f7b-5677-a265-b7398b260da7', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '5c85e9df-3f5b-5354-a565-588174785b3e'),
('d3dd1039-3077-5a46-acbf-16a1e47c3fb6', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '00a9eceb-70bc-515e-9f9e-4fee8ff6881f'),
('0255a0a6-6186-5c34-8fd7-1cf90f923ea9', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '00a9eceb-70bc-515e-9f9e-4fee8ff6881f'),
('7eaf8ff8-e710-5d8f-9d97-6d5111f057ef', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '00a9eceb-70bc-515e-9f9e-4fee8ff6881f'),
('541d261d-698e-56c0-9c03-cb653895f0a8', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '3eeb770c-049b-5bec-85b6-e22a0ea6e524'),
('0fa48d53-b52c-5277-aed8-51b2dac95efb', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '3eeb770c-049b-5bec-85b6-e22a0ea6e524'),
('2367cd47-e1e4-579e-8caf-a92e0a5bddba', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '3eeb770c-049b-5bec-85b6-e22a0ea6e524'),
('eaca1d23-b786-5149-8801-563ae1dfe031', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('12146b75-fb10-5860-ab84-759969329896', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('6ca5dff6-4289-59b7-876a-1cc70199a156', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('ab245d91-369a-51c6-99e7-9de684a90fda', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('c73bd038-076f-5840-8397-849a55e5bf7c', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('6d69cecb-ad64-5b8e-9aa7-37b7cc257f8b', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('2d8d8d18-8ba5-59a3-94bd-b4475db17979', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('e65f49eb-0390-5ad8-b4f6-7289363420ab', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('42bf8311-f876-5fd1-908e-5163a01a0c25', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('1d3e929c-efeb-530e-9dde-07bfaddb9926', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('8cfcaf4c-c097-5cf5-816a-b72e55d3a155', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('6e817b1c-bda5-5b5c-8136-2e10dfe68988', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('b7422b73-038d-532a-8d9e-57c882e02bcb', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('f0812bc2-28bc-50c6-9475-f699e72d3f29', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('e6b01164-379f-5562-8cfb-85ec1f6a364a', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('54158263-4cd6-5df3-9867-5a3273cded0e', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'ee54a616-3908-5d4e-b728-65bb01cfb00e'),
('4d2fd456-74c9-5456-bbb2-cb22ab0313d2', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'ee54a616-3908-5d4e-b728-65bb01cfb00e'),
('2b9e73c2-8ce8-577c-9aeb-6782faa86eef', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'ee54a616-3908-5d4e-b728-65bb01cfb00e'),
('6102488f-801e-5542-b73e-8505e6fd151c', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'e2a957b9-3ffe-5327-ac94-9fe398fabfe3'),
('2e1dd392-a306-5a29-aa97-91e01ecf9620', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'e2a957b9-3ffe-5327-ac94-9fe398fabfe3'),
('38b0dcfc-bc9f-5b04-89ac-9a9911e2981b', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'e2a957b9-3ffe-5327-ac94-9fe398fabfe3'),
('d427ef50-e202-50bb-bbdd-3824d2451d75', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '4fca7318-7836-5fdd-972a-319d505ef657'),
('dbb2006b-afca-55ad-92e9-4a4eb1772995', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '4fca7318-7836-5fdd-972a-319d505ef657'),
('bb384d8a-87ab-529d-a8a3-33a664fb3c13', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '4fca7318-7836-5fdd-972a-319d505ef657'),
('c07d3f80-a74b-56e9-bb14-ba97bf0a908c', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '9d5d08e8-adf5-5161-b202-a8f872f0a6e1'),
('f34e56b4-0cc8-5ba8-a193-ea2c474eb3a2', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '9d5d08e8-adf5-5161-b202-a8f872f0a6e1'),
('ae86f174-2ca8-5b7f-a513-31d92b459a9b', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '9d5d08e8-adf5-5161-b202-a8f872f0a6e1'),
('db72f577-4c5d-55be-8432-decc6d484448', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '97904c4d-3390-50c7-ad21-517bf97324b3'),
('95055295-3fe7-5a9f-bafd-57e9de6a6cc7', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '97904c4d-3390-50c7-ad21-517bf97324b3'),
('139c02f1-cb4b-56cc-9b58-b694872aeb70', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '97904c4d-3390-50c7-ad21-517bf97324b3'),
('819b57ba-571e-5733-9ab0-e79bc3e5eb17', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('8acb804f-2bd2-5724-a554-b0b72894361f', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('675a0444-4cf0-556f-b9e2-e49e75b28d43', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('d4fde1a9-8c34-5ed0-b388-9425468dad60', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('cd5ab19e-4e70-5506-bc8a-38a9fd01c216', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('8b799e3e-563a-5edc-9e02-21109f9e682d', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('ee2b1142-9135-5223-89ca-6ccc30e3c3e8', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('ddc36a9d-0e5f-5ac3-8a5e-e80ba11f20a8', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('1989551c-45ac-5b8b-80a2-23c2bb057bf1', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('58882b46-8c7a-52ee-9d96-41800733463f', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('7119d479-a652-524a-a881-066fd8fdf0c9', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('bca3aa4d-134a-5b53-994c-7c9eb53e8984', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('e2816843-011a-5598-a3f1-e2f8d4c12542', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '497262a3-e035-5e8c-a340-468ccf44f240'),
('65035c90-52db-59b5-abda-9675448114fd', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '497262a3-e035-5e8c-a340-468ccf44f240'),
('a5da7d02-ca31-5902-b3da-e355c1b6d4b0', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '497262a3-e035-5e8c-a340-468ccf44f240'),
('a12578cf-59a5-58da-9ea0-483626f2c27a', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad'),
('3f53e5d4-e37a-54af-bc3a-c4152714d60e', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad'),
('18b2a2e7-9a50-5d5e-8813-bd1dd9e4c030', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad'),
('d6b0af39-892e-565b-acd4-4e5e599fbe58', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '7bdebb04-1395-5899-8c71-effc01a2d366'),
('ee485a32-3e49-5ca5-b577-1afe97681d87', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '7bdebb04-1395-5899-8c71-effc01a2d366'),
('6bef1004-baf0-512f-8183-e2a1df58f67b', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '7bdebb04-1395-5899-8c71-effc01a2d366'),
('9ff39276-33b0-5b3a-865f-d5a52fe810cf', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'dbc308b2-1813-5109-8e40-5c418c58334b'),
('db02a2a1-2208-5820-9edc-3b29c2cd73ac', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'dbc308b2-1813-5109-8e40-5c418c58334b'),
('01b05a29-124a-57d9-8c99-228766a270ef', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'dbc308b2-1813-5109-8e40-5c418c58334b'),
('6ecf5f28-18c6-5b1b-88b8-7bcdb5623973', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'b71f8651-9926-57df-a3c8-44e1cb2678d0'),
('44826119-c50d-5a09-b7d6-40bdaaea77ad', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'b71f8651-9926-57df-a3c8-44e1cb2678d0'),
('fc757e38-7986-5f44-ab85-7b6cf04ef0ae', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', 'b71f8651-9926-57df-a3c8-44e1cb2678d0'),
('17708a87-9a46-5063-a8a3-4bdcafde70e3', 'Giường', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '64b6cdcf-a611-54fc-bc9a-2668faf8d9f1'),
('010d5a84-be83-57e3-8b40-3842946da1da', 'Tủ quần áo', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '64b6cdcf-a611-54fc-bc9a-2668faf8d9f1'),
('f95425d8-583d-5f34-8b27-b4d0c6c401b6', 'Máy lạnh', 1, 'Tốt', 'Tài sản bàn giao cùng phòng', '64b6cdcf-a611-54fc-bc9a-2668faf8d9f1');

-- HopDong: 18 bản ghi
insert into `HopDong` (`maHopDong`, `ngayBatDau`, `ngayKetThuc`, `giaThue`, `donGiaDien`, `donGiaNuoc`, `dieuKhoan`, `trangThai`, `ngayThanhLy`, `maKhachThue`, `maPhong`) values
('b9cdd32d-eead-5877-952e-4a189d6d306a', '2026-07-01', '2026-10-31', 2850000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'SAP_HET_HAN', null, '6acd6669-d766-5fe0-92e9-b1aa196d9be2', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('9d70c9d7-dc16-55ab-9c41-6f5985fbf82f', '2026-07-01', '2027-09-30', 2900000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '0801a2df-3b8f-5f01-a7a7-999df263b9f1', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('e8772d48-4dd0-53fd-99b3-bae649607251', '2026-07-01', '2027-03-31', 2950000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '1d191cfa-bc32-5792-b294-b7c9642e6738', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('03a058bf-b63d-5599-8ab2-0270bc48ac92', '2026-07-01', '2027-03-31', 3000000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '81e447aa-394a-5a24-ad70-c26090aa0046', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('2c2b33ad-e932-5ffa-8463-dfe5a8fef059', '2026-07-01', '2027-03-31', 3050000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, 'b35a8c46-67e0-5b9f-ae5a-66d5358784ad', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('158a8610-6bc5-5543-a2fc-c9b7ce581cfa', '2026-07-01', '2027-03-31', 3100000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, 'f75a4a84-722d-5fab-abd5-cdc3bfd47776', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('7c83cb2d-4a7c-5e33-bf31-e54b368f946a', '2026-07-01', '2027-03-31', 3150000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, 'c4c7e074-f65f-534a-9e0c-393f864a2712', 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('e9afd576-2886-5b65-b552-af64bc127ad1', '2026-07-01', '2027-03-31', 3200000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, 'e1593383-dc4f-5e38-88a9-7aa1efcb5ec5', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('b840c2f7-fc52-52ee-994f-03ce94693846', '2026-07-01', '2027-03-31', 3250000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '446f8eb0-3b6f-550a-9239-c6d13fe5ebbc', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('48844424-be50-566d-bdc5-43a600659724', '2026-07-01', '2027-03-31', 3300000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, 'e3b89704-9fae-5e06-a4e6-977af7910032', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('67e436ed-1168-5879-9d8c-1490377c6645', '2026-07-01', '2027-03-31', 3350000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '7c7efab9-14e8-512f-9dfd-99ae7d93ecdd', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('5939bacc-ac8b-50f2-949f-409e64e96606', '2026-07-01', '2027-03-31', 3450000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '7837675d-1005-531a-a1de-35d0d7a883ae', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('81dc5ce5-ad84-50da-8cf1-31b99ca1605b', '2026-07-01', '2027-03-31', 3500000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '3d75397c-6405-577d-be98-61e5fccf2a57', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('2f80db08-48ee-532f-88a8-ca9ed26cae13', '2026-07-01', '2027-03-31', 3550000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '4318a81c-c70c-58b0-879b-0e03e62cd951', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('d9c22d6f-b3fb-5d66-b629-b3d4534594a7', '2026-10-01', '2027-03-31', 3600000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '01c4b535-0c48-5983-a8ac-d926a3cace84', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('c6dbfb8d-f5b7-596f-931f-08d26fc9e60a', '2026-10-10', '2027-03-31', 3650000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DANG_HIEU_LUC', null, '08d5ca82-b3dd-5c94-83dd-384c98fc78ec', '497262a3-e035-5e8c-a340-468ccf44f240'),
('92256090-e741-5003-8cb0-ee1336a340fc', '2026-04-01', '2026-09-30', 3150000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DA_THANH_LY', '2026-09-30', '0ef1e9d9-dd04-5e11-9cca-09db54636c54', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('7814acca-085e-50ab-ac90-479792d8b10a', '2026-04-01', '2026-09-30', 3400000, 3500, 100000, 'Thu nước theo người; thuê nguyên phòng; giữ cọc một tháng; phí dịch vụ 100000 VND/tháng', 'DA_THANH_LY', '2026-09-30', 'd4049cbd-8856-5965-920e-95c337c4cc6a', 'ee54a616-3908-5d4e-b728-65bb01cfb00e');

-- TienCoc: 18 bản ghi
insert into `TienCoc` (`maTienCoc`, `soTienCoc`, `ngayNhanCoc`, `trangThai`, `soTienDaHoan`, `soTienDaKhauTru`, `maHopDong`) values
('200c6e4b-c452-5ab8-b8a0-a7d2f9ad6a19', 2850000, '2026-07-01', 'DA_NHAN', 0, 0, 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('a2e5130b-5b26-555c-8079-12424f1ee41b', 2900000, '2026-07-01', 'DA_NHAN', 0, 0, '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('c5f03102-854f-55da-812c-42a6d65575c7', 2950000, '2026-07-01', 'DA_NHAN', 0, 0, 'e8772d48-4dd0-53fd-99b3-bae649607251'),
('e4bb88e2-efa6-5214-9816-85caf62271de', 3000000, '2026-07-01', 'DA_NHAN', 0, 0, '03a058bf-b63d-5599-8ab2-0270bc48ac92'),
('6e7403c1-1d8d-590a-95d0-21965780b2c1', 3050000, '2026-07-01', 'DA_NHAN', 0, 0, '2c2b33ad-e932-5ffa-8463-dfe5a8fef059'),
('6b384296-596c-5034-a69b-678367948488', 3100000, '2026-07-01', 'DA_NHAN', 0, 0, '158a8610-6bc5-5543-a2fc-c9b7ce581cfa'),
('ebeaf09e-35f1-5e6a-8a93-154d4308869a', 3150000, '2026-07-01', 'DA_NHAN', 0, 0, '7c83cb2d-4a7c-5e33-bf31-e54b368f946a'),
('950d8f43-9b62-5ac7-bc45-1dcb89728bb8', 3200000, '2026-07-01', 'DA_NHAN', 0, 0, 'e9afd576-2886-5b65-b552-af64bc127ad1'),
('8a2343c5-4f48-52d4-9652-207cc7a4a187', 3250000, '2026-07-01', 'DA_NHAN', 0, 0, 'b840c2f7-fc52-52ee-994f-03ce94693846'),
('267eb606-7197-5ae8-9681-7d2fa021a995', 3300000, '2026-07-01', 'DA_NHAN', 0, 0, '48844424-be50-566d-bdc5-43a600659724'),
('4afb2566-80ca-59ba-9538-f78815d30cba', 3350000, '2026-07-01', 'DA_NHAN', 0, 0, '67e436ed-1168-5879-9d8c-1490377c6645'),
('230bb2fa-b070-5a9e-b5c1-36ed49f308d8', 3450000, '2026-07-01', 'DA_NHAN', 0, 0, '5939bacc-ac8b-50f2-949f-409e64e96606'),
('bc22d36b-ca73-58f1-90b2-9f3c87646157', 3500000, '2026-07-01', 'DA_NHAN', 0, 0, '81dc5ce5-ad84-50da-8cf1-31b99ca1605b'),
('3eca6b28-f0a1-5058-a084-3d0a005b34a0', 3550000, '2026-07-01', 'DA_NHAN', 0, 0, '2f80db08-48ee-532f-88a8-ca9ed26cae13'),
('7a7b21eb-cb64-5e0b-95fb-679fce859536', 3600000, '2026-10-01', 'DA_NHAN', 0, 0, 'd9c22d6f-b3fb-5d66-b629-b3d4534594a7'),
('9b2a2d18-1c00-56e6-b1d5-28610663c579', 3650000, null, 'CHUA_NHAN', 0, 0, 'c6dbfb8d-f5b7-596f-931f-08d26fc9e60a'),
('e68e2aa4-115e-5cab-937c-810cedca4410', 3150000, '2026-04-01', 'DA_HOAN', 2850000, 300000, '92256090-e741-5003-8cb0-ee1336a340fc'),
('950bc17d-c40a-53cb-b19c-707b6195dc8c', 3400000, '2026-04-01', 'DA_HOAN', 3250000, 150000, '7814acca-085e-50ab-ac90-479792d8b10a');

-- ThanhVienPhong: 30 bản ghi
insert into `ThanhVienPhong` (`maThanhVienPhong`, `hoTen`, `soDienThoai`, `ngayVao`, `ngayRoi`, `trangThaiCuTru`, `maPhong`, `maHopDong`) values
('d48e902b-f426-5244-b5d2-b40d78a00a0e', 'Trần Thị Mai', '0912000001', '2026-07-01', null, 'DANG_O', '859d5d6b-750c-5471-8c33-9b9585fdfb8e', 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('2f0d6618-82b0-542d-8217-04e339b09b1f', 'Bạn cùng phòng 01-1', '0930010001', '2026-07-01', null, 'DANG_O', '859d5d6b-750c-5471-8c33-9b9585fdfb8e', 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('c88ae02d-ae42-52ca-a4ef-2a6431eba15c', 'Bạn cùng phòng 01-2', '0930010002', '2026-07-01', null, 'DANG_O', '859d5d6b-750c-5471-8c33-9b9585fdfb8e', 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('3cb1bf97-4800-54c4-8f95-f7540dcc15d4', 'Lê Văn Nam', '0912000002', '2026-07-01', null, 'DANG_O', '058a650b-1f98-5c0f-9354-d858660c7d30', '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('a0a42689-c720-524a-80e7-3d051fccd89b', 'Bạn cùng phòng 02-1', '0930020001', '2026-07-01', null, 'DANG_O', '058a650b-1f98-5c0f-9354-d858660c7d30', '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('018e1d06-c385-5923-b1e8-5b24d74dff1b', 'Bạn cùng phòng 02-2', '0930020002', '2026-07-01', null, 'DANG_O', '058a650b-1f98-5c0f-9354-d858660c7d30', '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('08acafb8-f9a4-5425-a232-536baac41733', 'Phạm Quốc Bảo', '0912000003', '2026-07-01', null, 'DANG_O', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280', 'e8772d48-4dd0-53fd-99b3-bae649607251'),
('b181d8b9-bc9a-57c0-8053-5a60ef3edf74', 'Bạn cùng phòng 03-1', '0930030001', '2026-07-01', null, 'DANG_O', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280', 'e8772d48-4dd0-53fd-99b3-bae649607251'),
('23e78184-7623-5dee-8ac4-96224c0ffadb', 'Bạn cùng phòng 03-2', '0930030002', '2026-07-01', null, 'DANG_O', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280', 'e8772d48-4dd0-53fd-99b3-bae649607251'),
('1c0e5894-72ad-5265-8d03-653833a5acf2', 'Võ Thị Lan', '0912000004', '2026-07-01', null, 'DANG_O', 'c9a38be9-ac42-5e6b-94a6-62d746db1188', '03a058bf-b63d-5599-8ab2-0270bc48ac92'),
('e4846beb-35fc-515e-a164-171907806c8c', 'Bạn cùng phòng 04-1', '0930040001', '2026-07-01', null, 'DANG_O', 'c9a38be9-ac42-5e6b-94a6-62d746db1188', '03a058bf-b63d-5599-8ab2-0270bc48ac92'),
('2e46978f-5559-577e-b253-cceb7f6f9b67', 'Đặng Minh Tuấn', '0912000005', '2026-07-01', null, 'DANG_O', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36', '2c2b33ad-e932-5ffa-8463-dfe5a8fef059'),
('91946850-e67a-5815-93a9-e284e0808a26', 'Bạn cùng phòng 05-1', '0930050001', '2026-07-01', null, 'DANG_O', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36', '2c2b33ad-e932-5ffa-8463-dfe5a8fef059'),
('5370c8ef-146c-596d-9458-54aad7bf2d68', 'Bùi Thanh Sơn', '0912000006', '2026-07-01', null, 'DANG_O', '85e8da02-4014-52d8-886d-355fba7be7ca', '158a8610-6bc5-5543-a2fc-c9b7ce581cfa'),
('c3b8474b-0e87-5d49-9601-abbbb491abd5', 'Bạn cùng phòng 06-1', '0930060001', '2026-07-01', null, 'DANG_O', '85e8da02-4014-52d8-886d-355fba7be7ca', '158a8610-6bc5-5543-a2fc-c9b7ce581cfa'),
('eea83cde-1fc0-53ec-9cc7-852da1a5df42', 'Ngô Thị Hạnh', '0912000007', '2026-07-01', null, 'DANG_O', 'ca9a183a-c188-5f24-89a0-614aafd7728a', '7c83cb2d-4a7c-5e33-bf31-e54b368f946a'),
('1e251792-4fa4-5ff8-a4eb-8ce01473e304', 'Bạn cùng phòng 07-1', '0930070001', '2026-07-01', null, 'DANG_O', 'ca9a183a-c188-5f24-89a0-614aafd7728a', '7c83cb2d-4a7c-5e33-bf31-e54b368f946a'),
('88d9aa89-99f1-5ff4-bf5b-5ba550410fca', 'Nguyễn Hoàng Minh', '0912000008', '2026-07-01', null, 'DANG_O', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3', 'e9afd576-2886-5b65-b552-af64bc127ad1'),
('140fab46-2bb1-5303-bc43-7de1263c1e25', 'Lê Thị Ngọc', '0912000009', '2026-07-01', null, 'DANG_O', '83a59a9c-63ab-5778-9fb0-3502420d8cc7', 'b840c2f7-fc52-52ee-994f-03ce94693846'),
('37358220-cb03-5ada-8c14-caa9110d3d9b', 'Trần Quốc Huy', '0912000010', '2026-07-01', null, 'DANG_O', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d', '48844424-be50-566d-bdc5-43a600659724'),
('7d5e58a8-7f91-5221-8506-7cbe7cb82526', 'Phạm Thị Linh', '0912000011', '2026-07-01', null, 'DANG_O', '6b5f4efc-9356-52f8-ac72-08286bbf06fe', '67e436ed-1168-5879-9d8c-1490377c6645'),
('e5ebdae9-d5b2-5844-8eb2-06aca1353f08', 'Võ Minh Khang', '0912000012', '2026-07-01', null, 'DANG_O', '99b7dc36-7888-5949-b5af-c12a1c71f72e', '5939bacc-ac8b-50f2-949f-409e64e96606'),
('09aec330-827d-50de-867f-f135ce238143', 'Đỗ Thị Thảo', '0912000013', '2026-07-01', null, 'DANG_O', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe', '81dc5ce5-ad84-50da-8cf1-31b99ca1605b'),
('de227277-c84a-5652-bf48-4f6fa4ab5285', 'Huỳnh Văn Phúc', '0912000014', '2026-07-01', null, 'DANG_O', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f', '2f80db08-48ee-532f-88a8-ca9ed26cae13'),
('b884b443-b20e-5d3a-8525-d9a06d8ff43f', 'Nguyễn Thị Yến', '0912000015', '2026-10-01', null, 'DANG_O', '3d86767e-486c-5922-bc54-3844d4a23bf6', 'd9c22d6f-b3fb-5d66-b629-b3d4534594a7'),
('3e8f35cc-b2cd-583b-9d0a-83e6942629b7', 'Trần Minh Đức', '0912000016', '2026-10-10', null, 'DANG_O', '497262a3-e035-5e8c-a340-468ccf44f240', 'c6dbfb8d-f5b7-596f-931f-08d26fc9e60a'),
('62cb3b37-7713-57b9-bba7-38401e3cffec', 'Lê Quốc An', '0912000017', '2026-04-01', '2026-09-30', 'DA_ROI', '5f2c51c9-a920-56f2-bd7b-cfa969b06244', '92256090-e741-5003-8cb0-ee1336a340fc'),
('d1188ff3-f85e-597b-936e-a2fb507bfe72', 'Bạn cùng phòng 17-1', '0930170001', '2026-04-01', '2026-09-30', 'DA_ROI', '5f2c51c9-a920-56f2-bd7b-cfa969b06244', '92256090-e741-5003-8cb0-ee1336a340fc'),
('50872e97-0957-5e50-a8c9-e24f261c1959', 'Phạm Thị Thu', '0912000018', '2026-04-01', '2026-09-30', 'DA_ROI', 'ee54a616-3908-5d4e-b728-65bb01cfb00e', '7814acca-085e-50ab-ac90-479792d8b10a'),
('41b192eb-8288-5b2f-9111-600fc2646d80', 'Bạn cùng phòng 18-1', '0930180001', '2026-04-01', '2026-09-30', 'DA_ROI', 'ee54a616-3908-5d4e-b728-65bb01cfb00e', '7814acca-085e-50ab-ac90-479792d8b10a');

-- ViPhamHopDong: 2 bản ghi
insert into `ViPhamHopDong` (`maViPham`, `noiDung`, `ngayGhiNhan`, `dieuKhoanLienQuan`, `mucPhat`, `maHopDong`) values
('6947cb0f-0ee9-5380-a347-bd6fdcd79b41', 'Vi phạm quy định vệ sinh khi bàn giao', '2026-09-30 08:00:00', 'Nội quy vệ sinh', 100000, '92256090-e741-5003-8cb0-ee1336a340fc'),
('0c8f878a-905b-53a0-a5e5-22020b88e830', 'Vi phạm quy định vệ sinh khi bàn giao', '2026-09-30 08:00:00', 'Nội quy vệ sinh', 150000, '7814acca-085e-50ab-ac90-479792d8b10a');

-- ChiSoDien: 90 bản ghi
insert into `ChiSoDien` (`maChiSo`, `thang`, `nam`, `chiSoMoi`, `anhCongToUrl`, `donGiaApDung`, `trangThaiXacNhan`, `ngayGhiNhan`, `nguoiGhiNhanId`, `nguoiXacNhanId`, `ngayXacNhan`, `maPhong`) values
('feb78cfc-7fc8-50ef-aefa-29415cad320e', 8, 2026, 1303, '/demo/images/cong-to-101-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('c9527288-c4a4-5477-adba-fbb6e0c9264c', 9, 2026, 1370, '/demo/images/cong-to-101-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('a0c5aded-4dbf-55ba-825d-8555f9e43639', 10, 2026, 1437, '/demo/images/cong-to-101-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('f236312f-f931-549a-8355-6d327208c1cd', 8, 2026, 1306, '/demo/images/cong-to-102-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('af48dbeb-bee0-5d27-9f19-e8933298ae98', 9, 2026, 1380, '/demo/images/cong-to-102-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('746ec893-a977-5085-a13b-87616a1adb00', 10, 2026, 1454, '/demo/images/cong-to-102-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, '058a650b-1f98-5c0f-9354-d858660c7d30'),
('ea53edc3-16fc-5729-b096-1af3a42721fa', 8, 2026, 1309, '/demo/images/cong-to-103-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('be70c02f-54c9-54bf-a0ef-7a8ce25eddd0', 9, 2026, 1390, '/demo/images/cong-to-103-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('9878be20-bcbc-5381-b8ba-716108c5c259', 10, 2026, 1471, '/demo/images/cong-to-103-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('e18f74d0-aab9-5054-bffd-3c0132b2ebc0', 8, 2026, 1312, '/demo/images/cong-to-104-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('6420fac3-3745-54be-aa2b-bbc930321427', 9, 2026, 1400, '/demo/images/cong-to-104-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('bd7259cb-e031-55f7-bf0d-ed9e86898f13', 10, 2026, 1488, '/demo/images/cong-to-104-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', 'c9a38be9-ac42-5e6b-94a6-62d746db1188'),
('2971afc2-549f-5ef6-a7df-4e03c4db03fc', 8, 2026, 1315, '/demo/images/cong-to-105-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('ceb10098-e51a-5c9f-b045-a2f1ad2c449a', 9, 2026, 1410, '/demo/images/cong-to-105-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('1a50df1e-a9bf-5ea0-ad7f-d09f8cc0488d', 10, 2026, 1505, '/demo/images/cong-to-105-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('5013300a-fad2-5618-aef5-a803e34f61b6', 8, 2026, 1318, '/demo/images/cong-to-106-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('0adce1d6-1493-53bf-ab41-983b936b0798', 9, 2026, 1420, '/demo/images/cong-to-106-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('d79fd780-dae6-568d-bba9-0960aa538714', 10, 2026, 1522, '/demo/images/cong-to-106-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('333a199e-e669-5d8b-8c29-61991df109d7', 8, 2026, 1321, '/demo/images/cong-to-107-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('fe3ef32e-0b1d-58a1-b572-9c267d51b4f5', 9, 2026, 1430, '/demo/images/cong-to-107-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('10d8c1d4-d74d-5dad-8ea1-82ed1c905baf', 10, 2026, 1539, '/demo/images/cong-to-107-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '5f2c51c9-a920-56f2-bd7b-cfa969b06244'),
('16499455-b05c-54cc-804f-8018e8338ec1', 8, 2026, 1324, '/demo/images/cong-to-108-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '5c85e9df-3f5b-5354-a565-588174785b3e'),
('0f779e29-8918-5a4d-99c7-ba67dd0705f9', 9, 2026, 1440, '/demo/images/cong-to-108-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '5c85e9df-3f5b-5354-a565-588174785b3e'),
('13032b7f-1ea2-5286-94d8-1438dcc2455a', 10, 2026, 1556, '/demo/images/cong-to-108-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, '5c85e9df-3f5b-5354-a565-588174785b3e'),
('8a98d11d-b70f-5860-8234-a3c05fc7260a', 8, 2026, 1327, '/demo/images/cong-to-109-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '00a9eceb-70bc-515e-9f9e-4fee8ff6881f'),
('8e6211b9-448f-5db1-94a4-13806582e101', 9, 2026, 1450, '/demo/images/cong-to-109-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '00a9eceb-70bc-515e-9f9e-4fee8ff6881f'),
('4b353b10-6efa-5c8f-b2eb-e9da89c3ae12', 10, 2026, 1573, '/demo/images/cong-to-109-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '00a9eceb-70bc-515e-9f9e-4fee8ff6881f'),
('6826e084-68ff-5f23-a3b0-5fcd3c686575', 8, 2026, 1330, '/demo/images/cong-to-110-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '3eeb770c-049b-5bec-85b6-e22a0ea6e524'),
('ab8cd1f2-9af2-50f4-96f1-dee425e4a7e0', 9, 2026, 1390, '/demo/images/cong-to-110-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '3eeb770c-049b-5bec-85b6-e22a0ea6e524'),
('27447261-303b-5bbf-9cc0-6de3f24e99c5', 10, 2026, 1450, '/demo/images/cong-to-110-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '3eeb770c-049b-5bec-85b6-e22a0ea6e524'),
('04bff2e6-52b7-54c3-8cc2-a586687eedd0', 8, 2026, 1603, '/demo/images/cong-to-201-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('2362196a-396e-5080-983f-fb945f2448b8', 9, 2026, 1670, '/demo/images/cong-to-201-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('fc4246b1-e6c8-5cf9-82b5-d12a0374b5ca', 10, 2026, 1737, '/demo/images/cong-to-201-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, 'ca9a183a-c188-5f24-89a0-614aafd7728a'),
('b14c9b06-e568-5eb2-bb77-288964adc91f', 8, 2026, 1606, '/demo/images/cong-to-202-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('c6c08b6f-8953-5ec9-a0c9-59785efc51ef', 9, 2026, 1680, '/demo/images/cong-to-202-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('9d00f022-f1b9-5377-b3e2-5d4f0fb8412b', 10, 2026, 1754, '/demo/images/cong-to-202-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('4b0ab458-7be5-53fa-a190-7e6ad57476de', 8, 2026, 1609, '/demo/images/cong-to-203-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('6ca84ee9-ee4c-5e11-9891-d883d088a8e8', 9, 2026, 1690, '/demo/images/cong-to-203-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('fe45944d-a9d6-5c00-a301-fd0e69761e55', 10, 2026, 1771, '/demo/images/cong-to-203-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '83a59a9c-63ab-5778-9fb0-3502420d8cc7'),
('a1e1b34a-9b2a-58d4-aad9-0d7614c0eb8a', 8, 2026, 1612, '/demo/images/cong-to-204-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('3bf254c6-35d4-5045-93ad-545f7848b834', 9, 2026, 1700, '/demo/images/cong-to-204-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('d13c84b9-1d9f-599e-9f85-c1da37ed650d', 10, 2026, 1788, '/demo/images/cong-to-204-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, 'd86aab55-c4b0-55ac-9872-ff8e1f9bf36d'),
('7da3c809-3963-53bb-b7a1-f4073bf43681', 8, 2026, 1615, '/demo/images/cong-to-205-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('e88da7e4-39f0-50be-b563-b1128cc3f7d1', 9, 2026, 1710, '/demo/images/cong-to-205-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('0e568091-19b2-5ecf-b0fa-1a25983c830e', 10, 2026, 1805, '/demo/images/cong-to-205-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '6b5f4efc-9356-52f8-ac72-08286bbf06fe'),
('499664a1-9dae-5b8b-bf84-a6018db4ed4c', 8, 2026, 1618, '/demo/images/cong-to-206-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'ee54a616-3908-5d4e-b728-65bb01cfb00e'),
('2eba0987-ebdc-5c4c-964d-990fc53c74f9', 9, 2026, 1720, '/demo/images/cong-to-206-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'ee54a616-3908-5d4e-b728-65bb01cfb00e'),
('d703d2a2-b14c-5da8-a914-2d3756acfcfe', 10, 2026, 1822, '/demo/images/cong-to-206-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', 'ee54a616-3908-5d4e-b728-65bb01cfb00e'),
('53316995-b895-596d-abda-09938358ef59', 8, 2026, 1621, '/demo/images/cong-to-207-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'e2a957b9-3ffe-5327-ac94-9fe398fabfe3'),
('7b0ea978-a3d1-56da-a34f-7e92759aad99', 9, 2026, 1730, '/demo/images/cong-to-207-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'e2a957b9-3ffe-5327-ac94-9fe398fabfe3'),
('63352108-c7d6-514e-a30f-93c2eb7c8690', 10, 2026, 1839, '/demo/images/cong-to-207-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, 'e2a957b9-3ffe-5327-ac94-9fe398fabfe3'),
('3cacd684-e7f0-50a8-8592-10129118fdd3', 8, 2026, 1624, '/demo/images/cong-to-208-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '4fca7318-7836-5fdd-972a-319d505ef657'),
('6a55696d-ab59-5d10-a027-435642c29716', 9, 2026, 1740, '/demo/images/cong-to-208-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '4fca7318-7836-5fdd-972a-319d505ef657'),
('16d2a0f3-6916-5a97-b865-de60bfb674d2', 10, 2026, 1856, '/demo/images/cong-to-208-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '4fca7318-7836-5fdd-972a-319d505ef657'),
('125b4e39-7670-56b6-96fc-46236a0b7910', 8, 2026, 1627, '/demo/images/cong-to-209-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '9d5d08e8-adf5-5161-b202-a8f872f0a6e1'),
('56a7151c-0019-5ef2-ae98-016324e42875', 9, 2026, 1750, '/demo/images/cong-to-209-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '9d5d08e8-adf5-5161-b202-a8f872f0a6e1'),
('57b3a575-04fe-5ed1-8c7e-6d9341a47190', 10, 2026, 1873, '/demo/images/cong-to-209-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '9d5d08e8-adf5-5161-b202-a8f872f0a6e1'),
('c690a0cd-fdb0-5c7d-b360-4763bfdf9c2f', 8, 2026, 1630, '/demo/images/cong-to-210-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '97904c4d-3390-50c7-ad21-517bf97324b3'),
('cf4f4ee3-29ef-5ddf-8d5a-710a851d7d95', 9, 2026, 1690, '/demo/images/cong-to-210-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '97904c4d-3390-50c7-ad21-517bf97324b3'),
('84521578-982e-5b12-b457-3a3269fafd83', 10, 2026, 1750, '/demo/images/cong-to-210-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, '97904c4d-3390-50c7-ad21-517bf97324b3'),
('241dfdd8-450b-565b-bb52-dfc3da0002eb', 8, 2026, 1903, '/demo/images/cong-to-301-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('e33c082e-19f6-57e5-a001-7fe2893e21f7', 9, 2026, 1970, '/demo/images/cong-to-301-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('a817fb2b-049e-5758-9a53-78699a2f7a8b', 10, 2026, 2037, '/demo/images/cong-to-301-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '99b7dc36-7888-5949-b5af-c12a1c71f72e'),
('b34680f1-7ee2-5d12-9afc-c3ddf5a53e3f', 8, 2026, 1906, '/demo/images/cong-to-302-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('7b4868b6-6804-5ae9-865f-13ff39f1e82b', 9, 2026, 1980, '/demo/images/cong-to-302-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('25b35f2d-9842-50f0-a3ae-fa47630acbd9', 10, 2026, 2054, '/demo/images/cong-to-302-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', 'f44e0f30-4544-5a7b-a0f6-3ad24084b2fe'),
('3900b625-a1fa-57fa-8eb9-ca32531c7d36', 8, 2026, 1909, '/demo/images/cong-to-303-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('a3df42cb-2d8f-5f4b-9129-830aadb86946', 9, 2026, 1990, '/demo/images/cong-to-303-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('b5b679f0-02c1-50b3-b518-e2468921c7fa', 10, 2026, 2071, '/demo/images/cong-to-303-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, 'a4fa1ed3-c292-54f5-9050-fe831ff02d0f'),
('27937d3e-4548-59ad-86a0-514098aea5bf', 8, 2026, 1912, '/demo/images/cong-to-304-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('da1d4850-a4eb-59d1-a227-65fd1c806aa7', 9, 2026, 2000, '/demo/images/cong-to-304-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('c8866d28-7161-5e86-aab8-8426dd6cfa54', 10, 2026, 2088, '/demo/images/cong-to-304-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '3d86767e-486c-5922-bc54-3844d4a23bf6'),
('61145552-9dca-5398-930f-d8768447a53a', 8, 2026, 1915, '/demo/images/cong-to-305-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '497262a3-e035-5e8c-a340-468ccf44f240'),
('61217e7f-cab0-54ae-986e-cce793cd6277', 9, 2026, 2010, '/demo/images/cong-to-305-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '497262a3-e035-5e8c-a340-468ccf44f240'),
('7f8ffd12-a9ac-5f1d-aaba-1a4544c4d890', 10, 2026, 2105, '/demo/images/cong-to-305-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '497262a3-e035-5e8c-a340-468ccf44f240'),
('b30df3b3-df7a-50df-958e-6406ffad906f', 8, 2026, 1918, '/demo/images/cong-to-306-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad'),
('59a7273f-1f98-58a4-b240-5b3adbfd9e49', 9, 2026, 2020, '/demo/images/cong-to-306-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad'),
('fd3219e7-9942-5952-9289-a31c7283ecaf', 10, 2026, 2122, '/demo/images/cong-to-306-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, '9e54ecc6-7fdb-5f90-a51c-2d661e3dcbad'),
('07a62c1c-ca61-5494-907d-352cfc1a7b02', 8, 2026, 1921, '/demo/images/cong-to-307-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '7bdebb04-1395-5899-8c71-effc01a2d366'),
('53835498-e57a-5bc8-86bb-08e63465e30d', 9, 2026, 2030, '/demo/images/cong-to-307-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '7bdebb04-1395-5899-8c71-effc01a2d366'),
('9da424d4-28d7-51a0-9d07-5a663d7884bb', 10, 2026, 2139, '/demo/images/cong-to-307-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '7bdebb04-1395-5899-8c71-effc01a2d366'),
('a1dcc3f2-f0ba-5789-9fbe-b025a64f9204', 8, 2026, 1924, '/demo/images/cong-to-308-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'dbc308b2-1813-5109-8e40-5c418c58334b'),
('0654cfd1-a732-5d43-bdb6-d8e07d8ffc85', 9, 2026, 2040, '/demo/images/cong-to-308-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'dbc308b2-1813-5109-8e40-5c418c58334b'),
('2b6f30a7-5aef-5b8e-86f2-edd47455c9c3', 10, 2026, 2156, '/demo/images/cong-to-308-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', 'dbc308b2-1813-5109-8e40-5c418c58334b'),
('62fd7985-3174-57ee-9c72-b19e3290f9e8', 8, 2026, 1927, '/demo/images/cong-to-309-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', 'b71f8651-9926-57df-a3c8-44e1cb2678d0'),
('3b49a6fc-0851-50c1-aca1-d9e278bd6706', 9, 2026, 2050, '/demo/images/cong-to-309-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', 'b71f8651-9926-57df-a3c8-44e1cb2678d0'),
('f01c48ff-8690-5a47-a62a-70818db39702', 10, 2026, 2173, '/demo/images/cong-to-309-10.jpg', 3500, 'CHO_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', null, null, 'b71f8651-9926-57df-a3c8-44e1cb2678d0'),
('51ec2cb3-a9f2-52af-aafc-7c6c66d12923', 8, 2026, 1930, '/demo/images/cong-to-310-8.jpg', 3500, 'DA_XAC_NHAN', '2026-08-31 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-08-31 09:00:00', '64b6cdcf-a611-54fc-bc9a-2668faf8d9f1'),
('9d9bdd7c-de98-518c-b2e7-51449ebd3bb1', 9, 2026, 1990, '/demo/images/cong-to-310-9.jpg', 3500, 'DA_XAC_NHAN', '2026-09-30 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-09-30 09:00:00', '64b6cdcf-a611-54fc-bc9a-2668faf8d9f1'),
('d2241a65-3f12-5f1a-88a9-2026114006e4', 10, 2026, 2050, '/demo/images/cong-to-310-10.jpg', 3500, 'DA_XAC_NHAN', '2026-10-12 08:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', '910fb605-b871-5141-8d96-1f8577508ac2', '2026-10-12 09:00:00', '64b6cdcf-a611-54fc-bc9a-2668faf8d9f1');

-- YeuCau: 9 bản ghi
insert into `YeuCau` (`maYeuCau`, `ngayGui`, `noiDung`, `trangThai`, `loaiYeuCau`, `maKhachThue`) values
('556c05ff-6d33-5827-9b24-46e291ac2b88', '2026-10-11 10:00:00', 'Đề nghị gia hạn hợp đồng', 'CHO_XU_LY', 'GIA_HAN', '6acd6669-d766-5fe0-92e9-b1aa196d9be2'),
('2df770e3-012c-56d8-961c-d4014b6279f4', '2026-10-05 10:00:00', 'Đề nghị gia hạn hợp đồng', 'DA_PHE_DUYET', 'GIA_HAN', '0801a2df-3b8f-5f01-a7a7-999df263b9f1'),
('d9acfd46-2a89-547f-89ef-2722960ab2f4', '2026-10-06 10:00:00', 'Đề nghị gia hạn hợp đồng', 'TU_CHOI', 'GIA_HAN', '1d191cfa-bc32-5792-b294-b7c9642e6738'),
('20f0e088-9354-5f70-a5e1-c249fc4d8d05', '2026-10-07 10:00:00', 'Đề nghị trả phòng', 'DA_PHE_DUYET', 'TRA_PHONG', '81e447aa-394a-5a24-ad70-c26090aa0046'),
('8af33f04-c782-512e-8a29-77ceadd7f2a5', '2026-10-09 10:00:00', 'Đề nghị trả phòng', 'CHO_XU_LY', 'TRA_PHONG', 'b35a8c46-67e0-5b9f-ae5a-66d5358784ad'),
('1228dd52-6aab-5b5b-90c4-678cd2c4b8a9', '2026-10-10 10:00:00', 'Đề nghị thêm người ở cùng', 'CHO_XU_LY', 'DE_XUAT_BAN_CUNG_PHONG', 'e1593383-dc4f-5e38-88a9-7aa1efcb5ec5'),
('50250e6f-0e0f-59ad-a963-e63ad5caea36', '2026-10-08 10:00:00', 'Đề nghị thêm người ở cùng', 'TU_CHOI', 'DE_XUAT_BAN_CUNG_PHONG', '446f8eb0-3b6f-550a-9239-c6d13fe5ebbc'),
('f828fb7e-4cbb-56ac-9262-677c4731c59e', '2026-09-01 10:00:00', 'Đề nghị trả phòng', 'DA_PHE_DUYET', 'TRA_PHONG', '0ef1e9d9-dd04-5e11-9cca-09db54636c54'),
('f4d7db3b-8006-5782-9192-0a162d55911f', '2026-09-02 10:00:00', 'Đề nghị trả phòng', 'DA_PHE_DUYET', 'TRA_PHONG', 'd4049cbd-8856-5965-920e-95c337c4cc6a');

-- ThanhToan: 32 bản ghi
insert into `ThanhToan` (`maThanhToan`, `thang`, `nam`, `tongPhaiTra`, `tongDaThanhToan`, `soTienConNo`, `trangThai`, `maHopDong`) values
('ee23c735-b9d4-52e4-9699-a8d0c49a8567', 9, 2026, 3512500, 3512500, 0, 'DA_THANH_TOAN', 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('d2f527cc-9745-532b-b693-8fe69004fcdc', 10, 2026, 3484500, 1742250, 1742250, 'THANH_TOAN_MOT_PHAN', 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('f88940a6-f53b-5206-b1b0-0ee6c1e5576e', 9, 2026, 3562500, 3562500, 0, 'DA_THANH_TOAN', '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('9d0ff870-94b8-583b-a973-cbe91594fc37', 10, 2026, 3809000, 0, 3809000, 'CHUA_THANH_TOAN', '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('1727f278-6c03-5b1b-b339-704411d3a0e5', 9, 2026, 3612500, 3612500, 0, 'DA_THANH_TOAN', 'e8772d48-4dd0-53fd-99b3-bae649607251'),
('7bfe3135-c428-5c7d-a36b-ec6e626410d5', 10, 2026, 3633500, 3633500, 0, 'DA_THANH_TOAN', 'e8772d48-4dd0-53fd-99b3-bae649607251'),
('c8cafb83-5f92-5272-b794-eb303f988238', 9, 2026, 3562500, 3562500, 0, 'DA_THANH_TOAN', '03a058bf-b63d-5599-8ab2-0270bc48ac92'),
('58cc9f42-b2a6-56db-8e17-a70c17c16fa5', 10, 2026, 3608000, 1804000, 1804000, 'THANH_TOAN_MOT_PHAN', '03a058bf-b63d-5599-8ab2-0270bc48ac92'),
('1aae3243-1058-575c-b4ce-d73520f1b311', 9, 2026, 3612500, 0, 3612500, 'CHUA_THANH_TOAN', '2c2b33ad-e932-5ffa-8463-dfe5a8fef059'),
('12e042e6-0921-5bbf-962e-fa9deb419a41', 10, 2026, 3682500, 0, 3682500, 'CHUA_THANH_TOAN', '2c2b33ad-e932-5ffa-8463-dfe5a8fef059'),
('7513bed7-7402-50ff-8678-0ea827000267', 9, 2026, 3662500, 3662500, 0, 'DA_THANH_TOAN', '158a8610-6bc5-5543-a2fc-c9b7ce581cfa'),
('c828c26b-88ce-560e-83fb-26a207d510e4', 10, 2026, 3757000, 3757000, 0, 'DA_THANH_TOAN', '158a8610-6bc5-5543-a2fc-c9b7ce581cfa'),
('9c138298-93e3-5a0d-a256-1852a518e18e', 9, 2026, 3712500, 3712500, 0, 'DA_THANH_TOAN', '7c83cb2d-4a7c-5e33-bf31-e54b368f946a'),
('1b62c27e-9ee7-52cf-96b5-84bc8e416de0', 10, 2026, 3684500, 1842250, 1842250, 'THANH_TOAN_MOT_PHAN', '7c83cb2d-4a7c-5e33-bf31-e54b368f946a'),
('ddda3768-af5a-566a-b4f1-ab76fc0f484e', 9, 2026, 3662500, 3662500, 0, 'DA_THANH_TOAN', 'e9afd576-2886-5b65-b552-af64bc127ad1'),
('8303a73f-0de2-520a-b100-f9d74e245aea', 10, 2026, 3659000, 0, 3659000, 'CHUA_THANH_TOAN', 'e9afd576-2886-5b65-b552-af64bc127ad1'),
('e0a74d5f-fae3-5c90-9fef-1c782a3b7cc4', 9, 2026, 3712500, 3712500, 0, 'DA_THANH_TOAN', 'b840c2f7-fc52-52ee-994f-03ce94693846'),
('72182f55-f51f-5baa-a95d-e12cfbe818f7', 10, 2026, 3733500, 3733500, 0, 'DA_THANH_TOAN', 'b840c2f7-fc52-52ee-994f-03ce94693846'),
('d9f502c0-f0f9-52af-9b6a-fc514aa47609', 9, 2026, 3762500, 1881250, 1881250, 'THANH_TOAN_MOT_PHAN', '48844424-be50-566d-bdc5-43a600659724'),
('b1520500-fca9-5499-b6ff-c878e7f55ee9', 10, 2026, 3808000, 1904000, 1904000, 'THANH_TOAN_MOT_PHAN', '48844424-be50-566d-bdc5-43a600659724'),
('5275ccd3-8449-5252-98f0-dfb5b0d6329b', 9, 2026, 3812500, 3812500, 0, 'DA_THANH_TOAN', '67e436ed-1168-5879-9d8c-1490377c6645'),
('64416fca-e2e7-5946-8928-1361e91aa931', 10, 2026, 3882500, 0, 3882500, 'CHUA_THANH_TOAN', '67e436ed-1168-5879-9d8c-1490377c6645'),
('a0dc8420-c3fe-5491-8006-3626b12895a2', 9, 2026, 3912500, 3912500, 0, 'DA_THANH_TOAN', '5939bacc-ac8b-50f2-949f-409e64e96606'),
('e68e6c8f-5c72-5c56-8874-69fdde7540cd', 10, 2026, 3884500, 3884500, 0, 'DA_THANH_TOAN', '5939bacc-ac8b-50f2-949f-409e64e96606'),
('4474e697-84dd-5251-af3b-360f4ad753af', 9, 2026, 3962500, 3962500, 0, 'DA_THANH_TOAN', '81dc5ce5-ad84-50da-8cf1-31b99ca1605b'),
('6fd41a7a-3c1c-5d15-add4-a874ea1d290d', 10, 2026, 3959000, 1979500, 1979500, 'THANH_TOAN_MOT_PHAN', '81dc5ce5-ad84-50da-8cf1-31b99ca1605b'),
('07eb1c17-5567-5e32-ab8d-0933be7a61c0', 9, 2026, 4012500, 4012500, 0, 'DA_THANH_TOAN', '2f80db08-48ee-532f-88a8-ca9ed26cae13'),
('ad36f735-4fa6-5c6f-9d32-e4e22f6a726b', 10, 2026, 4033500, 0, 4033500, 'CHUA_THANH_TOAN', '2f80db08-48ee-532f-88a8-ca9ed26cae13'),
('15120081-c37c-5f98-9084-f08c025ea103', 10, 2026, 3800000, 3800000, 0, 'DA_THANH_TOAN', 'd9c22d6f-b3fb-5d66-b629-b3d4534594a7'),
('0b7abbef-6617-5787-bd9a-93a78cb599a5', 10, 2026, 2790323, 1395161, 1395162, 'THANH_TOAN_MOT_PHAN', 'c6dbfb8d-f5b7-596f-931f-08d26fc9e60a'),
('2a1f4a2b-6bc8-50b7-9dbe-8d57a90d8aa7', 9, 2026, 3712500, 3712500, 0, 'DA_THANH_TOAN', '92256090-e741-5003-8cb0-ee1336a340fc'),
('c586bc81-418d-5590-b741-bd5a0e721517', 9, 2026, 3962500, 3962500, 0, 'DA_THANH_TOAN', '7814acca-085e-50ab-ac90-479792d8b10a');

-- Backfill legacy: các phiếu mẫu đã tồn tại trước migration 013 được đánh dấu đã xử lý
-- để lần chạy cron đầu tiên không gửi/nhắc lại; soTienConNo được giữ nguyên.
update `ThanhToan` set
`ngayLap`=timestamp(concat(`nam`, '-', lpad(`thang`, 2, '0'), '-01 00:00:00')),
`daGui`=true, `ngayGui`=timestamp(concat(`nam`, '-', lpad(`thang`, 2, '0'), '-01 00:00:00')),
`daNhacHan`=true, `ngayNhacHan`=timestamp(concat(`nam`, '-', lpad(`thang`, 2, '0'), '-05 00:00:00')),
`quaHan`=true, `ngayQuaHan`=timestamp(concat(`nam`, '-', lpad(`thang`, 2, '0'), '-06 00:00:00')),
`daChotCongNo`=true, `ngayChotCongNo`=timestamp(concat(`nam`, '-', lpad(`thang`, 2, '0'), '-10 23:59:59')),
`soTienChotCongNo`=`soTienConNo`;

-- SuCo: 6 bản ghi
insert into `SuCo` (`maSuCo`, `loaiSuCo`, `mucDoUuTien`, `moTa`, `hinhAnhUrl`, `trangThai`, `ngayGui`, `ngayChinhSua`, `ngayTiepNhan`, `ketQuaXuLy`, `thietBiThayThe`, `chiPhiSuaChua`, `doiTuongChiuPhi`, `ngayHoanTat`, `daXoa`, `lyDoXoa`, `ngayXoa`, `nguoiTiepNhanId`, `nguoiXoaId`, `maNguoiGui`, `maPhong`) values
('da6a760f-965a-54c9-a283-3038da36f6ed', 'THIET_BI', 'CAO', 'Báo cáo thiết bị phòng 101 cần kiểm tra', '/demo/images/su-co-1.jpg', 'DA_XU_LY', '2026-10-03 08:00:00', null, '2026-10-03 10:00:00', 'Đã kiểm tra và sửa chữa', null, 180000, 'CHU_TRO', '2026-10-04 15:00:00', false, null, null, '910fb605-b871-5141-8d96-1f8577508ac2', null, '492d371e-f8c5-53b7-8615-ffdb678575ab', '859d5d6b-750c-5471-8c33-9b9585fdfb8e'),
('8f80721c-f9ff-5a97-baf9-b88a98cc60be', 'THIET_BI', 'CAO', 'Báo cáo thiết bị phòng 102 cần kiểm tra', '/demo/images/su-co-2.jpg', 'DA_XU_LY', '2026-10-03 08:00:00', null, '2026-10-03 10:00:00', 'Đã kiểm tra và sửa chữa', null, 250000, 'KHACH_THUE', '2026-10-04 15:00:00', false, null, null, '910fb605-b871-5141-8d96-1f8577508ac2', null, 'c0257961-a1f1-5d31-a4b1-0b85155a48d1', '058a650b-1f98-5c0f-9354-d858660c7d30'),
('fc09a14a-d911-5e19-a6b5-00e73462e37d', 'THIET_BI', 'CAO', 'Báo cáo thiết bị phòng 103 cần kiểm tra', '/demo/images/su-co-3.jpg', 'DANG_XU_LY', '2026-10-03 08:00:00', null, '2026-10-03 10:00:00', null, null, null, null, null, false, null, null, '910fb605-b871-5141-8d96-1f8577508ac2', null, '903fd6e2-0a6f-5370-a49a-841492537834', '92bb9c6e-ec9a-59c4-b6f4-10b984cbd280'),
('57ca4c8d-d6e7-52b2-ad7c-9e42ecc4714c', 'THIET_BI', 'TRUNG_BINH', 'Báo cáo thiết bị phòng 105 cần kiểm tra', '/demo/images/su-co-4.jpg', 'CHO_TIEP_NHAN', '2026-10-03 08:00:00', null, null, null, null, null, null, null, false, null, null, null, null, '4ca777c9-ae13-5b12-b28b-ed10e15c0be2', 'f339a5fb-544b-52dd-a0ac-aa8f0236ee36'),
('3ced92a1-0953-58dc-8c6b-cc20aa44ac98', 'THIET_BI', 'TRUNG_BINH', 'Báo cáo thiết bị phòng 106 cần kiểm tra', '/demo/images/su-co-5.jpg', 'CHO_TIEP_NHAN', '2026-10-03 08:00:00', null, null, null, null, null, null, null, true, 'Báo cáo trùng, xóa khi chưa tiếp nhận', '2026-10-03 09:00:00', null, '910fb605-b871-5141-8d96-1f8577508ac2', '392586b8-d887-5c87-b0fb-72401eadb43a', '85e8da02-4014-52d8-886d-355fba7be7ca'),
('7cc54d98-82ff-52c4-9c07-691366902efc', 'THIET_BI', 'TRUNG_BINH', 'Báo cáo thiết bị phòng 201 cần kiểm tra', '/demo/images/su-co-6.jpg', 'DA_XU_LY', '2026-10-03 08:00:00', null, '2026-10-03 10:00:00', 'Đã kiểm tra và sửa chữa', null, 0, 'CHU_TRO', '2026-10-04 15:00:00', false, null, null, '910fb605-b871-5141-8d96-1f8577508ac2', null, 'df69c727-c0e2-5300-8b5e-fb8d21eaf2cb', 'ca9a183a-c188-5f24-89a0-614aafd7728a');

-- YeuCauGiaHan: 3 bản ghi
insert into `YeuCauGiaHan` (`ngayKetThucDeXuat`, `maYeuCau`, `maHopDong`) values
('2027-04-30', '556c05ff-6d33-5827-9b24-46e291ac2b88', 'b9cdd32d-eead-5877-952e-4a189d6d306a'),
('2027-09-30', '2df770e3-012c-56d8-961c-d4014b6279f4', '9d70c9d7-dc16-55ab-9c41-6f5985fbf82f'),
('2027-09-30', 'd9acfd46-2a89-547f-89ef-2722960ab2f4', 'e8772d48-4dd0-53fd-99b3-bae649607251');

-- YeuCauTraPhong: 4 bản ghi
insert into `YeuCauTraPhong` (`maYeuCau`, `maHopDong`) values
('20f0e088-9354-5f70-a5e1-c249fc4d8d05', '03a058bf-b63d-5599-8ab2-0270bc48ac92'),
('8af33f04-c782-512e-8a29-77ceadd7f2a5', '2c2b33ad-e932-5ffa-8463-dfe5a8fef059'),
('f828fb7e-4cbb-56ac-9262-677c4731c59e', '92256090-e741-5003-8cb0-ee1336a340fc'),
('f4d7db3b-8006-5782-9192-0a162d55911f', '7814acca-085e-50ab-ac90-479792d8b10a');

-- DeXuatBanCungPhong: 2 bản ghi
insert into `DeXuatBanCungPhong` (`hoTenNguoiDeXuat`, `soDienThoaiNguoiDeXuat`, `noiDungBoSung`, `maYeuCau`, `maPhong`) values
('Người được đề xuất 8', '0940000008', 'Chưa ghi cư trú khi đề xuất chưa được duyệt', '1228dd52-6aab-5b5b-90c4-678cd2c4b8a9', '1f22fc5d-6fca-5fd7-adc4-c998515b04a3'),
('Người được đề xuất 9', '0940000009', 'Chưa ghi cư trú khi đề xuất chưa được duyệt', '50250e6f-0e0f-59ad-a963-e63ad5caea36', '83a59a9c-63ab-5778-9fb0-3502420d8cc7');

-- GiaoDichThanhToan: 45 bản ghi
insert into `GiaoDichThanhToan` (`maGiaoDich`, `soTien`, `thoiDiemGhiNhan`, `minhChungUrl`, `trangThaiXacNhan`, `thoiDiemXacNhan`, `lyDoHuy`, `ngayHuy`, `nguoiHuyId`, `maThanhToan`) values
('a29afff2-134f-566a-ba66-c8332bdbe824', 3512500, '2026-09-07 09:00:00', '/demo/images/gd1-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'ee23c735-b9d4-52e4-9699-a8d0c49a8567'),
('e62504cb-4ace-5ae9-978f-9549ddb82b7d', 1742250, '2026-10-07 09:00:00', '/demo/images/gd1-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, 'd2f527cc-9745-532b-b693-8fe69004fcdc'),
('65920ee4-8cb9-5461-b041-999640660787', 500000, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-1.jpg', 'CHO_XAC_NHAN', null, null, null, null, 'd2f527cc-9745-532b-b693-8fe69004fcdc'),
('ba0ed54e-48f7-58b1-99e8-a65d77db6fee', 3562500, '2026-09-07 09:00:00', '/demo/images/gd2-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'f88940a6-f53b-5206-b1b0-0ee6c1e5576e'),
('7c485c19-a741-52c1-bb79-14d4a371a114', null, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-2.jpg', 'CHO_XAC_NHAN', null, null, null, null, '9d0ff870-94b8-583b-a973-cbe91594fc37'),
('a9795243-1df2-500c-acaf-71ffe6e3ea02', 3612500, '2026-09-07 09:00:00', '/demo/images/gd3-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '1727f278-6c03-5b1b-b339-704411d3a0e5'),
('eece46bf-a7d9-5c69-abbd-b9653cac35e5', 3633500, '2026-10-07 09:00:00', '/demo/images/gd3-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, '7bfe3135-c428-5c7d-a36b-ec6e626410d5'),
('e2a55218-58bf-5cb6-8b66-2c7751d71a6d', 1781250, '2026-09-07 09:00:00', '/demo/images/gd4-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'c8cafb83-5f92-5272-b794-eb303f988238'),
('e75ebfb7-0ca2-5bb0-a313-47ad27d00cfe', 1781250, '2026-09-07 10:00:00', '/demo/images/gd4-9-2.jpg', 'DA_XAC_NHAN', '2026-09-07 11:00:00', null, null, null, 'c8cafb83-5f92-5272-b794-eb303f988238'),
('566140e8-3b35-597a-80a8-b37c1fa88ddd', 902000, '2026-10-07 09:00:00', '/demo/images/gd4-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, '58cc9f42-b2a6-56db-8e17-a70c17c16fa5'),
('5efc7ca7-bf3a-5524-8cf2-c7406ffb1e33', 902000, '2026-10-07 10:00:00', '/demo/images/gd4-10-2.jpg', 'DA_XAC_NHAN', '2026-10-07 11:00:00', null, null, null, '58cc9f42-b2a6-56db-8e17-a70c17c16fa5'),
('2d2f2122-52df-5e40-ae4d-e793747a6829', null, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-4.jpg', 'CHO_XAC_NHAN', null, null, null, null, '58cc9f42-b2a6-56db-8e17-a70c17c16fa5'),
('9bc77b3a-5fe4-5a23-97e4-9dac4404251b', 500000, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-5.jpg', 'CHO_XAC_NHAN', null, null, null, null, '12e042e6-0921-5bbf-962e-fa9deb419a41'),
('8311687e-f4ee-5c7d-a4b3-a387c2f19619', 3662500, '2026-09-07 09:00:00', '/demo/images/gd6-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '7513bed7-7402-50ff-8678-0ea827000267'),
('0a21a6b9-6edf-5e7e-84e3-1abe17597ee4', 3757000, '2026-10-07 09:00:00', '/demo/images/gd6-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, 'c828c26b-88ce-560e-83fb-26a207d510e4'),
('0afa433f-b73d-51ef-a0d6-23b498258515', 3712500, '2026-09-07 09:00:00', '/demo/images/gd7-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '9c138298-93e3-5a0d-a256-1852a518e18e'),
('06369e92-38bb-58c9-94f9-95c7b454f542', 1842250, '2026-10-07 09:00:00', '/demo/images/gd7-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, '1b62c27e-9ee7-52cf-96b5-84bc8e416de0'),
('09914476-c7a9-5a71-865b-f6b826f71951', 500000, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-7.jpg', 'CHO_XAC_NHAN', null, null, null, null, '1b62c27e-9ee7-52cf-96b5-84bc8e416de0'),
('ece6e8b3-036b-5de0-8b26-d0401588e6da', 1831250, '2026-09-07 09:00:00', '/demo/images/gd8-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'ddda3768-af5a-566a-b4f1-ab76fc0f484e'),
('a57d8cd9-113b-5e67-9e82-87c7fd28d5b7', 1831250, '2026-09-07 10:00:00', '/demo/images/gd8-9-2.jpg', 'DA_XAC_NHAN', '2026-09-07 11:00:00', null, null, null, 'ddda3768-af5a-566a-b4f1-ab76fc0f484e'),
('82ef3c2e-cf7a-5c90-9fd1-a33eaab9349c', null, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-8.jpg', 'CHO_XAC_NHAN', null, null, null, null, '8303a73f-0de2-520a-b100-f9d74e245aea'),
('1c3fde53-f032-5d3c-8d40-4336c54c3987', 3712500, '2026-09-07 09:00:00', '/demo/images/gd9-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'e0a74d5f-fae3-5c90-9fef-1c782a3b7cc4'),
('353c3bca-e614-57b3-8d2a-8c7f5df6e8d8', 3733500, '2026-10-07 09:00:00', '/demo/images/gd9-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, '72182f55-f51f-5baa-a95d-e12cfbe818f7'),
('4e20179d-0781-53c6-a605-aa97a60390e4', 1881250, '2026-09-07 09:00:00', '/demo/images/gd10-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'd9f502c0-f0f9-52af-9b6a-fc514aa47609'),
('bda30088-ce18-5ad6-b3fc-e066ed923395', 1904000, '2026-10-07 09:00:00', '/demo/images/gd10-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, 'b1520500-fca9-5499-b6ff-c878e7f55ee9'),
('3da727e5-bd90-5b31-b745-deae2563469b', null, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-10.jpg', 'CHO_XAC_NHAN', null, null, null, null, 'b1520500-fca9-5499-b6ff-c878e7f55ee9'),
('b6831d72-d77c-5b7e-854f-605c6e759fa9', 3812500, '2026-09-07 09:00:00', '/demo/images/gd11-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '5275ccd3-8449-5252-98f0-dfb5b0d6329b'),
('45d79bde-017a-57f2-b049-2f015784f778', 500000, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-11.jpg', 'CHO_XAC_NHAN', null, null, null, null, '64416fca-e2e7-5946-8928-1361e91aa931'),
('a77466e1-2dc2-53a9-9473-ed414a6fdd90', 1956250, '2026-09-07 09:00:00', '/demo/images/gd12-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'a0dc8420-c3fe-5491-8006-3626b12895a2'),
('02c3fedf-deb8-517b-b49a-880721baa5cc', 1956250, '2026-09-07 10:00:00', '/demo/images/gd12-9-2.jpg', 'DA_XAC_NHAN', '2026-09-07 11:00:00', null, null, null, 'a0dc8420-c3fe-5491-8006-3626b12895a2'),
('52a3036f-9511-5590-8433-c86a283a4119', 1942250, '2026-10-07 09:00:00', '/demo/images/gd12-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, 'e68e6c8f-5c72-5c56-8874-69fdde7540cd'),
('bbd30f3c-72a2-52c6-a4fc-d17534c47340', 1942250, '2026-10-07 10:00:00', '/demo/images/gd12-10-2.jpg', 'DA_XAC_NHAN', '2026-10-07 11:00:00', null, null, null, 'e68e6c8f-5c72-5c56-8874-69fdde7540cd'),
('e473deb0-13ee-5980-99e7-7c40873a7d4b', 3962500, '2026-09-07 09:00:00', '/demo/images/gd13-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '4474e697-84dd-5251-af3b-360f4ad753af'),
('2f272e0f-1c00-5789-bba8-4d3c93782aa4', 1979500, '2026-10-07 09:00:00', '/demo/images/gd13-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, '6fd41a7a-3c1c-5d15-add4-a874ea1d290d'),
('18c4ca3d-9639-5adc-84e4-5a32b7868c28', 500000, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-13.jpg', 'CHO_XAC_NHAN', null, null, null, null, '6fd41a7a-3c1c-5d15-add4-a874ea1d290d'),
('2c3d1fff-176a-5260-abd0-288b1b7ab737', 4012500, '2026-09-07 09:00:00', '/demo/images/gd14-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '07eb1c17-5567-5e32-ab8d-0933be7a61c0'),
('17cb3eef-24bb-57b8-b727-55024eab5c1a', null, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-14.jpg', 'CHO_XAC_NHAN', null, null, null, null, 'ad36f735-4fa6-5c6f-9d32-e4e22f6a726b'),
('c81b878b-c862-5359-b569-675b5ff76510', 3800000, '2026-10-07 09:00:00', '/demo/images/gd15-10-1.jpg', 'DA_XAC_NHAN', '2026-10-07 10:00:00', null, null, null, '15120081-c37c-5f98-9084-f08c025ea103'),
('5f078b79-7d10-530c-97d6-10874027823d', 697580, '2026-10-11 09:00:00', '/demo/images/gd16-10-1.jpg', 'DA_XAC_NHAN', '2026-10-11 10:00:00', null, null, null, '0b7abbef-6617-5787-bd9a-93a78cb599a5'),
('b2d32a71-e6bb-5b4a-a911-5a8a675cb554', 697581, '2026-10-11 10:00:00', '/demo/images/gd16-10-2.jpg', 'DA_XAC_NHAN', '2026-10-11 11:00:00', null, null, null, '0b7abbef-6617-5787-bd9a-93a78cb599a5'),
('25059c71-7dde-56a5-8150-aa091623a850', null, '2026-10-12 08:00:00', '/demo/images/minh-chung-cho-16.jpg', 'CHO_XAC_NHAN', null, null, null, null, '0b7abbef-6617-5787-bd9a-93a78cb599a5'),
('5593c162-2b4e-5b8b-bd61-735a0ab8439c', 3712500, '2026-09-07 09:00:00', '/demo/images/gd17-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, '2a1f4a2b-6bc8-50b7-9dbe-8d57a90d8aa7'),
('bab3f801-bfca-5934-9850-59089cb7c016', 3962500, '2026-09-07 09:00:00', '/demo/images/gd18-9-1.jpg', 'DA_XAC_NHAN', '2026-09-07 10:00:00', null, null, null, 'c586bc81-418d-5590-b741-bd5a0e721517'),
('2a1a9292-4f7b-501b-a5a8-92ee0584bb90', 100000, '2026-10-06 08:00:00', null, 'DA_HUY', '2026-10-06 09:00:00', 'Ghi nhầm giao dịch, đã hủy đồng bộ khoản thu', '2026-10-06 10:00:00', '910fb605-b871-5141-8d96-1f8577508ac2', 'd2f527cc-9745-532b-b693-8fe69004fcdc'),
('4db89b18-e581-54be-b5b7-93b68ec3a09c', 500000, '2026-10-08 08:00:00', '/demo/images/minh-chung-tu-choi.jpg', 'TU_CHOI', null, null, null, null, '9d0ff870-94b8-583b-a973-cbe91594fc37');

-- ChiTietThanhToan: 127 bản ghi
insert into `ChiTietThanhToan` (`maChiTiet`, `loaiKhoan`, `soTien`, `dienGiai`, `maThanhToan`, `maSuCo`) values
('a93e53fc-d64f-553c-b671-4c6403d12ab0', 'TIEN_PHONG', 2850000, 'Tiền phòng cả tháng', 'ee23c735-b9d4-52e4-9699-a8d0c49a8567', null),
('accc8ec9-fbf1-58c1-857c-b782612c1203', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'ee23c735-b9d4-52e4-9699-a8d0c49a8567', null),
('8b466d20-715e-56cc-b296-38f3e8827646', 'TIEN_NUOC', 300000, 'Nước khoán 100000 VND/người/kỳ', 'ee23c735-b9d4-52e4-9699-a8d0c49a8567', null),
('dc338481-c67d-5f86-85d3-78754d6c2b1b', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'ee23c735-b9d4-52e4-9699-a8d0c49a8567', null),
('7d7c5abb-19df-537d-9542-1cfdc0981d8f', 'TIEN_PHONG', 2850000, 'Tiền phòng cả tháng', 'd2f527cc-9745-532b-b693-8fe69004fcdc', null),
('6323785f-3072-57f4-ae4f-c1938c1b8c41', 'TIEN_DIEN', 234500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', 'd2f527cc-9745-532b-b693-8fe69004fcdc', null),
('71f91817-3fc6-519a-a9f6-16582706eb42', 'TIEN_NUOC', 300000, 'Nước khoán 100000 VND/người/kỳ', 'd2f527cc-9745-532b-b693-8fe69004fcdc', null),
('975ad3cf-bd33-584c-9620-8c0da4eebf21', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'd2f527cc-9745-532b-b693-8fe69004fcdc', null),
('22b02749-552a-5bcd-8835-54cf1dac1952', 'TIEN_PHONG', 2900000, 'Tiền phòng cả tháng', 'f88940a6-f53b-5206-b1b0-0ee6c1e5576e', null),
('d29f3601-617e-5acc-8332-8223f84ce116', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'f88940a6-f53b-5206-b1b0-0ee6c1e5576e', null),
('21d306a6-41b8-5102-8847-0ff6ba09b18d', 'TIEN_NUOC', 300000, 'Nước khoán 100000 VND/người/kỳ', 'f88940a6-f53b-5206-b1b0-0ee6c1e5576e', null),
('95228bf1-ce1f-5e89-903f-375c3f058fdd', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'f88940a6-f53b-5206-b1b0-0ee6c1e5576e', null),
('581ff375-1655-50c2-b1e8-23b2ed3738fe', 'TIEN_PHONG', 2900000, 'Tiền phòng cả tháng', '9d0ff870-94b8-583b-a973-cbe91594fc37', null),
('fda7527d-1ced-52d2-a798-250f6cd7d11a', 'TIEN_DIEN', 259000, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '9d0ff870-94b8-583b-a973-cbe91594fc37', null),
('da11c29b-bdc5-5407-be6c-6572f1315b0e', 'TIEN_NUOC', 300000, 'Nước khoán 100000 VND/người/kỳ', '9d0ff870-94b8-583b-a973-cbe91594fc37', null),
('45e23255-afe8-57bb-a9c8-68c5279f5f3c', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '9d0ff870-94b8-583b-a973-cbe91594fc37', null),
('07aa91aa-fcd2-5a2b-97e2-75dbff53a626', 'SUA_CHUA', 250000, 'Chi phí SC02 do khách thuê chịu', '9d0ff870-94b8-583b-a973-cbe91594fc37', '8f80721c-f9ff-5a97-baf9-b88a98cc60be'),
('35978d6e-a062-5cf2-a70d-738fe3201f65', 'TIEN_PHONG', 2950000, 'Tiền phòng cả tháng', '1727f278-6c03-5b1b-b339-704411d3a0e5', null),
('efeb314c-0a01-5f75-8b7d-5f80e4ddb3c9', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '1727f278-6c03-5b1b-b339-704411d3a0e5', null),
('7268ccdf-76dc-544c-8713-9b7c8fc0df04', 'TIEN_NUOC', 300000, 'Nước khoán 100000 VND/người/kỳ', '1727f278-6c03-5b1b-b339-704411d3a0e5', null),
('d11e97a5-548c-5aa0-befe-360acf6918f9', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '1727f278-6c03-5b1b-b339-704411d3a0e5', null),
('bc357f14-40a6-51a3-a28b-6d6c3ebb66e2', 'TIEN_PHONG', 2950000, 'Tiền phòng cả tháng', '7bfe3135-c428-5c7d-a36b-ec6e626410d5', null),
('bae12b25-8940-5a7f-bf82-2dc53bc6fc4e', 'TIEN_DIEN', 283500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '7bfe3135-c428-5c7d-a36b-ec6e626410d5', null),
('9b6c33f5-6e13-5a31-bd45-a831bad51b5b', 'TIEN_NUOC', 300000, 'Nước khoán 100000 VND/người/kỳ', '7bfe3135-c428-5c7d-a36b-ec6e626410d5', null),
('6628d5cf-7fb6-5c22-9a2b-38dfe666d374', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '7bfe3135-c428-5c7d-a36b-ec6e626410d5', null),
('d9c8de9e-8d16-51b5-a688-1ef49d7e99bd', 'TIEN_PHONG', 3000000, 'Tiền phòng cả tháng', 'c8cafb83-5f92-5272-b794-eb303f988238', null),
('2e776ade-782a-5391-9818-600f00cfc403', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'c8cafb83-5f92-5272-b794-eb303f988238', null),
('d828a9bf-8ce8-5597-8152-4c8933f6a321', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', 'c8cafb83-5f92-5272-b794-eb303f988238', null),
('a95ddfa9-8a00-5b9a-b5f5-523657e3e0d2', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'c8cafb83-5f92-5272-b794-eb303f988238', null),
('4d5d2cc3-3ec9-5d3b-a3f5-25dba8cc2304', 'TIEN_PHONG', 3000000, 'Tiền phòng cả tháng', '58cc9f42-b2a6-56db-8e17-a70c17c16fa5', null),
('edce39b5-5b21-5ba5-a004-ae54a6f9fd1e', 'TIEN_DIEN', 308000, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '58cc9f42-b2a6-56db-8e17-a70c17c16fa5', null),
('0d282bbc-f1a4-5a44-9f40-ca3ddd90c153', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '58cc9f42-b2a6-56db-8e17-a70c17c16fa5', null),
('81c40fbc-1e8d-5b5b-859a-056bf3f6141e', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '58cc9f42-b2a6-56db-8e17-a70c17c16fa5', null),
('6ffe97f4-acec-512c-b7f9-ed64500865ea', 'TIEN_PHONG', 3050000, 'Tiền phòng cả tháng', '1aae3243-1058-575c-b4ce-d73520f1b311', null),
('06453996-4c25-5a04-bf6a-9224bec5fb28', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '1aae3243-1058-575c-b4ce-d73520f1b311', null),
('fa45b819-e0cd-548f-a3ed-b81504cc999c', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '1aae3243-1058-575c-b4ce-d73520f1b311', null),
('1e21322d-9251-5b4b-b9db-a36283f81734', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '1aae3243-1058-575c-b4ce-d73520f1b311', null),
('96376a08-a7c5-548b-8098-4d47713f9d0c', 'TIEN_PHONG', 3050000, 'Tiền phòng cả tháng', '12e042e6-0921-5bbf-962e-fa9deb419a41', null),
('adb38e40-5ad0-5485-aacd-9331d7e41b30', 'TIEN_DIEN', 332500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '12e042e6-0921-5bbf-962e-fa9deb419a41', null),
('9dba9a51-a4ee-5311-b298-bff2faa8df31', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '12e042e6-0921-5bbf-962e-fa9deb419a41', null),
('8c9942f6-4691-5e59-8151-c22f71e44de1', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '12e042e6-0921-5bbf-962e-fa9deb419a41', null),
('93efb6e8-0a4d-5d4b-af27-cce4a12355ca', 'TIEN_PHONG', 3100000, 'Tiền phòng cả tháng', '7513bed7-7402-50ff-8678-0ea827000267', null),
('279a2473-6e0d-5258-85c3-d76c00a033a4', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '7513bed7-7402-50ff-8678-0ea827000267', null),
('5f6ae27e-8b30-525e-acc5-a0a3f3015cad', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '7513bed7-7402-50ff-8678-0ea827000267', null),
('d78156ee-05bd-532c-ab9b-f321a8086ea8', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '7513bed7-7402-50ff-8678-0ea827000267', null),
('514faafa-2176-53b2-8a67-9f8d3c00db63', 'TIEN_PHONG', 3100000, 'Tiền phòng cả tháng', 'c828c26b-88ce-560e-83fb-26a207d510e4', null),
('3be7db2c-0d8a-55e1-8c1e-1aa05423b57b', 'TIEN_DIEN', 357000, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', 'c828c26b-88ce-560e-83fb-26a207d510e4', null),
('04b4d488-720e-58cf-8b9f-f35c3df26c0d', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', 'c828c26b-88ce-560e-83fb-26a207d510e4', null),
('80461b7c-346c-5669-a75e-139898196f04', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'c828c26b-88ce-560e-83fb-26a207d510e4', null),
('dbde7ad2-5937-594b-8750-75d849962833', 'TIEN_PHONG', 3150000, 'Tiền phòng cả tháng', '9c138298-93e3-5a0d-a256-1852a518e18e', null),
('58d4379e-a2c3-5079-bc7d-96e9baf334d0', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '9c138298-93e3-5a0d-a256-1852a518e18e', null),
('73558cf3-a05b-5771-8286-61114459d016', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '9c138298-93e3-5a0d-a256-1852a518e18e', null),
('f5f79b68-d259-5bc9-bcf1-1975c7c49491', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '9c138298-93e3-5a0d-a256-1852a518e18e', null),
('a4b8ef1d-7cb0-5aa8-8970-0ec005a3f4b5', 'TIEN_PHONG', 3150000, 'Tiền phòng cả tháng', '1b62c27e-9ee7-52cf-96b5-84bc8e416de0', null),
('2e063d7d-dbfc-51e3-bd06-3229cf2d533f', 'TIEN_DIEN', 234500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '1b62c27e-9ee7-52cf-96b5-84bc8e416de0', null),
('c9dae7ae-5c1a-5dcd-825c-9305eb07a489', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '1b62c27e-9ee7-52cf-96b5-84bc8e416de0', null),
('25e1bac0-0fb0-53f0-bd21-1a3311e02f70', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '1b62c27e-9ee7-52cf-96b5-84bc8e416de0', null),
('fcb5c701-3065-5a85-9d63-704aa714a335', 'TIEN_PHONG', 3200000, 'Tiền phòng cả tháng', 'ddda3768-af5a-566a-b4f1-ab76fc0f484e', null),
('c936978a-762f-5be6-9902-93af398c1fdc', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'ddda3768-af5a-566a-b4f1-ab76fc0f484e', null),
('f8bfb90f-6bf8-568c-a5a3-c6906ac6a3d1', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'ddda3768-af5a-566a-b4f1-ab76fc0f484e', null),
('7eeae4da-4164-5d51-a172-96d9c206d25f', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'ddda3768-af5a-566a-b4f1-ab76fc0f484e', null),
('8a19a142-cad1-53ef-a3c2-79189e3936a6', 'TIEN_PHONG', 3200000, 'Tiền phòng cả tháng', '8303a73f-0de2-520a-b100-f9d74e245aea', null),
('faf1bdd9-d0c2-5696-8499-65911009784a', 'TIEN_DIEN', 259000, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '8303a73f-0de2-520a-b100-f9d74e245aea', null),
('48c6f1f6-ccdb-5387-a8e9-c85baa30af96', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '8303a73f-0de2-520a-b100-f9d74e245aea', null),
('deb735da-4829-56dc-b302-99fc686c1e6e', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '8303a73f-0de2-520a-b100-f9d74e245aea', null),
('4b232934-6094-598b-9742-84c66da1750f', 'TIEN_PHONG', 3250000, 'Tiền phòng cả tháng', 'e0a74d5f-fae3-5c90-9fef-1c782a3b7cc4', null),
('8195c6e1-c4b8-5439-b7f5-33d8ac4b0a5f', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'e0a74d5f-fae3-5c90-9fef-1c782a3b7cc4', null),
('e2dad049-0736-5759-aa1d-795324ed5fdd', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'e0a74d5f-fae3-5c90-9fef-1c782a3b7cc4', null),
('a938f3c3-d595-54b6-96d6-d41da7864e1d', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'e0a74d5f-fae3-5c90-9fef-1c782a3b7cc4', null),
('448eb637-13f0-5752-8755-4fee5f9b7e5e', 'TIEN_PHONG', 3250000, 'Tiền phòng cả tháng', '72182f55-f51f-5baa-a95d-e12cfbe818f7', null),
('cc85499f-c5ea-5df7-a983-969c7827c651', 'TIEN_DIEN', 283500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '72182f55-f51f-5baa-a95d-e12cfbe818f7', null),
('080c3e5c-aabb-55ad-abf1-7fa341c98d22', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '72182f55-f51f-5baa-a95d-e12cfbe818f7', null),
('7dbdd179-aa23-579b-9622-5b310a8e459b', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '72182f55-f51f-5baa-a95d-e12cfbe818f7', null),
('945bb88f-5bea-560c-871f-3b9a8edce2ae', 'TIEN_PHONG', 3300000, 'Tiền phòng cả tháng', 'd9f502c0-f0f9-52af-9b6a-fc514aa47609', null),
('06671463-671d-5667-ab7f-f45c7c05b1ca', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'd9f502c0-f0f9-52af-9b6a-fc514aa47609', null),
('fce78474-6a21-55b5-b72b-9490ba204913', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'd9f502c0-f0f9-52af-9b6a-fc514aa47609', null),
('828c0caf-6a20-573e-9a8f-b1da5dc5a286', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'd9f502c0-f0f9-52af-9b6a-fc514aa47609', null),
('230992e8-085b-5094-a5ed-16bea526827c', 'TIEN_PHONG', 3300000, 'Tiền phòng cả tháng', 'b1520500-fca9-5499-b6ff-c878e7f55ee9', null),
('5b721949-7491-5075-bb7f-fc1426f60a63', 'TIEN_DIEN', 308000, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', 'b1520500-fca9-5499-b6ff-c878e7f55ee9', null),
('29a2f25d-e194-583c-8fea-34e285858e2e', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'b1520500-fca9-5499-b6ff-c878e7f55ee9', null),
('5205f00e-25a2-524e-b73e-2398953250ef', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'b1520500-fca9-5499-b6ff-c878e7f55ee9', null),
('dcfdeecb-656d-5f75-bf7f-44a4bc8f89f5', 'TIEN_PHONG', 3350000, 'Tiền phòng cả tháng', '5275ccd3-8449-5252-98f0-dfb5b0d6329b', null),
('d3fd1ad7-5bd7-5da1-8114-14113e186b0e', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '5275ccd3-8449-5252-98f0-dfb5b0d6329b', null),
('357cbd67-51f8-5dd9-bd1a-d1970de81e02', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '5275ccd3-8449-5252-98f0-dfb5b0d6329b', null),
('261dfec9-ea08-5324-adf4-a913fea0bdbd', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '5275ccd3-8449-5252-98f0-dfb5b0d6329b', null),
('b64e364c-3e76-5e1e-8359-b4f68bc51a7e', 'TIEN_PHONG', 3350000, 'Tiền phòng cả tháng', '64416fca-e2e7-5946-8928-1361e91aa931', null),
('7185efcd-368a-5b84-b3ae-acf2eb4a31fe', 'TIEN_DIEN', 332500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '64416fca-e2e7-5946-8928-1361e91aa931', null),
('61372482-ea5a-5f86-b28c-e3a7c654c951', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '64416fca-e2e7-5946-8928-1361e91aa931', null),
('3d2e62fe-f7d4-5ce0-a18f-12623a93681c', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '64416fca-e2e7-5946-8928-1361e91aa931', null),
('48bce621-8463-5564-897e-0fee6b5c8756', 'TIEN_PHONG', 3450000, 'Tiền phòng cả tháng', 'a0dc8420-c3fe-5491-8006-3626b12895a2', null),
('192ee878-af72-59a5-b172-6cbb52ebd7d2', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'a0dc8420-c3fe-5491-8006-3626b12895a2', null),
('8c171599-c0fe-567c-bf86-4c82b769144f', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'a0dc8420-c3fe-5491-8006-3626b12895a2', null),
('af015e26-990a-5537-8c1a-edd5f651483a', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'a0dc8420-c3fe-5491-8006-3626b12895a2', null),
('48973631-256b-53cf-ad7a-07215d122492', 'TIEN_PHONG', 3450000, 'Tiền phòng cả tháng', 'e68e6c8f-5c72-5c56-8874-69fdde7540cd', null),
('c56bd501-6acf-5faf-b4c4-93d554793010', 'TIEN_DIEN', 234500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', 'e68e6c8f-5c72-5c56-8874-69fdde7540cd', null),
('975ae6ec-cb15-50b6-9d2e-92071c68d274', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'e68e6c8f-5c72-5c56-8874-69fdde7540cd', null),
('3dc6e2be-2174-550f-bab5-127bfdb26fb4', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'e68e6c8f-5c72-5c56-8874-69fdde7540cd', null),
('5ade343b-11cb-5b25-851c-7a6765007df9', 'TIEN_PHONG', 3500000, 'Tiền phòng cả tháng', '4474e697-84dd-5251-af3b-360f4ad753af', null),
('c8f3dcc9-d076-5b57-b2ae-6e057954faa3', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '4474e697-84dd-5251-af3b-360f4ad753af', null),
('2b412153-bbaa-5a8c-8bf3-d2f9b7ec5ad3', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '4474e697-84dd-5251-af3b-360f4ad753af', null),
('cf921c09-012e-551d-a353-a39057fe4617', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '4474e697-84dd-5251-af3b-360f4ad753af', null),
('d7b07174-fe85-590b-8f96-5e27661e4788', 'TIEN_PHONG', 3500000, 'Tiền phòng cả tháng', '6fd41a7a-3c1c-5d15-add4-a874ea1d290d', null),
('3ce742f3-b0c7-56e2-8dd1-5e8fc57399b4', 'TIEN_DIEN', 259000, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', '6fd41a7a-3c1c-5d15-add4-a874ea1d290d', null),
('beae38ba-9976-544a-a2c5-657301a2cbd4', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '6fd41a7a-3c1c-5d15-add4-a874ea1d290d', null),
('fbd30dad-5ecf-5995-87f9-85d2bca05193', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '6fd41a7a-3c1c-5d15-add4-a874ea1d290d', null),
('347e1237-5edf-511f-8b13-75c8e95bdc64', 'TIEN_PHONG', 3550000, 'Tiền phòng cả tháng', '07eb1c17-5567-5e32-ab8d-0933be7a61c0', null),
('138050c1-6f23-59c2-8122-4265a3f4c1fe', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '07eb1c17-5567-5e32-ab8d-0933be7a61c0', null),
('b2830504-c960-5253-8580-6757cef7f186', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '07eb1c17-5567-5e32-ab8d-0933be7a61c0', null),
('61eb9bc0-b60b-5b21-a931-50bcdc74af45', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '07eb1c17-5567-5e32-ab8d-0933be7a61c0', null),
('60e7f920-bce3-53c6-9705-0c9abfb8a39a', 'TIEN_PHONG', 3550000, 'Tiền phòng cả tháng', 'ad36f735-4fa6-5c6f-9d32-e4e22f6a726b', null),
('f8f693c8-2fb7-5b48-a517-1ae7f190e2b6', 'TIEN_DIEN', 283500, 'Điện tháng 9: số đã xác nhận tháng 9 trừ tháng 8, 3500 VND/kWh', 'ad36f735-4fa6-5c6f-9d32-e4e22f6a726b', null),
('6a0902c4-1d7a-59dd-ab23-7eb0b258a715', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', 'ad36f735-4fa6-5c6f-9d32-e4e22f6a726b', null),
('091be6fa-e1ce-598d-8760-5f304eae3812', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'ad36f735-4fa6-5c6f-9d32-e4e22f6a726b', null),
('92aa723b-934b-550f-8468-90d48d32dffe', 'TIEN_PHONG', 3600000, 'Tiền phòng cả tháng', '15120081-c37c-5f98-9084-f08c025ea103', null),
('595f83f9-e790-5d4e-8418-dca262265bc1', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '15120081-c37c-5f98-9084-f08c025ea103', null),
('f65ed2ac-0443-5190-85c4-0ac0a17c8b27', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '15120081-c37c-5f98-9084-f08c025ea103', null),
('c12758ab-d350-577f-8b17-e0971dfb3a32', 'TIEN_PHONG', 2590323, 'Tiền phòng 10–31/10, 22 ngày / 31 ngày', '0b7abbef-6617-5787-bd9a-93a78cb599a5', null),
('6aad2054-6289-5123-a48a-0987eda0136d', 'TIEN_NUOC', 100000, 'Nước khoán 100000 VND/người/kỳ', '0b7abbef-6617-5787-bd9a-93a78cb599a5', null),
('0de1525d-24ac-5516-9113-0891b56453ff', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '0b7abbef-6617-5787-bd9a-93a78cb599a5', null),
('ebf1267a-d01e-5de9-8fb4-8a3d05631216', 'TIEN_PHONG', 3150000, 'Tiền phòng cả tháng', '2a1f4a2b-6bc8-50b7-9dbe-8d57a90d8aa7', null),
('8e397cf7-d4ba-529b-b5d4-8c56f8f66292', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', '2a1f4a2b-6bc8-50b7-9dbe-8d57a90d8aa7', null),
('158b99fc-d579-5780-afa1-c8d4d23de170', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', '2a1f4a2b-6bc8-50b7-9dbe-8d57a90d8aa7', null),
('0007aae3-1152-5947-99e2-10067b966b84', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', '2a1f4a2b-6bc8-50b7-9dbe-8d57a90d8aa7', null),
('6b121e9a-c6af-5d2c-ab11-2e587e4b4f00', 'TIEN_PHONG', 3400000, 'Tiền phòng cả tháng', 'c586bc81-418d-5590-b741-bd5a0e721517', null),
('65e2642f-0145-58ed-bdc9-6dba504e9a48', 'TIEN_DIEN', 262500, 'Kỳ 9: snapshot điện tháng 8, 75 kWh', 'c586bc81-418d-5590-b741-bd5a0e721517', null),
('190cd3c5-8191-52b8-9c4c-4ecfa463e5f3', 'TIEN_NUOC', 200000, 'Nước khoán 100000 VND/người/kỳ', 'c586bc81-418d-5590-b741-bd5a0e721517', null),
('b1386f81-750b-5270-8b0b-a9afeb2b0858', 'PHI_DICH_VU', 100000, 'Internet và vệ sinh chung', 'c586bc81-418d-5590-b741-bd5a0e721517', null);

-- KhoanChi: 11 bản ghi
insert into `KhoanChi` (`maKhoanChi`, `loaiKhoanChi`, `soTien`, `ngayPhatSinh`, `phamVi`, `ghiChu`, `maCan`, `maSuCo`) values
('a39c3c07-359e-5eb5-a896-2e2c0160587e', 'SUA_CHUA', 180000, '2026-10-04', 'CAN_TRO', 'Chủ trọ chịu phí', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646', 'da6a760f-965a-54c9-a283-3038da36f6ed'),
('289a2c98-feee-505e-a75e-c8aae690ba0a', 'DIEN_CHUNG', 300000, '2026-10-02', 'CAN_TRO', 'Chi phí vận hành giả lập', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646', null),
('e55d5b85-ad3e-576c-be69-5f8adee2d8a5', 'VE_SINH', 400000, '2026-10-03', 'CAN_TRO', 'Chi phí vận hành giả lập', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646', null),
('b9522d15-ce9b-54ed-ac4f-fa22523df80a', 'BAO_TRI', 500000, '2026-10-04', 'CAN_TRO', 'Chi phí vận hành giả lập', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646', null),
('9da09f97-c2d2-51f1-a01c-a71f69a3e9b2', 'DIEN_CHUNG', 300000, '2026-10-02', 'CAN_TRO', 'Chi phí vận hành giả lập', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9', null),
('18c69bbb-21fd-5372-97ff-059dde7451e5', 'VE_SINH', 400000, '2026-10-03', 'CAN_TRO', 'Chi phí vận hành giả lập', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9', null),
('ff842895-6cf1-5af2-91c4-b5dcfdc450de', 'BAO_TRI', 500000, '2026-10-04', 'CAN_TRO', 'Chi phí vận hành giả lập', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9', null),
('ccc91ee1-506c-59cd-a4cd-0ba017813394', 'DIEN_CHUNG', 300000, '2026-10-02', 'CAN_TRO', 'Chi phí vận hành giả lập', 'f497891e-cb02-590b-bd80-de874320290f', null),
('75c1f0c4-9d36-56c5-b5a8-8b4d8b35f276', 'VE_SINH', 400000, '2026-10-03', 'CAN_TRO', 'Chi phí vận hành giả lập', 'f497891e-cb02-590b-bd80-de874320290f', null),
('c8446de1-6a76-5548-b86b-4e494d12a0b1', 'BAO_TRI', 500000, '2026-10-04', 'CAN_TRO', 'Chi phí vận hành giả lập', 'f497891e-cb02-590b-bd80-de874320290f', null),
('1c990bd7-e84f-548a-8ff0-848368312fde', 'QUAN_LY', 600000, '2026-10-05', 'TOAN_CHUOI', 'Chi chung của chuỗi do chủ trọ duy nhất quản lý', null, null);

-- ThongBao: 25 bản ghi
insert into `ThongBao` (`maThongBao`, `loaiThongBao`, `noiDung`, `thoiDiemTao`, `daDoc`, `maSuCo`, `maTaiKhoan`) values
('00358bde-7ae7-5fa4-b745-9cdb32b46b5b', 'SU_CO_DA_XU_LY', 'Sự cố phòng 101 đã xử lý. Chi phí: 180000 VND.', '2026-10-04 15:00:00', true, 'da6a760f-965a-54c9-a283-3038da36f6ed', '492d371e-f8c5-53b7-8615-ffdb678575ab'),
('8e3f4b8e-097e-5a87-bb0a-1dd918cffe8e', 'SU_CO_DA_XU_LY', 'Sự cố phòng 102 đã xử lý. Chi phí: 250000 VND.', '2026-10-04 15:00:00', false, '8f80721c-f9ff-5a97-baf9-b88a98cc60be', 'c0257961-a1f1-5d31-a4b1-0b85155a48d1'),
('58e51dfd-35dd-5aa2-876b-90e4eb654c46', 'SU_CO_DA_XU_LY', 'Sự cố phòng 201 đã xử lý. Chi phí: 0 VND.', '2026-10-04 15:00:00', false, '7cc54d98-82ff-52c4-9c07-691366902efc', 'df69c727-c0e2-5300-8b5e-fb8d21eaf2cb'),
('158e0f07-2cd8-58a9-b6d8-08cc9791f246', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3484500 VND, còn nợ 1742250 VND.', '2026-10-12 09:00:00', false, null, '492d371e-f8c5-53b7-8615-ffdb678575ab'),
('0a47f4ed-f9bb-52ba-b812-4a3af722107b', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3809000 VND, còn nợ 3809000 VND.', '2026-10-12 09:00:00', true, null, 'c0257961-a1f1-5d31-a4b1-0b85155a48d1'),
('61d9d9b1-a37f-5372-b72f-6ff24b610963', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3633500 VND, còn nợ 0 VND.', '2026-10-12 09:00:00', false, null, '903fd6e2-0a6f-5370-a49a-841492537834'),
('54253dfa-b724-58ba-bde7-0628b2f33975', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3608000 VND, còn nợ 1804000 VND.', '2026-10-12 09:00:00', true, null, '39c3c547-4ab1-5838-bfc9-2d4a19938e51'),
('8910b68c-1ce6-5256-b0f5-f0646eebf09e', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3682500 VND, còn nợ 3682500 VND.', '2026-10-12 09:00:00', false, null, '4ca777c9-ae13-5b12-b28b-ed10e15c0be2'),
('acfa8081-9663-5c21-a2e6-fca60fa9a61b', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3757000 VND, còn nợ 0 VND.', '2026-10-12 09:00:00', true, null, '392586b8-d887-5c87-b0fb-72401eadb43a'),
('a64a8e74-2434-58c8-b614-de0e648bc8db', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3684500 VND, còn nợ 1842250 VND.', '2026-10-12 09:00:00', false, null, 'df69c727-c0e2-5300-8b5e-fb8d21eaf2cb'),
('bf00db4e-5fe3-572b-94d0-028423cb8f05', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3659000 VND, còn nợ 3659000 VND.', '2026-10-12 09:00:00', true, null, 'e64073fe-9441-57a8-8752-d5944f870c3b'),
('6027f8af-2cb4-5ec1-bdab-436bd14f20c6', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3733500 VND, còn nợ 0 VND.', '2026-10-12 09:00:00', false, null, 'ca135837-b698-5ddf-81b4-66e8fffc7a8a'),
('fd1fd0c0-567d-5d86-9a1a-3f22756fef92', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3808000 VND, còn nợ 1904000 VND.', '2026-10-12 09:00:00', true, null, '1d9db92c-9bda-5683-9fec-d03c7a8fe9f0'),
('f1d72712-8be7-5602-b7be-afbe5e356c37', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3882500 VND, còn nợ 3882500 VND.', '2026-10-12 09:00:00', false, null, 'c651a2e0-88a7-578f-94ed-169d4cb2a965'),
('15544ba5-928f-5ab2-a1bf-cc9b23d04cdd', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3884500 VND, còn nợ 0 VND.', '2026-10-12 09:00:00', true, null, '99eb64a6-e245-5496-8be2-9f91deab711a'),
('a01482d4-7779-5dab-b208-2bd848b11c6c', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3959000 VND, còn nợ 1979500 VND.', '2026-10-12 09:00:00', false, null, 'a7b851b0-1d1d-5604-b4d3-817723535c32'),
('49e412fd-736c-5cbd-ba02-1ee86c940387', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 4033500 VND, còn nợ 4033500 VND.', '2026-10-12 09:00:00', true, null, '9041fc0e-5deb-5649-a261-9a47f8c6df60'),
('daf2ea3d-5fbe-59c9-b1a5-ceae19c4a81e', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 3800000 VND, còn nợ 0 VND.', '2026-10-12 09:00:00', false, null, 'c7f7effe-0fc9-572b-89f7-db54047361e1'),
('1c200e93-7861-5d3f-88db-aca5b0269bf3', 'THANH_TOAN_KY', 'Kỳ 10/2026: phải trả 2790323 VND, còn nợ 1395162 VND.', '2026-10-12 09:00:00', true, null, '57fba900-76fd-5347-add0-3a4bf77c9fb4'),
('0b7c40c9-8f91-52e2-b91b-27ba90257028', 'KET_QUA_YEU_CAU', 'Yêu cầu GIA_HAN: DA_PHE_DUYET.', '2026-10-05 15:00:00', true, null, 'c0257961-a1f1-5d31-a4b1-0b85155a48d1'),
('ab82e102-0ff1-5cb0-b947-3d9d04156f8d', 'KET_QUA_YEU_CAU', 'Yêu cầu GIA_HAN: TU_CHOI.', '2026-10-06 15:00:00', false, null, '903fd6e2-0a6f-5370-a49a-841492537834'),
('28b41f11-6f5e-5307-b6dd-a298a3fe91ac', 'KET_QUA_YEU_CAU', 'Yêu cầu TRA_PHONG: DA_PHE_DUYET.', '2026-10-07 15:00:00', true, null, '39c3c547-4ab1-5838-bfc9-2d4a19938e51'),
('417c76a3-10b0-5fe1-a7dc-8df09794b1f3', 'KET_QUA_YEU_CAU', 'Yêu cầu DE_XUAT_BAN_CUNG_PHONG: TU_CHOI.', '2026-10-08 15:00:00', false, null, 'ca135837-b698-5ddf-81b4-66e8fffc7a8a'),
('50923b5b-df5b-525a-ac0b-6d256676f3ec', 'KET_QUA_YEU_CAU', 'Yêu cầu TRA_PHONG: DA_PHE_DUYET.', '2026-09-01 15:00:00', false, null, '948a41e0-8356-5d89-9d6f-f10fb61d80e0'),
('7e5ba5bc-2318-5c45-aa0c-8619a4873a44', 'KET_QUA_YEU_CAU', 'Yêu cầu TRA_PHONG: DA_PHE_DUYET.', '2026-09-02 15:00:00', true, null, '57d6f1e4-7637-5101-8929-ceddf71db988');

-- SuCoTaiSan: 6 bản ghi
insert into `SuCoTaiSan` (`maSuCo`, `maTaiSan`) values
('da6a760f-965a-54c9-a283-3038da36f6ed', 'a4d96536-d579-5388-b51f-e287fcdd3ab5'),
('8f80721c-f9ff-5a97-baf9-b88a98cc60be', '05876cab-3a18-55b8-bbb9-cd3317cbecac'),
('fc09a14a-d911-5e19-a6b5-00e73462e37d', 'b52752a0-6d08-5c20-9a0f-9ea0159c668e'),
('57ca4c8d-d6e7-52b2-ad7c-9e42ecc4714c', '42b6b14f-dfca-5bd6-a6c4-3bcdb795130c'),
('3ced92a1-0953-58dc-8c6b-cc20aa44ac98', '4ad98ffd-d939-5f28-9338-0830c5213b8e'),
('7cc54d98-82ff-52c4-9c07-691366902efc', '6ca5dff6-4289-59b7-876a-1cc70199a156');

-- BienBanTraPhong: 2 bản ghi
insert into `BienBanTraPhong` (`maBienBan`, `ngayKiemTra`, `tinhTrangPhong`, `ghiChu`, `tongKhoanKhauTru`, `soTienCocDuocHoan`, `maHopDong`, `maYeuCauTraPhong`, `nguoiLapId`) values
('c3f1f9ab-95a6-54aa-8d10-bdf81e1a2900', '2026-09-30', 'Đã kiểm tra và hoàn tất bàn giao', 'Không còn nợ kỳ 9; tiền cọc còn lại đã hoàn thực tế', 300000, 2850000, '92256090-e741-5003-8cb0-ee1336a340fc', 'f828fb7e-4cbb-56ac-9262-677c4731c59e', '910fb605-b871-5141-8d96-1f8577508ac2'),
('f9b290ed-2ab1-5837-8054-bec5ac8c4893', '2026-09-30', 'Đã kiểm tra và hoàn tất bàn giao', 'Không còn nợ kỳ 9; tiền cọc còn lại đã hoàn thực tế', 150000, 3250000, '7814acca-085e-50ab-ac90-479792d8b10a', 'f4d7db3b-8006-5782-9192-0a162d55911f', '910fb605-b871-5141-8d96-1f8577508ac2');

-- KhoanThu: 33 bản ghi
insert into `KhoanThu` (`maKhoanThu`, `loaiKhoanThu`, `soTien`, `ngayGhiNhan`, `ghiChu`, `trangThaiGhiNhan`, `lyDoHuy`, `ngayHuy`, `maGiaoDichThanhToan`, `maCan`) values
('719e3863-98ae-5105-84fd-060bece2debd', 'THANH_TOAN_KY', 3512500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'a29afff2-134f-566a-ba66-c8332bdbe824', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('56b9175b-8349-57dc-b157-ccd560c1608a', 'THANH_TOAN_KY', 1742250, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'e62504cb-4ace-5ae9-978f-9549ddb82b7d', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('22c5a850-abc0-581a-a895-3acce0c2187f', 'THANH_TOAN_KY', 3562500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'ba0ed54e-48f7-58b1-99e8-a65d77db6fee', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('16aa3982-3a0c-5b32-960a-8e107c5d521d', 'THANH_TOAN_KY', 3612500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'a9795243-1df2-500c-acaf-71ffe6e3ea02', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('41273a09-a3c9-563f-81c6-fc01623ec4a4', 'THANH_TOAN_KY', 3633500, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'eece46bf-a7d9-5c69-abbd-b9653cac35e5', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('68762f6b-7cb1-552a-84c3-aaf3b2659457', 'THANH_TOAN_KY', 1781250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'e2a55218-58bf-5cb6-8b66-2c7751d71a6d', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('82e32ea9-bdc8-5323-9e07-b0897feccfd6', 'THANH_TOAN_KY', 1781250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'e75ebfb7-0ca2-5bb0-a313-47ad27d00cfe', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('47bb0364-d0be-520e-8502-8050e6c3c9a1', 'THANH_TOAN_KY', 902000, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '566140e8-3b35-597a-80a8-b37c1fa88ddd', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('837aa162-ff07-55bb-b893-a922e1fa39fd', 'THANH_TOAN_KY', 902000, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '5efc7ca7-bf3a-5524-8cf2-c7406ffb1e33', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('6d933ce9-094f-54dc-b699-83b882a76d16', 'THANH_TOAN_KY', 3662500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '8311687e-f4ee-5c7d-a4b3-a387c2f19619', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('b248d1cc-e6c3-5d4e-ac6b-e6e00f819850', 'THANH_TOAN_KY', 3757000, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '0a21a6b9-6edf-5e7e-84e3-1abe17597ee4', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('862aaf8b-e249-5963-aa04-e734cefae45d', 'THANH_TOAN_KY', 3712500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '0afa433f-b73d-51ef-a0d6-23b498258515', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('df456938-5f82-5cf8-80ab-698d48735660', 'THANH_TOAN_KY', 1842250, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '06369e92-38bb-58c9-94f9-95c7b454f542', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('fd1c22a9-9e1f-5be0-ba56-5957ad73efe6', 'THANH_TOAN_KY', 1831250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'ece6e8b3-036b-5de0-8b26-d0401588e6da', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('2c10aaa2-b695-5a78-bbcf-8a608c47616a', 'THANH_TOAN_KY', 1831250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'a57d8cd9-113b-5e67-9e82-87c7fd28d5b7', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('76ab96c5-51d0-5bb6-a3bc-868181e47eee', 'THANH_TOAN_KY', 3712500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '1c3fde53-f032-5d3c-8d40-4336c54c3987', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('ff678963-3e2a-57a6-a9a9-ee36f6c263d4', 'THANH_TOAN_KY', 3733500, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '353c3bca-e614-57b3-8d2a-8c7f5df6e8d8', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('38979362-00a9-5235-99f7-b66ab7e31051', 'THANH_TOAN_KY', 1881250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '4e20179d-0781-53c6-a605-aa97a60390e4', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('e535833c-14ec-569d-abce-8adb20702719', 'THANH_TOAN_KY', 1904000, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'bda30088-ce18-5ad6-b3fc-e066ed923395', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('cd3dc26e-4e1a-5950-b39b-0a3e20950128', 'THANH_TOAN_KY', 3812500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'b6831d72-d77c-5b7e-854f-605c6e759fa9', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('df36d5bf-624f-57a5-8b30-27c064a99d1d', 'THANH_TOAN_KY', 1956250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'a77466e1-2dc2-53a9-9473-ed414a6fdd90', 'f497891e-cb02-590b-bd80-de874320290f'),
('184798a2-608d-51ba-b197-3e4c27ae79e9', 'THANH_TOAN_KY', 1956250, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '02c3fedf-deb8-517b-b49a-880721baa5cc', 'f497891e-cb02-590b-bd80-de874320290f'),
('fbdd8bbd-ea82-57f1-a433-464fccc7e79f', 'THANH_TOAN_KY', 1942250, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '52a3036f-9511-5590-8433-c86a283a4119', 'f497891e-cb02-590b-bd80-de874320290f'),
('715bf863-356b-5df6-ac81-b1c39007b902', 'THANH_TOAN_KY', 1942250, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'bbd30f3c-72a2-52c6-a4fc-d17534c47340', 'f497891e-cb02-590b-bd80-de874320290f'),
('7ae83efe-3f79-5871-a4c3-1b4b13751b93', 'THANH_TOAN_KY', 3962500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'e473deb0-13ee-5980-99e7-7c40873a7d4b', 'f497891e-cb02-590b-bd80-de874320290f'),
('6975a6ce-f07a-5139-9092-99931bd8f230', 'THANH_TOAN_KY', 1979500, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '2f272e0f-1c00-5789-bba8-4d3c93782aa4', 'f497891e-cb02-590b-bd80-de874320290f'),
('81d04c40-eabe-5fa3-996a-17d600661e7a', 'THANH_TOAN_KY', 4012500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '2c3d1fff-176a-5260-abd0-288b1b7ab737', 'f497891e-cb02-590b-bd80-de874320290f'),
('1f4f9dd0-6a75-5a88-a5e9-1263f4169eed', 'THANH_TOAN_KY', 3800000, '2026-10-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'c81b878b-c862-5359-b569-675b5ff76510', 'f497891e-cb02-590b-bd80-de874320290f'),
('eb748e19-3b7a-5688-89e0-7310eae02d2f', 'THANH_TOAN_KY', 697580, '2026-10-11', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '5f078b79-7d10-530c-97d6-10874027823d', 'f497891e-cb02-590b-bd80-de874320290f'),
('6f50c9c6-fd6f-558a-a21b-932726871f64', 'THANH_TOAN_KY', 697581, '2026-10-11', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'b2d32a71-e6bb-5b4a-a911-5a8a675cb554', 'f497891e-cb02-590b-bd80-de874320290f'),
('ad57f0a4-17ed-5cf9-a421-5eea0b06b0b9', 'THANH_TOAN_KY', 3712500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, '5593c162-2b4e-5b8b-bd61-735a0ab8439c', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646'),
('5c5b6c7a-6c29-51c3-91b8-8e95f7a72a56', 'THANH_TOAN_KY', 3962500, '2026-09-07', 'Thu từ giao dịch xác nhận', 'HIEU_LUC', null, null, 'bab3f801-bfca-5934-9850-59089cb7c016', 'c5c294c5-65c3-508e-ae56-3a4f28755fb9'),
('318a6f04-e492-5186-aacf-99cfff0c64c1', 'THANH_TOAN_KY', 100000, '2026-10-06', null, 'DA_HUY', 'Hủy theo giao dịch ghi nhầm', '2026-10-06 10:00:00', '2a1a9292-4f7b-501b-a5a8-92ee0584bb90', 'f8e9ba5c-1161-5b50-8b66-98dc672cc646');

-- KhoanKhauTru: 3 bản ghi
insert into `KhoanKhauTru` (`maKhauTru`, `loaiKhauTru`, `lyDo`, `soTien`, `ghiChu`, `maBienBanTraPhong`, `maTaiSan`, `maViPham`) values
('6de34698-e0fc-5b1f-9da6-31b88560b00b', 'VI_PHAM_HOP_DONG', 'Phạt vệ sinh khi bàn giao', 100000, null, 'c3f1f9ab-95a6-54aa-8d10-bdf81e1a2900', null, '6947cb0f-0ee9-5380-a347-bd6fdcd79b41'),
('3272fc36-9a56-5392-bc6c-deb85fc7fe00', 'HU_HONG_TAI_SAN', 'Tủ bị trầy xước khi bàn giao', 200000, null, 'c3f1f9ab-95a6-54aa-8d10-bdf81e1a2900', '6a5c990f-dcc3-527b-9b59-a7d4b4c60857', null),
('6b3e340a-20df-51cd-83fb-47eb7d173407', 'VI_PHAM_HOP_DONG', 'Phạt vệ sinh khi bàn giao', 150000, null, 'f9b290ed-2ab1-5837-8054-bec5ac8c4893', null, '0c8f878a-905b-53a0-a5e5-22020b88e830');

commit;

-- Chuẩn hóa khóa nghiệp vụ của dữ liệu chỉ số cũ rồi mới bật unique index.
update `ChiSoDien` set `khoaNghiepVu`=concat('DINH_KY:', `nam`, '-', lpad(`thang`, 2, '0')) where `loaiChiSo`='DINH_KY';
create unique index `uq_ChiSoDien_nghiepVu` on `ChiSoDien` (`maPhong`, `loaiChiSo`, `khoaNghiepVu`);
update `BienBanTraPhong` b left join `TienCoc` c on c.`maHopDong`=b.`maHopDong`
set b.`laDuLieuLegacy`=true, b.`tienCocBanDau`=c.`soTienCoc`;

-- 3. KIỂM TRA TỔNG QUAN
select 'TaiKhoan' as bang, count(*) as so_ban_ghi from `TaiKhoan`
union all
select 'ChuTro' as bang, count(*) as so_ban_ghi from `ChuTro`
union all
select 'KhachThue' as bang, count(*) as so_ban_ghi from `KhachThue`
union all
select 'CanTro' as bang, count(*) as so_ban_ghi from `CanTro`
union all
select 'PhongTro' as bang, count(*) as so_ban_ghi from `PhongTro`
union all
select 'TaiSan' as bang, count(*) as so_ban_ghi from `TaiSan`
union all
select 'HopDong' as bang, count(*) as so_ban_ghi from `HopDong`
union all
select 'TienCoc' as bang, count(*) as so_ban_ghi from `TienCoc`
union all
select 'ThanhVienPhong' as bang, count(*) as so_ban_ghi from `ThanhVienPhong`
union all
select 'ViPhamHopDong' as bang, count(*) as so_ban_ghi from `ViPhamHopDong`
union all
select 'ChiSoDien' as bang, count(*) as so_ban_ghi from `ChiSoDien`
union all
select 'YeuCau' as bang, count(*) as so_ban_ghi from `YeuCau`
union all
select 'ThanhToan' as bang, count(*) as so_ban_ghi from `ThanhToan`
union all
select 'SuCo' as bang, count(*) as so_ban_ghi from `SuCo`
union all
select 'YeuCauGiaHan' as bang, count(*) as so_ban_ghi from `YeuCauGiaHan`
union all
select 'YeuCauTraPhong' as bang, count(*) as so_ban_ghi from `YeuCauTraPhong`
union all
select 'DeXuatBanCungPhong' as bang, count(*) as so_ban_ghi from `DeXuatBanCungPhong`
union all
select 'GiaoDichThanhToan' as bang, count(*) as so_ban_ghi from `GiaoDichThanhToan`
union all
select 'ChiTietThanhToan' as bang, count(*) as so_ban_ghi from `ChiTietThanhToan`
union all
select 'KhoanChi' as bang, count(*) as so_ban_ghi from `KhoanChi`
union all
select 'ThongBao' as bang, count(*) as so_ban_ghi from `ThongBao`
union all
select 'SuCoTaiSan' as bang, count(*) as so_ban_ghi from `SuCoTaiSan`
union all
select 'BienBanTraPhong' as bang, count(*) as so_ban_ghi from `BienBanTraPhong`
union all
select 'KhoanThu' as bang, count(*) as so_ban_ghi from `KhoanThu`
union all
select 'KhoanKhauTru' as bang, count(*) as so_ban_ghi from `KhoanKhauTru`;

-- Mỗi căn phải có 10 phòng.
select c.tenCan, count(p.maPhong) as so_phong
from CanTro c left join PhongTro p on p.maCan = c.maCan
group by c.maCan, c.tenCan;

-- Trạng thái phòng và người cư trú hiện tại.
select trangThai, count(*) as so_phong from PhongTro group by trangThai;
select p.soPhong, c.tenCan, count(tv.maThanhVienPhong) as so_nguoi_dang_o
from PhongTro p join CanTro c on c.maCan = p.maCan
left join ThanhVienPhong tv on tv.maPhong = p.maPhong and tv.trangThaiCuTru = 'DANG_O'
group by p.maPhong, p.soPhong, c.tenCan order by c.tenCan, p.soPhong;

-- Tài khoản và danh sách khách mới chưa có hợp đồng.
select vaiTro, count(*) as so_tai_khoan from TaiKhoan group by vaiTro;
select k.hoTen, k.soDienThoai from KhachThue k
where not exists (select 1 from HopDong h where h.maKhachThue = k.maKhachThue);

-- Công nợ theo khách, kể cả hợp đồng đã thanh lý còn nợ.
select k.hoTen, sum(t.soTienConNo) as tong_con_no
from KhachThue k join HopDong h on h.maKhachThue = k.maKhachThue
join ThanhToan t on t.maHopDong = h.maHopDong
group by k.maKhachThue, k.hoTen having sum(t.soTienConNo) > 0;

-- Các truy vấn dưới đây phải trả về 0 dòng.
-- Tổng chi tiết phải bằng tổng phải trả.
select t.maThanhToan, t.tongPhaiTra, coalesce(sum(ct.soTien), 0) as tong_chi_tiet
from ThanhToan t left join ChiTietThanhToan ct on ct.maThanhToan = t.maThanhToan
group by t.maThanhToan, t.tongPhaiTra having t.tongPhaiTra <> coalesce(sum(ct.soTien), 0);

-- Tổng giao dịch xác nhận bằng tổng đã trả; chờ/từ chối/hủy không tính.
select t.maThanhToan, t.tongDaThanhToan,
coalesce(sum(case when gd.trangThaiXacNhan = 'DA_XAC_NHAN' then gd.soTien else 0 end), 0) as tong_xac_nhan
from ThanhToan t left join GiaoDichThanhToan gd on gd.maThanhToan = t.maThanhToan
group by t.maThanhToan, t.tongDaThanhToan
having t.tongDaThanhToan <> coalesce(sum(case when gd.trangThaiXacNhan = 'DA_XAC_NHAN' then gd.soTien else 0 end), 0);

-- Không vượt sức chứa và không sai phòng hợp đồng.
select p.maPhong from PhongTro p join ThanhVienPhong tv on tv.maPhong = p.maPhong
where tv.trangThaiCuTru = 'DANG_O'
group by p.maPhong, p.soNguoiToiDa having count(*) > p.soNguoiToiDa;
select tv.maThanhVienPhong from ThanhVienPhong tv join HopDong h on h.maHopDong = tv.maHopDong
where tv.maPhong <> h.maPhong;

-- Mỗi hợp đồng phải có hồ sơ cọc.
select h.maHopDong from HopDong h left join TienCoc c on c.maHopDong = h.maHopDong where c.maTienCoc is null;

-- Chỉ một lớp con yêu cầu, khớp mã loại.
select y.maYeuCau from YeuCau y
left join YeuCauGiaHan gh on gh.maYeuCau = y.maYeuCau
left join YeuCauTraPhong tp on tp.maYeuCau = y.maYeuCau
left join DeXuatBanCungPhong dx on dx.maYeuCau = y.maYeuCau
where ((gh.maYeuCau is not null) + (tp.maYeuCau is not null) + (dx.maYeuCau is not null)) <> 1
or (y.loaiYeuCau = 'GIA_HAN' and gh.maYeuCau is null)
or (y.loaiYeuCau = 'TRA_PHONG' and tp.maYeuCau is null)
or (y.loaiYeuCau = 'DE_XUAT_BAN_CUNG_PHONG' and dx.maYeuCau is null);

-- Không ghi cả hai nhánh phí sửa chữa; người chịu phí khớp nhánh.
select s.maSuCo from SuCo s
left join KhoanChi c on c.maSuCo = s.maSuCo
left join ChiTietThanhToan ct on ct.maSuCo = s.maSuCo
where (c.maKhoanChi is not null and ct.maChiTiet is not null)
or (s.doiTuongChiuPhi = 'CHU_TRO' and s.chiPhiSuaChua > 0 and (c.maKhoanChi is null or c.soTien <> s.chiPhiSuaChua))
or (s.doiTuongChiuPhi = 'KHACH_THUE' and s.chiPhiSuaChua > 0 and (ct.maChiTiet is null or ct.soTien <> s.chiPhiSuaChua));

-- Thu và giao dịch đồng bộ số tiền, trạng thái và căn.
select kt.maKhoanThu from KhoanThu kt
join GiaoDichThanhToan gd on gd.maGiaoDich = kt.maGiaoDichThanhToan
join ThanhToan tt on tt.maThanhToan = gd.maThanhToan
join HopDong hd on hd.maHopDong = tt.maHopDong
join PhongTro p on p.maPhong = hd.maPhong
where kt.soTien <> gd.soTien or kt.maCan <> p.maCan
or (kt.trangThaiGhiNhan = 'HIEU_LUC' and gd.trangThaiXacNhan <> 'DA_XAC_NHAN')
or (kt.trangThaiGhiNhan = 'DA_HUY' and gd.trangThaiXacNhan <> 'DA_HUY');

-- Biên bản và tổng khấu trừ khớp nhau.
select b.maBienBan from BienBanTraPhong b left join KhoanKhauTru k on k.maBienBanTraPhong = b.maBienBan
group by b.maBienBan, b.tongKhoanKhauTru having b.tongKhoanKhauTru <> coalesce(sum(k.soTien), 0);

-- Thống kê tài khoản demo; mật khẩu được lưu bằng bcrypt.
select tenDangNhap, vaiTro, trangThai, batBuocDoiMatKhau from TaiKhoan order by vaiTro, tenDangNhap;
