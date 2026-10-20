require("dotenv").config();
const mysql = require("mysql2/promise");
const { getCashflow } = require("../src/services/cashflowReport.service");

const options = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME, charset: "utf8mb4" };
const checks = {
  billDetailTotals: `SELECT COUNT(*) violations FROM (SELECT t.maThanhToan FROM ThanhToan t JOIN ChiTietThanhToan c ON c.maThanhToan=t.maThanhToan GROUP BY t.maThanhToan,t.tongPhaiTra HAVING ABS(SUM(c.soTien)-t.tongPhaiTra)>0.001) x`,
  duplicateBills: `SELECT COUNT(*) violations FROM (SELECT maHopDong,thang,nam,loaiThanhToan,COUNT(*) n FROM ThanhToan GROUP BY maHopDong,thang,nam,loaiThanhToan HAVING n>1) x`,
  roomCapacity: `SELECT COUNT(*) violations FROM (SELECT p.maPhong FROM PhongTro p JOIN ThanhVienPhong v ON v.maPhong=p.maPhong AND v.trangThaiCuTru='DANG_O' GROUP BY p.maPhong,p.soNguoiToiDa HAVING COUNT(*)>p.soNguoiToiDa) x`,
  contractDeposits: `SELECT COUNT(*) violations FROM (SELECT h.maHopDong,COUNT(t.maTienCoc) n FROM HopDong h LEFT JOIN TienCoc t ON t.maHopDong=h.maHopDong GROUP BY h.maHopDong HAVING n<>1) x`,
  incidentBranches: `SELECT COUNT(*) violations FROM (SELECT s.maSuCo, (COALESCE(kc.n,0)+COALESCE(cs.n,0)+COALESCE(kt.n,0)) n FROM SuCo s LEFT JOIN (SELECT maSuCo,COUNT(*) n FROM KhoanChi GROUP BY maSuCo) kc ON kc.maSuCo=s.maSuCo LEFT JOIN (SELECT maSuCo,COUNT(*) n FROM ChiPhiSuCoKhachThue GROUP BY maSuCo) cs ON cs.maSuCo=s.maSuCo LEFT JOIN (SELECT c.maSuCo,COUNT(*) n FROM ChiPhiSuCoKhachThue c JOIN KhoanKhauTru k ON k.maChiPhiSuCo=c.maChiPhiSuCo GROUP BY c.maSuCo) kt ON kt.maSuCo=s.maSuCo WHERE s.trangThai='DA_XU_LY' HAVING n>1) x`,
  notificationKeys: `SELECT COUNT(*) violations FROM (SELECT maTaiKhoan,khoaSuKien,COUNT(*) n FROM ThongBao WHERE khoaSuKien IS NOT NULL GROUP BY maTaiKhoan,khoaSuKien HAVING n>1) x`,
  depositRefunds: `SELECT COUNT(*) violations FROM (SELECT t.maTienCoc, t.soTienDaHoan, COALESCE(SUM(g.soTien),0) refunded FROM TienCoc t JOIN GiaoDichHoanCoc g ON g.maTienCoc=t.maTienCoc GROUP BY t.maTienCoc,t.soTienDaHoan HAVING ABS(t.soTienDaHoan-refunded)>0.001) x`,
  activeReservationRoomState: `SELECT COUNT(*) violations FROM DatGiuPhong g JOIN PhongTro p ON p.maPhong=g.maPhong WHERE g.trangThai='DANG_GIU' AND p.trangThai<>'DA_GIU'`,
  heldRoomWithoutReservation: `SELECT COUNT(*) violations FROM (SELECT p.maPhong FROM PhongTro p LEFT JOIN DatGiuPhong g ON g.maPhong=p.maPhong AND g.trangThai='DANG_GIU' WHERE p.trangThai='DA_GIU' GROUP BY p.maPhong HAVING COUNT(g.maDatGiu)<>1) x`,
  reservationContractOverlap: `SELECT COUNT(*) violations FROM DatGiuPhong g JOIN HopDong h ON h.maPhong=g.maPhong AND h.trangThai IN ('DANG_HIEU_LUC','SAP_HET_HAN') WHERE g.trangThai='DANG_GIU'`,
  recordedReceiptSnapshots: `SELECT COUNT(*) violations FROM KhoanThu WHERE nguonSnapshot='GHI_NHAN' AND (doanhThuGop IS NULL OR giamTruPhanBo IS NULL)`,
  receiptSnapshotArithmetic: `SELECT COUNT(*) violations FROM KhoanThu WHERE nguonSnapshot='GHI_NHAN' AND ABS(doanhThuGop-giamTruPhanBo-soTien)>0.001`,
  allocatedDiscounts: `SELECT COUNT(*) violations FROM (SELECT g.maThanhToan,COALESCE(SUM(k.giamTruPhanBo),0) allocated,COALESCE(x.discountTotal,0) available FROM GiaoDichThanhToan g JOIN KhoanThu k ON k.maGiaoDichThanhToan=g.maGiaoDich AND k.trangThaiGhiNhan='HIEU_LUC' LEFT JOIN (SELECT maThanhToan,SUM(IF(loaiKhoan='GIAM_TRU',ABS(soTien),0)) discountTotal FROM ChiTietThanhToan GROUP BY maThanhToan) x ON x.maThanhToan=g.maThanhToan GROUP BY g.maThanhToan,x.discountTotal HAVING allocated>available+0.001) q`,
  snapshotReportTotals: `SELECT COUNT(*) violations FROM (SELECT ngayGhiNhan,SUM(soTien) net,SUM(doanhThuGop-giamTruPhanBo) snapshotNet FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC' AND nguonSnapshot IS NOT NULL GROUP BY ngayGhiNhan HAVING ABS(net-snapshotNet)>0.001) q`,
  reportBuildingRevenue: `SELECT IF(ABS((SELECT COALESCE(SUM(soTien),0) FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC')+(SELECT COALESCE(SUM(LEAST(tienCocBanDau,tongKhoanKhauTru)),0) FROM BienBanTraPhong WHERE laDuLieuLegacy=0)-(SELECT COALESCE(SUM(amount),0) FROM (SELECT maCan,SUM(soTien) amount FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC' GROUP BY maCan UNION ALL SELECT p.maCan,SUM(LEAST(b.tienCocBanDau,b.tongKhoanKhauTru)) FROM BienBanTraPhong b JOIN HopDong h ON h.maHopDong=b.maHopDong JOIN PhongTro p ON p.maPhong=h.maPhong WHERE b.laDuLieuLegacy=0 GROUP BY p.maCan) x))>0.001,1,0) violations`,
  reportBuildingGrossRevenue: `SELECT IF(ABS((SELECT COALESCE(SUM(COALESCE(doanhThuGop,soTien)),0) FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC')+(SELECT COALESCE(SUM(LEAST(tienCocBanDau,tongKhoanKhauTru)),0) FROM BienBanTraPhong WHERE laDuLieuLegacy=0)-(SELECT COALESCE(SUM(amount),0) FROM (SELECT maCan,SUM(COALESCE(doanhThuGop,soTien)) amount FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC' GROUP BY maCan UNION ALL SELECT p.maCan,SUM(LEAST(b.tienCocBanDau,b.tongKhoanKhauTru)) FROM BienBanTraPhong b JOIN HopDong h ON h.maHopDong=b.maHopDong JOIN PhongTro p ON p.maPhong=h.maPhong WHERE b.laDuLieuLegacy=0 GROUP BY p.maCan) x))>0.001,1,0) violations`,
  reportBuildingDiscounts: `SELECT IF(ABS((SELECT COALESCE(SUM(COALESCE(giamTruPhanBo,0)),0) FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC')-(SELECT COALESCE(SUM(amount),0) FROM (SELECT maCan,SUM(COALESCE(giamTruPhanBo,0)) amount FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC' GROUP BY maCan) x))>0.001,1,0) violations`,
  reportReceiptDetailsTotal: `SELECT IF(ABS((SELECT COALESCE(SUM(soTien),0) FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC')+(SELECT COALESCE(SUM(LEAST(tienCocBanDau,tongKhoanKhauTru)),0) FROM BienBanTraPhong WHERE laDuLieuLegacy=0)-(SELECT COALESCE(SUM(amount),0) FROM (SELECT soTien amount FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC' UNION ALL SELECT LEAST(tienCocBanDau,tongKhoanKhauTru) FROM BienBanTraPhong WHERE laDuLieuLegacy=0) x))>0.001,1,0) violations`,
  reportRevenueByTypeTotal: `SELECT IF(ABS((SELECT COALESCE(SUM(soTien),0) FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC')+(SELECT COALESCE(SUM(LEAST(tienCocBanDau,tongKhoanKhauTru)),0) FROM BienBanTraPhong WHERE laDuLieuLegacy=0)-(SELECT COALESCE(SUM(amount),0) FROM (SELECT loaiKhoanThu,SUM(soTien) amount FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC' GROUP BY loaiKhoanThu UNION ALL SELECT 'KHAU_TRU_COC',SUM(LEAST(tienCocBanDau,tongKhoanKhauTru)) FROM BienBanTraPhong WHERE laDuLieuLegacy=0) x))>0.001,1,0) violations`,
  buildingLandlord: `SELECT COUNT(*) violations FROM CanTro c LEFT JOIN ChuTro ct ON ct.maChuTro=c.maChuTro WHERE c.maChuTro IS NULL OR ct.maChuTro IS NULL`,
  landlordAccount: `SELECT COUNT(*) violations FROM (SELECT t.maTaiKhoan, COUNT(c.maChuTro) n FROM TaiKhoan t LEFT JOIN ChuTro c ON c.maTaiKhoan=t.maTaiKhoan WHERE t.vaiTro='CHU_TRO' GROUP BY t.maTaiKhoan HAVING n<>1) x`,
  roomBuilding: `SELECT COUNT(*) violations FROM PhongTro p LEFT JOIN CanTro c ON c.maCan=p.maCan WHERE p.maCan IS NULL OR c.maCan IS NULL`,
  contractBuilding: `SELECT COUNT(*) violations FROM HopDong h LEFT JOIN PhongTro p ON p.maPhong=h.maPhong LEFT JOIN CanTro c ON c.maCan=p.maCan WHERE h.maPhong IS NULL OR p.maPhong IS NULL OR c.maCan IS NULL`,
  reservationBuilding: `SELECT COUNT(*) violations FROM DatGiuPhong g LEFT JOIN PhongTro p ON p.maPhong=g.maPhong LEFT JOIN CanTro c ON c.maCan=p.maCan WHERE g.maPhong IS NULL OR p.maPhong IS NULL OR c.maCan IS NULL`,
  meterReadingBuilding: `SELECT COUNT(*) violations FROM ChiSoDien d LEFT JOIN PhongTro p ON p.maPhong=d.maPhong LEFT JOIN CanTro c ON c.maCan=p.maCan WHERE d.maPhong IS NULL OR p.maPhong IS NULL OR c.maCan IS NULL`,
  billBuilding: `SELECT COUNT(*) violations FROM ThanhToan t LEFT JOIN HopDong h ON h.maHopDong=t.maHopDong LEFT JOIN PhongTro p ON p.maPhong=h.maPhong LEFT JOIN CanTro c ON c.maCan=p.maCan WHERE t.maHopDong IS NULL OR h.maHopDong IS NULL OR p.maPhong IS NULL OR c.maCan IS NULL`,
};

(async () => {
  const connection = await mysql.createConnection(options); const result = {};
  for (const [name, sql] of Object.entries(checks)) result[name] = Number((await connection.query(sql))[0][0].violations);
  result.reportProfitArithmetic = 0;
  result.reportExpenseAllocation = 0;
  const [owners] = await connection.query("SELECT maChuTro FROM ChuTro");
  for (const owner of owners) {
    const [buildings] = await connection.query("SELECT maCan FROM CanTro WHERE maChuTro=?", [owner.maChuTro]);
    const ownedBuildingIds = buildings.map((row) => row.maCan);
    const report = await getCashflow({ from: "1900-01-01", to: "2100-12-31", ownedBuildingIds });
    if (Math.abs(report.totalRevenue - report.totalExpenses - report.profit) > 0.001) result.reportProfitArithmetic += 1;
    const [scope] = await connection.query(
      "SELECT COALESCE(SUM(k.soTien),0) expected FROM KhoanChi k LEFT JOIN CanTro c ON c.maCan=k.maCan WHERE k.trangThai='HIEU_LUC' AND k.ngayPhatSinh BETWEEN '1900-01-01' AND '2100-12-31' AND (k.maCan IS NULL OR c.maChuTro=?)",
      [owner.maChuTro],
    );
    if (Math.abs(report.totalExpenses + report.unassignedExpenses.total - Number(scope[0].expected)) > 0.001) result.reportExpenseAllocation += 1;
  }
  await connection.end(); console.log(JSON.stringify(result));
  if (Object.values(result).some((value) => value !== 0)) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
