const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", file), "utf8");

test("FR-133 report consumers use net, gross, discount, deposit and snapshot detail fields", () => {
  const reports = read("modules/finance/reports.tab.js");
  const dashboard = read("modules/overview/dashboard.tab.js");
  const dashboardMetrics = read("modules/overview/dashboard.metrics.mjs");
  const connected = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/assets/js/pages/connectedPages.page.js"), "utf8");
  for (const source of [reports, connected]) {
    assert.match(source, /totalRevenue/);
    assert.match(source, /grossRevenue/);
    assert.match(source, /discounts/);
    assert.match(source, /depositDeductions/);
  }
  assert.match(dashboard, /readCashflow\(/);
  assert.match(dashboardMetrics, /response\?\.data\?\.totalRevenue/);
  assert.match(dashboardMetrics, /Number\.isSafeInteger\(value\)/);
  assert.match(reports, /grossAmount/);
  assert.match(reports, /discountAllocated/);
  assert.match(reports, /snapshotSource/);
  assert.match(reports, /byBuilding/);
  assert.match(reports, /revenueByType/);
});
