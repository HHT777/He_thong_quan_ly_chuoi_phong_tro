import "./reports.css";
import { escapeHtml, shellPage } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { readCashflow, reportQuery } from "./report.model.mjs";
import { appliedLabel, reportBody } from "./report.view.mjs";

const meta = { id: "reports", route: "/finance/reports", title: "Báo cáo", tabLabel: "Báo cáo", group: "finance", order: 45, roles: ["CHU_TRO"] };
const viewKey = "qlpt:report-view";
const tableKey = "qlpt:report-table";
const currentPeriod = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
};
const stored = (key, allowed, fallback) => {
  try { const value = sessionStorage.getItem(key); return allowed.includes(value) ? value : fallback; } catch { return fallback; }
};
const remember = (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* Session storage can be unavailable. */ } };
const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;

function filterMarkup(buildings, month) {
  const year = month.slice(0, 4);
  return `<form class="report-filter" data-report-filter>
    <input type="hidden" name="mode" value="month">
    <div class="report-segment report-periods" role="group" aria-label="Loại kỳ báo cáo">
      ${[["month", "Tháng"], ["quarter", "Quý"], ["year", "Năm"], ["range", "Tùy chọn"]].map(([id, label]) => `<button type="button" data-report-mode="${id}" aria-pressed="${id === "month"}" class="${id === "month" ? "is-active" : ""}">${label}</button>`).join("")}
    </div>
    <div class="report-period-inputs">
      <label data-filter-mode="month"><span class="report-sr-only">Tháng báo cáo</span><input name="month" type="month" value="${month}" required></label>
      <label data-filter-mode="quarter" hidden><span class="report-sr-only">Quý báo cáo</span><select name="quarter" disabled>${[1, 2, 3, 4].map((value) => option(value, `Quý ${value}`)).join("")}</select></label>
      <label data-filter-mode="quarter" hidden><span class="report-sr-only">Năm của quý</span><input name="quarterYear" type="number" min="2000" max="2100" step="1" value="${year}" disabled></label>
      <label data-filter-mode="year" hidden><span class="report-sr-only">Năm báo cáo</span><input name="year" type="number" min="2000" max="2100" step="1" value="${year}" disabled></label>
      <label data-filter-mode="range" hidden><span>Từ ngày</span><input name="from" type="date" disabled></label>
      <label data-filter-mode="range" hidden><span>Đến ngày</span><input name="to" type="date" disabled></label>
    </div>
    <label class="report-building-filter"><span class="report-sr-only">Chọn căn</span><select name="buildingId">${option("", "Tất cả căn")}${buildings.map((row) => option(row.ma_can, row.ten_can)).join("")}</select></label>
    <button type="submit" class="report-apply">Áp dụng</button>
  </form>`;
}

function loadingMarkup() {
  return `<div class="report-skeleton-grid" role="status" aria-label="Đang tải báo cáo"><div class="report-skeleton"></div><div class="report-skeleton"></div><div class="report-skeleton"></div></div><div class="report-skeleton report-skeleton--chart"></div>`;
}

async function render(context) {
  this.listeners?.abort();
  this.listeners = new AbortController();
  const signal = this.listeners.signal;
  context.main.innerHTML = shellPage("", "");
  const page = context.main.querySelector(".module-page");
  page.classList.add("report-page");
  const heading = page.querySelector(".module-page__heading");
  heading.innerHTML = `<h1>Báo cáo</h1><button type="button" class="report-export" data-export-report disabled>${icons.download(18)} Xuất Excel</button>`;
  const content = page.querySelector("[data-content]");
  content.innerHTML = loadingMarkup();

  let buildings;
  try {
    const response = await context.api.get("/management/can-tro");
    buildings = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    content.innerHTML = `<div class="report-state" role="alert"><h2>Không tải được danh sách căn</h2><p>${escapeHtml(error.message)}</p><button type="button" data-retry-buildings>Thử lại</button></div>`;
    content.querySelector("[data-retry-buildings]").addEventListener("click", () => render.call(this, context), { signal });
    return;
  }
  const buildingNames = new Map(buildings.map((row) => [row.ma_can, row.ten_can]));
  const month = currentPeriod();
  content.innerHTML = `${filterMarkup(buildings, month)}<div class="report-toolbar"><span class="report-applied" data-applied-filter>Đang tải báo cáo...</span>
    <div class="report-segment report-view-toggle" role="group" aria-label="Kiểu xem"><button type="button" data-report-view="chart">Biểu đồ</button><button type="button" data-report-view="table">Bảng chi tiết</button></div></div>
    <p class="report-message" data-report-message role="alert"></p><div data-report-result>${loadingMarkup()}</div>`;
  const form = content.querySelector("[data-report-filter]");
  const result = content.querySelector("[data-report-result]");
  const message = content.querySelector("[data-report-message]");
  const appliedChip = content.querySelector("[data-applied-filter]");
  const exportButton = heading.querySelector("[data-export-report]");
  const applyButton = form.querySelector("[type=submit]");
  const state = {
    view: stored(viewKey, ["chart", "table"], "chart"),
    tableMode: stored(tableKey, ["building", "type", "transactions"], "transactions"),
    applied: null, appliedQuery: null, data: null, trend: null,
    buildingId: "", selectedType: "", search: "", estimatedOnly: false,
  };
  const syncFields = () => {
    const mode = form.elements.mode.value;
    form.querySelectorAll("[data-report-mode]").forEach((button) => {
      const active = button.dataset.reportMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    form.querySelectorAll("[data-filter-mode]").forEach((label) => {
      const enabled = label.dataset.filterMode === mode;
      label.hidden = !enabled;
      label.querySelectorAll("input,select").forEach((field) => { field.disabled = !enabled; });
    });
  };
  const paint = () => {
    content.querySelectorAll("[data-report-view]").forEach((button) => {
      const active = button.dataset.reportView === state.view;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (!state.data) return;
    appliedChip.textContent = appliedLabel(state, buildingNames);
    result.innerHTML = reportBody(state.data, buildingNames, state, state.trend);
  };
  const load = async (fields) => {
    let query;
    try { query = reportQuery(fields); } catch (error) { message.textContent = error.message; return; }
    applyButton.disabled = true;
    message.textContent = "";
    result.innerHTML = loadingMarkup();
    try {
      const trendQuery = new URLSearchParams({ period: fields.month || month });
      if (fields.buildingId) trendQuery.set("buildingId", fields.buildingId);
      const [cashflow, insights] = await Promise.all([
        context.api.get(`/v1/reports/cashflow?${query}`),
        fields.mode === "month" ? context.api.get(`/v1/dashboard/insights?${trendQuery}`) : Promise.resolve(null),
      ]);
      if (signal.aborted) return;
      state.data = readCashflow(cashflow);
      state.trend = insights?.data?.cashflow6m || null;
      state.applied = fields;
      state.appliedQuery = query;
      state.buildingId = "";
      state.selectedType = "";
      state.search = "";
      state.estimatedOnly = false;
      exportButton.disabled = false;
      paint();
    } catch (error) {
      if (signal.aborted) return;
      const friendly = error.status === 400 ? `Bộ lọc không hợp lệ: ${error.message}` : error.message;
      result.innerHTML = `<div class="report-state" role="alert"><h2>Không tải được báo cáo</h2><p>${escapeHtml(friendly)}</p><button type="button" data-report-retry>Thử lại</button></div>`;
      result.querySelector("[data-report-retry]").addEventListener("click", () => load(fields), { signal });
    } finally { applyButton.disabled = false; }
  };
  form.addEventListener("click", (event) => {
    const mode = event.target.closest("[data-report-mode]");
    if (!mode) return;
    form.elements.mode.value = mode.dataset.reportMode;
    syncFields();
  }, { signal });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    load(Object.fromEntries(new FormData(form)));
  }, { signal });
  content.addEventListener("click", (event) => {
    const view = event.target.closest("[data-report-view]");
    if (view) { state.view = view.dataset.reportView; remember(viewKey, state.view); paint(); return; }
    const detail = event.target.closest("[data-detail-mode]");
    if (detail) { state.tableMode = detail.dataset.detailMode; state.selectedType = ""; state.buildingId = ""; remember(tableKey, state.tableMode); paint(); return; }
    const type = event.target.closest("[data-type]");
    if (type) { state.view = "table"; state.tableMode = "type"; state.selectedType = type.dataset.type; state.buildingId = ""; remember(viewKey, state.view); remember(tableKey, state.tableMode); paint(); return; }
    const building = event.target.closest("[data-building]");
    if (building) { state.view = "table"; state.tableMode = "transactions"; state.buildingId = building.dataset.building; state.selectedType = ""; remember(viewKey, state.view); remember(tableKey, state.tableMode); paint(); return; }
    if (event.target.closest("[data-clear-selection]")) { state.buildingId = ""; state.selectedType = ""; paint(); return; }
    if (event.target.closest("[data-estimated-only]")) { state.estimatedOnly = !state.estimatedOnly; paint(); }
  }, { signal });
  content.addEventListener("input", (event) => {
    if (!event.target.matches("[data-report-search]")) return;
    state.search = event.target.value;
    const position = event.target.selectionStart;
    paint();
    const input = result.querySelector("[data-report-search]");
    input?.focus();
    input?.setSelectionRange(position, position);
  }, { signal });
  const readout = (event) => {
    const target = event.target.closest?.("[data-chart-detail]");
    if (!target) return;
    const element = result.querySelector("[data-chart-readout]");
    if (element) element.textContent = target.dataset.chartDetail;
  };
  content.addEventListener("mouseover", readout, { signal });
  content.addEventListener("focusin", readout, { signal });
  exportButton.addEventListener("click", async () => {
    if (!state.appliedQuery) return;
    exportButton.disabled = true;
    message.textContent = "";
    try {
      const { blob, disposition } = await context.api.getBlob(`/v1/reports/cashflow.xlsx?${state.appliedQuery}`);
      const filename = /filename="(bao-cao-thu-chi_[A-Za-z0-9_-]+\.xlsx)"/.exec(disposition)?.[1] || "bao-cao-thu-chi.xlsx";
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally { URL.revokeObjectURL(url); }
    } catch (error) { message.textContent = `Không xuất được Excel: ${error.message}`; }
    finally { exportButton.disabled = false; }
  }, { signal });
  syncFields();
  await load({ mode: "month", month, buildingId: "" });
}

export default { ...meta, render };
