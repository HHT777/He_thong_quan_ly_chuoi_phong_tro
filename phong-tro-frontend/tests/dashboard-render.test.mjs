import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import dashboard from "../src/modules/overview/dashboard.tab.js";
import { insightsResponse } from "./fixtures/dashboard-insights.sample.mjs";

const summary = { data: { period: "2026-10", rooms: { total: 30, byStatus: { TRONG: 12, DA_GIU: 0, DANG_THUE: 15, DANG_XU_LY_TRA_PHONG: 1, NGUNG_SU_DUNG: 2, KHAC: 0 } }, bills: { total: 16, daThu: 5, conNo: 0, quaHan: 11 } } };
const responses = {
  "/v1/dashboard/summary": summary,
  "/v1/dashboard/insights": insightsResponse,
  "/v1/incidents": { data: [{ ma_su_co: "1", mo_ta: "Hỏng <script>alert(1)</script>", ma_phong: "101", trang_thai: "CHO_TIEP_NHAN", ngay_gui: "2026-10-20" }] },
};
const source = (path) => Object.keys(responses).find((prefix) => path.startsWith(prefix));

function harness(reject = {}, customResponses = responses) {
  const elements = new Map();
  const extraTasks = [{ hidden: true }, { hidden: true }];
  const listeners = new Map();
  const main = {
    innerHTML: "",
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { innerHTML: "", hidden: true, textContent: "", attributes: {},
        setAttribute(key, value) { this.attributes[key] = value; }, getAttribute(key) { return this.attributes[key]; } });
      return elements.get(selector);
    },
    querySelectorAll(selector) { return selector === "[data-task-extra]" ? extraTasks : []; },
    addEventListener(type, handler) { listeners.set(type, handler); },
  };
  const calls = [];
  const context = { main, go() {}, api: { async get(path) { calls.push(path); const key = source(path); if (reject[key]) throw reject[key]; return customResponses[key]; } } };
  const body = (key) => main.querySelector(`[data-body="${key}"]`).innerHTML;
  return { context, main, calls, body, extraTasks,
    click: (target) => listeners.get("click")({ target }),
    interact: (type, target, relatedTarget = null) => listeners.get(type)?.({ target, relatedTarget }),
    element: (selector) => main.querySelector(selector) };
}

test("UI-2a-2 loads only summary, insights and incidents once, and renders all dashboard groups", async () => {
  const ui = harness();
  await dashboard.render(ui.context);
  assert.equal(ui.calls.length, 3);
  for (const route of Object.keys(responses)) assert.equal(ui.calls.filter((path) => path.startsWith(route)).length, 1);
  assert.doesNotMatch(ui.calls.join(" "), /\/reports\/cashflow|\/hop-dong\/expiring/);
  assert.match(ui.body("totalRooms"), />30</);
  assert.match(ui.body("rentedRooms"), />15</);
  assert.match(ui.body("occupancy"), />50%</);
  assert.match(ui.body("revenue"), /29\.475\.661 đ/);
  assert.match(ui.body("revenue"), /-45,67% so với tháng trước/);
  for (const key of ["totalRooms", "rentedRooms", "occupancy", "overdue"]) assert.doesNotMatch(ui.body(key), /so với tháng trước/);
  assert.match(ui.body("overdue"), />11 /);
  assert.match(ui.body("cashflow"), /<svg[^>]*role="img"/);
  assert.match(ui.body("cashflow"), /54256250/);
  assert.match(ui.body("buildingOccupancy"), /Căn trọ Hoa Sen/);
  assert.match(ui.body("bills"), /16 phiếu định kỳ/);
  assert.match(ui.body("rooms"), /Đã giữ/);
  assert.match(ui.body("rooms"), /Khác/);
  assert.match(ui.body("contracts"), /Trong 90 ngày/);
  assert.match(ui.body("tasks"), /Phiếu thu quá hạn/);
  assert.equal((ui.body("rooms").match(/class="ui1-ring__/g) || []).length, 4);
  assert.match(ui.body("rooms"), /class="ui1-ring__dang_thue"[^>]*pathLength="[^"]+"[^>]*stroke-linecap="butt"/);
  assert.doesNotMatch(ui.body("incidents"), /<script>/);
});

test("FR-132 dashboard links incidents and every task to its processing screen", async () => {
  const allTasks = structuredClone(insightsResponse);
  allTasks.data.tasks.forEach((task) => { task.count = 1; });
  const ui = harness({}, { ...responses, "/v1/dashboard/insights": allTasks });
  await dashboard.render(ui.context);
  for (const route of ["/finance/debts", "/residents-contracts/reservations", "/operations/incidents?status=CHO_TIEP_NHAN", "/residents-contracts/requests", "/operations/meter-readings", "/residents-contracts/contracts", "/properties/rooms?status=TRONG"]) {
    assert.ok(ui.body("tasks").includes(`href="#${route}"`), `Missing task destination ${route}`);
  }
  assert.ok(ui.body("incidents").includes('href="#/operations/incidents?search=1"'));
  assert.ok(ui.body("incidents").includes('href="#/operations/incidents?status=DANG_XU_LY"'));
  assert.equal(ui.calls.length, 3);
});

test("FR-132 chart details come from the three loaded APIs on hover and keyboard focus", async () => {
  const ui = harness();
  await dashboard.render(ui.context);
  for (const key of ["rooms", "cashflow", "buildingOccupancy", "bills", "contracts", "incidents"]) {
    assert.match(ui.body(key), /data-chart-detail=/, `${key} must expose a data-backed detail target`);
    assert.match(ui.body(key), /data-hover-readout/, `${key} must show an inline detail area`);
  }
  assert.match(ui.body("rooms"), /data-chart-detail="Đang thuê: 15 phòng \(50%\)"/);
  assert.match(ui.body("cashflow"), /Thu 29\.475\.661 đ; Chi 4\.380\.000 đ; Lợi nhuận 25\.095\.661 đ/);
  assert.match(ui.body("buildingOccupancy"), /Căn trọ Hoa Sen: 5\/10 phòng đang thuê \(50%\)/);
  assert.match(ui.body("bills"), /Quá hạn: 11\/16 phiếu định kỳ/);
  assert.match(ui.body("contracts"), /Trong 30 ngày: 1 hợp đồng/);
  assert.match(ui.body("incidents"), /Chờ tiếp nhận: 1\/1 sự cố/);
  const css = readFileSync(new URL("../src/shared/styles/dashboard.css", import.meta.url), "utf8");
  assert.match(css, /\.ui1-ring span\s*\{[^}]*pointer-events:\s*none/, "center label must not block hovering the ring");
  const detail = { dataset: { chartPanel: "rooms", chartDetail: "Đang thuê: 15 phòng (50%)" }, closest(selector) { return selector === "[data-chart-detail]" ? this : null; } };
  const readout = ui.element('[data-hover-readout="rooms"]');
  ui.interact("mouseover", detail);
  assert.equal(readout.textContent, detail.dataset.chartDetail);
  ui.interact("focusin", detail);
  assert.equal(readout.textContent, detail.dataset.chartDetail);
  ui.interact("focusout", detail);
  assert.equal(readout.textContent, "");
  assert.equal(ui.calls.length, 3, "hover/focus must not fetch again");
});

test("UI-2a-2 one failed insights source shows its own safe error and retries once", async () => {
  const ui = harness({ "/v1/dashboard/insights": Object.assign(new Error("SQL secret"), { status: 503, code: "DB_SCHEMA_OUTDATED" }) });
  await dashboard.render(ui.context);
  for (const key of ["revenue", "overdue", "cashflow", "buildingOccupancy", "bills", "contracts", "tasks"]) {
    assert.match(ui.body(key), /Thử lại/);
    assert.match(ui.body(key), /cần cập nhật dữ liệu/);
    assert.doesNotMatch(ui.body(key), /SQL|secret|>0</);
  }
  assert.match(ui.body("totalRooms"), />30</);
  assert.match(ui.body("incidents"), /Sự cố gần đây/);
  ui.context.api.get = async (path) => { ui.calls.push(path); return responses[source(path)]; };
  ui.click({ closest: (selector) => selector === "[data-retry]" ? { dataset: { retry: "insights" } } : null });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(ui.body("revenue"), /29\.475\.661 đ/);
  assert.equal(ui.calls.length, 4);
});

test("UI-2a-2 401, 403, 404, schema 503, 5xx and network errors never become fake zero", async () => {
  for (const error of [{ status: 401 }, { status: 403 }, { status: 404 }, { status: 503, code: "DB_SCHEMA_OUTDATED" }, { status: 500 }, new TypeError("network")]) {
    const ui = harness({ "/v1/dashboard/summary": error });
    await dashboard.render(ui.context);
    for (const key of ["totalRooms", "rentedRooms", "occupancy", "rooms"]) {
      assert.match(ui.body(key), /Thử lại/);
      assert.doesNotMatch(ui.body(key), /data-target|>0<|network|DB_SCHEMA_OUTDATED/);
    }
  }
});

test("UI-2a-2 empty data, no previous month and hostile text render safely", async () => {
  const empty = structuredClone(insightsResponse);
  empty.data.cashflow6m = empty.data.cashflow6m.map((row) => ({ ...row, totalRevenue: 0, totalExpenses: 0, profit: 0 }));
  empty.data.revenueChangePct = null;
  empty.data.occupancyByBuilding = [];
  empty.data.billBuckets = { paid: 0, outstanding: 0, overdue: 0, total: 0 };
  empty.data.tasks = empty.data.tasks.map((row) => ({ ...row, count: 0 }));
  const zeroSummary = structuredClone(summary);
  zeroSummary.data.rooms.total = 0;
  zeroSummary.data.rooms.byStatus = Object.fromEntries(Object.keys(zeroSummary.data.rooms.byStatus).map((key) => [key, 0]));
  const ui = harness({}, { "/v1/dashboard/summary": zeroSummary, "/v1/dashboard/insights": empty, "/v1/incidents": { data: [] } });
  await dashboard.render(ui.context);
  assert.match(ui.body("rooms"), /Chưa có phòng/);
  assert.match(ui.body("bills"), /Chưa có phiếu/);
  assert.match(ui.body("buildingOccupancy"), /Chưa có căn/);
  assert.match(ui.body("tasks"), /Không có việc cần xử lý/);
  assert.match(ui.body("revenue"), /Chưa có kỳ trước để so sánh/);
  assert.doesNotMatch(ui.body("cashflow"), /NaN|Infinity/);
  assert.match(ui.body("incidents"), /Chưa có sự cố/);
  const hostile = structuredClone(insightsResponse);
  hostile.data.occupancyByBuilding[0].buildingName = '<script>alert("x")</script>';
  const other = harness({}, { ...responses, "/v1/dashboard/insights": hostile });
  await dashboard.render(other.context);
  assert.doesNotMatch(other.body("buildingOccupancy"), /<script>/);
  assert.match(other.body("buildingOccupancy"), /&lt;script&gt;/);
  assert.match(other.body("buildingOccupancy"), /data-chart-detail="[^"]*&lt;script&gt;/);
  hostile.data.occupancyByBuilding[2].inComparison = false;
  hostile.data.cashflow6m[5].totalExpenses = 30000000;
  hostile.data.cashflow6m[5].profit = -524339;
  const negative = harness({}, { ...responses, "/v1/dashboard/insights": hostile });
  await dashboard.render(negative.context);
  assert.match(negative.body("buildingOccupancy"), /Ngừng hoạt động, không tham gia so sánh/);
  assert.match(negative.body("cashflow"), /-524339/);
  assert.doesNotMatch(negative.body("cashflow"), /NaN|Infinity/);
});

test("UI-2a-2 every card starts loading and six or seven tasks expand locally without another API call", async () => {
  const many = structuredClone(insightsResponse);
  many.data.tasks = many.data.tasks.map((row) => ({ ...row, count: 1 }));
  const ui = harness({}, { ...responses, "/v1/dashboard/insights": many });
  const rendering = dashboard.render(ui.context);
  assert.equal((ui.main.innerHTML.match(/Đang tải\.\.\./g) || []).length, 12);
  await rendering;
  assert.match(ui.body("tasks"), /data-task-extra hidden/);
  const toggle = { attributes: { "aria-expanded": "false" }, textContent: "", getAttribute(name) { return this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; } };
  ui.click({ closest: (selector) => selector === "[data-tasks-toggle]" ? toggle : null });
  assert.equal(toggle.attributes["aria-expanded"], "true");
  assert.equal(ui.extraTasks.every((row) => row.hidden === false), true);
  assert.equal(ui.calls.length, 3);
  ui.click({ closest: (selector) => selector === "[data-tasks-toggle]" ? toggle : null });
  assert.equal(ui.extraTasks.every((row) => row.hidden === true), true);
});

test("UI-2a-2 one widget render failure does not hide sibling widgets", async () => {
  const broken = structuredClone(insightsResponse);
  broken.data.cashflow6m[0].unassignedExpenses = { get total() { throw new Error("SQL secret"); } };
  const ui = harness({}, { ...responses, "/v1/dashboard/insights": broken });
  await dashboard.render(ui.context);
  assert.match(ui.body("cashflow"), /Thử lại/);
  assert.doesNotMatch(ui.body("cashflow"), /SQL|secret/);
  assert.match(ui.body("revenue"), /29\.475\.661 đ/);
  assert.match(ui.body("buildingOccupancy"), /Căn trọ Hoa Sen/);
});
