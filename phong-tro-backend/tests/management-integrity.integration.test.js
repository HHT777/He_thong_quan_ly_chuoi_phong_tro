const test = require("node:test");
const assert = require("node:assert/strict");
const { KhoanChi, ThanhToan, TaiSan, SuCo, SuCoTaiSan, PhongTro, BienBanTraPhong, KhoanKhauTru } = require("../src/models");
const { integration, request, headers, login, createBaseRental, createFreshRental } = require("./helpers/integration-api");

test("FR-023/193 management validation, soft cancellation and building guards", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "management-integrity");
  const unknown = await request("/api/management/can-tro", { method: "POST", headers: headers(landlord), body: JSON.stringify({ ten_can: "Invalid", dia_chi: "Invalid", injected: true }) });
  assert.equal(unknown.response.status, 400);
  const stopOccupied = await request(`/api/management/can-tro/${fresh.building.ma_can}`, { method: "PUT", headers: headers(landlord), body: JSON.stringify({ trang_thai: "NGUNG_HOAT_DONG" }) });
  assert.equal(stopOccupied.response.status, 409);
  const negative = await request("/api/management/thu-chi", { method: "POST", headers: headers(landlord), body: JSON.stringify({ loai_khoan_chi: "DIEN_CHUNG", so_tien: -1, ngay_phat_sinh: "2026-10-16", pham_vi: "CAN_TRO", ma_can: fresh.building.ma_can }) });
  assert.equal(negative.response.status, 400);
  const invalidScope = await request("/api/management/thu-chi", { method: "POST", headers: headers(landlord), body: JSON.stringify({ loai_khoan_chi: "DIEN_CHUNG", so_tien: 100000, ngay_phat_sinh: "2026-10-16", pham_vi: "CAN_TRO", ma_can: "00000000-0000-4000-8000-000000000000" }) });
  assert.equal(invalidScope.response.status, 422);
  const expense = await request("/api/management/thu-chi", { method: "POST", headers: headers(landlord), body: JSON.stringify({ loai_khoan_chi: "DIEN_CHUNG", so_tien: 100000, ngay_phat_sinh: "2026-10-16", pham_vi: "CAN_TRO", ma_can: fresh.building.ma_can }) });
  assert.equal(expense.response.status, 201, JSON.stringify(expense.body));
  const cancelled = await request(`/api/management/thu-chi/${expense.body.data.ma_khoan_chi}`, { method: "DELETE", headers: headers(landlord), body: JSON.stringify({ reason: "Ghi nhận nhầm" }) });
  assert.equal(cancelled.response.status, 200); assert.equal((await KhoanChi.findByPk(expense.body.data.ma_khoan_chi)).trang_thai, "DA_HUY");
  const twice = await request(`/api/management/thu-chi/${expense.body.data.ma_khoan_chi}`, { method: "DELETE", headers: headers(landlord), body: JSON.stringify({ reason: "Lần hai" }) });
  assert.equal(twice.response.status, 409);
  const report = await request(`/api/v1/reports/cashflow?buildingId=${fresh.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(report.body.data.totalExpenses, 0);
});

test("FR-038 management filters bills by building and protects linked assets", async () => {
  const landlord = await login(integration.landlord); const first = await createFreshRental(landlord, "filter-first"); const second = await createFreshRental(landlord, "filter-second");
  await ThanhToan.create({ ma_hop_dong: first.contract.ma_hop_dong, nam: 2028, thang: 1, loai_thanh_toan: "DINH_KY", tong_phai_tra: 1000, tong_da_thanh_toan: 0, so_tien_con_no: 1000, trang_thai: "CHUA_THANH_TOAN" });
  await ThanhToan.create({ ma_hop_dong: second.contract.ma_hop_dong, nam: 2028, thang: 1, loai_thanh_toan: "DINH_KY", tong_phai_tra: 2000, tong_da_thanh_toan: 0, so_tien_con_no: 2000, trang_thai: "CHUA_THANH_TOAN" });
  const bills = await request(`/api/khoan-phai-thu?buildingId=${first.building.ma_can}`, { headers: headers(landlord) });
  assert.equal(bills.response.status, 200); assert.ok(bills.body.data.length >= 1);
  assert.ok(bills.body.data.every((bill) => bill.hopDong.phongTro.ma_can === first.building.ma_can));

  const asset = await TaiSan.create({ ten_tai_san: "Quạt liên kết", so_luong: 1, ma_phong: first.room.ma_phong });
  const incident = await SuCo.create({ loai_su_co: "TAI_SAN", muc_do_uu_tien: "THAP", ma_nguoi_gui: first.account.ma_tai_khoan, ma_phong: first.room.ma_phong });
  await SuCoTaiSan.create({ ma_su_co: incident.ma_su_co, ma_tai_san: asset.ma_tai_san });
  const blocked = await request(`/api/v1/assets/${asset.ma_tai_san}`, { method: "DELETE", headers: headers(landlord) });
  assert.equal(blocked.response.status, 409); assert.ok(await TaiSan.findByPk(asset.ma_tai_san));
});

test("FR-193 deactivation guards each occupied room state and allows an all-empty building", async () => {
  const landlord = await login(integration.landlord);
  for (const status of ["DANG_THUE", "DA_GIU", "DANG_XU_LY_TRA_PHONG"]) {
    const fresh = await createBaseRental(landlord, `building-status-${status}`);
    await PhongTro.update({ trang_thai: status }, { where: { ma_phong: fresh.room.ma_phong } });
    const blocked = await request(`/api/management/can-tro/${fresh.building.ma_can}`, { method: "PUT", headers: headers(landlord), body: JSON.stringify({ trang_thai: "NGUNG_HOAT_DONG" }) });
    assert.equal(blocked.response.status, 409, status);
  }
  const empty = await createBaseRental(landlord, "building-status-empty");
  const allowed = await request(`/api/management/can-tro/${empty.building.ma_can}`, { method: "PUT", headers: headers(landlord), body: JSON.stringify({ trang_thai: "NGUNG_HOAT_DONG" }) });
  assert.equal(allowed.response.status, 200);
});

test("FR-038 asset deletion blocks a settlement deduction link", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "asset-settlement-link", { createAccount: false });
  const owner = await require("../src/models").TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } });
  const asset = await TaiSan.create({ ten_tai_san: "Settlement asset", so_luong: 1, ma_phong: fresh.room.ma_phong });
  const record = await BienBanTraPhong.create({ ngay_kiem_tra: "2026-10-16", tinh_trang_phong: "ok", tong_khoan_khau_tru: 10, so_tien_coc_duoc_hoan: 0, ma_hop_dong: fresh.contract.ma_hop_dong, nguoi_lap_id: owner.ma_tai_khoan });
  await KhoanKhauTru.create({ loai_khau_tru: "TAI_SAN", ly_do: "broken", so_tien: 10, ma_bien_ban_tra_phong: record.ma_bien_ban, ma_tai_san: asset.ma_tai_san });
  const blocked = await request(`/api/v1/assets/${asset.ma_tai_san}`, { method: "DELETE", headers: headers(landlord) });
  assert.equal(blocked.response.status, 409);
});
