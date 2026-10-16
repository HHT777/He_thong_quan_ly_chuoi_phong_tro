require("dotenv").config();
const mysql = require("mysql2/promise");

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
};

(async () => {
  const connection = await mysql.createConnection(options); const result = {};
  for (const [name, sql] of Object.entries(checks)) result[name] = Number((await connection.query(sql))[0][0].violations);
  await connection.end(); console.log(JSON.stringify(result));
  if (Object.values(result).some((value) => value !== 0)) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
