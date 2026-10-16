const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const reportService = require("../src/services/cashflowReport.service");
const adjustmentService = require("../src/services/billAdjustment.service");
const meterReadingService = require("../src/services/meterReading.service");
const billGenerationService = require("../src/services/billGeneration.service");
const { sumSignedLineAmounts, assertBillDetailTotal } = require("../src/utils/billLine.util");
const { firstPeriodRatio, prorateMonthlyAmount } = require("../src/utils/billingPeriod.util");
const fs = require("node:fs");
const path = require("node:path");

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

test("CT-007 signed bill lines preserve the algebraic detail-total invariant", () => {
  const details = [
    { loai_khoan: "TIEN_PHONG", so_tien: 100 },
    { loai_khoan: "PHI_PHAT_SINH", so_tien: 50 },
    { loai_khoan: "GIAM_TRU", so_tien: -30 },
  ];
  assert.equal(sumSignedLineAmounts(details), 120);
  assert.equal(assertBillDetailTotal(details, 120), 120);
});

test("CT-007 only permits canonical bill line domains", () => {
  assert.equal(adjustmentService.ALLOWED_LINE_TYPES.has("PHAT_SINH"), false);
  assert.equal(adjustmentService.ALLOWED_LINE_TYPES.has("PHI_PHAT_SINH"), true);
  assert.equal(adjustmentService.ALLOWED_LINE_TYPES.has("DIEU_CHINH"), false);
  assert.throws(() => sumSignedLineAmounts([{ loai_khoan: "GIAM_TRU", so_tien: 10 }]), (error) => error.code === "INVALID_BILL_LINE_SIGN");
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

test("CT-012 derives water from contract price and active occupants", () => {
  assert.equal(billGenerationService.calculateWater("100000.00", 3), 300000);
  assert.throws(() => billGenerationService.calculateWater(100000, 0), (error) => error.code === "MISSING_BILLABLE_OCCUPANTS");
});

test("FR-180 prorates the first contract period with the shared day formula", () => {
  assert.equal(firstPeriodRatio("2026-10-15", "2026-10"), 17 / 31);
  assert.equal(prorateMonthlyAmount(3100000, 17 / 31), 1700000);
  assert.equal(firstPeriodRatio("2026-10-15", "2026-11"), 1);
});

test("CT-012 bill generation ignores client-provided monetary overrides", () => {
  const route = fs.readFileSync(path.resolve(__dirname, "../src/routes/mvp.routes.js"), "utf8");
  const generationRoute = route.slice(route.indexOf('router.post("/bills/generate"'), route.indexOf('router.get("/debt"'));
  assert.match(generationRoute, /billGenerationService\.generate\(req\.body\.period, req\.user\.ma_tai_khoan, req\.body\.contractIds\)/);
  assert.doesNotMatch(generationRoute, /waterAmount|serviceFee/);
  const service = fs.readFileSync(path.resolve(__dirname, "../src/services/billGeneration.service.js"), "utf8");
  assert.match(service, /contract\.phi_dich_vu/);
  assert.doesNotMatch(service, /SERVICE_FEE_SCHEMA_MISSING/);
});

test("BR-44 allocates gross revenue and discount across partial receipts with final rounding", () => {
  const rows = [
    { ma_khoan_thu: "p1", so_tien: 60, ngay_ghi_nhan: "2026-10-01", giaoDich: { thanhToan: { ma_thanh_toan: "b1", chiTiets: [{ loai_khoan: "TIEN_PHONG", so_tien: 100 }, { loai_khoan: "GIAM_TRU", so_tien: -20 }] } } },
    { ma_khoan_thu: "p2", so_tien: 20, ngay_ghi_nhan: "2026-10-02", giaoDich: { thanhToan: { ma_thanh_toan: "b1", chiTiets: [{ loai_khoan: "TIEN_PHONG", so_tien: 100 }, { loai_khoan: "GIAM_TRU", so_tien: -20 }] } } },
  ];
  const allocated = reportService.allocateReceipts(rows);
  assert.equal(allocated.reduce((sum, row) => sum + row.gross, 0), 100);
  assert.equal(allocated.reduce((sum, row) => sum + row.discount, 0), 20);
  assert.equal(allocated[0].gross - allocated[0].discount, 60);
  assert.equal(allocated[1].gross - allocated[1].discount, 20);
});
