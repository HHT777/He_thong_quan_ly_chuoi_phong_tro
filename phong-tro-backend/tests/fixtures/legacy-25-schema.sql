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
constraint `ck_PhongTro_3` check (`trangThai` in ('TRONG', 'DANG_THUE', 'DANG_XU_LY_TRA_PHONG', 'NGUNG_SU_DUNG')),
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
primary key (`maChiSo`),
unique key `uq_ChiSoDien_ky1` (`maPhong`, `thang`, `nam`),
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
primary key (`maYeuCau`),
key `ix_YeuCau_1` (`maKhachThue`, `trangThai`, `loaiYeuCau`),
constraint `ck_YeuCau_1` check (`loaiYeuCau` in ('GIA_HAN', 'TRA_PHONG', 'DE_XUAT_BAN_CUNG_PHONG')),
constraint `ck_YeuCau_2` check (`trangThai` in ('CHO_XU_LY', 'DA_PHE_DUYET', 'TU_CHOI'))
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
primary key (`maThanhToan`),
unique key `uq_ThanhToan_ky1` (`maHopDong`, `thang`, `nam`),
key `ix_ThanhToan_1` (`trangThai`, `nam`, `thang`),
constraint `ck_ThanhToan_1` check (`thang` between 1 and 12),
constraint `ck_ThanhToan_2` check (`soTienConNo` >= 0),
constraint `ck_ThanhToan_3` check (`trangThai` in ('CHUA_THANH_TOAN', 'THANH_TOAN_MOT_PHAN', 'DA_THANH_TOAN')),
constraint `ck_ThanhToan_4` check (`nam` > 0),
constraint `ck_ThanhToan_5` check (`tongPhaiTra` >= 0),
constraint `ck_ThanhToan_6` check (`tongDaThanhToan` >= 0),
constraint `ck_ThanhToan_7` check (`tongDaThanhToan` <= `tongPhaiTra`),
constraint `ck_ThanhToan_8` check (`soTienConNo` = `tongPhaiTra` - `tongDaThanhToan`),
constraint `ck_ThanhToan_9` check ((`tongDaThanhToan` = `tongPhaiTra` and `trangThai` = 'DA_THANH_TOAN') or (`tongPhaiTra` > 0 and `tongDaThanhToan` = 0 and `trangThai` = 'CHUA_THANH_TOAN') or (`tongDaThanhToan` > 0 and `tongDaThanhToan` < `tongPhaiTra` and `trangThai` = 'THANH_TOAN_MOT_PHAN'))
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
primary key (`maYeuCau`)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `DeXuatBanCungPhong` (
`hoTenNguoiDeXuat` varchar(255) not null,
`soDienThoaiNguoiDeXuat` varchar(15) not null,
`noiDungBoSung` varchar(1000) null,
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
primary key (`maGiaoDich`),
key `ix_GiaoDichThanhToan_1` (`maThanhToan`, `trangThaiXacNhan`),
constraint `ck_GiaoDichThanhToan_1` check (`soTien` >= 0),
constraint `ck_GiaoDichThanhToan_2` check (`trangThaiXacNhan` in ('CHO_XAC_NHAN', 'DA_XAC_NHAN', 'TU_CHOI', 'DA_HUY')),
constraint `ck_GiaoDichThanhToan_3` check (`trangThaiXacNhan` not in ('DA_XAC_NHAN','DA_HUY') or (`soTien` is not null and `soTien` > 0 and `thoiDiemXacNhan` is not null)),
constraint `ck_GiaoDichThanhToan_4` check (`trangThaiXacNhan` <> 'DA_HUY' or (`lyDoHuy` is not null and `ngayHuy` is not null and `nguoiHuyId` is not null))
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
primary key (`maChiTiet`),
constraint `ck_ChiTietThanhToan_1` check (`soTien` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table `KhoanChi` (
`maKhoanChi` varchar(36) not null,
`loaiKhoanChi` varchar(50) not null,
`soTien` decimal(18,2) not null,
`ngayPhatSinh` date not null,
`phamVi` varchar(30) not null,
`ghiChu` varchar(1000) null,
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
primary key (`maThongBao`),
key `ix_ThongBao_1` (`maTaiKhoan`, `daDoc`, `thoiDiemTao`)
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
`maViPham` varchar(36) null,
constraint `fk_KhoanKhauTru_maViPham` foreign key (`maViPham`) references `ViPhamHopDong` (`maViPham`),
primary key (`maKhauTru`),
constraint `ck_KhoanKhauTru_1` check (`soTien` >= 0)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
