const test = require("node:test");
const assert = require("node:assert/strict");
const { HopDong, PhongTro, GiaoDichThanhToan } = require("../src/models");
const { integration, request, headers, login, createBaseRental, createFreshRental } = require("./helpers/integration-api");

test("FR-043/044 owning landlord can create, confirm and cancel a deposit", async () => {
  const owner = await login(integration.landlord);
  const fresh = await createBaseRental(owner, "authz-own-deposit");
  // Legacy contract fixture without a deposit: the POST route is the path that creates it.
  const contract = await HopDong.create({
    ma_khach_thue: fresh.tenant.ma_khach_thue, ma_phong: fresh.room.ma_phong,
    ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30", gia_thue: 2500000,
    don_gia_dien: 3500, don_gia_nuoc: 100000, dieu_khoan: "Authz fixture",
    trang_thai: "DANG_HIEU_LUC", da_co_ban_giay_ky: true,
  });
  await PhongTro.update({ trang_thai: "DANG_THUE" }, { where: { ma_phong: fresh.room.ma_phong } });
  const created = await request("/api/dat-coc", { method: "POST", headers: headers(owner),
    body: JSON.stringify({ ma_hop_dong: contract.ma_hop_dong, so_tien_coc: 1000000, ngay_nhan_coc: "2026-10-01" }) });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const id = created.body.data.ma_tien_coc;
  const confirmed = await request(`/api/dat-coc/${id}/confirm`, { method: "POST", headers: headers(owner), body: "{}" });
  assert.equal(confirmed.response.status, 200, JSON.stringify(confirmed.body));
  const cancelled = await request(`/api/dat-coc/${id}/cancel`, { method: "POST", headers: headers(owner), body: "{}" });
  assert.equal(cancelled.response.status, 200, JSON.stringify(cancelled.body));
});

test("FR-002/007 owning landlord can lock, unlock and reset own tenant account", async () => {
  const owner = await login(integration.landlord);
  const rental = await createFreshRental(owner, "authz-own-account");
  for (const status of ["DA_KHOA", "HOAT_DONG"]) {
    const result = await request(`/api/v1/accounts/${rental.account.ma_tai_khoan}/status`, {
      method: "PATCH", headers: headers(owner), body: JSON.stringify({ status }),
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
  }
  const reset = await request("/api/v1/accounts/reset-password", { method: "POST", headers: headers(owner),
    body: JSON.stringify({ tenantId: rental.tenant.ma_khach_thue }) });
  assert.equal(reset.response.status, 200, JSON.stringify(reset.body));
});

test("FR-073/079/164 owning landlord can confirm evidence and discount own bill", async () => {
  const owner = await login(integration.landlord);
  const rental = await createFreshRental(owner, "authz-own-payment");
  const bill = await request("/api/khoan-phai-thu", { method: "POST", headers: headers(owner),
    body: JSON.stringify({ ma_hop_dong: rental.contract.ma_hop_dong, ky: "2027-03", tien_phong: 2000000, tong_phai_thanh_toan: 2000000 }) });
  assert.equal(bill.response.status, 201, JSON.stringify(bill.body));
  const payment = await GiaoDichThanhToan.create({ ma_thanh_toan: bill.body.data.ma_thanh_toan,
    so_tien: 100000, thoi_diem_ghi_nhan: new Date(), trang_thai_xac_nhan: "CHO_XAC_NHAN", nguon_thanh_toan: "THU_TIEN" });
  const confirmed = await request(`/api/khoan-phai-thu/payment/${payment.ma_giao_dich}/confirm`, {
    method: "POST", headers: headers(owner), body: "{}",
  });
  assert.equal(confirmed.response.status, 200, JSON.stringify(confirmed.body));
  const stats = await request("/api/khoan-phai-thu/payment/stats?startDate=2027-03-01&endDate=2027-03-31", { headers: headers(owner) });
  assert.equal(stats.response.status, 200, JSON.stringify(stats.body));
  const discount = await request("/api/v1/discounts", { method: "POST", headers: headers(owner),
    body: JSON.stringify({ billId: bill.body.data.ma_thanh_toan, value: 50000, reason: "Ưu đãi" }) });
  assert.equal(discount.response.status, 201, JSON.stringify(discount.body));
});
