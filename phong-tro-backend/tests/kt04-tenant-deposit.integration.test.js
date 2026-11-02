const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const sequelize = require("../src/config/database");
const { TaiKhoan, ChuTro, HopDong, TienCoc, BienBanTraPhong, KhoanKhauTru, GiaoDichHoanCoc } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

async function snapshot() {
  const entries = [];
  for (const model of Object.values(sequelize.models)) {
    const rows = await model.findAll({ raw: true });
    rows.sort((a, b) => String(a[model.primaryKeyAttribute]).localeCompare(String(b[model.primaryKeyAttribute])));
    entries.push([model.name, crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex")]);
  }
  return Object.fromEntries(entries);
}
const shape = (result) => ({ status: result.response.status, code: result.body.error?.code || result.body.code, message: result.body.error?.message || result.body.message, keys: Object.keys(result.body).sort(), errorKeys: Object.keys(result.body.error || {}).sort() });
const path = (id) => `/api/v1/me/contracts/${id}/deposit`;
async function read(token, url) {
  const before = await snapshot();
  const result = await request(url, { headers: headers(token) });
  assert.deepEqual(await snapshot(), before, "KT-04 GET must not write any table, including audit and accounts");
  return result;
}

test("KT-04 tenant deposit ownership, ledger states, child FKs, whitelist and owner regression", async (t) => {
  const ownerA = await login(integration.landlord);
  const ownerAId = (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan;
  const ownerBName = `kt04b${Date.now()}`.slice(0, 15);
  const ownerBAccount = await TaiKhoan.create({ ten_dang_nhap: ownerBName, mat_khau: "Kt04OwnerB123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await ChuTro.create({ ma_tai_khoan: ownerBAccount.ma_tai_khoan, ho_ten: "Chủ trọ B KT04", so_dien_thoai: "0987654398" });
  const ownerB = await login({ username: ownerBName, password: "Kt04OwnerB123" });
  const a = await createFreshRental(ownerA, "kt04-a");
  const b = await createFreshRental(ownerA, "kt04-same-owner-b");
  const c = await createFreshRental(ownerB, "kt04-other-owner");
  const deposit = await TienCoc.findOne({ where: { ma_hop_dong: a.contract.ma_hop_dong } });
  const depositB = await TienCoc.findOne({ where: { ma_hop_dong: b.contract.ma_hop_dong } });
  const originalDeposit = structuredClone(deposit.get({ plain: true }));
  const missing = crypto.randomUUID();

  await t.test("cross-tenant and absent contracts share opaque 404, wrong role 403, unknown identity filters rejected", async () => {
    const absent = await read(a.tenantToken, path(missing));
    assert.equal(absent.response.status, 404); assert.equal(shape(absent).code, "RESOURCE_NOT_FOUND");
    for (const foreign of [b.contract.ma_hop_dong, c.contract.ma_hop_dong]) {
      assert.deepEqual(shape(await read(a.tenantToken, path(foreign))), shape(absent));
    }
    assert.equal((await read(ownerA, path(a.contract.ma_hop_dong))).response.status, 403);
    assert.equal((await read(ownerB, path(a.contract.ma_hop_dong))).response.status, 403);
    assert.equal((await read(a.tenantToken, `${path(a.contract.ma_hop_dong)}?tenantId=${b.tenant.ma_khach_thue}`)).response.status, 400);
  });

  await t.test("received and unreceived zero deposit are distinct and response is whitelisted", async () => {
    const received = await read(a.tenantToken, path(a.contract.ma_hop_dong));
    assert.equal(received.response.status, 200, JSON.stringify(received.body));
    assert.deepEqual(Object.keys(received.body.data.deposit).sort(), ["so_tien_coc", "ngay_nhan_coc", "trang_thai", "so_tien_da_hoan", "so_tien_da_khau_tru"].sort());
    assert.equal(received.body.data.deposit.trang_thai, "DA_NHAN");
    assert.equal(Number(received.body.data.deposit.so_tien_coc), 2500000);
    await deposit.update({ so_tien_coc: 0, trang_thai: "CHUA_NHAN", ngay_nhan_coc: null });
    const zero = await read(a.tenantToken, path(a.contract.ma_hop_dong));
    assert.equal(Number(zero.body.data.deposit.so_tien_coc), 0);
    assert.equal(zero.body.data.deposit.trang_thai, "CHUA_NHAN"); assert.equal(zero.body.data.deposit.ngay_nhan_coc, null);
    await deposit.update(originalDeposit);
  });

  await t.test("own contract without deposit returns null, restored fixture preserves invariants", async () => {
    await deposit.destroy();
    try {
      const empty = await read(a.tenantToken, path(a.contract.ma_hop_dong));
      assert.equal(empty.response.status, 200); assert.equal(empty.body.data.deposit, null);
    } finally { await TienCoc.create(originalDeposit); }
  });

  await t.test("multiple contracts of the same tenant remain separately scoped", async () => {
    const history = await HopDong.create({ ...a.contract, ma_hop_dong: crypto.randomUUID(), ngay_bat_dau: "2025-01-01", ngay_ket_thuc: "2025-12-31", ngay_thanh_ly: "2025-12-31", trang_thai: "DA_THANH_LY" });
    await TienCoc.create({ ma_hop_dong: history.ma_hop_dong, so_tien_coc: 1234567, trang_thai: "CHUA_NHAN", ngay_nhan_coc: null, so_tien_da_hoan: 0, so_tien_da_khau_tru: 0 });
    const old = await read(a.tenantToken, path(history.ma_hop_dong));
    assert.equal(old.response.status, 200); assert.equal(Number(old.body.data.deposit.so_tien_coc), 1234567);
    const current = await read(a.tenantToken, path(a.contract.ma_hop_dong));
    assert.equal(Number(current.body.data.deposit.so_tien_coc), 2500000);
    assert.equal((await read(b.tenantToken, path(history.ma_hop_dong))).response.status, 404);
  });

  const report = await BienBanTraPhong.create({ ma_hop_dong: a.contract.ma_hop_dong, ngay_kiem_tra: "2026-10-15", ngay_quyet_toan: "2026-10-15", tinh_trang_phong: "KT04 fixture", nguoi_lap_id: ownerAId, tong_khoan_khau_tru: 100000, so_tien_coc_duoc_hoan: 2400000, tien_coc_ban_dau: 2500000, tien_phong_tra_truoc_duoc_hoan: 500000, gia_tri_quyet_toan_rong: 2900000, so_tien_no_sau_thanh_ly: 0, snapshot_json: { internal: "not-for-response" }, la_du_lieu_legacy: false });
  const deduction = await KhoanKhauTru.create({ ma_bien_ban_tra_phong: report.ma_bien_ban, loai_khau_tru: "KHAC", ly_do: "<img src=x onerror=alert(1)>", ghi_chu: "<script>note</script>", so_tien: 100000 });
  try {
    await t.test("partial and full refunds, deductions and stored settlement are read without recalculation", async () => {
      await TienCoc.update({ trang_thai: "DA_KHAU_TRU_MOT_PHAN", so_tien_da_khau_tru: 100000, so_tien_da_hoan: 100000 }, { where: { ma_tien_coc: originalDeposit.ma_tien_coc } });
      await GiaoDichHoanCoc.create({ ma_bien_ban_tra_phong: report.ma_bien_ban, ma_tien_coc: originalDeposit.ma_tien_coc, ngay_hoan: "2026-10-16", so_tien: 100000, nguoi_ghi_nhan_id: ownerAId, khoa_chong_trung: `kt04-${crypto.randomUUID()}` });
      const partial = (await read(a.tenantToken, path(a.contract.ma_hop_dong))).body.data;
      assert.equal(Number(partial.deposit.so_tien_da_hoan), 100000); assert.equal(partial.refunds.length, 1);
      assert.equal(Number(partial.settlement.gia_tri_quyet_toan_rong), 2900000);
      assert.equal(Number(partial.settlement.tien_phong_tra_truoc_duoc_hoan), 500000);
      assert.equal(partial.deductions[0].ghi_chu, "<script>note</script>");
      assert.doesNotMatch(JSON.stringify(partial), /snapshot_json|not-for-response|nguoi_lap_id|nguoi_ghi_nhan_id|khoa_chong_trung|ma_bien_ban|ma_tien_coc/);
      await GiaoDichHoanCoc.create({ ma_bien_ban_tra_phong: report.ma_bien_ban, ma_tien_coc: originalDeposit.ma_tien_coc, ngay_hoan: "2026-10-17", so_tien: 2300000, nguoi_ghi_nhan_id: ownerAId, khoa_chong_trung: `kt04-${crypto.randomUUID()}` });
      await TienCoc.update({ so_tien_da_hoan: 2400000, trang_thai: "DA_HOAN" }, { where: { ma_tien_coc: originalDeposit.ma_tien_coc } });
      const full = (await read(a.tenantToken, path(a.contract.ma_hop_dong))).body.data;
      assert.equal(Number(full.deposit.so_tien_da_hoan), 2400000); assert.equal(full.deposit.trang_thai, "DA_HOAN"); assert.equal(full.refunds.length, 2);
    });
    await t.test("independent refund FKs must both match the selected contract", async () => {
      const foreign = await GiaoDichHoanCoc.create({ ma_bien_ban_tra_phong: report.ma_bien_ban, ma_tien_coc: depositB.ma_tien_coc, ngay_hoan: "2026-10-18", so_tien: 17, nguoi_ghi_nhan_id: ownerAId, khoa_chong_trung: `kt04-foreign-${crypto.randomUUID()}` });
      try {
        const dto = (await read(a.tenantToken, path(a.contract.ma_hop_dong))).body.data;
        assert.equal(dto.refunds.length, 2); assert.ok(dto.refunds.every((row) => Number(row.so_tien) !== 17));
        const other = (await read(b.tenantToken, path(b.contract.ma_hop_dong))).body.data;
        assert.deepEqual(other.refunds, []); assert.deepEqual(other.deductions, []);
      } finally { await foreign.destroy(); }
    });
    await t.test("legacy totals without refund events and missing fields remain visible", async () => {
      await GiaoDichHoanCoc.destroy({ where: { ma_bien_ban_tra_phong: report.ma_bien_ban } });
      await report.update({ la_du_lieu_legacy: true, tien_phong_tra_truoc_duoc_hoan: null });
      const dto = (await read(a.tenantToken, path(a.contract.ma_hop_dong))).body.data;
      assert.equal(Number(dto.deposit.so_tien_da_hoan), 2400000); assert.deepEqual(dto.refunds, []);
      assert.ok(dto.dataWarnings.includes("REFUND_DETAILS_UNAVAILABLE")); assert.ok(dto.dataWarnings.includes("LEGACY_SETTLEMENT"));
      assert.equal(dto.settlement.tien_phong_tra_truoc_duoc_hoan, null);
    });
  } finally {
    await GiaoDichHoanCoc.destroy({ where: { ma_bien_ban_tra_phong: report.ma_bien_ban } });
    await deduction.destroy(); await report.destroy();
    await TienCoc.update(originalDeposit, { where: { ma_tien_coc: originalDeposit.ma_tien_coc } });
  }

  await t.test("owner legacy deposit routes and contract modal data keep existing behavior", async () => {
    const list = await read(ownerA, "/api/dat-coc?limit=100");
    assert.equal(list.response.status, 200); assert.ok(list.body.data.some((row) => row.ma_tien_coc === depositB.ma_tien_coc));
    const foreignId = (await TienCoc.findOne({ where: { ma_hop_dong: c.contract.ma_hop_dong } })).ma_tien_coc;
    assert.ok(!list.body.data.some((row) => row.ma_tien_coc === foreignId));
    const own = await read(ownerA, `/api/dat-coc/${depositB.ma_tien_coc}`); assert.equal(own.response.status, 200);
    const foreign = await read(ownerA, `/api/dat-coc/${foreignId}`);
    assert.deepEqual(shape(foreign), shape(await read(ownerA, `/api/dat-coc/${missing}`))); assert.equal(foreign.response.status, 404);
    assert.equal((await read(a.tenantToken, "/api/dat-coc")).response.status, 403);
    for (const suffix of ["confirm", "cancel"]) {
      const before = await snapshot();
      const denied = await request(`/api/dat-coc/${depositB.ma_tien_coc}/${suffix}`, { method: "POST", headers: headers(a.tenantToken), body: "{}" });
      assert.equal(denied.response.status, 403); assert.deepEqual(await snapshot(), before);
    }
    const ownerModal = await read(ownerA, `/api/dat-coc?ma_hop_dong=${a.contract.ma_hop_dong}&limit=1`);
    assert.equal(ownerModal.body.data.length, 1); assert.equal(Number(ownerModal.body.data[0].so_tien_coc), 2500000);
  });
});
