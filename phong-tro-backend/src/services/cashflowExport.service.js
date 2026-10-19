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
  ];
  const details = report.receiptDetails || [];
  const receipts = details.filter((row) => row.source !== "CHI_PHI");
  const expenses = details.filter((row) => row.source === "CHI_PHI");
  const columns = ["Căn", "Phòng", "Loại", "Số tiền", "Ngày"];
  const row = (item) => [item.buildingId || "", item.roomId || "", item.type || item.source, item.amount, item.date || ""];
  if (Math.max(overview.length, receipts.length + 1, expenses.length + 1) > MAX_ROWS) {
    throw Object.assign(new Error("Báo cáo vượt giới hạn dòng"), { status: 413, code: "REPORT_EXPORT_TOO_LARGE" });
  }
  return [
    { name: "Tong quan", rows: overview },
    { name: "Thu", rows: [columns, ...receipts.map(row)] },
    { name: "Chi", rows: [columns, ...expenses.map(row)] },
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
