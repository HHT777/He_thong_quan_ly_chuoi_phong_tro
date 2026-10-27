import { escapeHtml } from "../../shared/components/view.js";
import { estimatedRows, expenseLabel, periodLabel, reportDate, reportMoney, revenueLabel } from "./report.model.mjs";
import { buildingComparisonChart, overviewChart, profitBridgeChart, timeChart, typeChart } from "./report.charts.mjs";

const safe = escapeHtml;
const names = { revenue: "Doanh thu thực nhận", expenses: "Chi phí", profit: "Lợi nhuận" };
const amounts = { revenue: "totalRevenue", expenses: "totalExpenses", profit: "profit" };
const icon = {
  revenue: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6 9c1.4 0 2.5-1.1 2.5-2.5M18 15c-1.4 0-2.5 1.1-2.5 2.5M12 8v8m2-6.5c-.5-.8-1.3-1.2-2.3-1.2-1.2 0-2 .6-2 1.5 0 2.4 4.6 1 4.6 3.5 0 .9-.8 1.7-2.1 1.7-1 0-1.9-.4-2.5-1.3"/></svg>',
  expenses: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2.8h9l4 4v6.1M15 2.8v4h4M6 2.8v18.4l2.2-1.5 2.2 1.5 2.2-1.5 2.2 1.5 1.2-.8"/><path d="M8.5 10h6M8.5 13h4"/><circle cx="18" cy="17.5" r="4.2"/><path d="M16.3 17.5h3.4"/></svg>',
  profit: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 16 5-5 4 3 7-8"/><circle cx="4" cy="16" r="1.5" fill="currentColor"/><circle cx="9" cy="11" r="1.5" fill="currentColor"/><circle cx="13" cy="14" r="1.5" fill="currentColor"/><circle cx="20" cy="6" r="1.5" fill="currentColor"/></svg>',
};
const panel = (title, body) => `<section class="report-card report-focus-panel"><h2>${safe(title)}</h2>${body}</section>`;
const table = (headers, rows) => `<div class="report-table-scroll"><table class="report-table"><thead><tr>${headers.map((name) => `<th scope="col">${safe(name)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;

export function reportKpis(data, metric = "") {
  return `<div class="report-kpis">${Object.keys(names).map((id) => `<button type="button" class="report-kpi report-kpi--button ${metric === id ? "is-selected" : ""}" data-report-metric="${id}" aria-pressed="${metric === id}"><span class="report-kpi__icon" aria-hidden="true">${icon[id]}</span><span class="report-kpi__content"><span class="report-kpi__title">${names[id]}</span><strong>${reportMoney(data[amounts[id]])}</strong><small>${id === "revenue" ? `Gộp ${reportMoney(data.grossRevenue)} · Giảm trừ ${reportMoney(data.discounts)} · Khấu trừ cọc ${reportMoney(data.depositDeductions)}` : id === "expenses" ? "Chi phí phát sinh trong kỳ" : data.profit < 0 ? "Lỗ trong kỳ" : "Doanh thu thực nhận trừ chi phí"}</small></span></button>`).join("")}</div>`;
}

export function statusBlock({ status, error, retry, body = "", empty = "Chưa có dữ liệu trong kỳ." }) {
  if (status === "error") return `<div class="report-state" role="alert"><p>${safe(error?.message || "Không tải được dữ liệu.")}</p><button type="button" data-report-retry="${safe(retry)}">Thử lại</button></div>`;
  if (status === "loading" && !body) return '<div class="report-skeleton report-skeleton--chart" role="status" aria-label="Đang tải"></div>';
  return `<div class="${status === "loading" ? "report-block--loading" : ""}" ${status === "loading" ? 'aria-busy="true"' : ""}>${body || `<p class="report-empty">${safe(empty)}</p>`}</div>`;
}

function viewTabs(state) {
  const rows = [["chart", "Biểu đồ"], ["table", "Bảng chi tiết"], ["compare", "So sánh căn"]];
  return `<div class="report-segment report-view-toggle" role="group" aria-label="Kiểu xem">${rows.map(([id, label]) => `<button type="button" data-report-view="${id}" aria-pressed="${state.view === id}" class="${state.view === id ? "is-active" : ""}" ${id === "compare" && state.buildingCount < 2 ? 'disabled title="Cần ít nhất 2 căn"' : ""}>${label}</button>`).join("")}</div>`;
}

function detailTable(data, state, trend) {
  if (state.metric === "profit") return panel("Lợi nhuận theo tháng", trend?.length ? table(["Tháng", "Thực nhận", "Chi phí", "Lợi nhuận"], trend.map((row) => `<tr><td>${safe(row.month)}</td><td class="report-number">${reportMoney(row.totalRevenue)}</td><td class="report-number">${reportMoney(row.totalExpenses)}</td><td class="report-number">${reportMoney(row.profit)}</td></tr>`)) : '<p class="report-empty">Chưa có dữ liệu theo tháng.</p>');
  const rows = (data.receiptDetails || []).filter((row) => state.metric === "expenses" ? row.source === "CHI_PHI" : row.source !== "CHI_PHI");
  const filtered = rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (state.metric === "expenses") return panel("Các khoản chi", filtered.length ? table(["Ngày", "Loại chi", "Căn", "Số tiền"], filtered.map((row) => `<tr><td>${safe(reportDate(row.date))}</td><td>${safe(expenseLabel(row.type))}</td><td>${safe(state.buildingNames.get(row.buildingId) || "Chưa phân căn")}</td><td class="report-number">${reportMoney(row.amount)}</td></tr>`)) : '<p class="report-empty">Chưa có khoản chi trong kỳ.</p>');
  return panel(state.metric === "expenses" ? "Các khoản chi" : "Các khoản thu", filtered.length ? table(["Ngày", "Loại", "Căn", "Số tiền", "Số gộp", "Giảm trừ"], filtered.map((row) => `<tr><td>${safe(reportDate(row.date))}${estimatedRows([row]).length ? '<span class="report-estimated-dot" title="Dữ liệu lịch sử được suy diễn"> ●</span>' : ""}</td><td>${safe(state.metric === "expenses" ? "Chi phí" : revenueLabel(row.type || row.source))}</td><td>${safe(state.buildingNames.get(row.buildingId) || "Chưa phân căn")}</td><td class="report-number">${reportMoney(row.amount)}</td><td class="report-number">${row.source === "CHI_PHI" ? "—" : reportMoney(row.grossAmount)}</td><td class="report-number">${row.source === "CHI_PHI" ? "—" : reportMoney(row.discountAllocated)}</td></tr>`)) : '<p class="report-empty">Chưa có giao dịch trong kỳ.</p>');
}

function chartChoices(state) {
  const perspective = state.perspective[state.metric] || "time";
  const types = perspective === "time" ? [["bar", "Cột"], ["area", "Vùng"]] : state.metric === "profit" ? [["bar", "Cột so sánh"], ["pie", "Tròn"]] : [["horizontal", "Thanh ngang"], ["pie", "Tròn"]];
  const kind = types.some(([value]) => value === state.kinds[`${state.metric}:${perspective}`]) ? state.kinds[`${state.metric}:${perspective}`] : types[0][0];
  return `<div class="report-chart-tools"><div class="report-segment" role="tablist" aria-label="Góc nhìn"><button type="button" role="tab" data-report-perspective="time" aria-selected="${perspective === "time"}" class="${perspective === "time" ? "is-active" : ""}">Theo thời gian</button><button type="button" role="tab" data-report-perspective="other" aria-selected="${perspective === "other"}" class="${perspective === "other" ? "is-active" : ""}">${state.metric === "profit" ? "Từ thu đến lãi" : state.metric === "expenses" ? "Theo loại chi" : "Theo loại thu"}</button></div><div class="report-segment" role="group" aria-label="Dạng biểu đồ">${types.map(([value, label]) => `<button type="button" data-report-kind="${value}" aria-pressed="${kind === value}" class="${kind === value ? "is-active" : ""}" ${value === "pie" && state.metric === "profit" && (state.data.profit < 0 || state.data.totalRevenue <= 0) ? 'disabled title="Cần thực nhận lớn hơn 0 và lợi nhuận không âm"' : ""}>${label}</button>`).join("")}</div></div>`;
}

function chartPanel(data, state, trend) {
  if (!state.metric) return panel("Thu – chi – lợi nhuận theo tháng", trend?.length ? overviewChart(trend, state.selectedMonth) : '<p class="report-empty">Chưa có dữ liệu theo tháng.</p>');
  const perspective = state.perspective[state.metric] || "time";
  const preferred = state.kinds[`${state.metric}:${perspective}`];
  const allowed = perspective === "time" ? ["bar", "area"] : state.metric === "profit" ? ["bar", "pie"] : ["horizontal", "pie"];
  const kind = allowed.includes(preferred) ? preferred : allowed[0];
  const graphic = perspective === "time" ? (trend?.length ? timeChart(trend, state.metric, kind, state.selectedMonth) : '<p class="report-empty">Chưa có dữ liệu theo tháng.</p>') : state.metric === "profit" ? profitBridgeChart(data, kind) : typeChart(state.metric === "expenses" ? data.expensesByType || [] : data.revenueByType || [], state.metric, kind);
  return panel(names[state.metric], `${chartChoices(state)}${graphic}`);
}

export function comparisonSelection(data, selectedIds) {
  const active = (data.byBuilding || []).filter((row) => row.buildingId && row.inComparison);
  const selected = Array.isArray(selectedIds) ? active.filter((row) => selectedIds.includes(row.buildingId)) : active;
  return { active, rows: (selected.length >= Math.min(2, active.length) ? selected : active).slice().sort((a, b) => Number(b.profit) - Number(a.profit)) };
}

function comparePanel(data, state) {
  const { active, rows } = comparisonSelection(data, state.compareBuildingIds);
  const selected = new Set(rows.map((row) => row.buildingId));
  const name = (row) => state.buildingNames.get(row.buildingId) || "Căn không rõ tên";
  const inactive = (data.byBuilding || []).filter((row) => row.buildingId && !row.inComparison);
  const chips = [...active, ...inactive].map((row) => `<button type="button" class="report-compare-chip ${selected.has(row.buildingId) ? "is-active" : ""}" data-compare-building="${safe(row.buildingId)}" aria-pressed="${selected.has(row.buildingId)}" ${!row.inComparison || (selected.has(row.buildingId) && rows.length <= 2) ? `disabled title="${row.inComparison ? "Cần chọn ít nhất 2 căn" : "Căn ngừng hoạt động"}"` : ""}>${safe(name(row))}${row.inComparison ? "" : " · Ngừng hoạt động"}</button>`).join("");
  const extremes = rows.length ? `<p class="report-compare-summary">Lợi nhuận cao nhất: ${safe(name(rows[0]))} (${reportMoney(rows[0].profit)}). Thấp nhất: ${safe(name(rows.at(-1)))} (${reportMoney(rows.at(-1).profit)}).</p>` : "";
  const unassigned = (data.byBuilding || []).find((row) => !row.buildingId);
  const unassignedRow = unassigned ? `<tr><th scope="row">Chưa phân căn <small>(đã tính trong tổng kỳ)</small></th><td class="report-number">${reportMoney(unassigned.revenue)}</td><td class="report-number">${reportMoney(unassigned.expenses)}</td><td class="report-number">${reportMoney(unassigned.profit)}</td></tr>` : "";
  const excluded = Number(data.unassignedExpenses?.total) > 0 ? `<p class="report-hint">Chi phí chưa phân căn không thuộc tổng kỳ này: ${reportMoney(data.unassignedExpenses.total)}.</p>` : "";
  const tableRows = rows.map((row) => `<tr><th scope="row">${safe(name(row))}</th><td class="report-number">${reportMoney(row.revenue)}</td><td class="report-number">${reportMoney(row.expenses)}</td><td class="report-number">${reportMoney(row.profit)}</td></tr>`);
  if (unassignedRow) tableRows.push(unassignedRow);
  const body = `${chips ? `<div class="report-compare-chips" role="group" aria-label="Chọn căn so sánh">${chips}</div>` : ""}${extremes}${rows.length ? buildingComparisonChart(rows, state.buildingNames) : '<p class="report-empty">Chưa có căn để so sánh.</p>'}${tableRows.length ? table(["Căn", "Thực nhận", "Chi phí", "Lợi nhuận"], tableRows) : ""}${excluded}`;
  return panel("So sánh các căn", body);
}

export function reportScreen(state) {
  const data = state.data;
  const fields = state.applied ? { ...state.applied, ...state.appliedFields } : null;
  const label = fields ? `${periodLabel(fields)} · ${state.applied.buildingId ? state.buildingNames.get(state.applied.buildingId) || "Căn không rõ tên" : "Tất cả căn"}` : "Đang tải báo cáo";
  const toolbar = `<div class="report-toolbar"><span class="report-applied">${safe(label)}</span>${viewTabs(state)}</div>`;
  const totalBody = data ? `${state.view === "compare" ? `<p class="report-chain-total">Toàn chuỗi: Thực nhận ${reportMoney(data.totalRevenue)} · Chi phí ${reportMoney(data.totalExpenses)} · Lợi nhuận ${reportMoney(data.profit)}</p>` : reportKpis(data, state.metric)}${state.applied?.buildingId && data.unassignedExpenses ? '<p class="report-hint">Chi phí chưa phân căn không thuộc căn này.</p>' : ""}` : "";
  const summary = statusBlock({ status: state.summaryStatus, error: state.summaryError, retry: "summary", body: totalBody });
  const needsTrend = state.view !== "compare" && (!state.metric || (state.view === "table" ? state.metric === "profit" : (state.perspective[state.metric] || "time") === "time"));
  const needsSummary = !needsTrend;
  const detail = (needsSummary ? data : state.trend) ? state.view === "compare" ? comparePanel(data, state) : state.view === "table" ? detailTable(data, state, state.trend) : chartPanel(data, state, state.trend) : "";
  const detailStatus = needsSummary ? state.summaryStatus : state.trendStatus;
  const detailError = needsSummary ? state.summaryError : state.trendError;
  const content = statusBlock({ status: detailStatus, error: detailError, retry: needsSummary ? "summary" : "trend", body: detail });
  return `${toolbar}${state.metric && state.view !== "compare" ? '<button type="button" class="report-overview-reset" data-report-overview>Xem tổng quan</button>' : ""}<div data-report-summary>${summary}</div><div data-report-detail>${content}</div>`;
}
