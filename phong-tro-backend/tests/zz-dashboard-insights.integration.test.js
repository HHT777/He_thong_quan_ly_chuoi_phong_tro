const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, CanTro, PhongTro } = require("../src/models");
const sequelize = require("../src/config/database");
const { getDashboardInsights } = require("../src/services/dashboardInsights.service");
const { integration, request, headers, login } = require("./helpers/integration-api");

test("UI-2a insights scopes two landlords, partitions bills, reconciles six cashflow months and enforces roles", async () => {
  const tokenA = await login(integration.landlord);
  const tenant = await login(integration.tenant);
  const accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const requesterA = { ma_tai_khoan: accountA.ma_tai_khoan, vai_tro: "CHU_TRO" };
  const accountB = await TaiKhoan.create({ ten_dang_nhap: `ins${Date.now()}`.slice(0, 15),
    mat_khau: await bcrypt.hash("insights-fixture", 10), vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  const profileB = await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Insights B", so_dien_thoai: "0987654321" });
  const tokenB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const buildingB = await CanTro.create({ ma_chu_tro: profileB.ma_chu_tro, ten_can: "Insights B", dia_chi: "Test", trang_thai: "NGUNG_HOAT_DONG" });
  const roomB = await PhongTro.create({ ma_can: buildingB.ma_can, so_phong: "B-I", dien_tich: 20, gia_thue: 2000000, so_nguoi_toi_da: 2, trang_thai: "TRONG" });
  try {
    const a = await request("/api/v1/dashboard/insights?period=2026-10", { headers: headers(tokenA) });
    const b = await request("/api/v1/dashboard/insights?period=2026-10", { headers: headers(tokenB) });
    assert.equal(a.response.status, 200, JSON.stringify(a.body));
    assert.equal(b.response.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.data.occupancyByBuilding.length, 1);
    assert.equal(b.body.data.occupancyByBuilding[0].buildingId, buildingB.ma_can);
    assert.equal(b.body.data.occupancyByBuilding[0].inComparison, false);
    assert.equal(b.body.data.occupancyByBuilding[0].total, 1);
    assert.equal(a.body.data.occupancyByBuilding.some((row) => row.buildingId === buildingB.ma_can), false);
    const previousLogging = sequelize.options.logging;
    let queryCount = 0;
    try {
      sequelize.options.logging = () => { queryCount += 1; };
      const measured = await getDashboardInsights(requesterA, { period: "2026-10" });
      assert.equal(measured.occupancyByBuilding.some((row) => row.buildingId === buildingB.ma_can), false);
    } finally { sequelize.options.logging = previousLogging; }
    assert.ok(queryCount <= 80, `insights query count must be bounded, got ${queryCount}`);
    console.log(`[UI-2a insights] query count=${queryCount}`);
    for (const [result, token] of [[a, tokenA], [b, tokenB]]) {
      const data = result.body.data;
      assert.equal(data.cashflow6m.length, 6);
      assert.equal(data.billBuckets.paid + data.billBuckets.outstanding + data.billBuckets.overdue, data.billBuckets.total);
      assert.ok(data.contractForecast.d30 <= data.contractForecast.d60);
      assert.ok(data.contractForecast.d60 <= data.contractForecast.d90);
      assert.equal(data.tasks.length, 7);
      for (const row of data.cashflow6m) {
        const report = await request(`/api/v1/reports/cashflow?periodType=month&periodValue=${row.month}`, { headers: headers(token) });
        assert.equal(report.response.status, 200, JSON.stringify(report.body));
        assert.equal(row.totalRevenue, report.body.data.totalRevenue);
        assert.equal(row.totalExpenses, report.body.data.totalExpenses);
        assert.equal(row.profit, report.body.data.profit);
        assert.equal(row.profit, row.totalRevenue - row.totalExpenses);
      }
    }
    const foreign = await request(`/api/v1/dashboard/insights?buildingId=${buildingB.ma_can}`, { headers: headers(tokenA) });
    assert.equal(foreign.response.status, 404);
    assert.equal(foreign.body.error.code, "RESOURCE_NOT_FOUND");
    assert.equal((await request("/api/v1/dashboard/insights", { headers: headers(tenant) })).response.status, 403);
    assert.equal((await request("/api/v1/dashboard/insights")).response.status, 401);
    assert.equal((await request("/api/v1/dashboard/insights?period=2026-13", { headers: headers(tokenA) })).response.status, 400);
    const beforeMidnight = await getDashboardInsights(requesterA, {}, new Date("2026-10-31T16:30:00Z"));
    const afterMidnight = await getDashboardInsights(requesterA, {}, new Date("2026-10-31T17:30:00Z"));
    assert.equal(beforeMidnight.period, "2026-10");
    assert.equal(afterMidnight.period, "2026-11");
  } finally {
    await roomB.destroy(); await buildingB.destroy(); await profileB.destroy(); await accountB.destroy();
  }
});
