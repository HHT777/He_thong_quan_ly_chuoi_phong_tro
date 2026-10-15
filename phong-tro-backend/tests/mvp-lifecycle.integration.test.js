const test = require("node:test");
const assert = require("node:assert/strict");
const { integration, request, headers, login, createBaseRental, createFreshRental } = require("./helpers/integration-api");

test("UC-02..07 real lifecycle: account, building, room, tenant, deposit and contract", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "lifecycle");
  const tenantContracts = await request("/api/hop-dong", { headers: { Authorization: `Bearer ${fresh.tenantToken}` } });
  assert.equal(tenantContracts.response.status, 200);
  assert.ok(tenantContracts.body.data.some((item) => item.ma_hop_dong === fresh.contract.ma_hop_dong));

  const invalidBase = await createBaseRental(landlord, "invalid-contract");
  const invalidContract = await request("/api/hop-dong", {
    method: "POST", headers: headers(landlord),
    body: JSON.stringify({
      ma_khach_thue: "missing-tenant", ma_phong: invalidBase.room.ma_phong,
      ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30",
      gia_thue: 1, tien_coc: 1, don_gia_dien: 1, don_gia_nuoc: 1,
      dieu_khoan: "Invalid tenant rollback",
      da_co_ban_giay_ky: true,
    }),
  });
  assert.equal(invalidContract.response.status, 404);
  const roomAfterRollback = await request(`/api/phong/${invalidBase.room.ma_phong}`, { headers: { Authorization: `Bearer ${landlord}` } });
  assert.equal(roomAfterRollback.response.status, 200);
  assert.equal(roomAfterRollback.body.data.trang_thai, "TRONG");
});

test("UC-26 contract race allows only one active rental", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createBaseRental(landlord, "race");
  const payload = {
    ma_khach_thue: fresh.tenant.ma_khach_thue, ma_phong: fresh.room.ma_phong,
    ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30",
    gia_thue: 2500000, tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000,
    dieu_khoan: "Concurrent contract test",
    da_co_ban_giay_ky: true,
  };
  const results = await Promise.all([
    request("/api/hop-dong", { method: "POST", headers: headers(landlord), body: JSON.stringify(payload) }),
    request("/api/hop-dong", { method: "POST", headers: headers(landlord), body: JSON.stringify(payload) }),
  ]);
  assert.deepEqual(results.map((item) => item.response.status).sort(), [201, 400]);
});
