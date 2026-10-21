const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePeriod, roomSummary } = require("../src/services/dashboardSummary.service");
const { actionDue } = require("../src/services/debtLifecycle.service");
const { businessDate } = require("../src/utils/businessDate.util");

test("BE-1 dashboard period defaults to Vietnam business month and rejects malformed months", () => {
  assert.equal(resolvePeriod(undefined, new Date("2026-10-31T19:00:00Z")), "2026-11");
  assert.equal(resolvePeriod("2026-10"), "2026-10");
  for (const invalid of ["2026-00", "2026-13", "2026-1", "2026-10-01", 202610, "0000-10"]) {
    assert.throws(() => resolvePeriod(invalid), { status: 400, code: "INVALID_PERIOD" });
  }
});

test("BE-1 dashboard room groups include held rooms and preserve unknown states as KHAC", () => {
  const result = roomSummary([
    { status: "DANG_THUE", count: 2 }, { status: "DA_GIU", count: 1 },
    { status: "FUTURE_STATUS", count: 3 },
  ]);
  assert.equal(result.total, 6);
  assert.deepEqual(result.byStatus, {
    TRONG: 0, DA_GIU: 1, DANG_THUE: 2, DANG_XU_LY_TRA_PHONG: 0,
    NGUNG_SU_DUNG: 0, KHAC: 3,
  });
  assert.equal(Object.values(result.byStatus).reduce((sum, value) => sum + value, 0), result.total);
});

test("BE-1b shared due rule crosses Vietnam day 05 to 06 without changing cron behavior", () => {
  const local = (instant) => {
    const [year, month, day] = businessDate(new Date(instant)).split("-").map(Number);
    return { year, month, day };
  };
  const config = { dueReminderDay: 5, overdueDay: 6, debtCloseDay: 10 };
  const current = { nam: 2026, thang: 10 };
  const day5 = local("2026-10-05T16:59:00Z");
  const day6 = local("2026-10-05T17:00:00Z");
  assert.deepEqual(day5, { year: 2026, month: 10, day: 5 });
  assert.deepEqual(day6, { year: 2026, month: 10, day: 6 });
  assert.equal(actionDue(current, day5, config).overdue, false);
  assert.equal(actionDue(current, day6, config).overdue, true);
  assert.equal(actionDue({ nam: 2026, thang: 9 }, day5, config).overdue, true);
  assert.equal(actionDue({ nam: 2026, thang: 11 }, day6, config).overdue, false);
});
