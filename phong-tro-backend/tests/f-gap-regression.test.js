const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const report = require("../src/services/cashflowReport.service");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../src", file), "utf8");

test("F.1 invalid report period is a client error and all period modes are wired", () => {
  assert.throws(() => report.buildWhere({ from: "2026-02-30" }), (e) => e.status === 400);
  for (const [periodType, periodValue] of [["month", "2026-02"], ["quarter", "2026-1"], ["year", "2026"]]) {
    const { receiptWhere } = report.buildWhere({ periodType, periodValue });
    assert.ok(receiptWhere.ngay_ghi_nhan);
  }
});

test("F.1 report route is landlord-only and exposes building/type breakdowns", () => {
  const route = read("routes/mvp.routes.js");
  const start = route.indexOf('router.get("/reports/cashflow"');
  const section = route.slice(start, route.indexOf("\n});", start) + 4);
  assert.match(section, /router\.get\("\/reports\/cashflow", landlord/);
  assert.match(read("services/cashflowReport.service.js"), /revenueByType/);
  assert.match(read("services/cashflowReport.service.js"), /byBuilding/);
});

test("F.2 rejection requires a reason, is landlord-only, and records the reason", () => {
  const route = read("routes/mvp.routes.js");
  assert.match(route, /router\.patch\("\/requests\/:id", landlord/);
  assert.match(route, /fail\(400, "Lý do từ chối là bắt buộc", "REQUEST_REJECTION_REASON_REQUIRED"\)/);
  assert.match(route, /ly_do_tu_choi/);
});

test("F.2 all billing paths use the date-aware occupancy helper", () => {
  const billing = read("services/billGeneration.service.js");
  const moveOut = read("services/moveOut.service.js");
  assert.match(billing, /countBillableOccupants\(contract\.ma_hop_dong, \{ atDate:/);
  assert.match(moveOut, /countBillableOccupants\(contractId/);
  assert.match(read("services/occupancy.service.js"), /ngay_roi: \{ \[Op\.gt\]: date \}/);
});
