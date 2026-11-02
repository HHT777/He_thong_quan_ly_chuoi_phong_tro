const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const service = require("../src/services/renewalRequest.service");
const { addRenewalMonths, renewalMonths } = require("../src/services/contractLifecycle.service");
const { YeuCauGiaHan } = require("../src/models");
test("KT09 calendar packages clamp month ends and leap years without changing prices", () => {
  for (const [from, months, to] of [["2026-08-31", 6, "2027-02-28"], ["2027-08-31", 6, "2028-02-29"], ["2028-02-29", 12, "2029-02-28"], ["2026-12-31", 6, "2027-06-30"], ["2026-10-30", 12, "2027-10-30"]]) { assert.equal(addRenewalMonths(from, months), to); assert.equal(renewalMonths(from, to), months); }
  assert.throws(() => addRenewalMonths("2026-02-31", 6)); assert.throws(() => addRenewalMonths("2026-01-01", 3));
});
test("KT09 eligibility uses real dates and allowed contract states independently of cron", () => {
  const config = { timezone: "Asia/Ho_Chi_Minh", contractWarningDays: 30 };
  const c = { trang_thai: "DANG_HIEU_LUC", ngay_ket_thuc: "2026-11-28", goi_gia_han_cho_phep: null };
  assert.equal(service.eligibility(c, config, "2026-10-29"), null);
  assert.equal(service.eligibility({ ...c, ngay_ket_thuc: "2026-11-29" }, config, "2026-10-29"), "CONTRACT_NOT_EXPIRING");
  assert.equal(service.eligibility({ ...c, trang_thai: "SAP_HET_HAN", ngay_ket_thuc: "2026-10-28" }, config, "2026-10-29"), "CONTRACT_EXPIRED");
  for (const state of ["HET_HAN", "DA_THANH_LY"]) assert.equal(service.eligibility({ ...c, trang_thai: state }, config, "2026-10-29"), "CONTRACT_NOT_ACTIVE");
});
test("KT09 null allows both packages and explicit contract package restricts selection", () => {
  assert.deepEqual(service.packages({ goi_gia_han_cho_phep: null }), [6, 12]);
  assert.deepEqual(service.packages({ goi_gia_han_cho_phep: "6" }), [6]);
  assert.deepEqual(service.packages({ goi_gia_han_cho_phep: "12" }), [12]);
  assert.deepEqual(service.packages({ goi_gia_han_cho_phep: "garbage" }), []);
});
test("KT09 rejects client dates missing content invalid packages and injected scope", () => {
  const good = { type: "GIA_HAN", contractId: "own", packageMonths: 6, content: "Gia hạn" };
  assert.doesNotThrow(() => service.validatePayload(good));
  for (const field of ["requestedEndDate", "date", "ngayKetThuc", "newEndDate"]) assert.throws(() => service.validatePayload({ ...good, [field]: "2030-01-01" }), { status: 400, code: "CLIENT_RENEWAL_DATE_FORBIDDEN" });
  for (const patch of [{ packageMonths: 7 }, { packageMonths: "6" }, { content: " " }, { content: "x".repeat(1001) }, { tenantId: "foreign" }]) assert.throws(() => service.validatePayload({ ...good, ...patch }), { status: 400 });
});
test("KT09 legacy missing package cannot be approved or inferred from proposed date", async (t) => {
  t.mock.method(require("../src/config/database"), "query", async () => { throw new Error("Unexpected DB query in isolated guard test"); });
  t.mock.method(YeuCauGiaHan, "findByPk", async () => ({ goi_gia_han_thang: null, ngay_ket_thuc_de_xuat: "2027-01-01" }));
  await assert.rejects(service.approve({ ma_yeu_cau: "legacy" }, "owner", { LOCK: { UPDATE: "UPDATE" } }), { status: 409, code: "LEGACY_RENEWAL_PACKAGE_MISSING" });
});
function createFixture(t, endOffset = 10) {
  const models = require("../src/models"), db = require("../src/config/database"), config = require("../src/services/systemConfig.service");
  const { businessDate, addBusinessDays } = require("../src/utils/businessDate.util");
  config.invalidateSystemConfigCache(); t.after(() => config.invalidateSystemConfigCache());
  t.mock.method(db, "query", async () => { throw Error("Unexpected real DB query"); });
  t.mock.method(models.CauHinhHeThong, "findAll", async () => []);
  t.mock.method(db, "transaction", async (work) => work({ LOCK: { UPDATE: "UPDATE" } }));
  const contract = { ma_hop_dong: "own", ma_khach_thue: "tenant", ma_phong: "room", trang_thai: "DANG_HIEU_LUC", ngay_ket_thuc: addBusinessDays(businessDate(), endOffset), goi_gia_han_cho_phep: null };
  t.mock.method(models.HopDong, "findByPk", async () => contract);
  t.mock.method(models.YeuCauGiaHan, "findAll", async () => [{ ma_yeu_cau: "pending" }]);
  t.mock.method(models.YeuCau, "findOne", async () => ({ ma_yeu_cau: "pending" }));
  let writes = 0;
  t.mock.method(models.YeuCau, "create", async () => { writes++; return { ma_yeu_cau: "new" }; });
  t.mock.method(models.YeuCauGiaHan, "create", async () => { writes++; return {}; });
  t.mock.method(models.PhongTro, "findByPk", async () => ({ ma_can: "building" }));
  t.mock.method(models.CanTro, "findByPk", async () => ({ ma_chu_tro: "owner" }));
  t.mock.method(models.ChuTro, "findByPk", async () => ({ ma_tai_khoan: "owner-account" }));
  t.mock.method(models.ThongBao, "create", async () => { writes++; return {}; });
  t.mock.method(models.AuditLog, "create", async () => { writes++; return {}; });
  return { user: { vai_tro: "KHACH_THUE", ma_khach_thue: "tenant", ma_tai_khoan: "account" }, body: { type: "GIA_HAN", contractId: "own", packageMonths: 6, content: "Request" }, writes: () => writes };
}
test("KT09 contract lock rejects existing pending without writes", async (t) => {
  const f = createFixture(t);
  await assert.rejects(service.create(f.user, f.body), { code: "RENEWAL_ALREADY_PENDING" }); assert.equal(f.writes(), 0);
});
test("KT09 server rejects out-of-window creation without writes", async (t) => {
  const f = createFixture(t, 90);
  await assert.rejects(service.create(f.user, f.body), { code: "CONTRACT_NOT_EXPIRING" }); assert.equal(f.writes(), 0);
});
test("KT09 PATCH ownership denies another landlord before request or audit updates", async (t) => {
  const models = require("../src/models"), db = require("../src/config/database"); let writes = 0;
  t.mock.method(db, "query", async () => { throw Error("Unexpected DB query"); });
  t.mock.method(db, "transaction", async (work) => work({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner-a" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building-a" }]);
  t.mock.method(models.YeuCauGiaHan, "findOne", async () => ({ hopDong: { phongTro: { ma_can: "building-b" } } }));
  t.mock.method(models.YeuCau, "findByPk", async () => ({ ma_yeu_cau: "foreign", ma_khach_thue: "tenant-b", loai_yeu_cau: "GIA_HAN", trang_thai: "CHO_XU_LY", update: async () => { writes++; } }));
  t.mock.method(models.KhachThue, "findByPk", async () => null); t.mock.method(models.AuditLog, "create", async () => { writes++; });
  const router = require("../src/routes/mvp.routes");
  const route = router.stack.find((l) => l.route?.path === "/requests/:id" && l.route.methods.patch).route;
  let error; const res = { status() { return this; }, json() {} };
  await route.stack.at(-1).handle({ user: { vai_tro: "CHU_TRO", ma_tai_khoan: "a" }, params: { id: "foreign" }, body: { status: "TU_CHOI", reason: "No" } }, res, (e) => { error = e; });
  assert.equal(error?.status, 404); assert.equal(error?.code, "RESOURCE_NOT_FOUND"); assert.equal(writes, 0);
});
test("KT09 DDL package check is nullable constrained and idempotent without additional columns", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../migrations/018_renewal_request_package.sql"), "utf8");
  assert.match(sql, /CHECK \(`goiGiaHanThang` IS NULL OR `goiGiaHanThang` IN \(6,12\)\)/);
  assert.equal((sql.match(/ADD COLUMN/g) || []).length, 1); assert.doesNotMatch(sql, /ADD INDEX|CREATE TABLE|DEFAULT/);
  assert.match(sql, /information_schema\.columns/); assert.match(sql, /information_schema\.table_constraints/);
});
