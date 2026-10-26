import "./reports.css";
import { escapeHtml, shellPage } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { availableYears, businessYearMonth, readCashflow, reportQuery, selectionFields, validPeriod } from "./report.model.mjs";
import { defaultPeriodForMode, filterMarkup } from "./report.filter.mjs";
import { cashflowPath, loadReportTrend, reportHash, reportUrlState } from "./report.data.mjs";
import { reportScreen } from "./report.screen.mjs";

const meta = { id: "reports", route: "/finance/reports", title: "Báo cáo", tabLabel: "Báo cáo", group: "finance", order: 45, roles: ["CHU_TRO"] };
const remember = (key, value) => { try { localStorage.setItem(`qlpt:report:${key}`, value); } catch { /* Storage can be unavailable. */ } };
const recalled = (key, allowed, fallback) => { try { const value = localStorage.getItem(`qlpt:report:${key}`); return allowed.includes(value) ? value : fallback; } catch { return fallback; } };
async function render(context) {
  this.listeners?.abort();
  this.requests?.summary?.abort();
  this.requests?.trend?.abort();
  this.listeners = new AbortController();
  const signal = this.listeners.signal;
  const today = businessYearMonth();
  const years = availableYears();
  const state = {
    ...reportUrlState(window.location.hash, years, today), today, buildings: [], buildingNames: new Map(), buildingCount: 0,
    applied: null, appliedFields: null, data: null, trend: null,
    summaryStatus: "loading", trendStatus: "loading", summaryError: null, trendError: null,
    perspective: { revenue: "time", expenses: "time", profit: "time" }, kinds: {}, selectedMonth: "",
  };
  state.period = validPeriod(state.year, state.period, today);
  for (const metric of ["revenue", "expenses", "profit"]) {
    state.perspective[metric] = recalled(`perspective:${metric}`, ["time", "other"], "time");
    for (const perspective of ["time", "other"]) state.kinds[`${metric}:${perspective}`] = recalled(`kind:${metric}:${perspective}`, perspective === "time" ? ["bar", "line", "area"] : metric === "profit" ? ["bar", "step", "pie"] : ["horizontal", "pie", "column"], perspective === "time" ? "bar" : metric === "profit" ? "bar" : "horizontal");
  }
  context.main.innerHTML = shellPage("", "");
  const page = context.main.querySelector(".module-page");
  page.classList.add("report-page");
  const heading = page.querySelector(".module-page__heading");
  heading.innerHTML = `<button type="button" class="report-export" data-export-report disabled>${icons.download(18)} Xuất Excel</button>`;
  const content = page.querySelector("[data-content]");
  content.innerHTML = '<div class="report-state" role="status">Đang tải danh sách căn...</div>';
  try {
    const response = await context.api.request("/management/can-tro", { signal });
    if (signal.aborted) return;
    state.buildings = Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    if (signal.aborted) return;
    content.innerHTML = `<div class="report-state" role="alert"><h2>Không tải được danh sách căn</h2><p>${escapeHtml(error.message)}</p><button type="button" data-retry-buildings>Thử lại</button></div>`;
    content.querySelector("[data-retry-buildings]").addEventListener("click", () => render.call(this, context), { signal });
    return;
  }
  state.buildingNames = new Map(state.buildings.map((row) => [row.ma_can, row.ten_can]));
  state.buildingCount = state.buildings.length;
  if (state.buildingId && !state.buildingNames.has(state.buildingId)) state.buildingId = "";
  if (state.view === "compare" && state.buildingCount < 2) state.view = "chart";
  content.innerHTML = `<div data-filter-slot>${filterMarkup(state, years)}</div><p class="report-message" data-report-message role="alert"></p><div data-screen-slot></div>`;
  const filterSlot = content.querySelector("[data-filter-slot]");
  const screenSlot = content.querySelector("[data-screen-slot]");
  const message = content.querySelector("[data-report-message]");
  const exportButton = heading.querySelector("[data-export-report]");
  let requestVersion = 0;
  let delay;
  let yearCursor = -1;
  const selection = () => ({ year: state.year, period: state.period, buildingId: state.view === "compare" ? "" : state.buildingId });
  const paint = () => { screenSlot.innerHTML = reportScreen(state); };
  const filterPaint = () => { filterSlot.innerHTML = filterMarkup(state, years); };
  const persist = () => { window.history.replaceState(null, "", reportHash(state)); };
  const apply = async (part = "both") => {
    if (part === "both") {
      this.requests?.summary?.abort();
      this.requests?.trend?.abort();
      ++requestVersion;
    } else this.requests?.[part]?.abort();
    this.requests ||= {};
    const version = requestVersion;
    const chosen = selection();
    state.selectedMonth = chosen.period.startsWith("month-") ? `${chosen.year}-${chosen.period.slice(6).padStart(2, "0")}` : "";
    if (part !== "trend") { state.summaryStatus = "loading"; state.summaryError = null; }
    if (part !== "summary") { state.trendStatus = "loading"; state.trendError = null; }
    message.textContent = "";
    if (part !== "trend") exportButton.disabled = true;
    paint();
    const getSummary = async () => {
      const controller = new AbortController(); this.requests.summary = controller;
      const fresh = () => !signal.aborted && !controller.signal.aborted && version === requestVersion;
      try {
      const response = await context.api.request(cashflowPath(chosen), { signal: controller.signal });
      if (!fresh()) return;
      state.data = readCashflow(response);
      state.applied = chosen;
      state.appliedFields = selectionFields(chosen);
      state.summaryStatus = "ready";
      exportButton.disabled = false;
      paint();
      } catch (error) { if (fresh()) { state.summaryError = error; state.summaryStatus = "error"; paint(); } }
    };
    const getTrend = async () => {
      const controller = new AbortController(); this.requests.trend = controller;
      const fresh = () => !signal.aborted && !controller.signal.aborted && version === requestVersion;
      try {
      const rows = await loadReportTrend(context.api, chosen, controller.signal);
      if (!fresh()) return;
      state.trend = rows; state.trendStatus = "ready"; paint();
      } catch (error) { if (fresh()) { state.trendError = error; state.trendStatus = "error"; paint(); } }
    };
    await Promise.all([part !== "trend" ? getSummary() : null, part !== "summary" ? getTrend() : null]);
  };
  const schedule = () => { clearTimeout(delay); persist(); delay = setTimeout(apply, 250); };
  filterSlot.addEventListener("change", (event) => {
    if (event.target.matches("[data-report-mode]")) { state.period = defaultPeriodForMode(state.year, event.target.value, today); filterPaint(); }
    else if (event.target.matches("[data-report-period]")) state.period = event.target.value;
    else if (event.target.matches("[data-report-building]")) state.buildingId = event.target.value;
    else return;
    schedule();
  }, { signal });
  const yearInput = () => filterSlot.querySelector("[data-report-year]");
  const yearList = () => filterSlot.querySelector("[data-report-years]");
  const yearError = () => filterSlot.querySelector("[data-report-year-error]");
  const showYears = (text) => {
    const list = yearList();
    const matches = years.filter((year) => String(year).includes(text));
    list.hidden = false; yearInput().setAttribute("aria-expanded", "true");
    const options = matches.map((year) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(year === state.year));
      button.dataset.reportYearOption = String(year);
      button.textContent = String(year);
      return button;
    });
    if (!options.length) {
      const empty = document.createElement("span");
      empty.setAttribute("role", "status");
      empty.textContent = "Không có năm này";
      options.push(empty);
    }
    list.replaceChildren(...options);
    yearError().textContent = matches.length ? "" : "Không có năm này";
    yearCursor = -1;
  };
  const pickYear = (year) => {
    if (!years.includes(year)) return;
    state.year = year; state.period = validPeriod(year, state.period, today);
    filterPaint(); schedule();
  };
  filterSlot.addEventListener("input", (event) => {
    if (!event.target.matches("[data-report-year]")) return;
    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
    showYears(event.target.value);
  }, { signal });
  filterSlot.addEventListener("keydown", (event) => {
    if (!event.target.matches("[data-report-year]")) return;
    if (event.key === "Escape") { filterPaint(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (yearList().hidden) showYears(event.target.value);
      const current = [...yearList().querySelectorAll("[data-report-year-option]")];
      if (!current.length) return;
      yearCursor = event.key === "ArrowDown" ? (yearCursor + 1) % current.length : (yearCursor <= 0 ? current.length - 1 : yearCursor - 1);
      current.forEach((button) => button.classList.remove("is-focused")); current[yearCursor]?.classList.add("is-focused");
    }
    if (event.key === "Enter") { event.preventDefault(); pickYear(Number(yearList().querySelector(".is-focused")?.dataset.reportYearOption || event.target.value)); }
  }, { signal });
  filterSlot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-year-option]");
    if (button) pickYear(Number(button.dataset.reportYearOption));
    else if (event.target.matches("[data-report-year]")) showYears(event.target.value);
  }, { signal });
  filterSlot.addEventListener("focusout", (event) => {
    if (!event.target.matches("[data-report-year]")) return;
    setTimeout(() => { if (signal.aborted) return; const typed = Number(yearInput()?.value); if (!years.includes(typed)) filterPaint(); else if (typed !== state.year) pickYear(typed); else { yearList().hidden = true; yearInput().setAttribute("aria-expanded", "false"); } }, 120);
  }, { signal });
  content.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-report-retry]");
    if (retry) { apply(retry.dataset.reportRetry); return; }
    const view = event.target.closest("[data-report-view]");
    if (view) {
      state.view = view.dataset.reportView;
      filterPaint(); persist(); paint();
      if (state.view === "compare" || state.applied?.buildingId !== selection().buildingId) schedule();
      return;
    }
    const metric = event.target.closest("[data-report-metric]");
    if (metric) { state.metric = state.metric === metric.dataset.reportMetric ? "" : metric.dataset.reportMetric; persist(); paint(); return; }
    if (event.target.closest("[data-report-overview]")) { state.metric = ""; persist(); paint(); return; }
    const perspective = event.target.closest("[data-report-perspective]");
    if (perspective) { state.perspective[state.metric] = perspective.dataset.reportPerspective; remember(`perspective:${state.metric}`, state.perspective[state.metric]); paint(); return; }
    const kind = event.target.closest("[data-report-kind]");
    if (kind) { const key = `${state.metric}:${state.perspective[state.metric]}`; state.kinds[key] = kind.dataset.reportKind; remember(`kind:${key}`, state.kinds[key]); paint(); }
  }, { signal });
  const readout = (event) => {
    const target = event.target.closest?.("[data-chart-detail]");
    const element = target?.closest(".report-card")?.querySelector("[data-chart-readout]");
    if (element) element.textContent = target.dataset.chartDetail;
  };
  content.addEventListener("mouseover", readout, { signal });
  content.addEventListener("focusin", readout, { signal });
  content.addEventListener("pointerdown", readout, { signal });
  exportButton.addEventListener("click", async () => {
    if (!state.applied) return;
    exportButton.disabled = true; message.textContent = "";
    try {
      const query = reportQuery(state.appliedFields);
      const { blob, disposition } = await context.api.getBlob(`/v1/reports/cashflow.xlsx?${query}`);
      const filename = /filename="(bao-cao-thu-chi_[A-Za-z0-9_-]+\.xlsx)"/.exec(disposition)?.[1] || "bao-cao-thu-chi.xlsx";
      const url = URL.createObjectURL(blob);
      try { const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); }
      finally { URL.revokeObjectURL(url); }
    } catch (error) { message.textContent = `Không xuất được Excel: ${error.message}`; }
    finally { exportButton.disabled = false; }
  }, { signal });
  persist();
  await apply();
}

export default { ...meta, render };
