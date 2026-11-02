const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const sequelize = require("../src/config/database");
const { TaiKhoan, ChuTro, HopDong, YeuCau, YeuCauGiaHan, LichSuGiaHanHopDong, ThongBao } = require("../src/models");
const { businessDate, addBusinessDays } = require("../src/utils/businessDate.util");
const { addRenewalMonths } = require("../src/services/contractLifecycle.service");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");
// Explicit teardown also drains connections last used under the test clock.
test.after(() => sequelize.close());
async function snapshot() {
  const rows = {};
  for (const model of Object.values(sequelize.models)) rows[model.name] = (await model.findAll({ raw: true })).map((r) => JSON.stringify(r)).sort();
  return JSON.stringify(rows);
}
async function call(token, method, url, body, status) {
  const before = method === "GET" || status >= 400 ? await snapshot() : null;
  const r = await request(url, { method, headers: headers(token), ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(r.response.status, status, `${method} ${url}: ${JSON.stringify(r.body)}`);
  if (before) assert.equal(await snapshot(), before, "GET or rejected request must not write DB/audit/notifications");
  return r.body;
}
test("KT09 scoped renewal packages race legacy rejection revalidation and shared-request regression", async () => {
  const ownerA = await login(integration.landlord);
  const accountB = await TaiKhoan.create({ ten_dang_nhap: `k9${Date.now()}`.slice(0, 15), mat_khau: "FixtureOwner123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "KT09 owner B", so_dien_thoai: "0987654309" });
  const ownerB = await login({ username: accountB.ten_dang_nhap, password: "FixtureOwner123" });
  const a = await createFreshRental(ownerA, "kt09-a"), b = await createFreshRental(ownerB, "kt09-b"), c = await createFreshRental(ownerA, "kt09-c"), shared = await createFreshRental(ownerB, "kt09-shared");
  const today = businessDate(), end = addBusinessDays(today, 10);
  await HopDong.update({ ngay_ket_thuc: end, trang_thai: "DANG_HIEU_LUC" }, { where: { ma_hop_dong: [a.contract.ma_hop_dong, b.contract.ma_hop_dong, c.contract.ma_hop_dong, shared.contract.ma_hop_dong] } });
  await HopDong.update({ ma_khach_thue: a.tenant.ma_khach_thue }, { where: { ma_hop_dong: shared.contract.ma_hop_dong } });
  const url = "/api/v1/requests", ctx = "/api/v1/me/renewal-context";
  const payload = (r, months = 6) => ({ type: "GIA_HAN", contractId: r.contract.ma_hop_dong, packageMonths: months, content: "<script>gia hạn</script>" });
  const context = await call(a.tenantToken, "GET", ctx, null, 200);
  assert.equal(context.data.contracts.length, 2); assert.ok(context.data.contracts.every((r) => r.eligible));
  assert.ok(context.data.contracts.some((r) => r.contractId === shared.contract.ma_hop_dong));
  assert.ok(context.data.contracts.every((r) => r.allowedPackages[0].expectedEndDate === addRenewalMonths(end, 6)));
  await call(ownerA, "GET", ctx, null, 403);
  await call(a.tenantToken, "GET", ctx + "?tenantId=" + b.tenant.ma_khach_thue, null, 400);
  const foreign = await call(a.tenantToken, "POST", url, payload(b), 404);
  const missing = await call(a.tenantToken, "POST", url, { ...payload(b), contractId: crypto.randomUUID() }, 404);
  assert.deepEqual(foreign.error, missing.error); assert.equal(foreign.error.code, "RESOURCE_NOT_FOUND");
  for (const extra of [{ requestedEndDate: end }, { date: end }, { newEndDate: end }, { packageMonths: 7 }, { content: "" }, { tenantId: b.tenant.ma_khach_thue }]) await call(a.tenantToken, "POST", url, { ...payload(a), ...extra }, 400);
  for (const [state, days] of [["DANG_HIEU_LUC", 31], ["SAP_HET_HAN", -1], ["HET_HAN", 10], ["DA_THANH_LY", 10]]) {
    await HopDong.update({ trang_thai: state, ngay_ket_thuc: addBusinessDays(today, days), ngay_thanh_ly: state === "DA_THANH_LY" ? today : null }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
    await call(a.tenantToken, "POST", url, payload(a), 409);
  }
  await HopDong.update({ trang_thai: "DANG_HIEU_LUC", ngay_ket_thuc: end, ngay_thanh_ly: null, goi_gia_han_cho_phep: "12" }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
  await call(a.tenantToken, "POST", url, payload(a), 400);
  await HopDong.update({ goi_gia_han_cho_phep: null }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
  const race = await Promise.all([1, 2].map(() => request(url, { method: "POST", headers: headers(a.tenantToken), body: JSON.stringify(payload(a, 12)) })));
  assert.deepEqual(race.map((r) => r.response.status).sort(), [201, 409]);
  assert.equal(await YeuCauGiaHan.count({ where: { ma_hop_dong: a.contract.ma_hop_dong } }), 1);
  const id = race.find((r) => r.response.status === 201).body.data.ma_yeu_cau;
  assert.equal((await YeuCauGiaHan.findByPk(id)).goi_gia_han_thang, 12);
  await call(a.tenantToken, "POST", url, payload(a), 409);
  const requestB = await call(b.tenantToken, "POST", url, payload(b), 201);
  const requestC = await call(c.tenantToken, "POST", url, payload(c), 201);
  const requestShared = await call(a.tenantToken, "POST", url, payload(shared), 201);
  const listed = await call(ownerA, "GET", url, null, 200);
  assert.ok(listed.data.some((r) => r.ma_yeu_cau === id));
  assert.ok(!listed.data.some((r) => [requestB.data.ma_yeu_cau, requestShared.data.ma_yeu_cau].includes(r.ma_yeu_cau)));
  for (const status of ["DA_PHE_DUYET", "TU_CHOI"]) {
    const f = await call(ownerA, "PATCH", `${url}/${requestB.data.ma_yeu_cau}`, { status, reason: "No" }, 404);
    const n = await call(ownerA, "PATCH", `${url}/${crypto.randomUUID()}`, { status, reason: "No" }, 404);
    assert.deepEqual(f.error, n.error); assert.equal(f.error.code, "RESOURCE_NOT_FOUND");
  }
  await call(a.tenantToken, "PATCH", `${url}/${id}`, { status: "DA_PHE_DUYET" }, 403);
  await call(ownerB, "PATCH", `${url}/${requestB.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET" }, 200);
  assert.equal((await HopDong.findByPk(b.contract.ma_hop_dong)).ngay_ket_thuc, addRenewalMonths(end, 6));
  const old = (await HopDong.findByPk(a.contract.ma_hop_dong)).toJSON();
  const changedEnd = addBusinessDays(end, 1);
  await HopDong.update({ ngay_ket_thuc: changedEnd }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
  await call(ownerA, "PATCH", `${url}/${id}`, { status: "DA_PHE_DUYET", requestedEndDate: "2099-01-01" }, 200);
  const renewed = await HopDong.findByPk(a.contract.ma_hop_dong);
  assert.equal(renewed.ngay_ket_thuc, addRenewalMonths(changedEnd, 12));
  for (const key of ["gia_thue", "don_gia_dien", "don_gia_nuoc", "phi_dich_vu"]) assert.equal(String(renewed[key]), String(old[key]));
  assert.equal(renewed.trang_thai, "DANG_HIEU_LUC");
  const history = await LichSuGiaHanHopDong.findOne({ where: { ma_hop_dong: renewed.ma_hop_dong } }); assert.equal(history.so_thang, 12); assert.equal(history.ngay_ket_thuc_cu, changedEnd);
  await call(ownerA, "PATCH", `${url}/${id}`, { status: "DA_PHE_DUYET" }, 409);
  await YeuCauGiaHan.update({ goi_gia_han_thang: null }, { where: { ma_yeu_cau: requestC.data.ma_yeu_cau } });
  const legacy = await call(ownerA, "PATCH", `${url}/${requestC.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET" }, 409); assert.equal(legacy.error.code, "LEGACY_RENEWAL_PACKAGE_MISSING");
  await call(ownerA, "PATCH", `${url}/${requestC.data.ma_yeu_cau}`, { status: "TU_CHOI" }, 400);
  await call(ownerA, "PATCH", `${url}/${requestC.data.ma_yeu_cau}`, { status: "TU_CHOI", reason: "Yêu cầu cũ thiếu gói" }, 200);
  const again = await call(c.tenantToken, "POST", url, payload(c), 201);
  await HopDong.update({ ngay_ket_thuc: addBusinessDays(today, 90) }, { where: { ma_hop_dong: c.contract.ma_hop_dong } });
  const stale = await call(ownerA, "PATCH", `${url}/${again.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET" }, 409); assert.equal(stale.error.code, "RENEWAL_NO_LONGER_ELIGIBLE");
  assert.equal((await YeuCau.findByPk(again.data.ma_yeu_cau)).trang_thai, "CHO_XU_LY");
  const tenantList = await call(c.tenantToken, "GET", url, null, 200); assert.ok(tenantList.data.some((r) => r.ly_do_xu_ly === "Yêu cầu cũ thiếu gói"));
  assert.ok(!JSON.stringify(tenantList).includes("nguoi_xu_ly_id"));
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: `YEU_CAU_MOI:${id}` } }), 1);
  const moveRental = await createFreshRental(ownerB, "kt09-move-regression");
  const other = await call(moveRental.tenantToken, "POST", url, { type: "TRA_PHONG", contractId: moveRental.contract.ma_hop_dong, content: "Hồi quy trả phòng", date: addBusinessDays(today, 35) }, 201);
  await call(ownerB, "PATCH", `${url}/${other.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET" }, 200);
  const proposal = await request(url, { method: "POST", headers: headers(b.tenantToken), body: JSON.stringify({ type: "DE_XUAT_BAN_CUNG_PHONG" }) });
  assert.equal(proposal.response.status, 422);
  const proposed = await call(b.tenantToken, "POST", "/api/v1/co-tenants", { name: "KT09 regression", phone: "0987654349", identityNumber: "KT09-identity", birthDate: "2000-05-12", gender: "NAM", permanentAddress: "Test", relationship: "BAN", startDate: today }, 201);
  const proposalId = proposed.data.request.ma_yeu_cau;
  await call(ownerA, "PATCH", `${url}/${proposalId}`, { status: "DA_PHE_DUYET" }, 404);
  await call(ownerB, "PATCH", `${url}/${proposalId}`, { status: "DA_PHE_DUYET" }, 200);
  await call(ownerA, "POST", `/api/hop-dong/${a.contract.ma_hop_dong}/renew`, {}, 409);
  const invalid = await call("invalid", "GET", ctx, null, 401); assert.equal(invalid.success, false);
  // Real DB + production service; only this test process has a controlled clock.
  // Each calendar case rolls back all contract, request, history and audit writes.
  const renewalService = require("../src/services/renewalRequest.service");
  const configService = require("../src/services/systemConfig.service");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const RealDate = global.Date;
  for (const [oldEnd, months, expected] of [["2026-08-31", 6, "2027-02-28"], ["2027-08-31", 6, "2028-02-29"], ["2028-02-29", 12, "2029-02-28"]]) {
    const now = new RealDate(`${oldEnd}T05:00:00Z`); now.setUTCDate(now.getUTCDate() - 5);
    const tx = await sequelize.transaction();
    try {
      global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [now.getTime()])); } static now() { return now.getTime(); } };
      configService.invalidateSystemConfigCache();
      await HopDong.update({ ngay_bat_dau: "2025-01-01", ngay_ket_thuc: oldEnd, trang_thai: "DANG_HIEU_LUC", ngay_thanh_ly: null }, { where: { ma_hop_dong: a.contract.ma_hop_dong }, transaction: tx });
      const row = await YeuCau.create({ ma_khach_thue: a.tenant.ma_khach_thue, loai_yeu_cau: "GIA_HAN", noi_dung: "KT09 calendar integration", trang_thai: "CHO_XU_LY" }, { transaction: tx });
      await YeuCauGiaHan.create({ ma_yeu_cau: row.ma_yeu_cau, ma_hop_dong: a.contract.ma_hop_dong, goi_gia_han_thang: months, ngay_ket_thuc_de_xuat: expected }, { transaction: tx });
      const result = await renewalService.approve(row, actor.ma_tai_khoan, tx);
      assert.equal(result.endDate, expected);
      assert.equal((await HopDong.findByPk(a.contract.ma_hop_dong, { transaction: tx })).ngay_ket_thuc, expected);
      const event = await LichSuGiaHanHopDong.findOne({ where: { ma_hop_dong: a.contract.ma_hop_dong, ngay_ket_thuc_cu: oldEnd }, transaction: tx });
      assert.equal(event.so_thang, months); assert.equal(event.ngay_ket_thuc_moi, expected);
    } finally { global.Date = RealDate; configService.invalidateSystemConfigCache(); await tx.rollback(); }
  }
});
