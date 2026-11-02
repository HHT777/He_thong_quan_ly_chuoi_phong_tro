import { monthsForPeriod, readCashflow, reportQuery, selectionFields } from "./report.model.mjs";

export function reportUrlState(hash, years, today) {
  const params = new URLSearchParams(String(hash || "").split("?")[1] || "");
  const currentYear = Number(today.slice(0, 4));
  const year = years.includes(Number(params.get("year"))) ? Number(params.get("year")) : currentYear;
  const period = params.get("period") || `month-${Number(today.slice(5))}`;
  const selectedPeriod = period === "year" || /^(month|quarter)-\d{1,2}$/.test(period) ? period : `month-${Number(today.slice(5))}`;
  return { year, period: selectedPeriod, buildingId: params.get("buildingId") || "", view: ["chart", "table", "compare"].includes(params.get("view")) ? params.get("view") : "chart", metric: ["revenue", "expenses", "profit"].includes(params.get("metric")) ? params.get("metric") : "" };
}

export function reportHash(state) {
  const params = new URLSearchParams({ year: String(state.year), period: state.period, view: state.view });
  if (state.buildingId) params.set("buildingId", state.buildingId);
  if (state.metric) params.set("metric", state.metric);
  return `#/finance/reports?${params}`;
}

export function cashflowPath(selection) {
  return `/v1/reports/cashflow?${reportQuery(selectionFields(selection))}`;
}

export async function loadReportTrend(api, selection, signal) {
  const months = monthsForPeriod(selection);
  if (selection.period.startsWith("month-")) {
    const query = new URLSearchParams({ period: months.at(-1) });
    if (selection.buildingId) query.set("buildingId", selection.buildingId);
    const response = await api.request(`/v1/dashboard/insights?${query}`, { signal });
    const list = response?.data?.cashflow6m;
    if (!Array.isArray(list)) throw new TypeError("Dữ liệu xu hướng trả về không hợp lệ.");
    const byMonth = new Map(list.map((row) => [row.month, row]));
    return months.map((month) => byMonth.get(month) || { month, totalRevenue: 0, totalExpenses: 0, profit: 0 });
  }
  const rows = [];
  for (let index = 0; index < months.length; index += 3) {
    const batch = months.slice(index, index + 3);
    const responses = await Promise.all(batch.map((month) => api.request(`/v1/reports/cashflow?${reportQuery({ mode: "month", month, buildingId: selection.buildingId })}`, { signal })));
    responses.forEach((response, offset) => {
      const data = readCashflow(response);
      rows.push({ month: batch[offset], totalRevenue: data.totalRevenue, totalExpenses: data.totalExpenses, profit: data.profit });
    });
  }
  return rows;
}
