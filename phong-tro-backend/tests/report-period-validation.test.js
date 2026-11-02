const test = require("node:test");
const assert = require("node:assert/strict");
const report = require("../src/services/cashflowReport.service");
const { validateQuery } = require("../src/utils/queryValidation");

const rejects = (input, code) => assert.throws(() => report.buildWhere(input), (error) => error.status === 400 && error.code === code);

test("FR-132 defaults to the current Vietnam month when no period is supplied", () => {
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
  const implicit = report.buildWhere({}).receiptWhere.ngay_ghi_nhan;
  const explicit = report.buildWhere({ periodType: "month", periodValue: month }).receiptWhere.ngay_ghi_nhan;
  assert.deepEqual(implicit, explicit);
});

test("FR-143 rejects a missing period pair with REPORT_PERIOD_INCOMPLETE", () => {
  rejects({ periodType: "month" }, "REPORT_PERIOD_INCOMPLETE");
  rejects({ periodValue: "2026-10" }, "REPORT_PERIOD_INCOMPLETE");
});
test("FR-143 rejects unknown period type with REPORT_PERIOD_TYPE_INVALID", () => rejects({ periodType: "week", periodValue: "2026-10" }, "REPORT_PERIOD_TYPE_INVALID"));
test("FR-143 rejects malformed and out-of-range periods with REPORT_PERIOD_VALUE_INVALID", () => {
  for (const [periodType, periodValue] of [["month", "2026-13"], ["quarter", "2026-5"], ["year", "0000"], ["year", "2200"], ["month", "abc"]]) rejects({ periodType, periodValue }, "REPORT_PERIOD_VALUE_INVALID");
});
test("FR-143 rejects conflicting period and date filters with REPORT_PERIOD_CONFLICT", () => rejects({ periodType: "year", periodValue: "2026", from: "2026-01-01" }, "REPORT_PERIOD_CONFLICT"));
test("FR-143 keeps valid period and building filters, unknown building IDs return an empty result at DB layer", () => {
  assert.ok(report.buildWhere({ periodType: "quarter", periodValue: "2026-4" }).receiptWhere.ngay_ghi_nhan);
  assert.equal(report.buildWhere({ periodType: "year", periodValue: "2026", buildingId: "00000000-0000-4000-8000-000000000001" }).receiptWhere.ma_can, "00000000-0000-4000-8000-000000000001");
  rejects({ buildingId: "not-a-uuid" }, "INVALID_REPORT_BUILDING");
});
test("FR-143 route query contracts reject unknown, malformed period, pagination and date input", () => {
  assert.throws(() => validateQuery({ surprise: "x" }), (error) => error.status === 400);
  assert.throws(() => validateQuery({ ky: "2026-13" }, { periods: ["ky"] }), (error) => error.status === 400);
  assert.throws(() => validateQuery({ page: "one" }, { positiveIntegers: ["page"] }), (error) => error.status === 400);
  assert.throws(() => validateQuery({ startDate: "2026-02-30" }, { dates: ["startDate"] }), (error) => error.status === 400);
});
