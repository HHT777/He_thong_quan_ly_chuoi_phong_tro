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
  return REVENUE_LABELS[type] || String(type || "Loại khác").replaceAll("_", " ").toLocaleLowerCase("vi-VN");
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
