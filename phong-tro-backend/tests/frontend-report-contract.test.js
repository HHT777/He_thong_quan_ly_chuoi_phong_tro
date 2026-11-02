const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", file), "utf8");

test("FR-133 report consumers use net, gross, discount, deposit and snapshot detail fields", () => {
  const reports = read("modules/finance/reports.tab.js") + read("modules/finance/report.view.mjs") + read("modules/finance/report.model.mjs");
  const dashboard = read("modules/overview/dashboard.view.mjs");
  const dashboardMetrics = read("modules/overview/dashboard.insights.mjs");
  assert.match(reports, /totalRevenue/);
  assert.match(reports, /grossRevenue/);
  assert.match(reports, /discounts/);
  assert.match(reports, /depositDeductions/);
  assert.match(dashboard, /readInsights\(/);
  assert.match(dashboard, /insights\.cashflow6m\[5\]\.totalRevenue/);
  assert.match(dashboardMetrics, /row\.totalRevenue/);
  assert.match(dashboardMetrics, /Number\.isSafeInteger\(value\)/);
  assert.match(reports, /grossAmount/);
  assert.match(reports, /discountAllocated/);
  assert.match(reports, /snapshotSource/);
  assert.match(reports, /byBuilding/);
  assert.match(reports, /revenueByType/);
});
