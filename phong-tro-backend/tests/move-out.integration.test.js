const test = require("node:test");
const assert = require("node:assert/strict");
const { ChiSoDien, TaiKhoan } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("UC-13/14/16/15 request approval and move-out settlement", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "move-out");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  await ChiSoDien.bulkCreate([
    { nam: 2026, thang: 9, chi_so_moi: 100, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_ghi_nhan_id: actor.ma_tai_khoan, nguoi_xac_nhan_id: actor.ma_tai_khoan, ngay_xac_nhan: new Date(), ma_phong: fresh.room.ma_phong },
    { nam: 2026, thang: 10, chi_so_moi: 123, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_ghi_nhan_id: actor.ma_tai_khoan, nguoi_xac_nhan_id: actor.ma_tai_khoan, ngay_xac_nhan: new Date(), ma_phong: fresh.room.ma_phong },
  ]);
  const created = await request("/api/v1/requests", {
    method: "POST", headers: headers(fresh.tenantToken),
    body: JSON.stringify({ type: "TRA_PHONG", content: "Tra phong integration", date: new Date().toISOString(), earlyReturnReason: "Da thong nhat tra som" }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.body));
  const approved = await request(`/api/v1/requests/${created.body.data.ma_yeu_cau}`, {
    method: "PATCH", headers: headers(landlord),
    body: JSON.stringify({ status: "DA_DUYET", reason: "Da tiep nhan", earlyReturnReason: "Da thong nhat tra som" }),
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  const settled = await request(`/api/v1/move-outs/${fresh.contract.ma_hop_dong}/settle`, {
    method: "POST", headers: headers(landlord),
    body: JSON.stringify({ assetsChecked: true, debtReviewed: true, roomCondition: "Dat yeu cau", deduction: 100000, finalElectricityReading: 123 }),
  });
  assert.equal(settled.response.status, 200, JSON.stringify(settled.body));
  assert.equal(Number(settled.body.data.refund), 2400000);
  const roomAfter = await request(`/api/phong/${fresh.room.ma_phong}`, { headers: { Authorization: `Bearer ${landlord}` } });
  assert.equal(roomAfter.body.data.trang_thai, "TRONG");
});
