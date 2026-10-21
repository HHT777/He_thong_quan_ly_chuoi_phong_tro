const test = require("node:test");
const assert = require("node:assert/strict");
const { monthOffset } = require("../src/services/dashboardInsights.service");

test("UI-2a six report months cross year and Vietnam month boundary without machine time", () => {
  assert.equal(monthOffset("2026-01", -5), "2025-08");
  assert.equal(monthOffset("2026-11", -1), "2026-10");
  assert.equal(monthOffset("2026-11", 0), "2026-11");
});
