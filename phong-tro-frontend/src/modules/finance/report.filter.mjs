import { escapeHtml } from "../../shared/components/view.js";
import { periodOptions } from "./report.model.mjs";

const option = (value, label, selected, disabled = false) => `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}>${escapeHtml(label)}</option>`;

export function modeForPeriod(period) {
  return period === "year" ? "year" : period.startsWith("quarter-") ? "quarter" : "month";
}

export function defaultPeriodForMode(year, mode, today) {
  if (mode === "year") return "year";
  const available = periodOptions(year, today).filter((row) => row.value.startsWith(`${mode}-`) && !row.disabled);
  return available.at(-1)?.value || "year";
}

export function filterMarkup(state, years) {
  const mode = modeForPeriod(state.period);
  const choices = periodOptions(state.year, state.today).filter((row) => row.value.startsWith(`${mode}-`));
  return `<div class="report-filter" data-report-filter>
    <label class="report-year"><span>Năm</span><input type="text" role="combobox" aria-label="Năm báo cáo" aria-autocomplete="list" aria-expanded="false" aria-controls="report-years" inputmode="numeric" autocomplete="off" data-report-year value="${state.year}"><div id="report-years" role="listbox" hidden data-report-years>${years.map((year) => `<button type="button" role="option" aria-selected="${year === state.year}" data-report-year-option="${year}">${year}</button>`).join("")}</div><small data-report-year-error role="status"></small></label>
    <label><span>Xem theo</span><select data-report-mode>${option("month", "Tháng", mode === "month")}${option("quarter", "Quý", mode === "quarter")}${option("year", "Cả năm", mode === "year")}</select></label>
    <label ${mode === "year" ? "hidden" : ""}><span>${mode === "quarter" ? "Quý" : "Tháng"}</span><select data-report-period>${choices.map((row) => option(row.value, row.label, row.value === state.period, row.disabled)).join("")}</select></label>
    <label data-report-building-wrap ${state.view === "compare" ? "hidden" : ""}><span>Căn</span><select data-report-building>${option("", "Tất cả căn", !state.buildingId)}${state.buildings.map((row) => option(row.ma_can, row.ten_can, state.buildingId === row.ma_can)).join("")}</select></label>
  </div>`;
}
