const test = require("node:test");
const assert = require("node:assert/strict");
const { ChiSoDien, ChiTietThanhToan, ThanhToan, TaiKhoan, LichSuSuaHopDong } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

async function confirmedReadings(fresh) {
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const common = {
    ma_phong: fresh.room.ma_phong,
    don_gia_ap_dung: 3500,
    trang_thai_xac_nhan: "DA_XAC_NHAN",
    nguoi_ghi_nhan_id: actor.ma_tai_khoan,
    nguoi_xac_nhan_id: actor.ma_tai_khoan,
    ngay_xac_nhan: new Date(),
  };
  await ChiSoDien.bulkCreate([
    { ...common, nam: 2026, thang: 9, chi_so_moi: 100 },
    { ...common, nam: 2026, thang: 10, chi_so_moi: 120 },
  ]);
}

test("UC-28 co-tenant proposal validates, deduplicates and admits only after approval", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "co-tenant");
  const missing = await request("/api/v1/co-tenants", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({ name: "Missing phone" }),
  });
  assert.equal(missing.response.status, 422);
  const payload = {
    name: "Nguoi O Integration",
    phone: "0987654321",
    identityNumber: "079203001234",
    birthDate: "2003-05-12",
    gender: "NAM",
    permanentAddress: "TP Ho Chi Minh",
    relationship: "BAN",
    startDate: "2026-10-15",
    note: "Ban",
  };
  const first = await request("/api/v1/co-tenants", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify(payload),
  });
  assert.equal(first.response.status, 201, JSON.stringify(first.body));
  const duplicatePending = await request("/api/v1/co-tenants", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify(payload),
  });
  assert.equal(duplicatePending.response.status, 409);
  const approved = await request(`/api/v1/requests/${first.body.data.request.ma_yeu_cau}`, {
    method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_DUYET" }),
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  const duplicateResident = await request("/api/v1/co-tenants", {
    method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify(payload),
  });
  assert.equal(duplicateResident.response.status, 409);
});

test("UC-22 bill reduction preserves the detail-total invariant", async () => {
  const landlord = await login(integration.landlord);
  const bill = await ThanhToan.findOne({
    where: { trang_thai: "CHUA_THANH_TOAN" },
    include: [{ model: ChiTietThanhToan, as: "chiTiets", required: true }],
  });
  assert.ok(bill);
  const before = Number(bill.tong_phai_tra);
  const adjusted = await request(`/api/v1/bills/${bill.ma_thanh_toan}/adjustments`, {
    method: "POST", headers: headers(landlord),
    body: JSON.stringify({ delta: -1000, reason: "Integration discount" }),
  });
  assert.equal(adjusted.response.status, 201, JSON.stringify(adjusted.body));
  const after = await ThanhToan.findByPk(bill.ma_thanh_toan, { include: [{ model: ChiTietThanhToan, as: "chiTiets" }] });
  assert.equal(Number(after.tong_phai_tra), before - 1000);
  assert.equal(after.chiTiets.reduce((sum, item) => sum + Number(item.so_tien), 0), before - 1000);
});

test("UC-15 move-out rejects incomplete input, settles once, and preserves lifecycle state", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "focused-move-out");
  await confirmedReadings(fresh);
  const requestRow = await request("/api/v1/requests", {
    method: "POST", headers: headers(fresh.tenantToken),
    body: JSON.stringify({ type: "TRA_PHONG", content: "Focused move-out" }),
  });
  assert.equal(requestRow.response.status, 201);
  const approval = await request(`/api/v1/requests/${requestRow.body.data.ma_yeu_cau}`, {
    method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_DUYET" }),
  });
  assert.equal(approval.response.status, 200);
  const incomplete = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify({ deduction: 0 }),
  });
  assert.equal(incomplete.response.status, 422);
  const payload = { assetsChecked: true, debtReviewed: true, roomCondition: "Tot", deduction: 100 };
  const first = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(payload),
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.data.refund, 2499900);
  const lifecycleHistory = await LichSuSuaHopDong.findAll({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  assert.ok(lifecycleHistory.some((row) => JSON.stringify(row.sau_json).includes("LIQUIDATED")));
  const repeated = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord), body: JSON.stringify(payload),
  });
  assert.equal(repeated.response.status, 409);
});
