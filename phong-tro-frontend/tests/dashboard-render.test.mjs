import test from "node:test";
import assert from "node:assert/strict";
import dashboard from "../src/modules/overview/dashboard.tab.js";

const summary = { data: { period: "2026-10", rooms: { total: 30, byStatus: { TRONG: 12, DA_GIU: 0, DANG_THUE: 15, DANG_XU_LY_TRA_PHONG: 1, NGUNG_SU_DUNG: 2, KHAC: 0 } }, bills: { total: 16, daThu: 5, conNo: 0, quaHan: 11 } } };
const responses = {
  "/v1/dashboard/summary": summary,
  "/v1/reports/cashflow": { data: { totalRevenue: 29475661 } },
  "/hop-dong/expiring": { data: [] },
  "/v1/incidents": { data: [{ ma_su_co: "1", mo_ta: "Hỏng <script>alert(1)</script>", ma_phong: "101", trang_thai: "CHO_TIEP_NHAN", ngay_gui: "2026-10-20" }] },
};
const source = (path) => Object.keys(responses).find((prefix) => path.startsWith(prefix));

function harness(reject = {}) {
  const elements = new Map();
  let onClick;
  const main = {
    innerHTML: "",
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { innerHTML: "", hidden: true, setAttribute() {} });
      return elements.get(selector);
    },
    addEventListener(type, handler) { if (type === "click") onClick = handler; },
  };
  const calls = [];
  const context = { main, go() {}, api: { async get(path) { calls.push(path); const key = source(path); if (reject[key]) throw reject[key]; return responses[key]; } } };
  const body = (key) => main.querySelector(`[data-body="${key}"]`).innerHTML;
  return { context, main, calls, body, click: (target) => onClick({ target }) };
}

test("UI-1a loads four sources once and reuses summary for six visual blocks", async () => {
  const ui = harness();
  await dashboard.render(ui.context);
  assert.equal(ui.calls.length, 4);
  assert.equal(ui.calls.filter((path) => path.startsWith("/v1/dashboard/summary")).length, 1);
  assert.match(ui.body("totalRooms"), />30</);
  assert.match(ui.body("rentedRooms"), />15</);
  assert.match(ui.body("occupancy"), />50%</);
  assert.match(ui.body("revenue"), /29\.475\.661 đ/);
  assert.match(ui.body("overdue"), />11 /);
  assert.match(ui.body("bills"), /16 phiếu định kỳ/);
  assert.match(ui.body("rooms"), /Đã giữ/);
  assert.match(ui.body("rooms"), /Khác/);
  assert.doesNotMatch(ui.main.innerHTML, /Thu.chi theo tháng|Lấp đầy theo căn|Việc cần xử lý/);
  assert.doesNotMatch(ui.body("incidents"), /<script>/);
});

test("UI-1a one failed source has its own error and retry without zeroing other blocks", async () => {
  const ui = harness({ "/v1/reports/cashflow": Object.assign(new Error("SQL secret"), { status: 503, code: "DB_SCHEMA_OUTDATED" }) });
  await dashboard.render(ui.context);
  assert.match(ui.body("revenue"), /Thử lại/);
  assert.match(ui.body("revenue"), /cần cập nhật dữ liệu/);
  assert.doesNotMatch(ui.body("revenue"), /SQL|secret|>0</);
  assert.match(ui.body("totalRooms"), />30</);
  delete ui.context.api.get;
  ui.context.api.get = async (path) => { ui.calls.push(path); return responses[source(path)]; };
  ui.click({ closest: (selector) => selector === "[data-retry]" ? { dataset: { retry: "cashflow" } } : null });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(ui.body("revenue"), /29\.475\.661 đ/);
  assert.equal(ui.calls.length, 5);
});

test("UI-1a status-specific failures all show a retry instead of a fake zero", async () => {
  for (const error of [{ status: 401 }, { status: 403 }, { status: 404 }, { status: 503, code: "DB_SCHEMA_OUTDATED" }, { status: 500 }, new TypeError("network")]) {
    const ui = harness({ "/v1/dashboard/summary": error });
    await dashboard.render(ui.context);
    for (const key of ["totalRooms", "rentedRooms", "occupancy", "overdue", "rooms", "bills"]) {
      assert.match(ui.body(key), /Thử lại/);
      assert.doesNotMatch(ui.body(key), /data-target|>0<|network|DB_SCHEMA_OUTDATED/);
    }
  }
});
