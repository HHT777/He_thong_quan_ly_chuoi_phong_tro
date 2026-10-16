const test = require("node:test");
const assert = require("node:assert/strict");
const { HopDong, ThanhVienPhong, ChiSoDien, TaiKhoan, ThanhToan, ChiTietThanhToan, ThongBao } = require("../src/models");
const billingCronService = require("../src/services/billingCron.service");
const { sumSignedLineAmounts } = require("../src/utils/billLine.util");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

async function confirmedReading(fresh, period, value) {
  const [year, month] = period.split("-").map(Number);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  return ChiSoDien.create({ ma_phong: fresh.room.ma_phong, nam: year, thang: month, chi_so_moi: value, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "DA_XAC_NHAN", ngay_ghi_nhan: new Date(Date.UTC(year, month, 0, 12)), nguoi_ghi_nhan_id: actor.ma_tai_khoan, nguoi_xac_nhan_id: actor.ma_tai_khoan, ngay_xac_nhan: new Date() });
}

test("FR-157/164/175/176/179 preview and generation snapshot contract charges atomically", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "billing-definitions");
  await HopDong.update({ phi_dich_vu: 120000 }, { where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  await ThanhVienPhong.create({ ho_ten: "Co tenant billing", so_dien_thoai: "0912345678", ngay_vao: "2026-10-01", trang_thai_cu_tru: "DANG_O", ma_phong: fresh.room.ma_phong, ma_hop_dong: fresh.contract.ma_hop_dong });
  await confirmedReading(fresh, "2026-10", 130);
  const fixed = await request("/api/v1/billing-adjustments", { method: "POST", headers: headers(landlord), body: JSON.stringify({ contractId: fresh.contract.ma_hop_dong, type: "GIAM_TRU", name: "Giảm quản lý căn", amount: 100000, mode: "CO_DINH", startDate: "2026-10-01" }) });
  assert.equal(fixed.response.status, 201, JSON.stringify(fixed.body));
  const onePeriod = await request("/api/v1/billing-adjustments", { method: "POST", headers: headers(landlord), body: JSON.stringify({ contractId: fresh.contract.ma_hop_dong, type: "PHI_PHAT_SINH", name: "Phí kỳ 10", amount: 50000, mode: "THEO_KY", period: "2026-10" }) });
  assert.equal(onePeriod.response.status, 201, JSON.stringify(onePeriod.body));
  const tenantForbidden = await request("/api/v1/billing-adjustments", { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({}) });
  assert.equal(tenantForbidden.response.status, 403);
  const before = await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } });
  const preview = await request("/api/v1/bills/preview", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-10", contractIds: [fresh.contract.ma_hop_dong] }) });
  assert.equal(preview.response.status, 200, JSON.stringify(preview.body));
  assert.equal(await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong } }), before, "preview must not write a bill");
  const item = preview.body.data.previews[0]; assert.equal(item.occupantCount, 2); assert.equal(item.components.water, 200000); assert.equal(item.components.serviceFee, 120000);
  assert.equal(item.total, 2500000 + 130 * 3500 + 200000 + 120000 + 50000 - 100000);
  const generated = await request("/api/v1/bills/generate", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-10", contractIds: [fresh.contract.ma_hop_dong] }) });
  assert.equal(generated.response.status, 201, JSON.stringify(generated.body)); assert.equal(generated.body.data.created.length, 1);
  const bill = await ThanhToan.findByPk(generated.body.data.created[0].ma_thanh_toan, { include: [{ model: ChiTietThanhToan, as: "chiTiets" }] });
  assert.equal(sumSignedLineAmounts(bill.chiTiets), Number(bill.tong_phai_tra));
  assert.equal(bill.chiTiets.filter((line) => line.loai_khoan === "GIAM_TRU").length, 1);
  const edited = await request(`/api/v1/billing-adjustments/${fixed.body.data.ma_khoan_dieu_chinh}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ amount: 200000 }) });
  assert.equal(edited.response.status, 200, JSON.stringify(edited.body));
  const snapshot = await ChiTietThanhToan.findOne({ where: { ma_thanh_toan: bill.ma_thanh_toan, ma_khoan_dieu_chinh: fixed.body.data.ma_khoan_dieu_chinh } }); assert.equal(Number(snapshot.so_tien), -100000);
  const disabled = await request(`/api/v1/billing-adjustments/${fixed.body.data.ma_khoan_dieu_chinh}/toggle`, { method: "POST", headers: headers(landlord), body: JSON.stringify({ enabled: false, reason: "Kết thúc ưu đãi" }) });
  assert.equal(disabled.response.status, 200, JSON.stringify(disabled.body));
  await confirmedReading(fresh, "2026-11", 150);
  const [raceA, raceB] = await Promise.all([0, 1].map(() => request("/api/v1/bills/generate", { method: "POST", headers: headers(landlord), body: JSON.stringify({ period: "2026-11", contractIds: [fresh.contract.ma_hop_dong] }) })));
  assert.equal(raceA.response.status, 201); assert.equal(raceB.response.status, 201);
  assert.equal(raceA.body.data.created.length + raceB.body.data.created.length, 1);
  assert.equal(await ThanhToan.count({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2026, thang: 11, loai_thanh_toan: "DINH_KY" } }), 1);
});

test("FR-151/153/155/156 billing cron sends each persisted bill once", async () => {
  const landlord = await login(integration.landlord); const fresh = await createFreshRental(landlord, "billing-cron"); await confirmedReading(fresh, "2026-12", 80);
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const first = await billingCronService.run({ now: new Date("2026-12-02T08:00:00+07:00"), actorId: actor.ma_tai_khoan, force: true });
  const second = await billingCronService.run({ now: new Date("2026-12-02T08:05:00+07:00"), actorId: actor.ma_tai_khoan, force: true });
  const bill = await ThanhToan.findOne({ where: { ma_hop_dong: fresh.contract.ma_hop_dong, nam: 2026, thang: 12, loai_thanh_toan: "DINH_KY" } });
  assert.ok(bill?.da_gui); assert.ok(bill.ngay_gui); assert.ok(first.sent >= 1); assert.equal(second.sent, 0);
  assert.equal(await ThongBao.count({ where: { ma_tai_khoan: fresh.account.ma_tai_khoan, loai_thong_bao: "PHIEU_THU" } }), 1);
  const forbidden = await request("/api/v1/jobs/billing", { method: "POST", headers: headers(fresh.tenantToken), body: JSON.stringify({ force: true }) }); assert.equal(forbidden.response.status, 403);
});
