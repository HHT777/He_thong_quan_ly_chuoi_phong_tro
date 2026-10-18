const bcrypt = require("bcryptjs");
const models = require("./schema");
// All canonical models inherit utf8mb4_unicode_ci from schema.js; do not let
// Sequelize sync() pick a server-dependent table default for new tables.
const AuditLog = require("./AuditLog");

const {
  TaiKhoan, ChuTro, KhachThue, CanTro, PhongTro, TaiSan, HopDong, LichSuGiaHanHopDong, LichSuSuaHopDong, LichSuChuyenPhong, TienCoc,
  ThanhVienPhong, ViPhamHopDong, ChiSoDien, LichSuChinhSuaChiSoDien, YeuCau, ThanhToan, SuCo,
  GiaoDichThanhToan, KhoanDieuChinh, ChiTietThanhToan, KhoanChi, ThongBao,
  BienBanTraPhong, KhoanThu, KhoanKhauTru, GiaoDichHoanCoc, ChiPhiSuCoKhachThue, DatGiuPhong, LichSuGiaHanGiuPhong, CauHinhHeThong, DanhMucSuCo,
} = models;

function ensureMeterBusinessKey(reading) {
  const type = reading.loai_chi_so || "DINH_KY";
  reading.setDataValue("loai_chi_so", type);
  if (!reading.khoa_nghiep_vu && type === "DINH_KY" && reading.nam && reading.thang) {
    reading.setDataValue("khoa_nghiep_vu", `DINH_KY:${reading.nam}-${String(reading.thang).padStart(2, "0")}`);
  }
  if (!reading.khoa_nghiep_vu) {
    throw Object.assign(new Error("Thiếu khóa nghiệp vụ của chỉ số điện"), { status: 422, code: "METER_BUSINESS_KEY_REQUIRED" });
  }
}
ChiSoDien.beforeValidate(ensureMeterBusinessKey);
ChiSoDien.beforeBulkCreate((readings) => readings.forEach(ensureMeterBusinessKey));

TaiKhoan.prototype.checkPassword = function checkPassword(password) {
  return bcrypt.compare(password, this.mat_khau);
};
async function hashPassword(account) {
  if (account.mat_khau && !/^\$2[aby]\$/.test(account.mat_khau)) {
    account.mat_khau = await bcrypt.hash(account.mat_khau, 12);
  }
}
TaiKhoan.beforeCreate(hashPassword);
TaiKhoan.beforeUpdate(async (account) => {
  if (account.changed("mat_khau")) await hashPassword(account);
});

TaiKhoan.hasOne(KhachThue, { foreignKey: "ma_tai_khoan", as: "khachThue" });
KhachThue.belongsTo(TaiKhoan, { foreignKey: "ma_tai_khoan", as: "taiKhoan" });
TaiKhoan.hasOne(ChuTro, { foreignKey: "ma_tai_khoan", as: "chuTro" });
ChuTro.belongsTo(TaiKhoan, { foreignKey: "ma_tai_khoan", as: "taiKhoan" });
ChuTro.hasMany(CanTro, { foreignKey: "ma_chu_tro", as: "canTros" });
CanTro.belongsTo(ChuTro, { foreignKey: "ma_chu_tro", as: "chuTro" });
CanTro.hasMany(PhongTro, { foreignKey: "ma_can", as: "phongs" });
PhongTro.belongsTo(CanTro, { foreignKey: "ma_can", as: "canTro" });
PhongTro.hasMany(TaiSan, { foreignKey: "ma_phong", as: "taiSans" });
TaiSan.belongsTo(PhongTro, { foreignKey: "ma_phong", as: "phongTro" });
KhachThue.hasMany(HopDong, { foreignKey: "ma_khach_thue", as: "hopDongs" });
HopDong.belongsTo(KhachThue, { foreignKey: "ma_khach_thue", as: "khachThue" });
PhongTro.hasMany(HopDong, { foreignKey: "ma_phong", as: "hopDongs" });
HopDong.belongsTo(PhongTro, { foreignKey: "ma_phong", as: "phongTro" });
HopDong.hasMany(LichSuGiaHanHopDong, { foreignKey: "ma_hop_dong", as: "lichSuGiaHans" });
LichSuGiaHanHopDong.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
HopDong.hasMany(LichSuSuaHopDong, { foreignKey: "ma_hop_dong", as: "lichSuThayDois" });
LichSuSuaHopDong.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
HopDong.hasMany(LichSuChuyenPhong, { foreignKey: "ma_hop_dong", as: "lichSuChuyenPhongs" });
LichSuChuyenPhong.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
LichSuChuyenPhong.belongsTo(PhongTro, { foreignKey: "ma_phong_cu", as: "phongCu" });
LichSuChuyenPhong.belongsTo(PhongTro, { foreignKey: "ma_phong_moi", as: "phongMoi" });
HopDong.hasOne(TienCoc, { foreignKey: "ma_hop_dong", as: "tienCoc" });
TienCoc.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
HopDong.hasMany(ThanhVienPhong, { foreignKey: "ma_hop_dong", as: "thanhVienPhongs" });
ThanhVienPhong.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
PhongTro.hasMany(ThanhVienPhong, { foreignKey: "ma_phong", as: "thanhVienPhongs" });
ThanhVienPhong.belongsTo(PhongTro, { foreignKey: "ma_phong", as: "phongTro" });
HopDong.hasMany(ViPhamHopDong, { foreignKey: "ma_hop_dong", as: "viPhams" });
ViPhamHopDong.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
PhongTro.hasMany(ChiSoDien, { foreignKey: "ma_phong", as: "chiSoDiens" });
ChiSoDien.belongsTo(PhongTro, { foreignKey: "ma_phong", as: "phongTro" });
ChiSoDien.hasMany(LichSuChinhSuaChiSoDien, { foreignKey: "ma_chi_so", as: "lichSuChinhSuas" });
LichSuChinhSuaChiSoDien.belongsTo(ChiSoDien, { foreignKey: "ma_chi_so", as: "chiSoDien" });
KhachThue.hasMany(YeuCau, { foreignKey: "ma_khach_thue", as: "yeuCaus" });
YeuCau.belongsTo(KhachThue, { foreignKey: "ma_khach_thue", as: "khachThue" });
HopDong.hasMany(ThanhToan, { foreignKey: "ma_hop_dong", as: "thanhToans" });
ThanhToan.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
ThanhToan.belongsTo(BienBanTraPhong, { foreignKey: "ma_bien_ban_tra_phong", as: "bienBanTraPhong" });
ThanhToan.hasMany(GiaoDichThanhToan, { foreignKey: "ma_thanh_toan", as: "giaoDichs" });
GiaoDichThanhToan.belongsTo(ThanhToan, { foreignKey: "ma_thanh_toan", as: "thanhToan" });
ThanhToan.hasMany(ChiTietThanhToan, { foreignKey: "ma_thanh_toan", as: "chiTiets" });
ChiTietThanhToan.belongsTo(ThanhToan, { foreignKey: "ma_thanh_toan", as: "thanhToan" });
HopDong.hasMany(KhoanDieuChinh, { foreignKey: "ma_hop_dong", as: "khoanDieuChinhs" });
KhoanDieuChinh.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
KhoanDieuChinh.hasMany(ChiTietThanhToan, { foreignKey: "ma_khoan_dieu_chinh", as: "chiTietSnapshots" });
ChiTietThanhToan.belongsTo(KhoanDieuChinh, { foreignKey: "ma_khoan_dieu_chinh", as: "khoanDieuChinh" });
PhongTro.hasMany(SuCo, { foreignKey: "ma_phong", as: "suCos" });
SuCo.belongsTo(PhongTro, { foreignKey: "ma_phong", as: "phongTro" });
CanTro.hasMany(KhoanChi, { foreignKey: "ma_can", as: "khoanChis" });
KhoanChi.belongsTo(CanTro, { foreignKey: "ma_can", as: "canTro" });
TaiKhoan.hasMany(ThongBao, { foreignKey: "ma_tai_khoan", as: "thongBaos" });
ThongBao.belongsTo(TaiKhoan, { foreignKey: "ma_tai_khoan", as: "taiKhoan" });
HopDong.hasOne(BienBanTraPhong, { foreignKey: "ma_hop_dong", as: "bienBanTraPhong" });
BienBanTraPhong.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
BienBanTraPhong.hasMany(KhoanKhauTru, { foreignKey: "ma_bien_ban_tra_phong", as: "khoanKhauTrus" });
KhoanKhauTru.belongsTo(BienBanTraPhong, { foreignKey: "ma_bien_ban_tra_phong", as: "bienBanTraPhong" });
BienBanTraPhong.hasMany(GiaoDichHoanCoc, { foreignKey: "ma_bien_ban_tra_phong", as: "giaoDichHoanCocs" });
GiaoDichHoanCoc.belongsTo(BienBanTraPhong, { foreignKey: "ma_bien_ban_tra_phong", as: "bienBanTraPhong" });
TienCoc.hasMany(GiaoDichHoanCoc, { foreignKey: "ma_tien_coc", as: "giaoDichHoanCocs" });
GiaoDichHoanCoc.belongsTo(TienCoc, { foreignKey: "ma_tien_coc", as: "tienCoc" });
GiaoDichThanhToan.hasOne(KhoanThu, { foreignKey: "ma_giao_dich_thanh_toan", as: "khoanThu" });
KhoanThu.belongsTo(GiaoDichThanhToan, { foreignKey: "ma_giao_dich_thanh_toan", as: "giaoDich" });
SuCo.hasOne(ChiPhiSuCoKhachThue, { foreignKey: "ma_su_co", as: "chiPhiKhachThue" });
ChiPhiSuCoKhachThue.belongsTo(SuCo, { foreignKey: "ma_su_co", as: "suCo" });
HopDong.hasMany(ChiPhiSuCoKhachThue, { foreignKey: "ma_hop_dong", as: "chiPhiSuCoKhachThues" });
ChiPhiSuCoKhachThue.belongsTo(HopDong, { foreignKey: "ma_hop_dong", as: "hopDong" });
PhongTro.hasMany(DatGiuPhong, { foreignKey: "ma_phong", as: "datGiuPhongs" });
DatGiuPhong.belongsTo(PhongTro, { foreignKey: "ma_phong", as: "phongTro" });
DatGiuPhong.hasMany(LichSuGiaHanGiuPhong, { foreignKey: "ma_dat_giu", as: "lichSuGiaHans" });
LichSuGiaHanGiuPhong.belongsTo(DatGiuPhong, { foreignKey: "ma_dat_giu", as: "datGiuPhong" });

module.exports = {
  ...models,
  AuditLog,
  NoiThat: TaiSan,
  DatCoc: TienCoc,
  DienNuoc: ChiSoDien,
  KhoanPhaiThu: ThanhToan,
  ChiPhi: KhoanChi,
  TraPhong: BienBanTraPhong,
  NguoiO: ThanhVienPhong,
};
