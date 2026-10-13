const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const reportService = require("../src/services/cashflowReport.service");

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
