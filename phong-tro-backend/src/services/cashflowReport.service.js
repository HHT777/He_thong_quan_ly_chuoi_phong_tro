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
  const from = parseDate(filters.from, "from");
  const to = parseDate(filters.to, "to");
  const date = buildDateCondition(from, to);
  const receiptWhere = { trang_thai_ghi_nhan: "HIEU_LUC" };
  const expenseWhere = {};
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
  return {
    totalCollected: receipts.reduce((sum, row) => sum + Number(row.so_tien), 0),
    totalExpenses: expenses.reduce((sum, row) => sum + Number(row.so_tien), 0),
    receipts,
    expenses,
  };
}

module.exports = { parseDate, buildDateCondition, buildWhere, getCashflow };
