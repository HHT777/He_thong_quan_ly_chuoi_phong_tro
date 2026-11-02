const test = require("node:test"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const db = require("../src/config/database"), m = require("../src/models");
const svc = require("../src/services/coTenant.service"), notices = require("../src/services/notification.service");
const { businessDate, addBusinessDays: days } = require("../src/utils/businessDate.util");
const { request, headers } = require("./helpers/integration-api");
test.after(() => db.close());
const today = businessDate(), pass = "KT11FixtureOnly!";
let step = "setup", sequence = 0;
const fakePhone = (n) => "000000" + String(n).padStart(5, "0");
const fake = (n) => ({ name: "TEST PERSON " + n, phone: fakePhone(n), identityNumber: "TESTDOC" + String(n).padStart(4, "0"), birthDate: "1900-01-01", gender: "KHAC", permanentAddress: "TEST ONLY NOT A REAL ADDRESS", relationship: "TEST RELATION", startDate: days(today, 1) });
async function snapshot() {
  const hashes = {};
  for (const model of Object.values(db.models)) {
    const rows = (await model.findAll({ raw: true })).map((r) => JSON.stringify(r)).sort();
    hashes[model.name] = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }
  return hashes;
}
async function call(token, method, path, body, expected) {
  step = method + " " + path.split("?")[0];
  const before = expected >= 400 || method === "GET" ? await snapshot() : null;
  const result = await request(path, { method, headers: headers(token), ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(result.response.status, expected, "Unexpected HTTP status; response withheld for privacy");
  if (before) assert.deepEqual(await snapshot(), before, "GET/denied request wrote DB, audit or notice");
  return result.body;
}
async function account(role, tenant = null) {
  const a = await m.TaiKhoan.create({ ten_dang_nhap: "kt11test" + (++sequence), mat_khau: pass, vai_tro: role, trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  if (role === "CHU_TRO") await m.ChuTro.create({ ma_tai_khoan: a.ma_tai_khoan, ho_ten: "TEST OWNER", so_dien_thoai: fakePhone(sequence) });
  if (tenant) await tenant.update({ ma_tai_khoan: a.ma_tai_khoan });
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ten_dang_nhap: a.ten_dang_nhap, mat_khau: pass }) });
  assert.equal(login.response.status, 200, "Fixture login failed; body withheld");
  return { account: a, token: login.body.data.token };
}
async function rental(owner, tenant = null, capacity = 3) {
  step = "create fictitious rental";
  const n = ++sequence;
  const building = await m.CanTro.create({ ten_can: "TEST BUILDING", dia_chi: "TEST BUILDING ADDRESS", trang_thai: "HOAT_DONG", ma_chu_tro: (await m.ChuTro.findOne({ where: { ma_tai_khoan: owner.account.ma_tai_khoan } })).ma_chu_tro });
  const room = await m.PhongTro.create({ ma_can: building.ma_can, so_phong: "TEST ROOM", dien_tich: 20, gia_thue: 1, so_nguoi_toi_da: capacity, trang_thai: "DANG_THUE" });
  tenant ||= await m.KhachThue.create({ ho_ten: "TEST TENANT", so_dien_thoai: fakePhone(n), cccd_giay_to: "TESTTENANT" + n });
  const contract = await m.HopDong.create({ ma_phong: room.ma_phong, ma_khach_thue: tenant.ma_khach_thue, ngay_bat_dau: days(today, -10), ngay_ket_thuc: days(today, 100), gia_thue: 1, don_gia_dien: 1, don_gia_nuoc: 1, dieu_khoan: "TEST ONLY", trang_thai: "DANG_HIEU_LUC" });
  await m.TienCoc.create({ ma_hop_dong: contract.ma_hop_dong, so_tien_coc: 1, ngay_nhan_coc: today, trang_thai: "DA_NHAN" });
  const actor = tenant.ma_tai_khoan ? null : await account("KHACH_THUE", tenant);
  return { room, contract, tenant, token: actor?.token };
}
test("KT11 HTTP owner scope masked PII duplicates capacity races review decision lifecycle and optional notice", async (t) => {
  try {
    const aOwner = await account("CHU_TRO"), bOwner = await account("CHU_TRO"), a = await rental(aOwner), b = await rental(bOwner), c = await rental(aOwner), multi = await rental(aOwner, a.tenant);
    const url = "/api/v1/co-tenants", ctx = "/api/v1/me/co-tenant-context", requests = "/api/v1/requests";
    const payload = (r, n) => ({ ...fake(n), contractId: r.contract.ma_hop_dong });
    const context = await call(a.token, "GET", ctx, null, 200); assert.equal(context.data.contracts.length, 2); assert.ok(context.data.contracts.every((r) => r.currentOccupants === 1));
    await call(aOwner.token, "GET", ctx, null, 403); await call("invalid", "GET", ctx, null, 401);
    for (const query of ["tenantId=other", "roomId=other", "contractId=other"]) await call(a.token, "GET", ctx + "?" + query, null, 400);
    const notFound = await call(a.token, "POST", url, { ...payload(a, 71), contractId: crypto.randomUUID() }, 404);
    for (const r of [b, c]) assert.deepEqual((await call(a.token, "POST", url, payload(r, 71), 404)).error, notFound.error);
    for (const patch of [{ roomId: b.room.ma_phong }, { tenantId: b.tenant.ma_khach_thue }, { name: "" }, { phone: "TEST_INVALID" }, { birthDate: "2099-01-01" }, { startDate: days(today, -1) }, { name: "x".repeat(101) }, { gender: "INVALID" }]) await call(a.token, "POST", url, { ...payload(a, 71), ...patch }, patch.name === "" ? 422 : 400);
    for (const patch of [{ phone: a.tenant.so_dien_thoai }, { identityNumber: a.tenant.cccd_giay_to }]) { const duplicate = await call(a.token, "POST", url, { ...payload(a, 71), ...patch }, 409); assert.equal(duplicate.error.code, "CO_TENANT_ALREADY_RESIDENT"); }
    await call(aOwner.token, "POST", url, payload(a, 71), 403);
    const beforeMembers = await m.ThanhVienPhong.count(), beforeAccounts = await m.TaiKhoan.count();
    step = "concurrent duplicate POST";
    const race = await Promise.all([1, 2].map(() => request(url, { method: "POST", headers: headers(a.token), body: JSON.stringify(payload(a, 71)) })));
    assert.deepEqual(race.map((r) => r.response.status).sort(), [201, 409]);
    const id = race.find((r) => r.response.status === 201).body.data.request.ma_yeu_cau;
    assert.equal(await m.ThanhVienPhong.count(), beforeMembers); assert.equal(await m.TaiKhoan.count(), beforeAccounts);
    assert.equal(await m.ThongBao.count({ where: { khoa_su_kien: "YEU_CAU_MOI:" + id, ma_tai_khoan: aOwner.account.ma_tai_khoan } }), 1);
    for (const patch of [{ phone: "000-000-00071" }, { identityNumber: "TEST-DOC-0071" }]) await call(a.token, "POST", url, { ...payload(a, 72), ...patch }, 409);
    const detailPath = "/api/v1/co-tenant-proposals/" + id;
    const ownDetail = await call(a.token, "GET", detailPath, null, 200); assert.equal(ownDetail.data.identityNumber === "****0071", true); assert.equal(Object.hasOwn(ownDetail.data, "birthDate"), false);
    const fullDetail = await call(aOwner.token, "GET", detailPath, null, 200); assert.equal(fullDetail.data.identityNumber === "TESTDOC0071", true);
    for (const token of [bOwner.token, b.token, c.token]) assert.deepEqual((await call(token, "GET", detailPath, null, 404)).error, (await call(token, "GET", "/api/v1/co-tenant-proposals/" + crypto.randomUUID(), null, 404)).error);
    await call(a.token, "PATCH", requests + "/" + id, { status: "DA_PHE_DUYET" }, 403);
    assert.deepEqual((await call(bOwner.token, "PATCH", requests + "/" + id, { status: "DA_PHE_DUYET" }, 404)).error, (await call(bOwner.token, "PATCH", requests + "/" + crypto.randomUUID(), { status: "DA_PHE_DUYET" }, 404)).error);
    step = "concurrent create and approve";
    const mixed = await Promise.all([request(url, { method: "POST", headers: headers(a.token), body: JSON.stringify(payload(a, 72)) }), request(requests + "/" + id, { method: "PATCH", headers: headers(aOwner.token), body: JSON.stringify({ status: "DA_PHE_DUYET", startDate: days(today, 2) }) })]);
    assert.deepEqual(mixed.map((r) => r.response.status), [201, 200]);
    const secondId = mixed[0].body.data.request.ma_yeu_cau;
    const third = await call(a.token, "POST", url, payload(a, 73), 201);
    step = "parallel final-place approvals";
    const approvals = await Promise.all([secondId, third.data.request.ma_yeu_cau].map((r) => request(requests + "/" + r, { method: "PATCH", headers: headers(aOwner.token), body: JSON.stringify({ status: "DA_PHE_DUYET" }) })));
    assert.deepEqual(approvals.map((r) => r.response.status).sort(), [200, 409]);
    assert.equal(await m.ThanhVienPhong.count({ where: { ma_phong: a.room.ma_phong } }), 2); assert.equal(await m.TaiKhoan.count(), beforeAccounts);
    const fullRoom = await call(a.token, "GET", ctx, null, 200); const state = fullRoom.data.contracts.find((r) => r.contractId === a.contract.ma_hop_dong); assert.equal(state.currentOccupants, 3); assert.equal(state.availablePlaces, 0);
    await call(a.token, "POST", url, payload(a, 74), 409);
    const inB = await call(b.token, "POST", url, payload(b, 81), 201); await call(bOwner.token, "PATCH", requests + "/" + inB.data.request.ma_yeu_cau, { status: "DA_PHE_DUYET" }, 200);
    const memberB = await m.ThanhVienPhong.findOne({ where: { ma_phong: b.room.ma_phong } });
    const listA = await call(aOwner.token, "GET", url, null, 200); assert.ok(!listA.data.some((r) => r.ma_phong === b.room.ma_phong)); assert.ok(listA.data.every((r) => !r.cccd_giay_to || r.cccd_giay_to.startsWith("****")));
    for (const method of ["GET", "PATCH"]) { const body = method === "PATCH" ? { status: "DA_ROI", leaveDate: days(today, 4) } : null; const f = await call(aOwner.token, method, url + "/" + memberB.ma_thanh_vien_phong, body, 404); const n = await call(aOwner.token, method, url + "/" + crypto.randomUUID(), body, 404); assert.deepEqual(f.error, n.error); }
    await call(a.token, "GET", url + "/" + memberB.ma_thanh_vien_phong, null, 403);
    const memberFull = await call(bOwner.token, "GET", url + "/" + memberB.ma_thanh_vien_phong, null, 200); assert.equal(memberFull.data.cccd_giay_to === "TESTDOC0081", true);
    await call(bOwner.token, "PATCH", url + "/" + memberB.ma_thanh_vien_phong, { status: "DA_ROI", leaveDate: days(today, 4) }, 200);
    const sharedRoomOnly = await call(a.token, "POST", url, payload(multi, 71), 201); await call(aOwner.token, "PATCH", requests + "/" + sharedRoomOnly.data.request.ma_yeu_cau, { status: "DA_PHE_DUYET" }, 200);
    await m.HopDong.update({ trang_thai: "HET_HAN" }, { where: { ma_hop_dong: multi.contract.ma_hop_dong } });
    const tenantMembers = await call(a.token, "GET", url, null, 200); assert.ok(tenantMembers.data.every((r) => r.ma_hop_dong === a.contract.ma_hop_dong));
    const rejected = await call(c.token, "POST", "/api/v1/requests", { ...payload(c, 91), type: "DE_XUAT_BAN_CUNG_PHONG" }, 201);
    const rejectionId = rejected.data.request.ma_yeu_cau;
    await call(aOwner.token, "PATCH", requests + "/" + rejectionId, { status: "TU_CHOI" }, 400);
    await call(aOwner.token, "PATCH", requests + "/" + rejectionId, { status: "TU_CHOI", reason: "TEST REJECTION REASON" }, 200);
    const rejectedContext = await call(c.token, "GET", ctx, null, 200); assert.ok(rejectedContext.data.proposals.some((r) => r.rejectionReason === "TEST REJECTION REASON"));
    step = "notice failure after real transaction commit";
    const originalNotice = notices.createIdempotent, errors = [], originalError = console.error;
    notices.createIdempotent = async () => { throw Error("TEST_PRIVATE_NOTICE_MARKER"); }; console.error = (...args) => errors.push(args);
    let saved;
    try { saved = await svc.propose(c.tenant.ma_khach_thue, payload(c, 92), c.tenant.ma_tai_khoan); }
    finally { notices.createIdempotent = originalNotice; console.error = originalError; }
    assert.equal((await m.YeuCau.findByPk(saved.request.ma_yeu_cau)).trang_thai, "CHO_XU_LY"); assert.equal(errors.length, 1); assert.equal(JSON.stringify(errors).includes("TEST_PRIVATE_NOTICE_MARKER"), false);
    step = "PII-free audit and notices";
    const audits = await m.AuditLog.findAll({ where: { action: ["CO_TENANT_PROPOSED", "CO_TENANT_UPDATED", "REQUEST_DECIDED"] }, raw: true }), noticeRows = await m.ThongBao.findAll({ where: { khoa_su_kien: { [require("sequelize").Op.like]: "%" + rejectionId + "%" } }, raw: true });
    const text = JSON.stringify({ audits, noticeRows });
    assert.equal([fake(71).phone, fake(71).identityNumber, fake(71).permanentAddress, fake(71).birthDate, "TESTDOC0071", "TEST REJECTION REASON"].some((marker) => text.includes(marker)), false, "PII marker in audit or notification");
  } catch (error) { throw Error("KT11 checkpoint " + step + ": " + (error.code === "ERR_ASSERTION" ? error.message : "fixture/runtime failure; private error withheld")); }
});
