import { escapeHtml } from "../../shared/components/view.js";
import { estimatedRows, periodLabel, reportDate, reportMoney, revenueLabel } from "./report.model.mjs";
import { overviewChart, profitBridgeChart, timeChart, typeChart } from "./report.charts.mjs";

const safe = escapeHtml;
const names = { revenue: "Doanh thu thực nhận", expenses: "Chi phí", profit: "Lợi nhuận" };
const amounts = { revenue: "totalRevenue", expenses: "totalExpenses", profit: "profit" };
const icon = { revenue: "₫", expenses: "▣", profit: "↗" };
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
  return panel(state.metric === "expenses" ? "Các khoản chi" : "Các khoản thu", filtered.length ? table(["Ngày", "Loại", "Căn", "Số tiền", "Số gộp", "Giảm trừ"], filtered.map((row) => `<tr><td>${safe(reportDate(row.date))}${estimatedRows([row]).length ? '<span class="report-estimated-dot" title="Dữ liệu lịch sử được suy diễn"> ●</span>' : ""}</td><td>${safe(state.metric === "expenses" ? "Chi phí" : revenueLabel(row.type || row.source))}</td><td>${safe(state.buildingNames.get(row.buildingId) || "Chưa phân căn")}</td><td class="report-number">${reportMoney(row.amount)}</td><td class="report-number">${row.source === "CHI_PHI" ? "—" : reportMoney(row.grossAmount)}</td><td class="report-number">${row.source === "CHI_PHI" ? "—" : reportMoney(row.discountAllocated)}</td></tr>`)) : '<p class="report-empty">Chưa có giao dịch trong kỳ.</p>');
}

function chartChoices(state) {
  const perspective = state.perspective[state.metric] || "time";
  const types = perspective === "time" ? [["bar", "Cột"], ["line", "Đường"], ["area", "Vùng"]] : state.metric === "profit" ? [["bar", "Cột so sánh"], ["step", "Bậc thang"], ["pie", "Tròn"]] : [["horizontal", "Thanh ngang"], ["pie", "Tròn"], ["column", "Cột"]];
  const kind = state.kinds[`${state.metric}:${perspective}`] || types[0][0];
  return `<div class="report-chart-tools"><div class="report-segment" role="tablist" aria-label="Góc nhìn"><button type="button" role="tab" data-report-perspective="time" aria-selected="${perspective === "time"}" class="${perspective === "time" ? "is-active" : ""}">Theo thời gian</button><button type="button" role="tab" data-report-perspective="other" aria-selected="${perspective === "other"}" class="${perspective === "other" ? "is-active" : ""}">${state.metric === "profit" ? "Từ thu đến lãi" : "Theo loại thu"}</button></div><div class="report-segment" role="group" aria-label="Dạng biểu đồ">${types.map(([value, label]) => `<button type="button" data-report-kind="${value}" aria-pressed="${kind === value}" class="${kind === value ? "is-active" : ""}" ${value === "pie" && state.metric === "profit" && (state.data.profit < 0 || state.data.totalRevenue <= 0) ? 'disabled title="Cần thực nhận lớn hơn 0 và lợi nhuận không âm"' : ""}>${label}</button>`).join("")}</div></div>`;
}

function chartPanel(data, state, trend) {
  if (!state.metric) return panel("Thu – chi – lợi nhuận theo tháng", trend?.length ? overviewChart(trend, state.selectedMonth) : '<p class="report-empty">Chưa có dữ liệu theo tháng.</p>');
  const perspective = state.perspective[state.metric] || "time";
  const kind = state.kinds[`${state.metric}:${perspective}`] || (perspective === "time" ? "bar" : state.metric === "profit" ? "bar" : "horizontal");
  const graphic = perspective === "time" ? (trend?.length ? timeChart(trend, state.metric, kind, state.selectedMonth) : '<p class="report-empty">Chưa có dữ liệu theo tháng.</p>') : state.metric === "profit" ? profitBridgeChart(data, kind) : typeChart(data.revenueByType || [], "revenue", kind);
  return panel(names[state.metric], `${chartChoices(state)}${graphic}`);
}

function comparePanel(data, state) {
  const rows = (data.byBuilding || []).filter((row) => row.buildingId && row.inComparison).sort((a, b) => b.profit - a.profit);
  return panel("So sánh các căn", rows.length ? table(["Căn", "Thực nhận", "Chi phí", "Lợi nhuận"], rows.map((row) => `<tr><th scope="row">${safe(state.buildingNames.get(row.buildingId) || "Căn không rõ tên")}</th><td class="report-number">${reportMoney(row.revenue)}</td><td class="report-number">${reportMoney(row.expenses)}</td><td class="report-number">${reportMoney(row.profit)}</td></tr>`)) : '<p class="report-empty">Chưa có căn để so sánh.</p>');
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
