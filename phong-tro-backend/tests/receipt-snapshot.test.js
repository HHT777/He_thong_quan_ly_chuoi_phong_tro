const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateSnapshot } = require("../src/services/receiptSnapshot.service");
const { allocateReceipts } = require("../src/services/cashflowReport.service");
const fs = require("node:fs");
const path = require("node:path");

test("BR-44 every cash receipt writer persists the snapshot in its transaction", () => {
  for (const file of ["thanhToan.service.js", "paymentLifecycle.service.js", "paymentConfirmation.service.js"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "../src/services", file), "utf8");
    assert.match(source, /\.\.\.await buildSnapshot\(bill, amount, transaction\)/, file);
  }
});

test("BR-44 snapshots 3,000,000 gross and 300,000 discount across two receipts", () => {
  const first = calculateSnapshot({ amount: 1000000, outstanding: 2700000, netTotal: 2700000, discountTotal: 300000 });
  const second = calculateSnapshot({ amount: 1700000, outstanding: 1700000, netTotal: 2700000, discountTotal: 300000, priorDiscount: first.giam_tru_phan_bo });
  assert.deepEqual(first, { doanh_thu_gop: 1111111, giam_tru_phan_bo: 111111, nguon_snapshot: "GHI_NHAN" });
  assert.deepEqual(second, { doanh_thu_gop: 1888889, giam_tru_phan_bo: 188889, nguon_snapshot: "GHI_NHAN" });
  assert.equal(first.doanh_thu_gop + second.doanh_thu_gop, 3000000);
  assert.equal(first.giam_tru_phan_bo + second.giam_tru_phan_bo, 300000);
});

test("BR-44 historical report reads immutable receipt snapshot after bill adjustment", () => {
  const bill = { ma_thanh_toan: "b-snapshot", tong_phai_tra: 800, chiTiets: [{ loai_khoan: "TIEN_PHONG", so_tien: 1000 }, { loai_khoan: "GIAM_TRU", so_tien: -200 }] };
  const receipt = { ma_khoan_thu: "r-snapshot", so_tien: 400, ngay_ghi_nhan: "2026-10-01", doanh_thu_gop: 500, giam_tru_phan_bo: 100, nguon_snapshot: "GHI_NHAN", giaoDich: { thanhToan: bill } };
  const before = allocateReceipts([receipt])[0];
  bill.tong_phai_tra = 1100;
  bill.chiTiets = [{ loai_khoan: "TIEN_PHONG", so_tien: 1200 }, { loai_khoan: "GIAM_TRU", so_tien: -100 }];
  const after = allocateReceipts([receipt])[0];
  assert.deepEqual({ gross: after.gross, discount: after.discount }, { gross: before.gross, discount: before.discount });
  assert.deepEqual({ gross: after.gross, discount: after.discount }, { gross: 500, discount: 100 });
});

test("BR-44 a later receipt uses the adjusted bill state without rewriting the first snapshot", () => {
  const first = calculateSnapshot({ amount: 400, outstanding: 800, netTotal: 800, discountTotal: 200 });
  const later = calculateSnapshot({ amount: 700, outstanding: 700, netTotal: 1100, discountTotal: 100, priorDiscount: first.giam_tru_phan_bo });
  assert.deepEqual(first, { doanh_thu_gop: 500, giam_tru_phan_bo: 100, nguon_snapshot: "GHI_NHAN" });
  assert.deepEqual(later, { doanh_thu_gop: 700, giam_tru_phan_bo: 0, nguon_snapshot: "GHI_NHAN" });
});

test("BR-44 cancelled receipt removal leaves other snapshots unchanged", () => {
  const bill = { ma_thanh_toan: "b-cancel", tong_phai_tra: 2700000, chiTiets: [{ loai_khoan: "TIEN_PHONG", so_tien: 3000000 }, { loai_khoan: "GIAM_TRU", so_tien: -300000 }] };
  const first = { ma_khoan_thu: "r1", so_tien: 1000000, ngay_ghi_nhan: "2026-10-01", doanh_thu_gop: 1111111, giam_tru_phan_bo: 111111, nguon_snapshot: "GHI_NHAN", giaoDich: { thanhToan: bill } };
  const last = { ma_khoan_thu: "r2", so_tien: 1700000, ngay_ghi_nhan: "2026-10-02", doanh_thu_gop: 1888889, giam_tru_phan_bo: 188889, nguon_snapshot: "GHI_NHAN", giaoDich: { thanhToan: bill } };
  const before = allocateReceipts([first, last]);
  const afterCancellation = allocateReceipts([first]);
  assert.deepEqual(afterCancellation[0], before[0]);
  const replacement = calculateSnapshot({ amount: 1700000, outstanding: 1700000, netTotal: 2700000, discountTotal: 300000, priorDiscount: 111111 });
  assert.equal(replacement.giam_tru_phan_bo, 188889);
});

test("BR-44 non-bill income does not receive a payment snapshot", () => {
  const postLiquidation = calculateSnapshot({ amount: 400000, outstanding: 400000, netTotal: 400000, discountTotal: 0 });
  assert.equal(postLiquidation.doanh_thu_gop - postLiquidation.giam_tru_phan_bo, 400000);
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../src/services/reservation.service.js"), "utf8");
  assert.doesNotMatch(source, /GIU_PHONG_KHONG_HOAN[\s\S]{0,300}buildSnapshot/);
});
