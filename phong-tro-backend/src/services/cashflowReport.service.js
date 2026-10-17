const { Op } = require("sequelize");
const {
  KhoanThu,
  KhoanChi,
  GiaoDichThanhToan,
  ThanhToan,
  ChiTietThanhToan,
  BienBanTraPhong,
  HopDong,
  PhongTro,
  CanTro,
} = require("../models");

function parseDate(value, field) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw { status: 400, code: "INVALID_REPORT_PERIOD", message: `${field} phải có định dạng YYYY-MM-DD` };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw { status: 400, code: "INVALID_REPORT_PERIOD", message: `${field} không phải ngày hợp lệ` };
  }
  return value;
}

function buildDateCondition(from, to) {
  if (from && to && from > to) {
    throw { status: 400, code: "INVALID_REPORT_PERIOD", message: "from không được sau to" };
  }
  if (from && to) return { [Op.between]: [from, to] };
  if (from) return { [Op.gte]: from };
  if (to) return { [Op.lte]: to };
  return undefined;
}

function normalizeFilters(filters = {}) {
  const bad = (code, message) => { throw { status: 400, code, message }; };
  const hasType = filters.periodType !== undefined;
  const hasValue = filters.periodValue !== undefined;
  const hasDates = filters.from !== undefined || filters.to !== undefined;
  if (hasType !== hasValue) bad("REPORT_PERIOD_INCOMPLETE", "Cần cung cấp đủ loại kỳ và giá trị kỳ báo cáo");
  if (hasType && hasDates) bad("REPORT_PERIOD_CONFLICT", "Không dùng kỳ báo cáo cùng khoảng ngày");
  if (hasType) {
    const type = filters.periodType;
    const value = filters.periodValue;
    if (!["month", "quarter", "year"].includes(type)) bad("REPORT_PERIOD_TYPE_INVALID", "Loại kỳ báo cáo không hợp lệ");
    if (typeof value !== "string") bad("REPORT_PERIOD_VALUE_INVALID", "Giá trị kỳ báo cáo không hợp lệ");
    const year = Number(value.slice(0, 4));
    const validYear = year >= 1900 && year <= 2100;
    if (!validYear || (type === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
      || (type === "quarter" && !/^\d{4}-[1-4]$/.test(value))
      || (type === "year" && !/^\d{4}$/.test(value))) bad("REPORT_PERIOD_VALUE_INVALID", "Giá trị kỳ báo cáo không hợp lệ");
    if (type === "month") { const month = Number(value.slice(5)); return { ...filters, from: `${value}-01`, to: `${value}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}` }; }
    if (type === "quarter") { const start = (Number(value.slice(5)) - 1) * 3 + 1; const end = start + 2; return { ...filters, from: `${year}-${String(start).padStart(2, "0")}-01`, to: `${year}-${String(end).padStart(2, "0")}-${new Date(Date.UTC(year, end, 0)).getUTCDate()}` }; }
    return { ...filters, from: `${value}-01-01`, to: `${value}-12-31` };
  }
  if (hasDates) return filters;
  // SRS UC-19 / FR-132: default to the current month in Vietnam.
  const now = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
  return normalizeFilters({ ...filters, periodType: "month", periodValue: now });
}

function buildWhere(filters = {}) {
  filters = normalizeFilters(filters);
  if (filters.buildingId !== undefined && (typeof filters.buildingId !== "string" || !/^[0-9a-fA-F-]{36}$/.test(filters.buildingId))) {
    throw { status: 400, code: "INVALID_REPORT_BUILDING", message: "Mã căn trọ không hợp lệ" };
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
          include: [
            { model: ChiTietThanhToan, as: "chiTiets", required: false },
            {
              model: HopDong,
              as: "hopDong",
              required: false,
              include: [{ model: PhongTro, as: "phongTro", required: false }],
            },
          ],
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
  const buildingIds = [...new Set([
    ...receipts.map((row) => row.ma_can),
    ...expenses.map((row) => row.ma_can),
    ...reports.map((row) => row.hopDong?.phongTro?.ma_can),
  ].filter(Boolean))];
  const buildings = buildingIds.length ? await CanTro.findAll({ where: { ma_can: { [Op.in]: buildingIds } } }) : [];
  return summarizeCashflow({ receipts, expenses, reports, buildings });
}

function summarizeCashflow({ receipts, expenses, reports, buildings = [] }) {
  const allocations = allocateReceipts(receipts);
  const cashReceipts = receipts.reduce((sum, row) => sum + Number(row.so_tien), 0);
  const grossCashRevenue = allocations.reduce((sum, row) => sum + row.gross, 0);
  const discounts = allocations.reduce((sum, row) => sum + row.discount, 0);
  const depositDeductions = reports.reduce(
    (sum, row) => sum + Math.min(Number(row.tien_coc_ban_dau || 0), Number(row.tong_khoan_khau_tru || 0)),
    0,
  );
  // API contract: totalRevenue/totalCollected are effective cash received
  // (KhoanThu, already net of discount) plus deposit deductions/other
  // non-refundable income. grossRevenue is the explicit pre-discount view.
  const totalRevenue = cashReceipts + depositDeductions;
  const grossRevenue = totalRevenue + discounts;
  const totalExpenses = expenses.reduce((sum, row) => sum + Number(row.so_tien), 0);
  const revenueByType = Object.values(allocations.reduce((all, row) => {
    for (const [key, amount] of Object.entries(row.netByType || row.byType)) {
      all[key] = all[key] || { type: key, amount: 0 };
      all[key].amount += amount;
    }
    return all;
  }, {}));
  if (depositDeductions > 0) revenueByType.push({ type: "KHAU_TRU_COC", amount: depositDeductions });
  const expensesByType = Object.values(expenses.reduce((all, row) => { const key = row.loai_khoan_chi; all[key] = all[key] || { type: key, amount: 0 }; all[key].amount += Number(row.so_tien); return all; }, {}));
  const expenseDetails = expenses.map((row) => ({ source: "CHI_PHI", amount: Number(row.so_tien), date: row.ngay_phat_sinh, expenseId: row.ma_khoan_chi, buildingId: row.ma_can || null, roomId: null, incidentId: row.ma_su_co || null }));
  const statusByBuilding = new Map(buildings.map((row) => [row.ma_can, row.trang_thai]));
  const comparison = {};
  const buildingRow = (buildingId) => {
    const key = buildingId || "TOAN_CHUOI";
    comparison[key] ||= { buildingId: buildingId || null, revenue: 0, grossRevenue: 0, discounts: 0, depositDeductions: 0, expenses: 0 };
    return comparison[key];
  };
  for (const item of allocations) {
    const row = buildingRow(item.buildingId);
    row.revenue += item.gross - item.discount;
    row.grossRevenue += item.gross;
    row.discounts += item.discount;
  }
  for (const report of reports) {
    const amount = Math.min(Number(report.tien_coc_ban_dau || 0), Number(report.tong_khoan_khau_tru || 0));
    if (amount <= 0) continue;
    const row = buildingRow(report.hopDong?.phongTro?.ma_can || null);
    row.revenue += amount;
    row.grossRevenue += amount;
    row.depositDeductions += amount;
  }
  for (const row of expenses) {
    buildingRow(row.ma_can).expenses += Number(row.so_tien);
  }
  const byBuilding = Object.values(comparison).map((row) => ({
    ...row,
    inComparison: row.buildingId ? statusByBuilding.get(row.buildingId) === "HOAT_DONG" : false,
    profit: row.revenue - row.expenses,
  }));
  const receiptDetails = [
    ...receipts.map((row) => {
      const allocation = allocations.find((item) => item.receiptId === row.ma_khoan_thu);
      const grossAmount = allocation?.gross || Number(row.so_tien);
      const discountAllocated = allocation?.discount || 0;
      return ({
      source: "THU_TIEN", amount: grossAmount - discountAllocated, grossAmount, discountAllocated,
      date: row.ngay_ghi_nhan,
      receiptId: row.ma_khoan_thu,
      snapshotSource: allocation?.snapshotSource || "SUY_DIEN",
      snapshotFallback: allocation?.snapshotFallback ?? true,
      reportId: null,
      roomId: row.giaoDich?.thanhToan?.hopDong?.phongTro?.ma_phong || null,
      buildingId: row.ma_can,
    }); }),
    ...reports.map((row) => ({
      source: "KHAU_TRU_COC",
      amount: Math.min(Number(row.tien_coc_ban_dau || 0), Number(row.tong_khoan_khau_tru || 0)),
      grossAmount: Math.min(Number(row.tien_coc_ban_dau || 0), Number(row.tong_khoan_khau_tru || 0)),
      discountAllocated: 0,
      snapshotSource: null,
      date: row.ngay_quyet_toan,
      receiptId: null,
      reportId: row.ma_bien_ban,
      roomId: row.hopDong?.phongTro?.ma_phong || null,
      buildingId: row.hopDong?.phongTro?.ma_can || null,
    })).filter((row) => row.amount > 0),
  ];
  return {
    cashReceipts,
    discounts,
    depositDeductions,
    totalRevenue,
    totalCollected: totalRevenue,
    totalExpenses,
    grossRevenue,
    grossCashRevenue,
    profit: totalRevenue - totalExpenses,
    revenueByType, expensesByType,
    byBuilding, receiptDetails: [...receiptDetails, ...expenseDetails], expenseDetails,
    receipts,
    expenses,
  };
}

function allocateReceipts(receipts) {
  const groups = new Map();
  for (const row of receipts) {
    const bill = row.giaoDich?.thanhToan;
    const key = bill?.ma_thanh_toan || `receipt:${row.ma_khoan_thu}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, bill });
  }
  const result = [];
  for (const entries of groups.values()) {
    entries.sort((a, b) => new Date(a.row.ngay_ghi_nhan) - new Date(b.row.ngay_ghi_nhan));
    const lines = entries[0].bill?.chiTiets || [];
    const grossLines = lines.filter((line) => line.loai_khoan !== "GIAM_TRU");
    const grossTotal = grossLines.reduce((sum, line) => sum + Math.max(0, Number(line.so_tien)), 0) || entries.reduce((sum, item) => sum + Number(item.row.so_tien), 0);
    const discountTotal = lines.filter((line) => line.loai_khoan === "GIAM_TRU").reduce((sum, line) => sum + Math.abs(Number(line.so_tien)), 0);
    // Allocate against the bill's immutable net payable, not the set of
    // receipts currently visible in the report period. This keeps an earlier
    // payment's gross/discount attribution stable when a later payment lands.
    const netTotal = Number(entries[0].bill?.tong_phai_tra) > 0
      ? Number(entries[0].bill.tong_phai_tra)
      : (grossTotal - discountTotal || entries.reduce((sum, item) => sum + Number(item.row.so_tien), 0));
    let cumulative = 0;
    let grossAssigned = 0; let discountAssigned = 0;
    entries.forEach((item, index) => {
      const hasSnapshot = item.row.doanh_thu_gop !== null && item.row.doanh_thu_gop !== undefined
        && item.row.giam_tru_phan_bo !== null && item.row.giam_tru_phan_bo !== undefined;
      cumulative += Number(item.row.so_tien);
      const last = index === entries.length - 1 && cumulative >= netTotal;
      const gross = hasSnapshot ? Number(item.row.doanh_thu_gop) : (last ? grossTotal - grossAssigned : Math.round(Number(item.row.so_tien) * grossTotal / (netTotal || 1)));
      const discount = hasSnapshot ? Number(item.row.giam_tru_phan_bo) : (last ? discountTotal - discountAssigned : Math.round(Number(item.row.so_tien) * discountTotal / (netTotal || 1)));
      grossAssigned += gross; discountAssigned += discount;
      const byType = {};
      for (const line of grossLines) {
        const amount = last ? Math.max(0, Number(line.so_tien)) : Math.round(Math.max(0, Number(line.so_tien)) * gross / (grossTotal || 1));
        byType[line.loai_khoan] = (byType[line.loai_khoan] || 0) + amount;
      }
      if (!grossLines.length) byType.THANH_TOAN = gross;
      const typeEntries = Object.entries(byType);
      const netByType = {};
      let netAssigned = 0;
      typeEntries.forEach(([type, amount], typeIndex) => {
        const net = typeIndex === typeEntries.length - 1
          ? (gross - discount) - netAssigned
          : Math.round((gross - discount) * amount / (gross || 1));
        netByType[type] = net;
        netAssigned += net;
      });
      result.push({ receiptId: item.row.ma_khoan_thu, gross, discount, byType, netByType, buildingId: item.row.ma_can || null, snapshotSource: item.row.nguon_snapshot || null, snapshotFallback: !hasSnapshot });
    });
  }
  return result;
}

module.exports = { parseDate, buildDateCondition, buildWhere, getCashflow, allocateReceipts, summarizeCashflow };
