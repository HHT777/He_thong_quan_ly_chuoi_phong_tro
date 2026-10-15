const { Op } = require("sequelize");
const { KhoanThu, KhoanChi } = require("../models");

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

function buildWhere(filters = {}) {
  if (filters.periodType && filters.periodValue && !filters.from && !filters.to) {
    const value = String(filters.periodValue);
    if (filters.periodType === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) { const [year, month] = value.split("-").map(Number); filters = { ...filters, from: `${value}-01`, to: `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` }; }
    if (filters.periodType === "quarter" && /^\d{4}-[1-4]$/.test(value)) { const [year, quarter] = value.split("-").map(Number); const start = (quarter - 1) * 3 + 1; const end = start + 2; filters = { ...filters, from: `${year}-${String(start).padStart(2, "0")}-01`, to: `${year}-${String(end).padStart(2, "0")}-${new Date(Date.UTC(year, end, 0)).getUTCDate()}` }; }
    if (filters.periodType === "year" && /^\d{4}$/.test(value)) filters = { ...filters, from: `${value}-01-01`, to: `${value}-12-31` };
  }
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
  return { receiptWhere, expenseWhere };
}

async function getCashflow(filters) {
  const { receiptWhere, expenseWhere } = buildWhere(filters);
  const [receipts, expenses] = await Promise.all([
    KhoanThu.findAll({ where: receiptWhere, order: [["ngay_ghi_nhan", "DESC"]] }),
    KhoanChi.findAll({ where: expenseWhere, order: [["ngay_phat_sinh", "DESC"]] }),
  ]);
  const totalCollected = receipts.reduce((sum, row) => sum + Number(row.so_tien), 0);
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.so_tien), 0);
  const revenueByType = Object.values(receipts.reduce((all, row) => { const key = row.loai_khoan_thu; all[key] = all[key] || { type: key, amount: 0 }; all[key].amount += Number(row.so_tien); return all; }, {}));
  const expensesByType = Object.values(expenses.reduce((all, row) => { const key = row.loai_khoan_chi; all[key] = all[key] || { type: key, amount: 0 }; all[key].amount += Number(row.so_tien); return all; }, {}));
  return {
    totalCollected,
    totalExpenses,
    profit: totalCollected - totalExpenses,
    revenueByType, expensesByType,
    receipts,
    expenses,
  };
}

module.exports = { parseDate, buildDateCondition, buildWhere, getCashflow };
