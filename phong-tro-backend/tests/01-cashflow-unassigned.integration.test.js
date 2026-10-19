const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { TaiKhoan, ChuTro, CanTro, KhoanChi } = require("../src/models");
const { getOwnedBuildingIds } = require("../src/services/ownership.service");
const { getCashflow } = require("../src/services/cashflowReport.service");
const { integration, login, request, headers } = require("./helpers/integration-api");

test("FR-194 legacy chain expense remains in single-owner cashflow and is separately visible with two owners", async () => {
  const period = { periodType: "month", periodValue: "2026-10" };
  const url = "/api/v1/reports/cashflow?periodType=month&periodValue=2026-10";
  const tokenA = await login(integration.landlord);
  const accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const userA = { ma_tai_khoan: accountA.ma_tai_khoan, vai_tro: "CHU_TRO" };
  const ownedA = await getOwnedBuildingIds(userA);
  assert.equal(await ChuTro.count(), 1, "this test must run first on a fresh legacy seed");
  const legacy = await getCashflow(period);
  const unassignedRows = await KhoanChi.findAll({
    where: { ma_can: null, trang_thai: "HIEU_LUC", ngay_phat_sinh: { [Op.between]: ["2026-10-01", "2026-10-31"] } },
  });
  const unassignedTotal = unassignedRows.reduce((sum, row) => sum + Number(row.so_tien), 0);
  assert.ok(unassignedRows.length > 0, "legacy seed must contain unassigned chain expenses");
  const g3BeforeFixExpenses = legacy.totalExpenses - unassignedTotal;
  const g3BeforeFixProfit = legacy.profit + unassignedTotal;
  console.log(`[G3 legacy seed 2026-10] null=${unassignedRows.length} sum=${unassignedTotal} preG3Expenses=${legacy.totalExpenses} g3Expenses=${g3BeforeFixExpenses} preG3Profit=${legacy.profit} g3Profit=${g3BeforeFixProfit}`);
  const singleton = await request(url, { headers: headers(tokenA) });
  assert.equal(singleton.response.status, 200, JSON.stringify(singleton.body));
  assert.equal(singleton.body.data.totalExpenses, legacy.totalExpenses, "one landlord must retain legacy expense amount");
  assert.equal(singleton.body.data.profit, legacy.profit);
  assert.deepEqual(singleton.body.data.unassignedExpenses, { count: 0, total: 0 });

  const accountB = await TaiKhoan.create({ ten_dang_nhap: `g3owner${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("g3-fixture-only", 10), vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  const ownerB = await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "G3 Owner B", so_dien_thoai: "0987654399" });
  const buildingB = await CanTro.create({ ma_chu_tro: ownerB.ma_chu_tro, ten_can: "G3 B", dia_chi: "Fixture B", trang_thai: "HOAT_DONG" });
  await KhoanChi.create({ ma_can: buildingB.ma_can, loai_khoan_chi: "KHAC", so_tien: 91000, ngay_phat_sinh: "2026-10-19", pham_vi: "CAN_TRO", trang_thai: "HIEU_LUC" });
  const tokenB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const a = await request(url, { headers: headers(tokenA) });
  const b = await request(url, { headers: headers(tokenB) });
  assert.equal(a.response.status, 200, JSON.stringify(a.body));
  assert.equal(b.response.status, 200, JSON.stringify(b.body));
  assert.deepEqual(a.body.data.unassignedExpenses, { count: unassignedRows.length, total: unassignedTotal });
  assert.deepEqual(b.body.data.unassignedExpenses, { count: unassignedRows.length, total: unassignedTotal });
  assert.equal(a.body.data.totalExpenses, g3BeforeFixExpenses);
  assert.equal(b.body.data.totalExpenses, 91000);
  assert.equal(a.body.data.profit, a.body.data.totalRevenue - a.body.data.totalExpenses);
  assert.equal(b.body.data.profit, b.body.data.totalRevenue - b.body.data.totalExpenses);
  assert.equal(a.body.data.totalExpenses + a.body.data.unassignedExpenses.total, legacy.totalExpenses);
  assert.equal(b.body.data.totalExpenses + b.body.data.unassignedExpenses.total, 91000 + unassignedTotal);
  console.log(`[G3 two-owner fixture 2026-10] A_expenses=${a.body.data.totalExpenses} A_profit=${a.body.data.profit} B_expenses=${b.body.data.totalExpenses} B_profit=${b.body.data.profit} unassigned=${unassignedTotal}`);
});
