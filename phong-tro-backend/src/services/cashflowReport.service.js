const { Op } = require("sequelize");
const {
  KhoanThu,
  KhoanChi,
  GiaoDichThanhToan,
  ThanhToan,
  BienBanTraPhong,
  HopDong,
  PhongTro,
} = require("../models");

function parseDate(value, field) {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw { status: 422, code: "INVALID_REPORT_PERIOD", message: `${field} phải có định dạng YYYY-MM-DD` };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw { status: 422, code: "INVALID_REPORT_PERIOD", message: `${field} không phải ngày hợp lệ` };
  }
  return value;
}

function buildDateCondition(from, to) {
  if (from && to && from > to) {
    throw { status: 422, code: "INVALID_REPORT_PERIOD", message: "from không được sau to" };
  }
  if (from && to) return { [Op.between]: [from, to] };
  if (from) return { [Op.gte]: from };
  if (to) return { [Op.lte]: to };
  return undefined;
}

function normalizeFilters(filters = {}) {
  if (filters.periodType && filters.periodValue && !filters.from && !filters.to) {
    const value = String(filters.periodValue);
    if (filters.periodType === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) { const [year, month] = value.split("-").map(Number); filters = { ...filters, from: `${value}-01`, to: `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` }; }
    if (filters.periodType === "quarter" && /^\d{4}-[1-4]$/.test(value)) { const [year, quarter] = value.split("-").map(Number); const start = (quarter - 1) * 3 + 1; const end = start + 2; filters = { ...filters, from: `${year}-${String(start).padStart(2, "0")}-01`, to: `${year}-${String(end).padStart(2, "0")}-${new Date(Date.UTC(year, end, 0)).getUTCDate()}` }; }
    if (filters.periodType === "year" && /^\d{4}$/.test(value)) filters = { ...filters, from: `${value}-01-01`, to: `${value}-12-31` };
  }
  return filters;
}

function buildWhere(filters = {}) {
  filters = normalizeFilters(filters);
  const from = parseDate(filters.from, "from");
  const to = parseDate(filters.to, "to");
  const date = buildDateCondition(from, to);
  const receiptWhere = { trang_thai_ghi_nhan: "HIEU_LUC" };
  const expenseWhere = { trang_thai: "HIEU_LUC" };
  if (date) {
    receiptWhere.ngay_ghi_nhan = date;
    expenseWhere.ngay_phat_sinh = date;
  }
  if (filters.buildingId !== undefined && String(filters.buildingId).trim()) {
    receiptWhere.ma_can = String(filters.buildingId).trim();
    expenseWhere.ma_can = String(filters.buildingId).trim();
  }
  return { receiptWhere, expenseWhere, reportDate: date, buildingId: filters.buildingId };
}

async function getCashflow(filters) {
  const { receiptWhere, expenseWhere, reportDate, buildingId } = buildWhere(filters);
  const roomWhere = buildingId !== undefined && String(buildingId).trim()
    ? { ma_can: String(buildingId).trim() }
    : undefined;
  const [receipts, expenses, reports] = await Promise.all([
    KhoanThu.findAll({
      where: receiptWhere,
      include: [{
        model: GiaoDichThanhToan,
        as: "giaoDich",
        required: false,
        include: [{
          model: ThanhToan,
          as: "thanhToan",
          required: false,
          include: [{
            model: HopDong,
            as: "hopDong",
            required: false,
            include: [{ model: PhongTro, as: "phongTro", required: false }],
          }],
        }],
      }],
      order: [["ngay_ghi_nhan", "DESC"]],
    }),
    KhoanChi.findAll({ where: expenseWhere, order: [["ngay_phat_sinh", "DESC"]] }),
    BienBanTraPhong.findAll({
      where: {
        la_du_lieu_legacy: false,
        ...(reportDate ? { ngay_quyet_toan: reportDate } : {}),
      },
      include: [{
        model: HopDong,
        as: "hopDong",
        required: true,
        include: [{ model: PhongTro, as: "phongTro", required: Boolean(roomWhere), where: roomWhere }],
      }],
      order: [["ngay_quyet_toan", "DESC"]],
    }),
  ]);
  const cashReceipts = receipts.reduce((sum, row) => sum + Number(row.so_tien), 0);
  const depositDeductions = reports.reduce(
    (sum, row) => sum + Math.min(Number(row.tien_coc_ban_dau || 0), Number(row.tong_khoan_khau_tru || 0)),
    0,
  );
  const totalRevenue = cashReceipts + depositDeductions;
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.so_tien), 0);
  const revenueByType = Object.values(receipts.reduce((all, row) => { const key = row.loai_khoan_thu; all[key] = all[key] || { type: key, amount: 0 }; all[key].amount += Number(row.so_tien); return all; }, {}));
  if (depositDeductions > 0) revenueByType.push({ type: "KHAU_TRU_COC", amount: depositDeductions });
  const expensesByType = Object.values(expenses.reduce((all, row) => { const key = row.loai_khoan_chi; all[key] = all[key] || { type: key, amount: 0 }; all[key].amount += Number(row.so_tien); return all; }, {}));
  const receiptDetails = [
    ...receipts.map((row) => ({
      source: "THU_TIEN",
      amount: Number(row.so_tien),
      date: row.ngay_ghi_nhan,
      receiptId: row.ma_khoan_thu,
      reportId: null,
      roomId: row.giaoDich?.thanhToan?.hopDong?.phongTro?.ma_phong || null,
      buildingId: row.ma_can,
    })),
    ...reports.map((row) => ({
      source: "KHAU_TRU_COC",
      amount: Math.min(Number(row.tien_coc_ban_dau || 0), Number(row.tong_khoan_khau_tru || 0)),
      date: row.ngay_quyet_toan,
      receiptId: null,
      reportId: row.ma_bien_ban,
      roomId: row.hopDong?.phongTro?.ma_phong || null,
      buildingId: row.hopDong?.phongTro?.ma_can || null,
    })).filter((row) => row.amount > 0),
  ];
  return {
    cashReceipts,
    depositDeductions,
    totalRevenue,
    totalCollected: totalRevenue,
    totalExpenses,
    profit: totalRevenue - totalExpenses,
    revenueByType, expensesByType,
    receiptDetails,
    receipts,
    expenses,
  };
}

module.exports = { parseDate, buildDateCondition, buildWhere, getCashflow };
