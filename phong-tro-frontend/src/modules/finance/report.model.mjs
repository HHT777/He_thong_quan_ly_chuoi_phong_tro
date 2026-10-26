const number = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export const REPORT_MODES = ["month", "quarter", "year", "range"];
export const REVENUE_LABELS = Object.freeze({
  TIEN_PHONG: "Tiền phòng",
  TIEN_DIEN: "Tiền điện",
  TIEN_NUOC: "Tiền nước",
  PHI_DICH_VU: "Phí dịch vụ",
  KHAU_TRU_COC: "Khấu trừ cọc",
  THU_KHAC: "Thu khác",
  SUA_CHUA: "Sửa chữa",
  PHI_PHAT_SINH: "Phí phát sinh",
  DIEU_CHINH_TANG: "Điều chỉnh tăng",
  NO_SAU_THANH_LY: "Nợ sau thanh lý",
});
export const EXPENSE_LABELS = Object.freeze({
  SUA_CHUA: "Sửa chữa", BAO_TRI: "Bảo trì", VE_SINH: "Vệ sinh",
  DIEN_CHUNG: "Điện chung", NUOC_CHUNG: "Nước chung", KHAC: "Khác",
});
export const SOURCE_LABELS = Object.freeze({
  THU_TIEN: "Thu tiền",
  KHAU_TRU_COC: "Khấu trừ cọc",
  CHI_PHI: "Chi phí",
});

export function reportMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `${amount < 0 ? "−" : ""}${number.format(Math.abs(amount))} đ`;
}

export function readCashflow(response) {
  const data = response?.data;
  const moneyFields = ["totalRevenue", "grossRevenue", "discounts", "depositDeductions", "totalExpenses", "profit"];
  const rowFields = ["revenueByType", "byBuilding", "receiptDetails"];
  if (!data || moneyFields.some((key) => typeof data[key] !== "number" || !Number.isFinite(data[key]))
      || rowFields.some((key) => !Array.isArray(data[key]))) {
    throw new TypeError("Dữ liệu báo cáo trả về không hợp lệ.");
  }
  return data;
}

export function reportDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

export function revenueLabel(type) {
  const code = String(type || "").trim().toUpperCase().replace(/\s+/g, "_");
  return REVENUE_LABELS[code] || "Khác";
}

export function expenseLabel(type) {
  const code = String(type || "").trim().toUpperCase().replace(/\s+/g, "_");
  return EXPENSE_LABELS[code] || "Khác";
}

export function businessYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
}

export function availableYears(now = new Date()) {
  const year = Number(businessYearMonth(now).slice(0, 4));
  return Array.from({ length: 5 }, (_, index) => year - index);
}

export function filterYears(years, input) {
  const text = String(input || "");
  if (!/^\d*$/.test(text)) return [];
  return years.filter((year) => String(year).includes(text));
}

export function periodOptions(year, today = businessYearMonth()) {
  const [currentYear, currentMonth] = today.split("-").map(Number);
  return [
    { value: "year", label: "Cả năm", disabled: false },
    ...Array.from({ length: 4 }, (_, index) => ({ value: `quarter-${index + 1}`, label: `Quý ${index + 1}`, disabled: Number(year) === currentYear && index * 3 + 1 > currentMonth })),
    ...Array.from({ length: 12 }, (_, index) => ({ value: `month-${index + 1}`, label: `Tháng ${index + 1}`, disabled: Number(year) === currentYear && index + 1 > currentMonth })),
  ];
}

export function validPeriod(year, period, today = businessYearMonth()) {
  const options = periodOptions(year, today);
  if (options.some((item) => item.value === period && !item.disabled)) return period;
  return Number(year) === Number(today.slice(0, 4)) ? `month-${Number(today.slice(5))}` : "year";
}

export function selectionFields({ year, period, buildingId = "" }) {
  const [mode, unit] = String(period).split("-");
  const base = { mode, buildingId };
  if (mode === "year") return { ...base, year: String(year) };
  if (mode === "quarter") return { ...base, quarterYear: String(year), quarter: unit };
  if (mode === "month") return { ...base, month: `${year}-${String(unit).padStart(2, "0")}` };
  throw new Error("Kỳ báo cáo không hợp lệ.");
}

export function monthsForPeriod({ year, period }) {
  const [mode, unit] = String(period).split("-");
  const start = mode === "month" ? Number(unit) - 5 : mode === "quarter" ? (Number(unit) - 1) * 3 + 1 : 1;
  const count = mode === "month" ? 6 : mode === "quarter" ? 3 : 12;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(Number(year), start - 1 + index, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

// Apportion 1000 tenths using the largest remainders; no money is recalculated.
export function sharesToOneDecimal(amounts) {
  const values = amounts.map((amount) => Math.max(0, Number(amount) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return values.map(() => 0);
  const exact = values.map((value) => value / total * 1000);
  const units = exact.map(Math.floor);
  let remainder = 1000 - units.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - units[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) units[order[index].index] += 1;
  return units.map((value) => value / 10);
}

export function reportQuery(fields) {
  const mode = fields.mode;
  if (!REPORT_MODES.includes(mode)) throw new Error("Loại kỳ báo cáo không hợp lệ.");
  const query = new URLSearchParams();
  if (fields.buildingId) query.set("buildingId", fields.buildingId);
  if (mode === "range") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(fields.to || "") || fields.from > fields.to) {
      throw new Error("Cần chọn ngày bắt đầu và kết thúc hợp lệ.");
    }
    query.set("from", fields.from);
    query.set("to", fields.to);
  } else {
    let periodValue = "";
    if (mode === "month") periodValue = fields.month;
    if (mode === "quarter") periodValue = `${fields.quarterYear}-${fields.quarter}`;
    if (mode === "year") periodValue = fields.year;
    const valid = mode === "month" ? /^\d{4}-(0[1-9]|1[0-2])$/.test(periodValue || "")
      : mode === "quarter" ? /^\d{4}-[1-4]$/.test(periodValue || "") : /^\d{4}$/.test(periodValue || "");
    if (!valid) throw new Error("Kỳ báo cáo không hợp lệ.");
    query.set("periodType", mode);
    query.set("periodValue", periodValue);
  }
  return query;
}

export function periodLabel(fields) {
  if (fields.mode === "month") {
    const [year, month] = fields.month.split("-");
    return `Tháng ${Number(month)}/${year}`;
  }
  if (fields.mode === "quarter") return `Quý ${fields.quarter}/${fields.quarterYear}`;
  if (fields.mode === "year") return `Năm ${fields.year}`;
  return `${reportDate(fields.from)} – ${reportDate(fields.to)}`;
}

export function estimatedRows(rows) {
  return (rows || []).filter((row) => row.source === "THU_TIEN" && (row.snapshotSource === "SUY_DIEN" || row.snapshotFallback === true));
}

export function filterTransactions(rows, { buildingId = "", query = "", estimatedOnly = false } = {}, buildingNames = new Map()) {
  const needle = query.trim().toLocaleLowerCase("vi-VN");
  return (rows || []).filter((row) => {
    if (buildingId && row.buildingId !== buildingId) return false;
    if (estimatedOnly && !estimatedRows([row]).length) return false;
    if (!needle) return true;
    const building = buildingNames.get(row.buildingId) || (row.buildingId ? "" : "Chưa phân căn");
    const haystack = `${building} ${SOURCE_LABELS[row.source] || row.source || ""} ${row.type || ""}`.toLocaleLowerCase("vi-VN");
    return haystack.includes(needle);
  });
}

export function sortedRevenueTypes(rows) {
  return [...(rows || [])].sort((a, b) => Number(b.amount) - Number(a.amount));
}

export function share(value, total) {
  return total > 0 ? `${percent.format(Number(value) * 100 / total)}%` : "0%";
}

export function chartScale(rows) {
  const values = rows.flatMap((row) => [Number(row.totalRevenue), Number(row.totalExpenses), Number(row.profit)]);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = Math.max(1, max - min);
  return { max, min, y: (value) => 30 + (max - Number(value)) / span * 170 };
}
