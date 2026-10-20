const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { getLandlordProfile } = require("./ownership.service");
const { businessMonth } = require("../utils/businessDate.util");

const ROOM_STATUSES = Object.freeze([
  "TRONG", "DA_GIU", "DANG_THUE", "DANG_XU_LY_TRA_PHONG", "NGUNG_SU_DUNG",
]);

function resolvePeriod(value, now = new Date()) {
  const period = value === undefined ? businessMonth(now) : value;
  if (typeof period !== "string" || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period)) {
    throw Object.assign(new Error("Kỳ báo cáo không hợp lệ"), { status: 400, code: "INVALID_PERIOD" });
  }
  return period;
}

function roomSummary(rows) {
  const byStatus = Object.fromEntries([...ROOM_STATUSES, "KHAC"].map((status) => [status, 0]));
  for (const row of rows) {
    const status = ROOM_STATUSES.includes(row.status) ? row.status : "KHAC";
    byStatus[status] += Number(row.count);
  }
  return { total: Object.values(byStatus).reduce((sum, count) => sum + count, 0), byStatus };
}

async function getDashboardSummary(requester, periodValue) {
  const period = resolvePeriod(periodValue);
  const owner = await getLandlordProfile(requester);
  const [year, month] = period.split("-").map(Number);
  const replacements = { ownerId: owner.ma_chu_tro, year, month };
  const roomRows = await sequelize.query(`
    SELECT p.trangThai AS status, COUNT(*) AS count
    FROM PhongTro p INNER JOIN CanTro c ON c.maCan = p.maCan
    WHERE c.maChuTro = :ownerId
    GROUP BY p.trangThai
  `, { replacements, type: QueryTypes.SELECT });
  const billRows = await sequelize.query(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(t.soTienConNo = 0), 0) AS daThu,
      COALESCE(SUM(t.soTienConNo > 0 AND t.quaHan = 0), 0) AS conNo,
      COALESCE(SUM(t.soTienConNo > 0 AND t.quaHan = 1), 0) AS quaHan
    FROM ThanhToan t
    INNER JOIN HopDong h ON h.maHopDong = t.maHopDong
    INNER JOIN PhongTro p ON p.maPhong = h.maPhong
    INNER JOIN CanTro c ON c.maCan = p.maCan
    WHERE c.maChuTro = :ownerId AND t.loaiThanhToan = 'DINH_KY'
      AND t.nam = :year AND t.thang = :month
  `, { replacements, type: QueryTypes.SELECT });
  const bill = billRows[0];
  // quaHan is set by the debt cron (overdueDay defaults to day 6). A settled
  // bill is never counted as overdue, even when its historical flag remains set.
  const bills = {
    total: Number(bill.total), daThu: Number(bill.daThu),
    conNo: Number(bill.conNo), quaHan: Number(bill.quaHan),
  };
  if (bills.daThu + bills.conNo + bills.quaHan !== bills.total) {
    throw new Error("Dashboard bill partition mismatch");
  }
  return {
    period,
    rooms: roomSummary(roomRows),
    bills,
  };
}

module.exports = { ROOM_STATUSES, resolvePeriod, roomSummary, getDashboardSummary };
