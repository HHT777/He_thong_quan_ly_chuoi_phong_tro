const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const db = require("../src/config/database"), models = require("../src/models");
const { TaiKhoan, ChuTro, HopDong, YeuCau, YeuCauTraPhong, YeuCauGiaHan, ThongBao, PhongTro, TienCoc } = models;
const service = require("../src/services/moveOutRequest.service");
const { businessDate, addBusinessDays: days } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");
test.after(() => db.close());
async function snapshot() {
  const data = {};
  for (const model of Object.values(db.models)) data[model.name] = (await model.findAll({ raw: true })).map((r) => JSON.stringify(r)).sort();
  return data;
}
async function call(token, method, path, payload, status) {
  const before = method === "GET" || status >= 400 ? await snapshot() : null;
  const result = await request(path, { method, headers: headers(token), ...(payload ? { body: JSON.stringify(payload) } : {}) });
  assert.equal(result.response.status, status, `${method} ${path}: ${JSON.stringify(result.body)}`);
  if (before) assert.deepEqual(await snapshot(), before, "rejected requests/GET must not write DB, audit or notifications");
  return result.body;
}
test("KT10 scoped move-out dates duplicates race mutual renewal conflicts decisions revoke notices and no liquidation", async () => {
  const ownerA = await login(integration.landlord), accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const accountB = await TaiKhoan.create({ ten_dang_nhap: `kt10${Date.now()}`.slice(0, 15), mat_khau: "OwnerTest123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "KT10 B", so_dien_thoai: "0987654310" });
  const ownerB = await login({ username: accountB.ten_dang_nhap, password: "OwnerTest123" });
  const a = await createFreshRental(ownerA, "kt10-a"), b = await createFreshRental(ownerB, "kt10-b"), c = await createFreshRental(ownerA, "kt10-c"), multi = await createFreshRental(ownerA, "kt10-multi");
  const today = businessDate(), url = "/api/v1/requests", ctx = "/api/v1/me/move-out-context";
  await HopDong.update({ ma_khach_thue: a.tenant.ma_khach_thue }, { where: { ma_hop_dong: multi.contract.ma_hop_dong } });
  const payload = (r, offset = 30, extra = {}) => ({ type: "TRA_PHONG", contractId: r.contract.ma_hop_dong, content: "<script>Trả phòng</script>", expectedMoveOutDate: days(today, offset), ...extra });
  const context = await call(a.tenantToken, "GET", ctx, null, 200);
  assert.equal(context.data.minimumNormalMoveOutDate, days(today, 30)); assert.equal(context.data.contracts.length, 2);
  assert.ok(context.data.contracts.every((r) => r.eligible));
  assert.ok(!JSON.stringify(context.data).includes("ma_tai_khoan"));
  await call(ownerA, "GET", ctx, null, 403); await call("bad", "GET", ctx, null, 401);
  for (const query of ["tenantId=other", "contractId=other", "roomId=other"]) await call(a.tenantToken, "GET", `${ctx}?${query}`, null, 400);
  await HopDong.update({ ma_khach_thue: c.tenant.ma_khach_thue }, { where: { ma_hop_dong: [a.contract.ma_hop_dong, multi.contract.ma_hop_dong] } });
  assert.deepEqual((await call(a.tenantToken, "GET", ctx, null, 200)).data.contracts, []);
  await HopDong.update({ ma_khach_thue: a.tenant.ma_khach_thue }, { where: { ma_hop_dong: [a.contract.ma_hop_dong, multi.contract.ma_hop_dong] } });
  const absent = await call(a.tenantToken, "POST", url, { ...payload(a), contractId: crypto.randomUUID() }, 404);
  for (const rental of [b, c]) { const foreign = await call(a.tenantToken, "POST", url, payload(rental), 404); assert.deepEqual(foreign.error, absent.error); assert.equal(foreign.error.code, "RESOURCE_NOT_FOUND"); }
  await call(ownerA, "POST", url, payload(a), 403);
  for (const patch of [{ expectedMoveOutDate: days(today, -1), earlyReturnReason: "Reason" }, { expectedMoveOutDate: "2026-02-30" }, { expectedMoveOutDate: "31/10/2026" }, { expectedMoveOutDate: "2099-01-01" }, { expectedMoveOutDate: days(today, 29) }, { tenantId: "other" }, { roomId: "other" }, { content: "" }]) await call(a.tenantToken, "POST", url, { ...payload(a), ...patch }, 400);
  const race = await Promise.all([1, 2].map(() => request(url, { method: "POST", headers: headers(a.tenantToken), body: JSON.stringify(payload(a)) })));
  assert.deepEqual(race.map((r) => r.response.status).sort(), [201, 409]);
  assert.equal(await YeuCauTraPhong.count({ where: { ma_hop_dong: a.contract.ma_hop_dong } }), 1);
  let id = race.find((r) => r.response.status === 201).body.data.ma_yeu_cau;
  await call(a.tenantToken, "POST", url, payload(a), 409);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: `YEU_CAU_MOI:${id}`, ma_tai_khoan: accountA.ma_tai_khoan } }), 1);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: `YEU_CAU_MOI:${id}`, ma_tai_khoan: accountB.ma_tai_khoan } }), 0);
  for (const method of ["PATCH", "POST"]) {
    const suffix = method === "POST" ? "/revoke" : "", body = method === "POST" ? { reason: "No" } : { status: "DA_PHE_DUYET" };
    const f = await call(ownerB, method, `${url}/${id}${suffix}`, body, 404), n = await call(ownerB, method, `${url}/${crypto.randomUUID()}${suffix}`, body, 404);
    assert.deepEqual(f.error, n.error);
    await call(a.tenantToken, method, `${url}/${id}${suffix}`, body, 403);
  }
  const beforeApproval = await snapshot();
  await call(ownerA, "PATCH", `${url}/${id}`, { status: "DA_PHE_DUYET" }, 200);
  const afterApproval = await snapshot();
  assert.deepEqual(Object.keys(beforeApproval).filter((key) => JSON.stringify(beforeApproval[key]) !== JSON.stringify(afterApproval[key])).sort(), ["AuditLog", "ThongBao", "YeuCau", "YeuCauTraPhong"].sort());
  assert.equal((await PhongTro.findByPk(a.room.ma_phong)).trang_thai, "DANG_THUE");
  assert.equal((await TaiKhoan.findByPk(a.account.ma_tai_khoan)).trang_thai, "HOAT_DONG");
  assert.equal((await HopDong.findByPk(a.contract.ma_hop_dong)).trang_thai, "DANG_HIEU_LUC");
  const depositsBefore = JSON.stringify(await TienCoc.findAll({ where: { ma_hop_dong: a.contract.ma_hop_dong }, raw: true }));
  await call(a.tenantToken, "POST", url, payload(a), 409);
  const listed = await call(ownerB, "GET", url, null, 200); assert.ok(!listed.data.some((r) => r.ma_yeu_cau === id));
  const tenantList = await call(a.tenantToken, "GET", url, null, 200), ownRow = tenantList.data.find((r) => r.ma_yeu_cau === id);
  assert.equal(ownRow.moveOut.approvedDate, days(today, 30)); assert.ok(!JSON.stringify(ownRow).includes("nguoi_xu_ly_id"));
  await call(ownerA, "POST", `${url}/${id}/revoke`, { reason: "Hai bên thay đổi kế hoạch" }, 200);
  const early = await call(a.tenantToken, "POST", url, payload(a, 29, { earlyReturnReason: "Tenant exception" }), 201); id = early.data.ma_yeu_cau;
  const noOwnerReason = await call(ownerA, "PATCH", `${url}/${id}`, { status: "DA_PHE_DUYET" }, 409); assert.equal(noOwnerReason.error.code, "EARLY_MOVE_OUT_REASON_REQUIRED");
  await call(ownerA, "PATCH", `${url}/${id}`, { status: "DA_PHE_DUYET", earlyReturnReason: "Owner agrees exception" }, 200);
  await HopDong.update({ ngay_ket_thuc: days(today, 20) }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
  const renewal = { type: "GIA_HAN", contractId: a.contract.ma_hop_dong, packageMonths: 6, content: "Renewal" };
  const blockedRenew = await call(a.tenantToken, "POST", url, renewal, 409); assert.equal(blockedRenew.error.code, "CONTRACT_REQUEST_CONFLICT");
  await call(ownerA, "POST", `${url}/${id}/revoke`, { reason: "Điều chỉnh kế hoạch" }, 200);
  const renewing = await call(a.tenantToken, "POST", url, renewal, 201);
  const blockedMove = await call(a.tenantToken, "POST", url, payload(a, 5, { earlyReturnReason: "Reason" }), 409); assert.equal(blockedMove.error.code, "CONTRACT_REQUEST_CONFLICT");
  await call(ownerA, "PATCH", `${url}/${renewing.data.ma_yeu_cau}`, { status: "TU_CHOI", reason: "Theo đề nghị khách" }, 200);
  const stale = await call(a.tenantToken, "POST", url, payload(a, 10, { earlyReturnReason: "Reason" }), 201);
  await HopDong.update({ ngay_ket_thuc: days(today, 9) }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
  const afterEnd = await call(ownerA, "PATCH", `${url}/${stale.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET", earlyReturnReason: "Agree" }, 409); assert.equal(afterEnd.error.code, "MOVE_OUT_AFTER_CONTRACT_END");
  await HopDong.update({ ngay_ket_thuc: days(today, -1) }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
  await call(ownerA, "PATCH", `${url}/${stale.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET", earlyReturnReason: "Agree" }, 409);
  assert.equal((await YeuCau.findByPk(stale.data.ma_yeu_cau)).trang_thai, "CHO_XU_LY");
  await call(ownerA, "PATCH", `${url}/${stale.data.ma_yeu_cau}`, { status: "TU_CHOI" }, 400);
  await call(ownerA, "PATCH", `${url}/${stale.data.ma_yeu_cau}`, { status: "TU_CHOI", reason: "Hợp đồng đổi ngày" }, 200);
  assert.equal(JSON.stringify(await TienCoc.findAll({ where: { ma_hop_dong: a.contract.ma_hop_dong }, raw: true })), depositsBefore);
  const history = await call(a.tenantToken, "GET", url, null, 200); assert.ok(history.data.some((r) => r.ly_do_xu_ly === "Hợp đồng đổi ngày"));
  // Legacy concurrent decisions: both types existed before the new guards.
  await HopDong.update({ ngay_ket_thuc: days(today, 10) }, { where: { ma_hop_dong: c.contract.ma_hop_dong } });
  const waitingMove = await call(c.tenantToken, "POST", url, payload(c, 1, { earlyReturnReason: "Reason" }), 201);
  const waitingRenew = await YeuCau.create({ ma_khach_thue: c.tenant.ma_khach_thue, loai_yeu_cau: "GIA_HAN", trang_thai: "CHO_XU_LY", noi_dung: "Legacy conflict" });
  await YeuCauGiaHan.create({ ma_yeu_cau: waitingRenew.ma_yeu_cau, ma_hop_dong: c.contract.ma_hop_dong, goi_gia_han_thang: 6, ngay_ket_thuc_de_xuat: require("../src/services/contractLifecycle.service").addRenewalMonths(days(today, 10), 6) });
  for (const decisionId of [waitingMove.data.ma_yeu_cau, waitingRenew.ma_yeu_cau]) {
    const r = await call(ownerA, "PATCH", `${url}/${decisionId}`, { status: "DA_PHE_DUYET", earlyReturnReason: "Agree" }, 409); assert.equal(r.error.code, "CONTRACT_REQUEST_CONFLICT");
  }
  await call(ownerA, "PATCH", `${url}/${waitingRenew.ma_yeu_cau}`, { status: "TU_CHOI", reason: "Chọn trả phòng" }, 200);
  await call(ownerA, "PATCH", `${url}/${waitingMove.data.ma_yeu_cau}`, { status: "DA_PHE_DUYET", earlyReturnReason: "Agree" }, 200);
  const dueDay = new Date(`${days(today, 1)}T05:00:00Z`);
  await service.processDueMoveOuts({ now: dueDay, actorId: accountA.ma_tai_khoan });
  const dueKey = `BAT_DAU_TRA_PHONG:${waitingMove.data.ma_yeu_cau}:${days(today, 1)}`;
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: dueKey, ma_tai_khoan: accountA.ma_tai_khoan } }), 1);
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: dueKey, ma_tai_khoan: accountB.ma_tai_khoan } }), 0);
  await service.processDueMoveOuts({ now: dueDay, actorId: accountA.ma_tai_khoan });
  assert.equal(await ThongBao.count({ where: { khoa_su_kien: dueKey, ma_tai_khoan: accountA.ma_tai_khoan } }), 1);
  assert.equal((await PhongTro.findByPk(c.room.ma_phong)).trang_thai, "DANG_XU_LY_TRA_PHONG");
  assert.equal((await HopDong.findByPk(c.contract.ma_hop_dong)).trang_thai, "DANG_HIEU_LUC");
});
