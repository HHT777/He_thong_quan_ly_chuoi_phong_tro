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
    <div class="report-year"><span>Năm</span><button type="button" class="report-year-trigger" data-report-year aria-label="Chọn năm báo cáo" aria-expanded="false" aria-controls="report-years">${state.year}<span aria-hidden="true">▾</span></button><div id="report-years" class="report-year-grid" role="group" aria-label="Chọn năm" hidden data-report-years>${years.map((year) => `<button type="button" aria-pressed="${year === state.year}" data-report-year-option="${year}">${year}</button>`).join("")}</div></div>
    <label><span>Xem theo</span><select data-report-mode>${option("month", "Tháng", mode === "month")}${option("quarter", "Quý", mode === "quarter")}${option("year", "Cả năm", mode === "year")}</select></label>
    <label ${mode === "year" ? "hidden" : ""}><span>${mode === "quarter" ? "Quý" : "Tháng"}</span><select data-report-period>${choices.map((row) => option(row.value, row.label, row.value === state.period, row.disabled)).join("")}</select></label>
    <label data-report-building-wrap ${state.view === "compare" ? "hidden" : ""}><span>Căn</span><select data-report-building>${option("", "Tất cả căn", !state.buildingId)}${state.buildings.map((row) => option(row.ma_can, row.ten_can, state.buildingId === row.ma_can)).join("")}</select></label>
    <div class="report-export-slot" data-report-export-slot></div>
  </div>`;
}
