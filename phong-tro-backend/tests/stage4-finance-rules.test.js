const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const reportService = require("../src/services/cashflowReport.service");
const adjustmentService = require("../src/services/billAdjustment.service");
const meterReadingService = require("../src/services/meterReading.service");

test("CT-006 cashflow filters both sources by inclusive period and building", () => {
  const { receiptWhere, expenseWhere } = reportService.buildWhere({
    from: "2099-01-01",
    to: "2099-12-31",
    buildingId: "none",
  });
  assert.equal(receiptWhere.trang_thai_ghi_nhan, "HIEU_LUC");
  assert.equal(receiptWhere.ma_can, "none");
  assert.equal(expenseWhere.ma_can, "none");
  assert.deepEqual(receiptWhere.ngay_ghi_nhan[Op.between], ["2099-01-01", "2099-12-31"]);
  assert.deepEqual(expenseWhere.ngay_phat_sinh[Op.between], ["2099-01-01", "2099-12-31"]);
});

test("CT-006 rejects malformed or reversed report periods", () => {
  assert.throws(() => reportService.buildWhere({ from: "2026-02-30" }), (error) => error.code === "INVALID_REPORT_PERIOD");
  assert.throws(() => reportService.buildWhere({ from: "2026-10-02", to: "2026-10-01" }), (error) => error.code === "INVALID_REPORT_PERIOD");
});

test("CT-007 negative adjustments reduce existing non-negative details", () => {
  const details = [{ so_tien: 100 }, { so_tien: 50 }];
  const changes = adjustmentService.planReductions(details, 120);
  assert.deepEqual(changes.map((change) => change.amount), [0, 30]);
  assert.equal(changes.reduce((sum, change, index) => sum + (Number(details[index].so_tien) - change.amount), 0), 120);
});

test("CT-007 only permits canonical bill line domains", () => {
  assert.equal(adjustmentService.ALLOWED_LINE_TYPES.has("PHAT_SINH"), true);
  assert.equal(adjustmentService.ALLOWED_LINE_TYPES.has("DIEU_CHINH"), false);
  assert.throws(() => adjustmentService.planReductions([{ so_tien: 10 }], 11), (error) => error.code === "BILL_DETAIL_TOTAL_MISMATCH");
});

test("CT-011 first electricity period requires an explicit prior reading", () => {
  assert.throws(
    () => meterReadingService.requirePreviousReading(null, "2026-10", "room-1"),
    (error) => error.status === 422
      && error.code === "INITIAL_READING_REQUIRED"
      && error.details.period === "2026-10",
  );
  assert.equal(meterReadingService.requirePreviousReading({ chi_so_moi: "125" }, "2026-10", "room-1"), 125);
});
