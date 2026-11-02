const test = require("node:test"), assert = require("node:assert/strict");
const models = require("../src/models"), db = require("../src/config/database");
const service = require("../src/services/coTenant.service"), privacy = require("../src/utils/privacy.util"), owner = require("../src/services/ownership.service");
const { businessDate, addBusinessDays } = require("../src/utils/businessDate.util");
// Deliberately fictitious data. Test failures assert booleans/codes, never PII.
const fake = () => ({ name: "TEST PERSON", phone: "000-000-00001", identityNumber: "TEST-DOC-0001", birthDate: "1900-01-01", gender: "KHAC", permanentAddress: "TEST ONLY NOT A REAL ADDRESS", relationship: "TEST RELATION", startDate: businessDate() });
test("KT11 validation normalizes identifiers and validates every required field and dates", () => {
  const good = fake(), v = service.validateProposal(good);
  assert.equal(v.phone === "00000000001", true); assert.equal(v.identity === "TESTDOC0001", true);
  for (const key of Object.keys(good)) assert.throws(() => service.validateProposal({ ...good, [key]: "" }), { code: "INVALID_CO_TENANT_PROPOSAL" });
  for (const patch of [{ phone: "TEST_INVALID" }, { identityNumber: "<>" }, { name: "x".repeat(101) }, { permanentAddress: "x".repeat(256) }, { relationship: "x".repeat(81) }, { gender: "INVALID" }, { note: "x".repeat(1001) }, { startDate: addBusinessDays(businessDate(), -1) }, { birthDate: "2099-01-01" }, { birthDate: "2026-02-30" }, { roomId: "other" }, { tenantId: "other" }]) assert.throws(() => service.validateProposal({ ...good, ...patch }), { status: 400 });
});
test("KT11 capacity includes primary tenant and accepted future arrivals; pending does not reserve places", () => {
  const candidate = service.validateProposal(fake()), room = { so_nguoi_toi_da: 2 };
  assert.throws(() => service.assertCapacityAndUniqueness(room, { availablePlaces: 0, tenants: [], members: [], pending: [] }, candidate), { code: "ROOM_CAPACITY_REACHED" });
  assert.doesNotThrow(() => service.assertCapacityAndUniqueness(room, { availablePlaces: 1, tenants: [], members: [], pending: [] }, candidate));
});
test("KT11 normalized duplicate guard covers primary member and pending document or phone", () => {
  const c = service.validateProposal(fake()), base = { availablePlaces: 1, tenants: [], members: [], pending: [] };
  for (const group of ["tenants", "members"]) for (const field of ["so_dien_thoai", "cccd_giay_to"]) {
    const input = field === "so_dien_thoai" ? fake().phone : fake().identityNumber;
    assert.throws(() => service.assertCapacityAndUniqueness({}, { ...base, [group]: [{ [field]: input }] }, c), { code: "CO_TENANT_ALREADY_RESIDENT" });
  }
  for (const item of [{ so_dien_thoai_nguoi_de_xuat: fake().phone }, { cccd_giay_to: fake().identityNumber }]) assert.throws(() => service.assertCapacityAndUniqueness({}, { ...base, pending: [item] }, c), { code: "CO_TENANT_PROPOSAL_PENDING" });
});
test("KT11 masked projections never expose raw documents dates or addresses in lists", () => {
  const p = fake(), raw = { cccd_giay_to: p.identityNumber, so_dien_thoai: p.phone, ngay_sinh: p.birthDate, dia_chi_thuong_tru: p.permanentAddress };
  const output = service.memberView(raw);
  assert.equal(output.cccd_giay_to === "****0001", true); assert.equal(Object.hasOwn(output, "ngay_sinh"), false); assert.equal(Object.hasOwn(output, "dia_chi_thuong_tru"), false);
  assert.equal(service.memberView(raw, true).cccd_giay_to === p.identityNumber, true);
});
test("KT11 audit strips every sensitive key and SQL/error log never takes raw input", (t) => {
  const calls = []; t.mock.method(console, "log", (...args) => calls.push(args)); t.mock.method(console, "error", (...args) => calls.push(args));
  const p = fake(), audit = require("../src/services/auditLog.service").toJsonValue({ phone: p.phone, so_dien_thoai: p.phone, identityNumber: p.identityNumber, nested: { birthDate: p.birthDate, permanentAddress: p.permanentAddress, id: "safe" } });
  assert.equal(Object.hasOwn(audit, "phone"), false); assert.equal(Object.hasOwn(audit, "so_dien_thoai"), false); assert.deepEqual(Object.keys(audit.nested), ["id"]);
  privacy.logSqlOperation(p.identityNumber); privacy.logPrivateFailure("CO_TENANT_NOTICE_FAILED", p);
  const error = Object.assign(Error(p.permanentAddress), { name: "SequelizeDatabaseError", sql: p.phone, parent: { sql: p.identityNumber } });
  const handler = require("../src/middleware/errorHandler");
  let response; handler(error, { path: "/api/v1/co-tenants" }, { status() { return this; }, json(value) { response = value; } }, () => {});
  const all = JSON.stringify({ calls, response });
  assert.equal([p.phone, p.identityNumber, p.permanentAddress, p.birthDate].some((v) => all.includes(v)), false, "Private marker leaked");
  assert.equal(calls.length, 3);
});
function fixture(t) {
  const tx = { LOCK: { UPDATE: "UPDATE" } }, writes = [];
  t.mock.method(db, "query", async () => { throw Error("Unexpected DB call"); });
  t.mock.method(db, "transaction", async (fn) => fn(tx));
  const room = { ma_phong: "room", ma_can: "building", trang_thai: "DANG_THUE", so_nguoi_toi_da: 2 };
  const contract = { ma_hop_dong: "contract", ma_khach_thue: "tenant", ma_phong: "room" };
  t.mock.method(models.HopDong, "findOne", async () => contract);
  t.mock.method(models.HopDong, "findAll", async () => [contract]);
  t.mock.method(models.PhongTro, "findByPk", async () => room);
  t.mock.method(models.KhachThue, "findAll", async () => [{ so_dien_thoai: "TEST_OTHER", cccd_giay_to: "TEST_OTHER" }]);
  t.mock.method(models.ThanhVienPhong, "findAll", async () => []);
  t.mock.method(models.DeXuatBanCungPhong, "findAll", async () => []);
  t.mock.method(models.YeuCau, "create", async () => { writes.push("request"); return { ma_yeu_cau: "request" }; });
  t.mock.method(models.DeXuatBanCungPhong, "create", async () => { writes.push("proposal"); });
  t.mock.method(models.AuditLog, "create", async () => { writes.push("audit"); });
  t.mock.method(owner, "getLandlordAccountForRoom", async () => "owner");
  t.mock.method(require("../src/services/notification.service"), "createIdempotent", async () => { throw Error("TEST_PRIVATE_NOTICE_FAILURE"); });
  return { tx, writes, room, contract };
}
test("KT11 notice failure preserves committed proposal and never creates member or account", async (t) => {
  const f = fixture(t), logs = []; t.mock.method(console, "error", (...args) => logs.push(args));
  t.mock.method(models.ThanhVienPhong, "create", async () => { throw Error("Must not admit"); });
  t.mock.method(models.TaiKhoan, "create", async () => { throw Error("Must not create account"); });
  const result = await service.propose("tenant", { ...fake(), contractId: "contract" }, "actor");
  assert.deepEqual(f.writes, ["request", "proposal", "audit"]); assert.equal(result.request.trang_thai, "CHO_XU_LY"); assert.equal(logs.length, 1);
  assert.equal(JSON.stringify(logs).includes("TEST_PRIVATE_NOTICE_FAILURE"), false);
});
test("KT11 list scopes owner buildings and masks response before returning", async (t) => {
  fixture(t); let options;
  t.mock.method(owner, "getOwnedBuildingIds", async () => ["owned"]);
  t.mock.method(models.PhongTro, "findAll", async (o) => { assert.equal(o.where.ma_can[Op.in][0], "owned"); return [{ ma_phong: "owned-room" }]; });
  t.mock.method(models.ThanhVienPhong, "findAll", async (o) => { options = o; return [{ ma_thanh_vien_phong: "member", cccd_giay_to: fake().identityNumber }]; });
  const result = await service.list({ vai_tro: "CHU_TRO" });
  assert.equal(options.where.ma_phong[Op.in][0], "owned-room"); assert.equal(result[0].cccd_giay_to === "****0001", true);
});
const { Op } = require("sequelize");
test("KT11 PATCH foreign and missing ownership deny before any update or audit", async (t) => {
  const f = fixture(t);
  t.mock.method(owner, "assertOwned", async () => { throw owner.notFoundError(); });
  t.mock.method(models.ThanhVienPhong, "findByPk", async () => { throw Error("Must authorize first"); });
  await assert.rejects(service.updateMember("foreign", { status: "DA_ROI" }, { ma_tai_khoan: "a" }), { status: 404, code: "RESOURCE_NOT_FOUND" });
  assert.deepEqual(f.writes, []);
});
test("KT11 approval capacity recheck cannot admit into a full room", async (t) => {
  const f = fixture(t), p = fake();
  t.mock.method(models.DeXuatBanCungPhong, "findByPk", async () => ({ ma_phong: "room", ho_ten_nguoi_de_xuat: p.name, so_dien_thoai_nguoi_de_xuat: p.phone, cccd_giay_to: p.identityNumber, ngay_sinh: p.birthDate, gioi_tinh: p.gender, dia_chi_thuong_tru: p.permanentAddress, quan_he: p.relationship, ngay_bat_dau_o: p.startDate }));
  t.mock.method(models.ThanhVienPhong, "findAll", async () => [{ so_dien_thoai: "TEST_OTHER", ngay_vao: "2099-01-01" }]);
  t.mock.method(models.ThanhVienPhong, "create", async () => { throw Error("Must not create"); });
  await assert.rejects(service.approve({ ma_yeu_cau: "r", ma_khach_thue: "tenant" }, f.tx, "actor"), { code: "ROOM_CAPACITY_REACHED" });
});
