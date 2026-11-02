const { getCashflow, normalizeFilters, parseDate } = require("./cashflowReport.service");
const { writeWorkbook, MAX_ROWS } = require("../utils/xlsxWriter.util");

function periodToken(filters) {
  const normalized = normalizeFilters(filters);
  let token;
  if (normalized.periodType) {
    token = `${normalized.periodType}_${normalized.periodValue}`;
  } else {
    token = `${parseDate(normalized.from, "from") || "start"}_${parseDate(normalized.to, "to") || "end"}`;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error("Invalid export period token");
  return token;
}

function workbookSheets(report, filters) {
  const overview = [
    ["Chỉ số", "Giá trị"],
    ["Kỳ báo cáo", periodToken(filters)],
    ["Từ ngày", normalizeFilters(filters).from || ""],
    ["Đến ngày", normalizeFilters(filters).to || ""],
    ["Căn", filters.buildingId || "Toàn chuỗi của Chủ trọ"],
    ["Doanh thu thực nhận", report.totalRevenue],
    ["Doanh thu gộp", report.grossRevenue],
    ["Giảm trừ", report.discounts],
    ["Khấu trừ cọc", report.depositDeductions],
    ["Chi phí", report.totalExpenses],
    ["Lợi nhuận", report.profit],
    ["Số khoản chi chưa phân căn", report.unassignedExpenses?.count ?? 0],
    ["Chi phí chưa phân căn", report.unassignedExpenses?.total ?? 0],
  ];
  const details = report.receiptDetails || [];
  const receipts = details.filter((row) => row.source !== "CHI_PHI");
  const expenses = details.filter((row) => row.source === "CHI_PHI");
  const expenseColumns = ["Căn", "Phòng", "Loại", "Số tiền", "Ngày"];
  const expenseRow = (item) => [item.buildingId || "", item.roomId || "", item.type || item.source, item.amount, item.date || ""];
  const receiptColumns = ["Căn", "Phòng", "Nguồn", "Số tiền", "Ngày", "Doanh thu gộp", "Giảm trừ phân bổ", "Nguồn snapshot"];
  const receiptRow = (item) => [item.buildingId || "", item.roomId || "", item.source, item.amount, item.date || "", item.grossAmount, item.discountAllocated, item.snapshotSource || ""];
  const typeRows = (report.revenueByType || []).map((item) => [item.type, item.amount]);
  const buildingRows = (report.byBuilding || []).map((item) => [item.buildingId || "", item.inComparison, item.revenue, item.grossRevenue, item.discounts, item.depositDeductions, item.expenses, item.profit]);
  if (Math.max(overview.length, typeRows.length + 1, buildingRows.length + 1, receipts.length + 1, expenses.length + 1) > MAX_ROWS) {
    throw Object.assign(new Error("Báo cáo vượt giới hạn dòng"), { status: 413, code: "REPORT_EXPORT_TOO_LARGE" });
  }
  return [
    { name: "Tong quan", rows: overview },
    { name: "Theo loai", rows: [["Loại doanh thu", "Số tiền thực nhận"], ...typeRows] },
    { name: "Theo can", rows: [["Căn", "Tham gia so sánh", "Doanh thu thực nhận", "Doanh thu gộp", "Giảm trừ", "Khấu trừ cọc", "Chi phí", "Lợi nhuận"], ...buildingRows] },
    { name: "Thu", rows: [receiptColumns, ...receipts.map(receiptRow)] },
    { name: "Chi", rows: [expenseColumns, ...expenses.map(expenseRow)] },
  ];
}

async function exportCashflow(filters) {
  // Pin the default Vietnam business month once, including at midnight.
  const normalized = normalizeFilters(filters);
  const effectiveFilters = normalized.periodType && filters.periodType === undefined
    ? { ...filters, periodType: normalized.periodType, periodValue: normalized.periodValue }
    : filters;
  const report = await getCashflow({ ...effectiveFilters, maxDetailRows: MAX_ROWS - 1 });
  const filename = `bao-cao-thu-chi_${periodToken(effectiveFilters)}.xlsx`;
  return { filename, buffer: writeWorkbook(workbookSheets(report, effectiveFilters)) };
}

module.exports = { periodToken, workbookSheets, exportCashflow };
