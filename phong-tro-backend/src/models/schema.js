const crypto = require("crypto");
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const id = (field) => ({ type: DataTypes.STRING(36), field, primaryKey: true, defaultValue: () => crypto.randomUUID() });
const ref = (field, allowNull = false) => ({ type: DataTypes.STRING(36), field, allowNull });
const money = (field, allowNull = false, defaultValue) => ({ type: DataTypes.DECIMAL(18, 2), field, allowNull, ...(defaultValue === undefined ? {} : { defaultValue }) });
const opts = (tableName) => ({ tableName, timestamps: false, freezeTableName: true, charset: "utf8mb4", collate: "utf8mb4_unicode_ci" });

const TaiKhoan = sequelize.define("TaiKhoan", {
  ma_tai_khoan: id("maTaiKhoan"),
  ten_dang_nhap: { type: DataTypes.STRING(15), field: "tenDangNhap", allowNull: false, unique: true },
  mat_khau: { type: DataTypes.STRING(255), field: "matKhauHash", allowNull: false },
  vai_tro: { type: DataTypes.STRING(30), field: "vaiTro", allowNull: false },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "HOAT_DONG" },
  bat_buoc_doi_mat_khau: { type: DataTypes.BOOLEAN, field: "batBuocDoiMatKhau", allowNull: false, defaultValue: true },
}, opts("TaiKhoan"));
const ChuTro = sequelize.define("ChuTro", {
  ma_chu_tro: id("maChuTro"), ho_ten: { type: DataTypes.STRING(100), field: "hoTen", allowNull: false },
  so_dien_thoai: { type: DataTypes.STRING(15), field: "soDienThoai", allowNull: false }, ma_tai_khoan: { ...ref("maTaiKhoan"), unique: true },
}, opts("ChuTro"));
const KhachThue = sequelize.define("KhachThue", {
  ma_khach_thue: id("maKhachThue"), ho_ten: { type: DataTypes.STRING(100), field: "hoTen", allowNull: false },
  so_dien_thoai: { type: DataTypes.STRING(15), field: "soDienThoai", allowNull: false },
  cccd_giay_to: { type: DataTypes.STRING(20), field: "soGiayTo", allowNull: false, unique: true },
  ma_tai_khoan: { ...ref("maTaiKhoan", true), unique: true },
}, opts("KhachThue"));
const CanTro = sequelize.define("CanTro", {
  ma_can: id("maCan"), ten_can: { type: DataTypes.STRING(100), field: "tenCan", allowNull: false },
  dia_chi: { type: DataTypes.STRING(255), field: "diaChi", allowNull: false }, mo_ta: { type: DataTypes.STRING(1000), field: "moTa", allowNull: true },
  quy_dinh_chung: { type: DataTypes.STRING(255), field: "quyDinhChung", allowNull: true }, hinh_anh_tong_quan_url: { type: DataTypes.STRING(500), field: "hinhAnhTongQuanUrl", allowNull: true },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "HOAT_DONG" }, ma_chu_tro: ref("maChuTro"),
}, opts("CanTro"));
const PhongTro = sequelize.define("PhongTro", {
  ma_phong: id("maPhong"), so_phong: { type: DataTypes.STRING(255), field: "soPhong", allowNull: false }, dien_tich: money("dienTich"),
  gia_thue: money("giaThue"), so_nguoi_toi_da: { type: DataTypes.INTEGER, field: "soNguoiToiDa", allowNull: false },
  noi_that_mo_ta: { type: DataTypes.STRING(1000), field: "noiThatMoTa", allowNull: true },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "TRONG" }, ma_can: ref("maCan"),
}, opts("PhongTro"));
const TaiSan = sequelize.define("TaiSan", {
  ma_tai_san: id("maTaiSan"), ten_tai_san: { type: DataTypes.STRING(100), field: "tenTaiSan", allowNull: false },
  so_luong: { type: DataTypes.INTEGER, field: "soLuong", allowNull: false, defaultValue: 1 }, tinh_trang: { type: DataTypes.STRING(1000), field: "tinhTrang", allowNull: true },
  ghi_chu: { type: DataTypes.STRING(1000), field: "ghiChu", allowNull: true }, ma_phong: ref("maPhong"),
}, opts("TaiSan"));
const HopDong = sequelize.define("HopDong", {
  ma_hop_dong: id("maHopDong"), ngay_bat_dau: { type: DataTypes.DATEONLY, field: "ngayBatDau", allowNull: false },
  ngay_ket_thuc: { type: DataTypes.DATEONLY, field: "ngayKetThuc", allowNull: false }, gia_thue: money("giaThue"), don_gia_dien: money("donGiaDien"),
  don_gia_nuoc: money("donGiaNuoc"), dieu_khoan: { type: DataTypes.STRING(255), field: "dieuKhoan", allowNull: false },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false }, ngay_thanh_ly: { type: DataTypes.DATEONLY, field: "ngayThanhLy", allowNull: true },
  da_co_ban_giay_ky: { type: DataTypes.BOOLEAN, field: "daCoBanGiayKy", allowNull: false, defaultValue: false },
  phi_dich_vu: money("phiDichVu", false, 0),
  goi_gia_han_cho_phep: { type: DataTypes.STRING(20), field: "goiGiaHanChoPhep", allowNull: true },
  ma_khach_thue: ref("maKhachThue"), ma_phong: ref("maPhong"),
}, opts("HopDong"));
const LichSuGiaHanHopDong = sequelize.define("LichSuGiaHanHopDong", {
  ma_lich_su: id("maLichSu"), ma_hop_dong: ref("maHopDong"),
  ngay_ket_thuc_cu: { type: DataTypes.DATEONLY, field: "ngayKetThucCu", allowNull: false },
  ngay_ket_thuc_moi: { type: DataTypes.DATEONLY, field: "ngayKetThucMoi", allowNull: false },
  so_thang: { type: DataTypes.INTEGER, field: "soThang", allowNull: false },
  nguoi_duyet_id: ref("nguoiDuyetId"),
  thoi_diem_duyet: { type: DataTypes.DATE, field: "thoiDiemDuyet", allowNull: false, defaultValue: DataTypes.NOW },
}, opts("LichSuGiaHanHopDong"));
const LichSuSuaHopDong = sequelize.define("LichSuSuaHopDong", {
  ma_lich_su: id("maLichSu"), ma_hop_dong: ref("maHopDong"),
  truoc_json: { type: DataTypes.JSON, field: "truocJson", allowNull: true },
  sau_json: { type: DataTypes.JSON, field: "sauJson", allowNull: false },
  ly_do: { type: DataTypes.STRING(1000), field: "lyDo", allowNull: false },
  nguoi_sua_id: ref("nguoiSuaId"),
  thoi_diem_sua: { type: DataTypes.DATE, field: "thoiDiemSua", allowNull: false, defaultValue: DataTypes.NOW },
}, opts("LichSuSuaHopDong"));
const LichSuChuyenPhong = sequelize.define("LichSuChuyenPhong", {
  ma_lich_su: id("maLichSu"), ma_hop_dong: ref("maHopDong"), ma_phong_cu: ref("maPhongCu"), ma_phong_moi: ref("maPhongMoi"),
  ngay_chuyen: { type: DataTypes.DATEONLY, field: "ngayChuyen", allowNull: false }, gia_thue_cu: money("giaThueCu"), gia_thue_moi: money("giaThueMoi"),
  chi_so_dien_cuoi_phong_cu: money("chiSoDienCuoiPhongCu"), chi_so_dien_dau_phong_moi: money("chiSoDienDauPhongMoi"),
  nguoi_thuc_hien_id: ref("nguoiThucHienId"), thoi_diem_tao: { type: DataTypes.DATE, field: "thoiDiemTao", allowNull: false, defaultValue: DataTypes.NOW },
}, opts("LichSuChuyenPhong"));
const TienCoc = sequelize.define("TienCoc", {
  ma_tien_coc: id("maTienCoc"), so_tien_coc: money("soTienCoc"), ngay_nhan_coc: { type: DataTypes.DATEONLY, field: "ngayNhanCoc", allowNull: true },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false }, so_tien_da_hoan: money("soTienDaHoan", false, 0),
  so_tien_da_khau_tru: money("soTienDaKhauTru", false, 0), ma_hop_dong: { ...ref("maHopDong"), unique: true },
}, opts("TienCoc"));
const ThanhVienPhong = sequelize.define("ThanhVienPhong", {
  ma_thanh_vien_phong: id("maThanhVienPhong"), ho_ten: { type: DataTypes.STRING(100), field: "hoTen", allowNull: false },
  so_dien_thoai: { type: DataTypes.STRING(15), field: "soDienThoai", allowNull: false }, ngay_vao: { type: DataTypes.DATEONLY, field: "ngayVao", allowNull: false },
  ngay_roi: { type: DataTypes.DATEONLY, field: "ngayRoi", allowNull: true }, trang_thai_cu_tru: { type: DataTypes.STRING(50), field: "trangThaiCuTru", allowNull: false },
  ma_phong: ref("maPhong"), ma_hop_dong: ref("maHopDong"), cccd_giay_to: { type: DataTypes.STRING(50), field: "soGiayTo", allowNull: true }, ngay_sinh: { type: DataTypes.DATEONLY, field: "ngaySinh", allowNull: true }, gioi_tinh: { type: DataTypes.STRING(20), field: "gioiTinh", allowNull: true }, dia_chi_thuong_tru: { type: DataTypes.STRING(255), field: "diaChiThuongTru", allowNull: true }, quan_he: { type: DataTypes.STRING(80), field: "quanHe", allowNull: true },
}, opts("ThanhVienPhong"));
const ViPhamHopDong = sequelize.define("ViPhamHopDong", {
  ma_vi_pham: id("maViPham"), noi_dung: { type: DataTypes.STRING(1000), field: "noiDung", allowNull: false },
  ngay_ghi_nhan: { type: DataTypes.DATE, field: "ngayGhiNhan", allowNull: false, defaultValue: DataTypes.NOW },
  dieu_khoan_lien_quan: { type: DataTypes.STRING(255), field: "dieuKhoanLienQuan", allowNull: false }, muc_phat: money("mucPhat", true), ma_hop_dong: ref("maHopDong"),
}, opts("ViPhamHopDong"));
const ChiSoDien = sequelize.define("ChiSoDien", {
  ma_chi_so: id("maChiSo"), thang: { type: DataTypes.INTEGER, allowNull: false }, nam: { type: DataTypes.INTEGER, allowNull: false }, chi_so_moi: money("chiSoMoi"),
  loai_chi_so: { type: DataTypes.STRING(30), field: "loaiChiSo", allowNull: false, defaultValue: "DINH_KY" },
  khoa_nghiep_vu: { type: DataTypes.STRING(100), field: "khoaNghiepVu", allowNull: false },
  anh_cong_to_url: { type: DataTypes.STRING(500), field: "anhCongToUrl", allowNull: true }, don_gia_ap_dung: money("donGiaApDung"),
  trang_thai_xac_nhan: { type: DataTypes.STRING(30), field: "trangThaiXacNhan", allowNull: false }, ngay_ghi_nhan: { type: DataTypes.DATE, field: "ngayGhiNhan", allowNull: false, defaultValue: DataTypes.NOW },
  nguoi_ghi_nhan_id: ref("nguoiGhiNhanId"), nguoi_xac_nhan_id: ref("nguoiXacNhanId", true), ngay_xac_nhan: { type: DataTypes.DATE, field: "ngayXacNhan", allowNull: true }, ma_phong: ref("maPhong"),
  da_xoa: { type: DataTypes.BOOLEAN, field: "daXoa", allowNull: false, defaultValue: false }, ly_do_xoa: { type: DataTypes.STRING(1000), field: "lyDoXoa", allowNull: true }, ngay_xoa: { type: DataTypes.DATE, field: "ngayXoa", allowNull: true }, nguoi_xoa_id: ref("nguoiXoaId", true),
}, opts("ChiSoDien"));
const LichSuChinhSuaChiSoDien = sequelize.define("LichSuChinhSuaChiSoDien", {
  ma_lich_su: id("maLichSu"), chi_so_cu: money("chiSoCu"), chi_so_moi: money("chiSoMoi"), ly_do: { type: DataTypes.STRING(1000), field: "lyDo", allowNull: false }, thoi_diem_sua: { type: DataTypes.DATE, field: "thoiDiemSua", allowNull: false, defaultValue: DataTypes.NOW }, nguoi_sua_id: ref("nguoiSuaId"), ma_chi_so: ref("maChiSo"),
}, opts("LichSuChinhSuaChiSoDien"));
const YeuCau = sequelize.define("YeuCau", {
  ma_yeu_cau: id("maYeuCau"), ngay_gui: { type: DataTypes.DATE, field: "ngayGui", allowNull: false, defaultValue: DataTypes.NOW },
  noi_dung: { type: DataTypes.STRING(1000), field: "noiDung", allowNull: false }, trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "CHO_XU_LY" },
  loai_yeu_cau: { type: DataTypes.STRING(30), field: "loaiYeuCau", allowNull: false }, ma_khach_thue: ref("maKhachThue"),
  ly_do_xu_ly: { type: DataTypes.STRING(1000), field: "lyDoXuLy", allowNull: true }, ngay_duyet: { type: DataTypes.DATE, field: "ngayDuyet", allowNull: true },
  ngay_rut_duyet: { type: DataTypes.DATE, field: "ngayRutDuyet", allowNull: true }, nguoi_xu_ly_id: ref("nguoiXuLyId", true),
}, opts("YeuCau"));
const ThanhToan = sequelize.define("ThanhToan", {
  ma_thanh_toan: id("maThanhToan"), thang: { type: DataTypes.INTEGER, allowNull: false }, nam: { type: DataTypes.INTEGER, allowNull: false },
  tong_phai_tra: money("tongPhaiTra"), tong_da_thanh_toan: money("tongDaThanhToan"), so_tien_con_no: money("soTienConNo"),
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false }, ma_hop_dong: ref("maHopDong"),
  loai_thanh_toan: { type: DataTypes.STRING(30), field: "loaiThanhToan", allowNull: false, defaultValue: "DINH_KY" },
  ma_bien_ban_tra_phong: { ...ref("maBienBanTraPhong", true), unique: true },
  ngay_lap: { type: DataTypes.DATE, field: "ngayLap", allowNull: false, defaultValue: DataTypes.NOW },
  da_gui: { type: DataTypes.BOOLEAN, field: "daGui", allowNull: false, defaultValue: false },
  ngay_gui: { type: DataTypes.DATE, field: "ngayGui", allowNull: true },
  da_nhac_han: { type: DataTypes.BOOLEAN, field: "daNhacHan", allowNull: false, defaultValue: false },
  ngay_nhac_han: { type: DataTypes.DATE, field: "ngayNhacHan", allowNull: true },
  qua_han: { type: DataTypes.BOOLEAN, field: "quaHan", allowNull: false, defaultValue: false },
  ngay_qua_han: { type: DataTypes.DATE, field: "ngayQuaHan", allowNull: true },
  da_chot_cong_no: { type: DataTypes.BOOLEAN, field: "daChotCongNo", allowNull: false, defaultValue: false },
  ngay_chot_cong_no: { type: DataTypes.DATE, field: "ngayChotCongNo", allowNull: true },
  so_tien_chot_cong_no: money("soTienChotCongNo", true),
}, opts("ThanhToan"));
const SuCo = sequelize.define("SuCo", {
  ma_su_co: id("maSuCo"), loai_su_co: { type: DataTypes.STRING(50), field: "loaiSuCo", allowNull: false }, muc_do_uu_tien: { type: DataTypes.STRING(255), field: "mucDoUuTien", allowNull: false },
  mo_ta: { type: DataTypes.STRING(1000), field: "moTa", allowNull: true }, hinh_anh_url: { type: DataTypes.STRING(500), field: "hinhAnhUrl", allowNull: true },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "CHO_TIEP_NHAN" }, ngay_gui: { type: DataTypes.DATE, field: "ngayGui", allowNull: false, defaultValue: DataTypes.NOW },
  ngay_chinh_sua: { type: DataTypes.DATE, field: "ngayChinhSua", allowNull: true }, ngay_tiep_nhan: { type: DataTypes.DATE, field: "ngayTiepNhan", allowNull: true },
  ket_qua_xu_ly: { type: DataTypes.STRING(1000), field: "ketQuaXuLy", allowNull: true }, thiet_bi_thay_the: { type: DataTypes.STRING(255), field: "thietBiThayThe", allowNull: true },
  chi_phi_sua_chua: money("chiPhiSuaChua", true), doi_tuong_chiu_phi: { type: DataTypes.STRING(255), field: "doiTuongChiuPhi", allowNull: true },
  ngay_hoan_tat: { type: DataTypes.DATE, field: "ngayHoanTat", allowNull: true }, da_xoa: { type: DataTypes.BOOLEAN, field: "daXoa", allowNull: false, defaultValue: false },
  ly_do_xoa: { type: DataTypes.STRING(1000), field: "lyDoXoa", allowNull: true }, ngay_xoa: { type: DataTypes.DATE, field: "ngayXoa", allowNull: true },
  nguoi_tiep_nhan_id: ref("nguoiTiepNhanId", true), nguoi_xoa_id: ref("nguoiXoaId", true), ma_nguoi_gui: ref("maNguoiGui"), ma_phong: ref("maPhong"),
}, opts("SuCo"));
const YeuCauGiaHan = sequelize.define("YeuCauGiaHan", { ma_yeu_cau: id("maYeuCau"), ngay_ket_thuc_de_xuat: { type: DataTypes.DATEONLY, field: "ngayKetThucDeXuat", allowNull: false }, ma_hop_dong: ref("maHopDong") }, opts("YeuCauGiaHan"));
const YeuCauTraPhong = sequelize.define("YeuCauTraPhong", {
  ma_yeu_cau: id("maYeuCau"), ma_hop_dong: ref("maHopDong"), ngay_tra_du_kien: { type: DataTypes.DATEONLY, field: "ngayTraDuKien", allowNull: true },
  ngay_tra_da_duyet: { type: DataTypes.DATEONLY, field: "ngayTraDaDuyet", allowNull: true }, ly_do_tra_som: { type: DataTypes.STRING(1000), field: "lyDoTraSom", allowNull: true },
}, opts("YeuCauTraPhong"));
const DeXuatBanCungPhong = sequelize.define("DeXuatBanCungPhong", {
  ma_yeu_cau: id("maYeuCau"), ho_ten_nguoi_de_xuat: { type: DataTypes.STRING(255), field: "hoTenNguoiDeXuat", allowNull: false },
  so_dien_thoai_nguoi_de_xuat: { type: DataTypes.STRING(15), field: "soDienThoaiNguoiDeXuat", allowNull: false },
  noi_dung_bo_sung: { type: DataTypes.STRING(1000), field: "noiDungBoSung", allowNull: true }, ma_phong: ref("maPhong"), cccd_giay_to: { type: DataTypes.STRING(50), field: "soGiayTo", allowNull: true }, ngay_sinh: { type: DataTypes.DATEONLY, field: "ngaySinh", allowNull: true }, gioi_tinh: { type: DataTypes.STRING(20), field: "gioiTinh", allowNull: true }, dia_chi_thuong_tru: { type: DataTypes.STRING(255), field: "diaChiThuongTru", allowNull: true }, quan_he: { type: DataTypes.STRING(80), field: "quanHe", allowNull: true }, ngay_bat_dau_o: { type: DataTypes.DATEONLY, field: "ngayBatDauO", allowNull: true }, ly_do_tu_choi: { type: DataTypes.STRING(1000), field: "lyDoTuChoi", allowNull: true }, nguoi_xu_ly_id: ref("nguoiXuLyId", true), ngay_xu_ly: { type: DataTypes.DATE, field: "ngayXuLy", allowNull: true },
}, opts("DeXuatBanCungPhong"));
const GiaoDichThanhToan = sequelize.define("GiaoDichThanhToan", {
  ma_giao_dich: id("maGiaoDich"), so_tien: money("soTien", true), thoi_diem_ghi_nhan: { type: DataTypes.DATE, field: "thoiDiemGhiNhan", allowNull: false, defaultValue: DataTypes.NOW },
  minh_chung_url: { type: DataTypes.STRING(500), field: "minhChungUrl", allowNull: true }, trang_thai_xac_nhan: { type: DataTypes.STRING(30), field: "trangThaiXacNhan", allowNull: false },
  thoi_diem_xac_nhan: { type: DataTypes.DATE, field: "thoiDiemXacNhan", allowNull: true }, ly_do_huy: { type: DataTypes.STRING(1000), field: "lyDoHuy", allowNull: true },
  ngay_huy: { type: DataTypes.DATE, field: "ngayHuy", allowNull: true }, nguoi_huy_id: ref("nguoiHuyId", true), ma_thanh_toan: ref("maThanhToan"),
  nguon_thanh_toan: { type: DataTypes.STRING(30), field: "nguonThanhToan", allowNull: false, defaultValue: "THU_TIEN" },
}, opts("GiaoDichThanhToan"));
const KhoanDieuChinh = sequelize.define("KhoanDieuChinh", {
  ma_khoan_dieu_chinh: id("maKhoanDieuChinh"), ma_hop_dong: ref("maHopDong"),
  loai_khoan: { type: DataTypes.STRING(30), field: "loaiKhoan", allowNull: false },
  ten_ly_do: { type: DataTypes.STRING(255), field: "tenLyDo", allowNull: false }, so_tien: money("soTien"),
  che_do: { type: DataTypes.STRING(20), field: "cheDo", allowNull: false },
  thang_ap_dung: { type: DataTypes.INTEGER, field: "thangApDung", allowNull: true }, nam_ap_dung: { type: DataTypes.INTEGER, field: "namApDung", allowNull: true },
  ngay_bat_dau: { type: DataTypes.DATEONLY, field: "ngayBatDau", allowNull: true },
  trang_thai: { type: DataTypes.STRING(20), field: "trangThai", allowNull: false, defaultValue: "DANG_AP_DUNG" },
  ngay_tao: { type: DataTypes.DATE, field: "ngayTao", allowNull: false, defaultValue: DataTypes.NOW },
  ngay_cap_nhat: { type: DataTypes.DATE, field: "ngayCapNhat", allowNull: false, defaultValue: DataTypes.NOW },
  ngay_tat: { type: DataTypes.DATE, field: "ngayTat", allowNull: true }, ly_do_tat: { type: DataTypes.STRING(1000), field: "lyDoTat", allowNull: true },
  nguoi_tao_id: ref("nguoiTaoId"), nguoi_cap_nhat_id: ref("nguoiCapNhatId", true),
}, opts("KhoanDieuChinh"));
const ChiTietThanhToan = sequelize.define("ChiTietThanhToan", {
  ma_chi_tiet: id("maChiTiet"), loai_khoan: { type: DataTypes.STRING(30), field: "loaiKhoan", allowNull: false }, so_tien: money("soTien"),
  dien_giai: { type: DataTypes.STRING(255), field: "dienGiai", allowNull: false }, ma_thanh_toan: ref("maThanhToan"), ma_su_co: { ...ref("maSuCo", true), unique: true },
  ma_khoan_dieu_chinh: ref("maKhoanDieuChinh", true), nguoi_thuc_hien_id: ref("nguoiThucHienId", true),
  thoi_diem_tao: { type: DataTypes.DATE, field: "thoiDiemTao", allowNull: false, defaultValue: DataTypes.NOW },
}, opts("ChiTietThanhToan"));
const KhoanChi = sequelize.define("KhoanChi", {
  ma_khoan_chi: id("maKhoanChi"), loai_khoan_chi: { type: DataTypes.STRING(50), field: "loaiKhoanChi", allowNull: false }, so_tien: money("soTien"),
  ngay_phat_sinh: { type: DataTypes.DATEONLY, field: "ngayPhatSinh", allowNull: false }, pham_vi: { type: DataTypes.STRING(30), field: "phamVi", allowNull: false },
  ghi_chu: { type: DataTypes.STRING(1000), field: "ghiChu", allowNull: true }, ma_can: ref("maCan", true), ma_su_co: { ...ref("maSuCo", true), unique: true }, trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "HIEU_LUC" }, ly_do_huy: { type: DataTypes.STRING(1000), field: "lyDoHuy", allowNull: true }, ngay_huy: { type: DataTypes.DATE, field: "ngayHuy", allowNull: true }, nguoi_huy_id: ref("nguoiHuyId", true),
}, opts("KhoanChi"));
const ThongBao = sequelize.define("ThongBao", {
  ma_thong_bao: id("maThongBao"), loai_thong_bao: { type: DataTypes.STRING(50), field: "loaiThongBao", allowNull: false },
  noi_dung: { type: DataTypes.STRING(1000), field: "noiDung", allowNull: false }, thoi_diem_tao: { type: DataTypes.DATE, field: "thoiDiemTao", allowNull: false, defaultValue: DataTypes.NOW },
  da_doc: { type: DataTypes.BOOLEAN, field: "daDoc", allowNull: false, defaultValue: false }, ma_su_co: ref("maSuCo", true), ma_tai_khoan: ref("maTaiKhoan"),
  khoa_su_kien: { type: DataTypes.STRING(150), field: "khoaSuKien", allowNull: true },
}, opts("ThongBao"));
const SuCoTaiSan = sequelize.define("SuCoTaiSan", { ma_su_co: { ...ref("maSuCo"), primaryKey: true }, ma_tai_san: { ...ref("maTaiSan"), primaryKey: true } }, opts("SuCoTaiSan"));
const BienBanTraPhong = sequelize.define("BienBanTraPhong", {
  ma_bien_ban: id("maBienBan"), ngay_kiem_tra: { type: DataTypes.DATEONLY, field: "ngayKiemTra", allowNull: false },
  tinh_trang_phong: { type: DataTypes.STRING(1000), field: "tinhTrangPhong", allowNull: false }, ghi_chu: { type: DataTypes.STRING(1000), field: "ghiChu", allowNull: true },
  tong_khoan_khau_tru: money("tongKhoanKhauTru"), so_tien_coc_duoc_hoan: money("soTienCocDuocHoan"), ma_hop_dong: { ...ref("maHopDong"), unique: true },
  ma_yeu_cau_tra_phong: { ...ref("maYeuCauTraPhong", true), unique: true }, nguoi_lap_id: ref("nguoiLapId"),
  la_du_lieu_legacy: { type: DataTypes.BOOLEAN, field: "laDuLieuLegacy", allowNull: false, defaultValue: false },
  ngay_quyet_toan: { type: DataTypes.DATEONLY, field: "ngayQuyetToan", allowNull: true },
  tien_coc_ban_dau: money("tienCocBanDau", true),
  tien_phong_tra_truoc_duoc_hoan: money("tienPhongTraTruocDuocHoan", true),
  gia_tri_quyet_toan_rong: money("giaTriQuyetToanRong", true),
  so_tien_no_sau_thanh_ly: money("soTienNoSauThanhLy", true),
  cong_thuc_quyet_toan: { type: DataTypes.STRING(255), field: "congThucQuyetToan", allowNull: true },
  snapshot_json: { type: DataTypes.JSON, field: "snapshotJson", allowNull: true },
}, opts("BienBanTraPhong"));
const KhoanThu = sequelize.define("KhoanThu", {
  ma_khoan_thu: id("maKhoanThu"), loai_khoan_thu: { type: DataTypes.STRING(50), field: "loaiKhoanThu", allowNull: false }, so_tien: money("soTien"),
  ngay_ghi_nhan: { type: DataTypes.DATEONLY, field: "ngayGhiNhan", allowNull: false }, ghi_chu: { type: DataTypes.STRING(1000), field: "ghiChu", allowNull: true },
  trang_thai_ghi_nhan: { type: DataTypes.STRING(50), field: "trangThaiGhiNhan", allowNull: false }, ly_do_huy: { type: DataTypes.STRING(1000), field: "lyDoHuy", allowNull: true },
  ngay_huy: { type: DataTypes.DATE, field: "ngayHuy", allowNull: true }, ma_giao_dich_thanh_toan: { ...ref("maGiaoDichThanhToan", true), unique: true }, ma_can: ref("maCan"),
  doanh_thu_gop: money("doanhThuGop", true), giam_tru_phan_bo: money("giamTruPhanBo", true),
  nguon_snapshot: { type: DataTypes.STRING(20), field: "nguonSnapshot", allowNull: true },
}, opts("KhoanThu"));
const KhoanKhauTru = sequelize.define("KhoanKhauTru", {
  ma_khau_tru: id("maKhauTru"), loai_khau_tru: { type: DataTypes.STRING(50), field: "loaiKhauTru", allowNull: false },
  ly_do: { type: DataTypes.STRING(1000), field: "lyDo", allowNull: false }, so_tien: money("soTien"), ghi_chu: { type: DataTypes.STRING(1000), field: "ghiChu", allowNull: true },
  ma_bien_ban_tra_phong: ref("maBienBanTraPhong"), ma_tai_san: ref("maTaiSan", true),
  so_luong_tai_san: { type: DataTypes.INTEGER, field: "soLuongTaiSan", allowNull: true },
  ma_vi_pham: { ...ref("maViPham", true), unique: true }, ma_chi_phi_su_co: { ...ref("maChiPhiSuCo", true), unique: true },
}, opts("KhoanKhauTru"));
const GiaoDichHoanCoc = sequelize.define("GiaoDichHoanCoc", {
  ma_giao_dich_hoan_coc: id("maGiaoDichHoanCoc"), ma_bien_ban_tra_phong: ref("maBienBanTraPhong"), ma_tien_coc: ref("maTienCoc"),
  ngay_hoan: { type: DataTypes.DATEONLY, field: "ngayHoan", allowNull: false }, so_tien: money("soTien"),
  nguoi_ghi_nhan_id: ref("nguoiGhiNhanId"), khoa_chong_trung: { type: DataTypes.STRING(100), field: "khoaChongTrung", allowNull: false, unique: true },
  thoi_diem_tao: { type: DataTypes.DATE, field: "thoiDiemTao", allowNull: false, defaultValue: DataTypes.NOW },
}, opts("GiaoDichHoanCoc"));
const DatGiuPhong = sequelize.define("DatGiuPhong", {
  ma_dat_giu: id("maDatGiu"), ho_ten_nguoi_giu: { type: DataTypes.STRING(100), field: "hoTenNguoiGiu", allowNull: false },
  so_dien_thoai: { type: DataTypes.STRING(15), field: "soDienThoai", allowNull: false }, so_tien_giu: money("soTienGiu"),
  ngay_nhan: { type: DataTypes.DATEONLY, field: "ngayNhan", allowNull: false }, han_giu: { type: DataTypes.DATEONLY, field: "hanGiu", allowNull: false },
  dieu_kien: { type: DataTypes.STRING(1000), field: "dieuKien", allowNull: false }, ghi_chu: { type: DataTypes.STRING(1000), field: "ghiChu", allowNull: true },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "DANG_GIU" }, so_tien_hoan: money("soTienHoan", false, 0),
  ly_do_huy: { type: DataTypes.STRING(1000), field: "lyDoHuy", allowNull: true }, ngay_huy: { type: DataTypes.DATE, field: "ngayHuy", allowNull: true }, nguoi_thuc_hien_id: ref("nguoiThucHienId"), ma_phong: ref("maPhong"),
}, opts("DatGiuPhong"));
const LichSuGiaHanGiuPhong = sequelize.define("LichSuGiaHanGiuPhong", {
  ma_lich_su: id("maLichSu"), han_cu: { type: DataTypes.DATEONLY, field: "hanCu", allowNull: false }, han_moi: { type: DataTypes.DATEONLY, field: "hanMoi", allowNull: false },
  ly_do: { type: DataTypes.STRING(1000), field: "lyDo", allowNull: true }, thoi_diem_tao: { type: DataTypes.DATE, field: "thoiDiemTao", allowNull: false, defaultValue: DataTypes.NOW }, nguoi_thuc_hien_id: ref("nguoiThucHienId"), ma_dat_giu: ref("maDatGiu"),
}, opts("LichSuGiaHanGiuPhong"));
const CauHinhHeThong = sequelize.define("CauHinhHeThong", { ma_cau_hinh: id("maCauHinh"), khoa: { type: DataTypes.STRING(100), field: "khoa", allowNull: false, unique: true }, gia_tri: { type: DataTypes.JSON, field: "giaTri", allowNull: false }, mo_ta: { type: DataTypes.STRING(500), field: "moTa", allowNull: true }, ngay_cap_nhat: { type: DataTypes.DATE, field: "ngayCapNhat", allowNull: false, defaultValue: DataTypes.NOW }, nguoi_cap_nhat_id: ref("nguoiCapNhatId") }, opts("CauHinhHeThong"));
const DanhMucSuCo = sequelize.define("DanhMucSuCo", { ma_danh_muc: id("maDanhMuc"), ma: { type: DataTypes.STRING(50), field: "ma", allowNull: false, unique: true }, ten: { type: DataTypes.STRING(100), field: "ten", allowNull: false }, dang_hoat_dong: { type: DataTypes.BOOLEAN, field: "dangHoatDong", allowNull: false, defaultValue: true }, thu_tu: { type: DataTypes.INTEGER, field: "thuTu", allowNull: false, defaultValue: 0 } }, opts("DanhMucSuCo"));
const ChiPhiSuCoKhachThue = sequelize.define("ChiPhiSuCoKhachThue", {
  ma_chi_phi_su_co: id("maChiPhiSuCo"), ma_su_co: { ...ref("maSuCo"), unique: true }, ma_hop_dong: ref("maHopDong"),
  so_tien: money("soTien"), can_cu_trach_nhiem: { type: DataTypes.STRING(1000), field: "canCuTrachNhiem", allowNull: false },
  trang_thai: { type: DataTypes.STRING(30), field: "trangThai", allowNull: false, defaultValue: "CHO_KHAU_TRU" },
  ngay_ghi_nhan: { type: DataTypes.DATE, field: "ngayGhiNhan", allowNull: false, defaultValue: DataTypes.NOW }, ngay_khau_tru: { type: DataTypes.DATE, field: "ngayKhauTru", allowNull: true },
}, opts("ChiPhiSuCoKhachThue"));

module.exports = { TaiKhoan, ChuTro, KhachThue, CanTro, PhongTro, TaiSan, HopDong, LichSuGiaHanHopDong, LichSuSuaHopDong, LichSuChuyenPhong, TienCoc, ThanhVienPhong, ViPhamHopDong, ChiSoDien, LichSuChinhSuaChiSoDien, YeuCau, ThanhToan, SuCo, YeuCauGiaHan, YeuCauTraPhong, DeXuatBanCungPhong, GiaoDichThanhToan, KhoanDieuChinh, ChiTietThanhToan, KhoanChi, ThongBao, SuCoTaiSan, BienBanTraPhong, KhoanThu, KhoanKhauTru, GiaoDichHoanCoc, ChiPhiSuCoKhachThue, DatGiuPhong, LichSuGiaHanGiuPhong, CauHinhHeThong, DanhMucSuCo };
