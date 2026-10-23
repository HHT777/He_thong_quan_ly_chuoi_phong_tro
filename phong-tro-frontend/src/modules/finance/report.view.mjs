import { escapeHtml } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { chartScale, estimatedRows, filterTransactions, periodLabel, reportDate, reportMoney, revenueLabel, share, sortedRevenueTypes, SOURCE_LABELS } from "./report.model.mjs";

const safe = escapeHtml;
const nameOf = (id, names) => id ? (names.get(id) || "Căn không rõ tên") : "Chưa phân căn";
const empty = (message) => `<div class="report-empty">${safe(message)}</div>`;
const card = (title, body, extra = "") => `<section class="report-card ${extra}"><h3>${title}</h3>${body}</section>`;
const barWidth = (value, max) => max > 0 ? Math.max(0, Number(value) / max * 100) : 0;

export function kpiMarkup(data) {
  const revenue = reportMoney(data.totalRevenue);
  const expenses = reportMoney(data.totalExpenses);
  const profit = reportMoney(data.profit);
  return `<div class="report-kpis">
    <article class="report-kpi"><span class="report-kpi__icon" aria-hidden="true">${icons.money(28)}</span><div><h2>Doanh thu thực nhận</h2><strong>${revenue}</strong><p>Gộp ${reportMoney(data.grossRevenue)} · Giảm trừ ${reportMoney(data.discounts)} · Khấu trừ cọc ${reportMoney(data.depositDeductions)}</p></div></article>
    <article class="report-kpi"><span class="report-kpi__icon" aria-hidden="true">${icons.finance(28)}</span><div><h2>Chi phí</h2><strong>${expenses}</strong><p>Chi phí phát sinh trong kỳ</p></div></article>
    <article class="report-kpi"><span class="report-kpi__icon" aria-hidden="true">${icons.trendingUp(28)}</span><div><h2>Lợi nhuận</h2><strong class="${Number(data.profit) < 0 ? "is-negative" : "is-positive"}">${profit}</strong><p>Doanh thu thực nhận trừ chi phí</p></div></article>
  </div>`;
}

export function trendMarkup(rows) {
  if (!rows?.length) return card("Thu – chi – lợi nhuận theo tháng", empty("Chưa có dữ liệu xu hướng trong kỳ."));
  const scale = chartScale(rows);
  const zero = scale.y(0);
  const x = (index) => 90 + index * 154;
  const line = rows.map((row, index) => `${x(index) + 27},${scale.y(row.profit)}`).join(" ");
  const chart = `<div class="report-trend-scroll"><svg viewBox="0 0 940 250" role="img" aria-label="Thu, chi và lợi nhuận sáu tháng">
    ${[0, 1, 2, 3, 4].map((step) => {
      const value = scale.min + (scale.max - scale.min) * step / 4;
      const ordinate = scale.y(value);
      return `<line class="report-grid-line" x1="62" x2="920" y1="${ordinate}" y2="${ordinate}" /><text x="8" y="${ordinate + 4}">${Math.round(value / 1_000_000)} tr</text>`;
    }).join("")}
    <line class="report-zero-line" x1="62" x2="920" y1="${zero}" y2="${zero}" />
    ${rows.map((row, index) => {
      const detail = `Tháng ${Number(row.month.slice(5))}/${row.month.slice(0, 4)}: thu ${reportMoney(row.totalRevenue)}, chi ${reportMoney(row.totalExpenses)}, lợi nhuận ${reportMoney(row.profit)}`;
      const revenueY = scale.y(row.totalRevenue);
      const expenseY = scale.y(row.totalExpenses);
      return `<g class="report-trend-point" tabindex="0" aria-label="${safe(detail)}" data-chart-detail="${safe(detail)}">
        <rect class="report-trend-revenue" x="${x(index)}" y="${Math.min(zero, revenueY)}" width="30" height="${Math.max(1, Math.abs(zero - revenueY))}" />
        <rect class="report-trend-expense" x="${x(index) + 34}" y="${Math.min(zero, expenseY)}" width="30" height="${Math.max(1, Math.abs(zero - expenseY))}" />
        <text x="${x(index) - 1}" y="232">${row.month.slice(5)}/${row.month.slice(0, 4)}</text></g>`;
    }).join("")}
    <polyline class="report-trend-profit" points="${line}" />
    ${rows.map((row, index) => `<circle class="report-trend-profit-dot ${row.profit < 0 ? "is-negative" : ""}" cx="${x(index) + 27}" cy="${scale.y(row.profit)}" r="5" />`).join("")}
  </svg></div>`;
  return card("Thu – chi – lợi nhuận theo tháng", `<div class="report-legend"><span><i class="report-dot report-dot--revenue"></i> Thực nhận</span><span><i class="report-dot report-dot--expense"></i> Chi phí</span><span><i class="report-dot report-dot--profit"></i> Lợi nhuận</span></div>${chart}<p class="report-chart-readout" data-chart-readout aria-live="polite">Rê chuột hoặc dùng Tab để xem số liệu từng tháng.</p>`, "report-card--trend");
}

export function revenueMixMarkup(data) {
  const rows = sortedRevenueTypes(data.revenueByType);
  if (!rows.length) return card("Cơ cấu doanh thu", empty("Chưa có doanh thu theo loại trong kỳ."));
  const max = Math.max(...rows.map((row) => Number(row.amount)), 0);
  return card("Cơ cấu doanh thu", `<div class="report-bar-list">${rows.map((row) => `<button type="button" class="report-bar-row" data-type="${safe(row.type)}" title="Xem chi tiết loại ${safe(revenueLabel(row.type))}">
    <span class="report-bar-label">${safe(revenueLabel(row.type))}</span><span class="report-bar-track"><i style="width:${barWidth(row.amount, max)}%"></i></span>
    <strong>${reportMoney(row.amount)}</strong><small>${share(row.amount, data.totalRevenue)}</small></button>`).join("")}</div>`);
}

export function buildingCompareMarkup(data, names) {
  const rows = (data.byBuilding || []).filter((row) => row.buildingId && row.inComparison === true);
  const unassigned = (data.byBuilding || []).find((row) => !row.buildingId && Number(row.expenses) > 0);
  if (!rows.length && !unassigned) return card("So sánh các căn", empty("Chưa có căn phát sinh trong kỳ."));
  const max = Math.max(0, ...rows.flatMap((row) => [Number(row.revenue), Number(row.expenses)]), Number(unassigned?.expenses || 0));
  const info = unassigned ? `<button type="button" class="report-info" aria-label="Chi phí chưa phân căn: ${reportMoney(unassigned.expenses)} (đã tính vào tổng chi phí)" title="Chi phí chưa phân căn: ${reportMoney(unassigned.expenses)} (đã tính vào tổng chi phí)">ⓘ</button>` : "";
  return card(`So sánh các căn ${info}`, `<div class="report-legend"><span><i class="report-dot report-dot--revenue"></i> Thực nhận</span><span><i class="report-dot report-dot--expense"></i> Chi phí</span></div>
    <div class="report-building-list">${rows.map((row) => `<button type="button" class="report-building-row" data-building="${safe(row.buildingId)}" title="Xem giao dịch của ${safe(nameOf(row.buildingId, names))}">
      <span class="report-building-name">${safe(nameOf(row.buildingId, names))}</span><span class="report-building-bars"><i class="report-building-revenue" style="width:${barWidth(row.revenue, max)}%"></i><i class="report-building-expense" style="width:${barWidth(row.expenses, max)}%"></i></span>
      <span class="report-building-amounts">${reportMoney(row.revenue)}<small>${reportMoney(row.expenses)}</small></span><strong class="${Number(row.profit) < 0 ? "is-negative" : ""}">${reportMoney(row.profit)}</strong></button>`).join("")}
      ${unassigned ? `<div class="report-building-row report-building-row--unassigned"><span class="report-building-name">Chưa phân căn</span><span class="report-building-bars"><i style="width:${barWidth(unassigned.expenses, max)}%"></i></span><span class="report-building-amounts">${reportMoney(unassigned.expenses)}<small>Đã tính trong tổng chi phí</small></span><strong>—</strong></div>` : ""}
    </div><p class="report-hint">Chọn một căn hoặc loại doanh thu để xem bảng chi tiết.</p>`);
}

const th = (label, numeric = false) => `<th scope="col" class="${numeric ? "report-number" : ""}">${label}</th>`;
const tdMoney = (value) => `<td class="report-number">${reportMoney(value)}</td>`;
const table = (headers, rows, footer = "") => `<div class="report-table-scroll"><table class="report-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody>${footer}</table></div>`;
const totalFooter = (data, columns) => `<tfoot><tr><th scope="row" colspan="${columns}">Tổng kỳ theo server (tất cả căn)</th>${tdMoney(data.totalRevenue)}${tdMoney(data.totalExpenses)}${tdMoney(data.profit)}</tr></tfoot>`;

export function detailMarkup(data, names, state) {
  const rows = data.byBuilding || [];
  const inactive = rows.filter((row) => row.buildingId && row.inComparison === false);
  const unassigned = rows.find((row) => !row.buildingId && Number(row.expenses) > 0);
  const info = unassigned ? `<span class="report-detail-info" title="Chi phí chưa phân căn: ${reportMoney(unassigned.expenses)} (đã tính vào tổng chi phí)">ⓘ Chi phí chưa phân căn: ${reportMoney(unassigned.expenses)} (đã tính vào tổng chi phí)</span>` : "";
  const selectedType = state.selectedType;
  const chip = state.buildingId ? `<button type="button" class="report-selection-chip" data-clear-selection>Căn: ${safe(nameOf(state.buildingId, names))} ×</button>`
    : selectedType ? `<button type="button" class="report-selection-chip" data-clear-selection>Loại: ${safe(revenueLabel(selectedType))} ×</button>` : "";
  const controls = `<div class="report-detail-controls"><div class="report-segment" role="group" aria-label="Nhóm chi tiết">
    ${[["building", "Theo căn"], ["type", "Theo loại"], ["transactions", "Giao dịch thu/chi"]].map(([id, label]) => `<button type="button" data-detail-mode="${id}" aria-pressed="${state.tableMode === id}" class="${state.tableMode === id ? "is-active" : ""}">${label}</button>`).join("")}
    </div><div class="report-detail-tools">${state.tableMode === "transactions" ? `<label class="report-search"><span class="report-sr-only">Tìm theo căn hoặc loại giao dịch</span><input type="search" data-report-search value="${safe(state.search || "")}" placeholder="Tìm theo căn, loại giao dịch..."></label>` : ""}
    ${state.tableMode === "transactions" && estimatedRows(data.receiptDetails).length ? `<button type="button" class="report-estimated-chip ${state.estimatedOnly ? "is-active" : ""}" data-estimated-only aria-pressed="${state.estimatedOnly}" title="Chỉ hiện giao dịch thu có snapshot ước tính">● ${estimatedRows(data.receiptDetails).length} dòng ước tính</button>` : ""}</div></div>`;
  let content = "";
  if (state.tableMode === "building") {
    const shown = rows.filter((row) => !state.buildingId || row.buildingId === state.buildingId);
    content = shown.length ? table(
      th("Căn") + th("Thực nhận", true) + th("Chi phí", true) + th("Lợi nhuận", true),
      shown.map((row) => `<tr><td>${safe(nameOf(row.buildingId, names))}</td>${tdMoney(row.revenue)}${tdMoney(row.expenses)}${tdMoney(row.profit)}</tr>`).join(""),
      totalFooter(data, 1),
    ) : empty("Không có căn phát sinh theo bộ lọc.");
  } else if (state.tableMode === "type") {
    const shown = sortedRevenueTypes(data.revenueByType).filter((row) => !selectedType || row.type === selectedType);
    content = shown.length ? table(th("Loại doanh thu") + th("Thực nhận", true) + th("Tỷ trọng", true),
      shown.map((row) => `<tr><td>${safe(revenueLabel(row.type))}</td>${tdMoney(row.amount)}<td class="report-number">${share(row.amount, data.totalRevenue)}</td></tr>`).join(""),
      `<tfoot><tr><th scope="row">Tổng doanh thu thực nhận theo server</th>${tdMoney(data.totalRevenue)}<td></td></tr></tfoot>`) : empty("Không có doanh thu theo loại trong kỳ.");
  } else {
    const shown = filterTransactions(data.receiptDetails, state, names).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    content = shown.length ? table(
      th("Ngày") + th("Loại") + th("Căn") + th("Thực nhận/chi", true) + th("Số gộp", true) + th("Giảm trừ", true),
      shown.map((row) => {
        const estimated = estimatedRows([row]).length > 0;
        const source = SOURCE_LABELS[row.source] || row.source || "Khác";
        const amount = row.source === "CHI_PHI" ? -Number(row.amount) : Number(row.amount);
        return `<tr><td class="report-date">${reportDate(row.date)}${estimated ? `<span class="report-estimated-dot" title="Số gộp và giảm trừ được ước tính từ dữ liệu cũ" aria-label="Dữ liệu ước tính">●</span>` : ""}</td><td>${safe(source)}</td><td>${safe(nameOf(row.buildingId, names))}</td>${tdMoney(amount)}<td class="report-number">${row.source === "CHI_PHI" ? "—" : reportMoney(row.grossAmount)}</td><td class="report-number">${row.source === "CHI_PHI" ? "—" : reportMoney(row.discountAllocated)}</td></tr>`;
      }).join(""),
      `<tfoot><tr><th scope="row" colspan="3">Tổng kỳ theo server (tất cả căn): thực nhận ${reportMoney(data.totalRevenue)} · chi phí ${reportMoney(data.totalExpenses)} · lợi nhuận ${reportMoney(data.profit)}</th><td colspan="3"></td></tr></tfoot>`,
    ) : empty("Không có giao dịch thu/chi theo bộ lọc.");
  }
  return card(`Chi tiết giao dịch ${info}`, `${controls}${chip ? `<div class="report-selection">${chip}</div>` : ""}${content}${inactive.length ? `<p class="report-inactive">${inactive.length} căn ngừng hoạt động có phát sinh, được giữ trong bảng chi tiết và không tham gia so sánh.</p>` : ""}`, "report-card--detail");
}

export function reportBody(data, names, state, trend) {
  const chartMode = state.view === "chart";
  const charts = `${state.applied.mode === "month" ? trendMarkup(trend) : ""}<div class="report-two-column">${revenueMixMarkup(data)}${buildingCompareMarkup(data, names)}</div>`;
  return `${kpiMarkup(data)}${chartMode ? charts : detailMarkup(data, names, state)}`;
}

export function appliedLabel(state, names) {
  return `${periodLabel(state.applied)} · ${state.applied.buildingId ? safe(nameOf(state.applied.buildingId, names)) : "Tất cả căn"}`;
}
