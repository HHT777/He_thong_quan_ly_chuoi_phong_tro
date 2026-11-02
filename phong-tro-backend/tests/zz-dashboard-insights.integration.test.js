const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, CanTro, PhongTro, HopDong, KhachThue, YeuCau, DeXuatBanCungPhong, CauHinhHeThong } = require("../src/models");
const sequelize = require("../src/config/database");
const { QueryTypes } = require("sequelize");
const { getDashboardInsights } = require("../src/services/dashboardInsights.service");
const { getOwnedBuildingIds } = require("../src/services/ownership.service");
const { invalidateSystemConfigCache } = require("../src/services/systemConfig.service");
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
  let pendingRequest;
  let pendingDetail;
  let changedContract;
  let previousContract;
  let warningConfig;
  let previousWarningValue;
  let createdWarningConfig = false;
  try {
    const a = await request("/api/v1/dashboard/insights?period=2026-10", { headers: headers(tokenA) });
    const b = await request("/api/v1/dashboard/insights?period=2026-10", { headers: headers(tokenB) });
    assert.equal(a.response.status, 200, JSON.stringify(a.body));
    assert.equal(b.response.status, 200, JSON.stringify(b.body));
    assert.equal(b.body.data.occupancyByBuilding.length, 1);
    assert.equal(b.body.data.occupancyByBuilding[0].buildingId, buildingB.ma_can);
    assert.equal(b.body.data.occupancyByBuilding[0].inComparison, false);
    assert.equal(b.body.data.occupancyByBuilding[0].total, 1);
    assert.equal(b.body.data.revenueChangePct, null, "Zero previous-month revenue has no percentage trend");
    assert.ok(b.body.data.cashflow6m.every((row) => row.totalRevenue === 0 && row.totalExpenses === 0 && row.profit === 0));
    assert.equal(a.body.data.occupancyByBuilding.some((row) => row.buildingId === buildingB.ma_can), false);
    assert.equal(b.body.data.occupancyByBuilding.reduce((sum, row) => sum + row.total, 0), 1);
    const tenantA = await KhachThue.findOne();
    pendingRequest = await YeuCau.create({ ma_khach_thue: tenantA.ma_khach_thue, noi_dung: "Scope by request detail", loai_yeu_cau: "DE_XUAT_BAN_CUNG_PHONG", trang_thai: "CHO_XU_LY" });
    pendingDetail = await DeXuatBanCungPhong.create({ ma_yeu_cau: pendingRequest.ma_yeu_cau, ma_phong: roomB.ma_phong,
      ho_ten_nguoi_de_xuat: "Candidate B", so_dien_thoai_nguoi_de_xuat: "0912345678" });
    const withPendingA = await getDashboardInsights(requesterA, { period: "2026-10" });
    const requesterB = { ma_tai_khoan: accountB.ma_tai_khoan, vai_tro: "CHU_TRO" };
    const withPendingB = await getDashboardInsights(requesterB, { period: "2026-10" });
    const pendingCount = (data) => data.tasks.find((item) => item.type === "PENDING_REQUESTS").count;
    assert.equal(pendingCount(withPendingA), pendingCount(a.body.data), "Requester's old contract must not assign request to A");
    assert.equal(pendingCount(withPendingB), pendingCount(b.body.data) + 1, "Request detail room assigns request to B");
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
      const summary = await request("/api/v1/dashboard/summary?period=2026-10", { headers: headers(token) });
      assert.equal(summary.response.status, 200, JSON.stringify(summary.body));
      assert.equal(data.occupancyByBuilding.reduce((sum, row) => sum + row.total, 0), summary.body.data.rooms.total);
      assert.equal(data.billBuckets.total, summary.body.data.bills.total);
      assert.equal(data.billBuckets.paid, summary.body.data.bills.daThu);
      assert.equal(data.billBuckets.outstanding, summary.body.data.bills.conNo);
      assert.equal(data.billBuckets.overdue, summary.body.data.bills.quaHan);
      assert.equal(data.tasks[0].count, data.billBuckets.overdue);
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
    const [scopedBill] = await sequelize.query(`SELECT p.maCan AS buildingId,
      SUM(t.soTienConNo > 0) AS outstanding, SUM(t.soTienConNo = 0) AS paid
      FROM ThanhToan t JOIN HopDong h ON h.maHopDong=t.maHopDong
      JOIN PhongTro p ON p.maPhong=h.maPhong JOIN CanTro c ON c.maCan=p.maCan
      WHERE c.maChuTro=(SELECT maChuTro FROM ChuTro WHERE maTaiKhoan=:accountId)
        AND t.loaiThanhToan='DINH_KY' AND t.nam=2026 AND t.thang=10
      GROUP BY p.maCan HAVING outstanding > 0 LIMIT 1`,
    { replacements: { accountId: accountA.ma_tai_khoan }, type: QueryTypes.SELECT });
    assert.ok(scopedBill, "Seed needs an owner A building with outstanding periodic bills");
    const scopedQuery = { period: "2026-10", buildingId: scopedBill.buildingId };
    const scopedDay5 = await getDashboardInsights(requesterA, scopedQuery, new Date("2026-10-05T16:59:00Z"));
    const scopedDay6 = await getDashboardInsights(requesterA, scopedQuery, new Date("2026-10-05T17:00:00Z"));
    assert.equal(scopedDay5.billBuckets.paid, Number(scopedBill.paid));
    assert.equal(scopedDay5.billBuckets.outstanding, Number(scopedBill.outstanding));
    assert.equal(scopedDay5.billBuckets.overdue, 0);
    assert.equal(scopedDay6.billBuckets.overdue, Number(scopedBill.outstanding));
    assert.equal(scopedDay6.billBuckets.outstanding, 0);
    const idsA = await getOwnedBuildingIds(requesterA);
    const [candidate] = await sequelize.query(`SELECT h.maHopDong AS id FROM HopDong h
      JOIN PhongTro p ON p.maPhong=h.maPhong WHERE p.maCan IN (:ids)
      AND h.ngayBatDau < '2026-10-21' AND h.trangThai <> 'DA_THANH_LY'
      AND NOT EXISTS (SELECT 1 FROM YeuCauGiaHan yg JOIN YeuCau y ON y.maYeuCau=yg.maYeuCau
        WHERE yg.maHopDong=h.maHopDong AND y.trangThai='CHO_XU_LY') LIMIT 1`,
    { replacements: { ids: idsA }, type: QueryTypes.SELECT });
    changedContract = candidate && await HopDong.findByPk(candidate.id);
    assert.ok(changedContract, "Seed needs an owner A contract starting before forecast day");
    previousContract = { trang_thai: changedContract.trang_thai, ngay_ket_thuc: changedContract.ngay_ket_thuc };
    await changedContract.update({ trang_thai: "HET_HAN", ngay_ket_thuc: "2026-11-10" });
    const excludedForecast = await getDashboardInsights(requesterA, { period: "2026-10" }, new Date("2026-10-21T05:00:00Z"));
    await changedContract.update({ trang_thai: "SAP_HET_HAN" });
    const includedForecast = await getDashboardInsights(requesterA, { period: "2026-10" }, new Date("2026-10-21T05:00:00Z"));
    assert.equal(includedForecast.contractForecast.d30, excludedForecast.contractForecast.d30 + 1,
      "SAP_HET_HAN is forecast while HET_HAN is excluded");
    assert.equal(includedForecast.contractForecast.d60, excludedForecast.contractForecast.d60 + 1);
    assert.equal(includedForecast.contractForecast.d90, excludedForecast.contractForecast.d90 + 1);
    await changedContract.update({ ngay_ket_thuc: "2026-12-10" });
    warningConfig = await CauHinhHeThong.findOne({ where: { khoa: "contractWarningDays" } });
    if (!warningConfig) {
      warningConfig = await CauHinhHeThong.create({ khoa: "contractWarningDays", gia_tri: 30, nguoi_cap_nhat_id: accountA.ma_tai_khoan });
      createdWarningConfig = true;
    } else previousWarningValue = warningConfig.gia_tri;
    await warningConfig.update({ gia_tri: 30 });
    invalidateSystemConfigCache();
    const warning30 = await getDashboardInsights(requesterA, { period: "2026-10" }, new Date("2026-10-21T05:00:00Z"));
    await warningConfig.update({ gia_tri: 60 });
    invalidateSystemConfigCache();
    const warning60 = await getDashboardInsights(requesterA, { period: "2026-10" }, new Date("2026-10-21T05:00:00Z"));
    assert.equal(warning30.contractWarningDays, 30);
    assert.equal(warning60.contractWarningDays, 60);
    assert.ok(warning60.tasks.find((item) => item.type === "EXPIRING_CONTRACTS").count
      > warning30.tasks.find((item) => item.type === "EXPIRING_CONTRACTS").count,
    "Runtime warningDays must include a contract 50 days away when set to 60, but not 30");
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
    if (changedContract && previousContract) await changedContract.update(previousContract);
    if (warningConfig) {
      if (createdWarningConfig) await warningConfig.destroy();
      else await warningConfig.update({ gia_tri: previousWarningValue });
      invalidateSystemConfigCache();
    }
    if (pendingDetail) await pendingDetail.destroy();
    if (pendingRequest) await pendingRequest.destroy();
    await roomB.destroy(); await buildingB.destroy(); await profileB.destroy(); await accountB.destroy();
  }
});
