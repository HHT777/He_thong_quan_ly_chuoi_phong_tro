const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { getOwnedBuildingIds, notFoundError } = require("./ownership.service");
const { getPersistedSystemConfig } = require("./systemConfig.service");
const { getCashflow } = require("./cashflowReport.service");
const { getDashboardSummary } = require("./dashboardSummary.service");
const { businessDate, businessMonth, addBusinessDays } = require("../utils/businessDate.util");

const number = (value) => Number(value || 0);
const monthOffset = (month, offset) => {
  const [year, part] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, part - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
const invalidPeriod = () => Object.assign(new Error("Kỳ báo cáo không hợp lệ"), { status: 400, code: "INVALID_PERIOD" });

async function getDashboardInsights(requester, query = {}, now = new Date()) {
  if (Object.keys(query).some((key) => !["period", "buildingId"].includes(key))) throw invalidPeriod();
  const period = query.period === undefined ? businessMonth(now) : query.period;
  if (typeof period !== "string" || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(period)) throw invalidPeriod();
  const ownedBuildingIds = await getOwnedBuildingIds(requester);
  const buildingId = query.buildingId;
  if (buildingId !== undefined && !ownedBuildingIds.includes(buildingId)) throw notFoundError();
  const ids = buildingId ? [buildingId] : ownedBuildingIds;
  const today = businessDate(now);
  const month = businessMonth(now);
  const config = await getPersistedSystemConfig();
  const scope = { ids, today, month, d30: addBusinessDays(today, 30), d60: addBusinessDays(today, 60), d90: addBusinessDays(today, 90), warningEnd: addBusinessDays(today, config.contractWarningDays) };
  const select = (sql, replacements = scope) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  const empty = !ids.length;
  const inScope = (column) => `${column} IN (:ids)`;
  const cashflow6m = [];
  // Bounded seven calls, independent of the number of buildings or contracts.
  for (let offset = -5; offset <= 0; offset += 1) {
    const target = monthOffset(period, offset);
    const report = await getCashflow({ periodType: "month", periodValue: target, ownedBuildingIds, ...(buildingId ? { buildingId } : {}) });
    cashflow6m.push({ month: target, totalRevenue: report.totalRevenue, totalExpenses: report.totalExpenses,
      profit: report.profit, unassignedExpenses: report.unassignedExpenses });
  }
  const previous = await getCashflow({ periodType: "month", periodValue: monthOffset(period, -1), ownedBuildingIds, ...(buildingId ? { buildingId } : {}) });
  const currentRevenue = cashflow6m[5].totalRevenue;
  const revenueChangePct = previous.totalRevenue > 0
    ? Math.round(((currentRevenue - previous.totalRevenue) / previous.totalRevenue) * 10000) / 100 : null;
  const occupancyRows = empty ? [] : await select(`
    SELECT c.maCan AS buildingId, c.tenCan AS buildingName, c.trangThai AS buildingStatus,
      COUNT(p.maPhong) AS total, COALESCE(SUM(p.trangThai = 'DANG_THUE'), 0) AS rented
    FROM CanTro c LEFT JOIN PhongTro p ON p.maCan = c.maCan
    WHERE ${inScope("c.maCan")} GROUP BY c.maCan, c.tenCan, c.trangThai ORDER BY c.tenCan, c.maCan`);
  const occupancyByBuilding = occupancyRows.map((row) => ({ buildingId: row.buildingId, buildingName: row.buildingName,
    total: number(row.total), rented: number(row.rented), pct: number(row.total) ? Math.round(number(row.rented) * 10000 / number(row.total)) / 100 : 0,
    inComparison: row.buildingStatus === "HOAT_DONG" }));
  // Summary shares the exact actionDue rule with debt; scoped-building view uses
  // the same SQL partition with an additional ownership-checked building filter.
  let bills;
  if (!buildingId) {
    const summary = await getDashboardSummary(requester, period, now);
    bills = { paid: summary.bills.daThu, outstanding: summary.bills.conNo, overdue: summary.bills.quaHan, total: summary.bills.total };
  } else {
    const [year, part] = period.split("-").map(Number);
    const overdue = month < period ? 0 : month > period || (businessDate(now).slice(8) >= String(config.overdueDay).padStart(2, "0"));
    const [row] = await select(`SELECT COUNT(*) AS total, COALESCE(SUM(t.soTienConNo = 0),0) AS paid,
      COALESCE(SUM(t.soTienConNo > 0 AND :overdue = 0),0) AS outstanding,
      COALESCE(SUM(t.soTienConNo > 0 AND :overdue = 1),0) AS overdue
      FROM ThanhToan t JOIN HopDong h ON h.maHopDong=t.maHopDong JOIN PhongTro p ON p.maPhong=h.maPhong
      WHERE p.maCan IN (:ids) AND t.loaiThanhToan='DINH_KY' AND t.nam=:year AND t.thang=:part`, { ids, overdue: Number(overdue), year, part });
    bills = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, number(value)]));
  }
  if (bills.paid + bills.outstanding + bills.overdue !== bills.total) throw new Error("Dashboard bill partition mismatch");
  const [forecast] = empty ? [{ d30: 0, d60: 0, d90: 0, warning: 0 }] : await select(`
    SELECT COALESCE(SUM(h.ngayKetThuc BETWEEN :today AND :d30),0) AS d30,
      COALESCE(SUM(h.ngayKetThuc BETWEEN :today AND :d60),0) AS d60,
      COALESCE(SUM(h.ngayKetThuc BETWEEN :today AND :d90),0) AS d90,
      COALESCE(SUM(h.ngayKetThuc BETWEEN :today AND :warningEnd AND NOT EXISTS
        (SELECT 1 FROM YeuCauGiaHan yg JOIN YeuCau y ON y.maYeuCau=yg.maYeuCau
         WHERE yg.maHopDong=h.maHopDong AND y.trangThai='CHO_XU_LY')),0) AS warning
    FROM HopDong h JOIN PhongTro p ON p.maPhong=h.maPhong
    WHERE ${inScope("p.maCan")} AND h.trangThai IN ('DANG_HIEU_LUC','SAP_HET_HAN')`);
  const contractForecast = { d30: number(forecast.d30), d60: number(forecast.d60), d90: number(forecast.d90) };
  const [other] = empty ? [{ reservations: 0, incidents: 0, requests: 0, readings: 0, vacant: 0 }] : await Promise.all([
    select(`SELECT COUNT(*) AS reservations FROM DatGiuPhong d JOIN PhongTro p ON p.maPhong=d.maPhong
      WHERE ${inScope("p.maCan")} AND d.trangThai='DANG_GIU' AND d.hanGiu < :today`).then(([row]) => row),
    select(`SELECT COUNT(*) AS incidents FROM SuCo s JOIN PhongTro p ON p.maPhong=s.maPhong
      WHERE ${inScope("p.maCan")} AND s.trangThai='CHO_TIEP_NHAN' AND s.daXoa=0`).then(([row]) => row),
    select(`SELECT COUNT(DISTINCT y.maYeuCau) AS requests FROM YeuCau y JOIN HopDong h ON h.maKhachThue=y.maKhachThue
      JOIN PhongTro p ON p.maPhong=h.maPhong WHERE ${inScope("p.maCan")}
      AND y.trangThai='CHO_XU_LY' AND h.trangThai IN ('DANG_HIEU_LUC','SAP_HET_HAN')`).then(([row]) => row),
    select(`SELECT COUNT(*) AS readings FROM ChiSoDien e JOIN PhongTro p ON p.maPhong=e.maPhong
      WHERE ${inScope("p.maCan")} AND e.trangThaiXacNhan='CHO_XAC_NHAN' AND e.daXoa=0`).then(([row]) => row),
    select(`SELECT COUNT(*) AS vacant FROM PhongTro p WHERE ${inScope("p.maCan")} AND p.trangThai='TRONG'`).then(([row]) => row),
  ]).then(([reservations, incidents, requests, readings, vacant]) => [{ ...reservations, ...incidents, ...requests, ...readings, ...vacant }]);
  const tasks = [
    ["OVERDUE_BILLS", bills.overdue], ["EXPIRED_RESERVATIONS", other.reservations],
    ["NEW_INCIDENTS", other.incidents], ["PENDING_REQUESTS", other.requests],
    ["PENDING_METER_READINGS", other.readings], ["EXPIRING_CONTRACTS", forecast.warning],
    ["VACANT_ROOMS", other.vacant],
  ].map(([type, count]) => ({ type, count: number(count) }));
  return { period, cashflow6m, revenueChangePct, occupancyByBuilding,
    billBuckets: bills, contractForecast, tasks, contractWarningDays: config.contractWarningDays };
}

module.exports = { getDashboardInsights, monthOffset };
