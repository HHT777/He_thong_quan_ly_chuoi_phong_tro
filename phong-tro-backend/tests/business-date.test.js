const test = require("node:test");
const assert = require("node:assert/strict");
const { businessDate, businessMonth, addBusinessDays } = require("../src/utils/businessDate.util");

test("FR-187 Vietnam business date crosses the UTC month boundary", () => {
  const instant = new Date("2026-10-31T19:00:00.000Z");
  assert.equal(businessDate(instant), "2026-11-01");
  assert.equal(businessMonth(instant), "2026-11");
  assert.equal(businessDate("2026-11-01"), "2026-11-01");
  assert.equal(addBusinessDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addBusinessDays("2026-11-01", -1), "2026-10-31");
});
