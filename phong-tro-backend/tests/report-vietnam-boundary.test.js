const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const { buildWhere, vietnamMonth } = require("../src/services/cashflowReport.service");
const { localParts: billingLocalParts } = require("../src/services/billingCron.service");
const { localParts: debtLocalParts } = require("../src/services/debtLifecycle.service");

test("FR-132 default report month follows Vietnam time across UTC month boundary", () => {
  const lateOctober = new Date("2026-10-31T16:30:00.000Z"); // 23:30 Oct 31 in Vietnam
  const earlyNovember = new Date("2026-10-31T17:30:00.000Z"); // 00:30 Nov 1 in Vietnam
  assert.equal(vietnamMonth(lateOctober), "2026-10");
  assert.equal(vietnamMonth(earlyNovember), "2026-11");
  const october = buildWhere({}, lateOctober).receiptWhere.ngay_ghi_nhan[Op.between];
  const november = buildWhere({}, earlyNovember).receiptWhere.ngay_ghi_nhan[Op.between];
  assert.deepEqual(october, ["2026-10-01", "2026-10-31"]);
  assert.deepEqual(november, ["2026-11-01", "2026-11-30"]);
  assert.ok("2026-10-31" >= october[0] && "2026-10-31" <= october[1]);
  assert.ok("2026-10-31" < november[0]);
});

test("FR-132 billing and debt cron read days 05/06/10 in Vietnam time", () => {
  for (const day of [5, 6, 10]) {
    const priorUtc = new Date(`2026-10-${String(day - 1).padStart(2, "0")}T16:30:00.000Z`);
    const afterMidnight = new Date(`2026-10-${String(day - 1).padStart(2, "0")}T17:30:00.000Z`);
    assert.equal(billingLocalParts(priorUtc, "Asia/Ho_Chi_Minh").day, day - 1);
    assert.equal(billingLocalParts(afterMidnight, "Asia/Ho_Chi_Minh").day, day);
    assert.equal(debtLocalParts(afterMidnight, "Asia/Ho_Chi_Minh").day, day);
  }
});
