const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, ThanhToan } = require("../src/models");
const billService = require("../src/services/khoanPhaiThu.service");
const debtService = require("../src/services/debtLifecycle.service");
const { getDashboardSummary } = require("../src/services/dashboardSummary.service");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("FR-173 overdue list and debt match dashboard across Vietnam day boundary and owners", async () => {
  const tokenA = await login(integration.landlord);
  const accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `due${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("overdue-fixture", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Owner B overdue", so_dien_thoai: "0987654321" });
  const tokenB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const rentalA = await createFreshRental(tokenA, "overdue-owner-a");
  const rentalB = await createFreshRental(tokenB, "overdue-owner-b");
  const makeBill = async (token, contractId) => {
    const result = await request("/api/khoan-phai-thu", { method: "POST", headers: headers(token), body: JSON.stringify({
      ma_hop_dong: contractId, ky: "2026-10", tien_phong: 1000000, tong_phai_thanh_toan: 1000000,
    }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.body));
    await ThanhToan.update({ da_gui: true, ngay_gui: new Date("2026-10-02T01:00:00Z") }, { where: { ma_thanh_toan: result.body.data.ma_thanh_toan } });
    return result.body.data.ma_thanh_toan;
  };
  const billA = await makeBill(tokenA, rentalA.contract.ma_hop_dong);
  const billB = await makeBill(tokenB, rentalB.contract.ma_hop_dong);
  await ThanhToan.update({ qua_han: true, ngay_qua_han: new Date("2026-10-06T00:00:00Z") }, { where: { ma_thanh_toan: billB } });
  const owners = [
    { token: tokenA, requester: { ma_tai_khoan: accountA.ma_tai_khoan, vai_tro: "CHU_TRO" }, ownBill: billA, foreignBill: billB },
    { token: tokenB, requester: { ma_tai_khoan: accountB.ma_tai_khoan, vai_tro: "CHU_TRO" }, ownBill: billB, foreignBill: billA },
  ];

  for (const [instant, due] of [["2026-10-05T16:59:00Z", false], ["2026-10-05T17:00:00Z", true]]) {
    const now = new Date(instant);
    for (const owner of owners) {
      const summary = await getDashboardSummary(owner.requester, "2026-10", now);
      const list = await billService.getOverdueBills(owner.requester, now);
      const debt = await debtService.listDebt({ requester: owner.requester, now });
      const inPeriod = (row) => row.nam === 2026 && row.thang === 10 && row.loai_thanh_toan === "DINH_KY";
      const listForPeriod = list.filter(inPeriod);
      const debtForPeriod = debt.filter((row) => inPeriod(row) && row.isOverdue);
      assert.equal(listForPeriod.length, summary.bills.quaHan);
      assert.equal(debtForPeriod.length, summary.bills.quaHan);
      assert.ok(listForPeriod.every((row) => row.isOverdue === true));
      assert.equal(summary.bills.daThu + summary.bills.conNo + summary.bills.quaHan, summary.bills.total);
      assert.equal(listForPeriod.some((row) => row.ma_thanh_toan === owner.ownBill), due);
      assert.equal(debtForPeriod.some((row) => row.ma_thanh_toan === owner.ownBill), due);
      assert.equal(list.some((row) => row.ma_thanh_toan === owner.foreignBill), false);
      assert.equal(debt.some((row) => row.ma_thanh_toan === owner.foreignBill), false);
    }
  }
  for (const owner of owners) {
    const overdue = await request("/api/khoan-phai-thu/list/overdue", { headers: headers(owner.token) });
    const debt = await request("/api/v1/debt", { headers: headers(owner.token) });
    assert.equal(overdue.response.status, 200, JSON.stringify(overdue.body));
    assert.equal(debt.response.status, 200, JSON.stringify(debt.body));
    assert.equal(Array.isArray(overdue.body.data), true);
    assert.equal(overdue.body.data.some((row) => row.ma_thanh_toan === owner.foreignBill), false);
    assert.equal(debt.body.data.some((row) => row.ma_thanh_toan === owner.foreignBill), false);
  }
  const pageB = await request("/api/khoan-phai-thu?limit=1", { headers: headers(tokenB) });
  assert.equal(pageB.response.status, 200, JSON.stringify(pageB.body));
  assert.equal(pageB.body.pagination.total, 1);
  assert.equal(pageB.body.data.length, 1);
  assert.equal(pageB.body.data[0].ma_thanh_toan, billB);
});
