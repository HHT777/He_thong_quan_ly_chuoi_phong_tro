import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrastRatio } from "../src/shared/design/contrast.mjs";
import { cashflowPath, loadReportTrend, reportHash, reportUrlState } from "../src/modules/finance/report.data.mjs";
import { reportKpis, reportScreen, statusBlock } from "../src/modules/finance/report.screen.mjs";
import { buildingComparisonChart, overviewChart, profitBridgeChart, timeChart, typeChart } from "../src/modules/finance/report.charts.mjs";
import { defaultPeriodForMode, filterMarkup } from "../src/modules/finance/report.filter.mjs";

const data = {
  totalRevenue: 5000000, grossRevenue: 5100000, discounts: 100000, depositDeductions: 0,
  totalExpenses: 2000000, profit: 3000000,
  revenueByType: [{ type: "SUA_CHUA", amount: 100000 }, { type: "TIEN_PHONG", amount: 4900000 }],
  expensesByType: [{ type: "BAO_TRI", amount: 2000000 }],
  byBuilding: [{ buildingId: "a", inComparison: true, revenue: 5000000, expenses: 2000000, profit: 3000000 }],
  receiptDetails: [{ source: "THU_TIEN", type: "TIEN_PHONG", amount: 4900000, date: "2026-10-09", buildingId: "a" }],
};
const rows = [{ month: "2026-09", totalRevenue: 0, totalExpenses: 100, profit: -100 }, { month: "2026-10", totalRevenue: 5000000, totalExpenses: 2000000, profit: 3000000 }];
const state = (patch = {}) => ({
  year: 2026, period: "month-10", buildingId: "", view: "chart", metric: "", buildingCount: 2,
  buildingNames: new Map([["a", "Căn Hoa Sen"]]), applied: { buildingId: "", mode: "month", month: "2026-10" },
  data, trend: rows, summaryStatus: "ready", trendStatus: "ready", perspective: { revenue: "time", expenses: "time", profit: "time" }, kinds: {}, selectedMonth: "2026-10", ...patch,
});

test("URL giữ bộ lọc và API dùng đúng kỳ/căn", () => {
  const hash = reportHash(state({ buildingId: "a", view: "table", metric: "revenue" }));
  assert.deepEqual(reportUrlState(hash, [2026, 2025], "2026-10"), { year: 2026, period: "month-10", buildingId: "a", view: "table", metric: "revenue" });
  assert.equal(cashflowPath({ year: 2026, period: "quarter-2", buildingId: "a" }), "/v1/reports/cashflow?buildingId=a&periodType=quarter&periodValue=2026-2");
});

test("xu hướng tháng dùng insights, năm dùng cashflow tháng; signal được chuyển vào request", async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const api = { request: async (path, options) => {
    calls.push([path, options.signal]);
    if (path.includes("insights")) return { data: { cashflow6m: rows } };
    return { data };
  } };
  const month = await loadReportTrend(api, { year: 2026, period: "month-10", buildingId: "a" }, signal);
  assert.equal(month.length, 6);
  assert.equal(month[0].totalRevenue, 0);
  assert.match(calls[0][0], /\/v1\/dashboard\/insights\?period=2026-10&buildingId=a/);
  calls.length = 0;
  const quarter = await loadReportTrend(api, { year: 2026, period: "quarter-2", buildingId: "" }, signal);
  assert.deepEqual(quarter.map((row) => row.month), ["2026-04", "2026-05", "2026-06"]);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call[1] === signal));
});

test("KPI là nút và từng góc nhìn chỉ hiện chỉ tiêu đã chọn", () => {
  assert.match(reportKpis(data, "profit"), /data-report-metric="profit" aria-pressed="true"/);
  const overview = reportScreen(state());
  assert.match(overview, /Thu – chi – lợi nhuận theo tháng/);
  assert.doesNotMatch(overview, /Cơ cấu doanh thu|So sánh các căn<\/h2>/);
  const revenue = reportScreen(state({ metric: "revenue", perspective: { revenue: "other" } }));
  assert.match(revenue, /Theo loại thu/);
  assert.match(revenue, /Sửa chữa/);
  assert.doesNotMatch(revenue, /sua chua/);
  assert.doesNotMatch(revenue, /Thu – chi – lợi nhuận theo tháng/);
  const profit = reportScreen(state({ metric: "profit" }));
  assert.match(profit, /data-report-kind="area"/);
  assert.match(profit, /Xem tổng quan/);
});

test("mỗi góc nhìn chỉ có hai kiểu biểu đồ và loại bỏ lựa chọn cũ đã lưu", () => {
  const time = reportScreen(state({ metric: "revenue", kinds: { "revenue:time": "line" } }));
  assert.match(time, /data-report-kind="bar" aria-pressed="true"/);
  assert.match(time, /data-report-kind="area"/);
  assert.doesNotMatch(time, /data-report-kind="line"/);
  const types = reportScreen(state({ metric: "expenses", perspective: { expenses: "other" }, kinds: { "expenses:other": "column" } }));
  assert.match(types, /data-report-kind="horizontal" aria-pressed="true"/);
  assert.match(types, /data-report-kind="pie"/);
  assert.doesNotMatch(types, /data-report-kind="column"/);
  assert.match(types, /Bảo trì: 2\.000\.000/);
  assert.doesNotMatch(types, /Tiền phòng: 4\.900\.000/);
  const profit = reportScreen(state({ metric: "profit", perspective: { profit: "other" }, kinds: { "profit:other": "step" } }));
  assert.doesNotMatch(profit, /data-report-kind="step"/);
});

test("khối lỗi, tải, rỗng, có dữ liệu độc lập", () => {
  assert.match(statusBlock({ status: "error", error: Error("Lỗi server"), retry: "trend" }), /data-report-retry="trend"/);
  assert.match(statusBlock({ status: "loading" }), /aria-label="Đang tải"/);
  assert.match(statusBlock({ status: "ready" }), /Chưa có dữ liệu/);
  assert.match(statusBlock({ status: "ready", body: "Dữ liệu" }), /Dữ liệu/);
  const failedTrend = reportScreen(state({ trendStatus: "error", trendError: Error("Không tải được xu hướng") }));
  assert.match(failedTrend, /5\.000\.000 đ/);
  assert.match(failedTrend, /Không tải được xu hướng/);
  const failedSummary = reportScreen(state({ data: null, summaryStatus: "error", summaryError: Error("Không tải được tổng") }));
  assert.match(failedSummary, /data-report-retry="summary"/);
  assert.match(failedSummary, /Thu – chi – lợi nhuận theo tháng/);
});

test("đồ thị âm, bằng 0, một điểm, nhiều loại và profit bridge", () => {
  assert.match(timeChart(rows, "profit", "area"), /report-series-area/);
  assert.match(timeChart([{ month: "2026-10", totalRevenue: 0 }], "revenue", "line"), /report-series-point/);
  assert.match(overviewChart(rows), /Đường vàng: lợi nhuận/);
  assert.match(typeChart(data.revenueByType, "revenue", "pie"), /100,0%/);
  assert.match(typeChart(data.revenueByType, "revenue", "pie"), /<path class="report-pie-slice/);
  assert.doesNotMatch(typeChart(data.revenueByType, "revenue", "pie"), /stroke-dasharray/);
  assert.match(profitBridgeChart({ ...data, profit: -100 }, "pie"), /chỉ dùng khi lợi nhuận không âm/);
  assert.match(profitBridgeChart(data, "step"), /report-bridge-step/);
});

test("bộ lọc tách năm, loại kỳ và quý; không chọn kỳ tương lai", () => {
  const markup = filterMarkup({ year: 2026, period: "quarter-2", today: "2026-10", view: "chart", buildingId: "", buildings: [] }, [2026, 2025]);
  assert.match(markup, /data-report-year/);
  assert.match(markup, /class="report-year-grid"/);
  assert.match(markup, /data-report-year-option="2025"/);
  assert.doesNotMatch(markup, /input type="text" role="combobox"/);
  assert.match(markup, /data-report-mode/);
  assert.match(markup, /data-report-period/);
  assert.match(markup, /Quý 2/);
  assert.doesNotMatch(markup, /<optgroup/);
  assert.equal(defaultPeriodForMode(2026, "quarter", "2026-10"), "quarter-4");
  assert.equal(defaultPeriodForMode(2026, "month", "2026-10"), "month-10");
  assert.equal(defaultPeriodForMode(2026, "year", "2026-10"), "year");
});

test("so sánh căn có biểu đồ cột cùng tỷ lệ, cột lỗ và số API nguyên giá trị", () => {
  const names = new Map([["a", "Căn Hoa Sen"], ["b", "Căn Bình Minh"]]);
  const compared = [{ buildingId: "a", inComparison: true, revenue: 5000000, expenses: 2000000, profit: 3000000 }, { buildingId: "b", inComparison: true, revenue: 1000000, expenses: 1500000, profit: -500000 }];
  const chart = buildingComparisonChart(compared, names);
  assert.match(chart, /report-compare-columns/);
  assert.match(chart, /report-compare-column--revenue/);
  assert.match(chart, /report-compare-column--expenses/);
  assert.match(chart, /report-compare-column--loss/);
  assert.match(chart, /−500\.000 đ/);
  assert.match(chart, /height="48"/);
  assert.match(reportScreen(state({ view: "compare", data: { ...data, byBuilding: compared }, buildingNames: names })), /report-compare-columns/);
  assert.doesNotMatch(buildingComparisonChart([{ ...compared[0], buildingId: '<script>' }], new Map()), /<script>/);
});

test("chú thích có ký hiệu và chấm lợi nhuận nhỏ", () => {
  const chart = overviewChart(rows);
  assert.match(chart, /report-legend-symbol--profit/);
  assert.match(chart, /report-legend-symbol--expenses/);
  assert.match(chart, /report-overview-profit-point[^>]*r="3\.5"/);
  const css = readFileSync(new URL("../src/modules/finance/reports.css", import.meta.url), "utf8");
  assert.match(css, /report-graphic \{[^}]*850px/);
  assert.match(css, /report-focus-panel \{ min-height: 0; \}/);
});

test("bảng hỗ trợ trình đọc màn hình không kéo dài trang báo cáo", () => {
  const chart = overviewChart(rows);
  assert.match(chart, /<div class="report-sr-only"><table>/);
  assert.doesNotMatch(chart, /<table class="report-sr-only">/);
  const css = readFileSync(new URL("../src/modules/finance/reports.css", import.meta.url), "utf8");
  assert.match(css, /\.report-sr-only \{[^}]*overflow: hidden;/);
});

test("token viền lợi nhuận có tương phản đồ họa tối thiểu 3:1; phép thử phủ định nhạt bị đỏ", () => {
  const css = readFileSync(new URL("../src/shared/styles/ui2-shell.css", import.meta.url), "utf8");
  const line = css.match(/--chart-profit-line:\s*(#[0-9a-fA-F]{6})/)?.[1];
  assert.ok(contrastRatio(line, "#ffffff") >= 3);
  assert.ok(contrastRatio("#f6c26b", "#ffffff") < 3);
});
