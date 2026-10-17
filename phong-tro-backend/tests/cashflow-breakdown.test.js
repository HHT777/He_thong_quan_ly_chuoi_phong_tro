const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeCashflow } = require("../src/services/cashflowReport.service");

test("FR-133 report breakdown reconciles two buildings, inactive revenue, deposit and split discount", () => {
  const bill = {
    ma_thanh_toan: "bill-a",
    tong_phai_tra: 2700000,
    chiTiets: [
      { loai_khoan: "TIEN_PHONG", so_tien: 3000000 },
      { loai_khoan: "GIAM_TRU", so_tien: -300000 },
    ],
    hopDong: { phongTro: { ma_phong: "room-a", ma_can: "building-a" } },
  };
  const receipts = [
    { ma_khoan_thu: "r1", so_tien: 1000000, ma_can: "building-a", ngay_ghi_nhan: "2026-10-01", doanh_thu_gop: 1111111, giam_tru_phan_bo: 111111, nguon_snapshot: "GHI_NHAN", giaoDich: { thanhToan: bill } },
    { ma_khoan_thu: "r2", so_tien: 1700000, ma_can: "building-a", ngay_ghi_nhan: "2026-10-02", doanh_thu_gop: null, giam_tru_phan_bo: null, nguon_snapshot: null, giaoDich: { thanhToan: bill } },
  ];
  const reports = [{ ma_bien_ban: "report-b", tien_coc_ban_dau: 800000, tong_khoan_khau_tru: 500000, ngay_quyet_toan: "2026-10-03", hopDong: { phongTro: { ma_phong: "room-b", ma_can: "building-b" } } }];
  const expenses = [
    { ma_khoan_chi: "e1", ma_can: "building-a", so_tien: 100000, loai_khoan_chi: "BAO_TRI", ngay_phat_sinh: "2026-10-04" },
    { ma_khoan_chi: "e2", ma_can: "building-b", so_tien: 50000, loai_khoan_chi: "BAO_TRI", ngay_phat_sinh: "2026-10-04" },
  ];
  const result = summarizeCashflow({ receipts, reports, expenses, buildings: [{ ma_can: "building-a", trang_thai: "HOAT_DONG" }, { ma_can: "building-b", trang_thai: "NGUNG_HOAT_DONG" }] });
  assert.equal(result.totalRevenue, 3200000);
  assert.equal(result.grossRevenue, 3500000);
  assert.equal(result.discounts, 300000);
  const active = result.byBuilding.find((row) => row.buildingId === "building-a");
  const inactive = result.byBuilding.find((row) => row.buildingId === "building-b");
  assert.deepEqual({ revenue: active.revenue, gross: active.grossRevenue, discount: active.discounts, deposit: active.depositDeductions, profit: active.profit, compare: active.inComparison }, { revenue: 2700000, gross: 3000000, discount: 300000, deposit: 0, profit: 2600000, compare: true });
  assert.deepEqual({ revenue: inactive.revenue, gross: inactive.grossRevenue, discount: inactive.discounts, deposit: inactive.depositDeductions, profit: inactive.profit, compare: inactive.inComparison }, { revenue: 500000, gross: 500000, discount: 0, deposit: 500000, profit: 450000, compare: false });
  assert.equal(result.byBuilding.reduce((sum, row) => sum + row.revenue, 0), result.totalRevenue);
  assert.equal(result.byBuilding.reduce((sum, row) => sum + row.grossRevenue, 0), result.grossRevenue);
  assert.equal(result.byBuilding.reduce((sum, row) => sum + row.discounts, 0), result.discounts);
  assert.equal(result.receiptDetails.filter((row) => row.source !== "CHI_PHI").reduce((sum, row) => sum + row.amount, 0), result.totalRevenue);
  assert.equal(result.revenueByType.reduce((sum, row) => sum + row.amount, 0), result.totalRevenue);
  assert.deepEqual(result.receiptDetails.slice(0, 2).map((row) => [row.amount, row.grossAmount, row.discountAllocated, row.snapshotSource]), [[1000000, 1111111, 111111, "GHI_NHAN"], [1700000, 1888889, 188889, "SUY_DIEN"]]);
  assert.deepEqual(result.receiptDetails.find((row) => row.source === "KHAU_TRU_COC"), { source: "KHAU_TRU_COC", amount: 500000, grossAmount: 500000, discountAllocated: 0, snapshotSource: null, date: "2026-10-03", receiptId: null, reportId: "report-b", roomId: "room-b", buildingId: "building-b" });
});
