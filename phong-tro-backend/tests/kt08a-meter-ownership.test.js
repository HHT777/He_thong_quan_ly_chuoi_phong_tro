const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { getUploadContext } = require("../src/config/uploadFilesystem");
const uploadContext = getUploadContext();
const uploadRoot = uploadContext.resolve("kt08a-unit");
uploadContext.mkdir(uploadRoot);
const models = require("../src/models");
const sequelize = require("../src/config/database");
const controller = require("../src/controllers/meterReading.controller");
const service = require("../src/services/meterReading.service");
const router = require("../src/routes/meterReading.routes");
const { Op } = require("sequelize");
const user = { vai_tro: "CHU_TRO", ma_tai_khoan: "actor-a" };
const meterDir = path.join(uploadRoot, "meter");
test.after(() => uploadContext.removeTree(uploadRoot));
const reading = (id) => ({ ma_chi_so: id, ma_phong: id === "a" ? "room-a" : "room-b", phongTro: { ma_can: id === "a" ? "building-a" : "building-b" }, anh_cong_to_url: path.join(meterDir, "evidence"), nam: 2026, thang: 10, chi_so_moi: 10, trang_thai_xac_nhan: "CHO_XAC_NHAN" });
function fixture(t) {
  const config = require("../src/services/systemConfig.service");
  config.invalidateSystemConfigCache(); t.after(() => config.invalidateSystemConfigCache());
  t.mock.method(models.CauHinhHeThong, "findAll", async () => []);
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner-a" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building-a" }]);
  t.mock.method(models.CanTro, "findByPk", async (id) => id === "missing" ? null : ({ ma_can: id, ma_chu_tro: id === "building-a" ? "owner-a" : "owner-b" }));
  t.mock.method(models.PhongTro, "findByPk", async (id) => id === "missing" || !id ? null : ({ ma_phong: id, ma_can: id === "room-a" ? "building-a" : "building-b" }));
  t.mock.method(models.ChiSoDien, "findByPk", async (id) => id === "missing" ? null : reading(id));
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
}
async function invoke(method, req = {}, res = {}) {
  let error; let body;
  await controller[method]({ user, body: {}, query: {}, params: {}, headers: {}, get: () => "unit-header", ...req }, { apiSuccess(value) { body = value; }, apiError(status, code) { error = { status, code }; }, ...res }, (value) => { error = value; });
  return { error, body };
}
test("KT-08A owner list without a filter scopes its room join to owned buildings", async (t) => {
  fixture(t);
  t.mock.method(models.ChiSoDien, "findAndCountAll", async (options) => {
    assert.ok(options.include[0].where, "owner list must always carry building scope");
    assert.deepEqual(options.include[0].where.ma_can[Op.in], ["building-a"]);
    assert.equal(options.include[0].required, true); return { count: 0, rows: [] };
  });
  assert.deepEqual((await invoke("list")).body, []);
  for (const query of [{ buildingId: "building-b" }, { roomId: "room-b" }]) assert.equal((await invoke("list", { query })).error.code, "RESOURCE_NOT_FOUND");
});
test("KT-08A private files reject a foreign or missing meter before touching evidence", async (t) => {
  fixture(t); t.mock.method(fs, "existsSync", () => true);
  for (const id of ["b", "missing"]) {
    const result = await invoke("privateFile", { params: { id } }, { sendFile() { assert.fail("foreign evidence must not be served"); } });
    assert.equal(result.error?.status, 404); assert.equal(result.error?.code, "RESOURCE_NOT_FOUND");
  }
});
test("KT-08A confirm rejects foreign or missing meter before transaction writes", async (t) => {
  fixture(t);
  t.mock.method(models.ChiSoDien, "findByPk", async (id) => id === "missing" ? null : ({ ...reading(id), update() { assert.fail("foreign confirmation must not write"); } }));
  for (const readingId of ["b", "missing"]) assert.equal((await invoke("confirm", { params: { readingId } })).error?.code, "RESOURCE_NOT_FOUND");
});
test("KT-08A detail update delete and manual reject foreign scope with common not-found", async (t) => {
  fixture(t);
  for (const method of ["detail", "update", "remove"]) assert.equal((await invoke(method, { params: { readingId: "b" }, body: { reason: "test", readingValue: 20 } })).error.code, "RESOURCE_NOT_FOUND");
  t.mock.method(models.HopDong, "findOne", async () => ({ ma_hop_dong: "contract-b", ma_phong: "room-b" }));
  t.mock.method(models.HopDong, "findByPk", async () => ({ ma_hop_dong: "contract-b", phongTro: { ma_can: "building-b" } }));
  assert.equal((await invoke("manual", { body: { tenantId: "tenant-b", readingValue: 20, period: "2026-11" } })).error.code, "RESOURCE_NOT_FOUND");
});

test("KT-08A OCR preview checks room ownership before persisting any buffered multipart file", async (t) => {
  fixture(t);
  t.mock.method(fs, "writeFileSync", () => assert.fail("unauthorized preview must not create a file"));
  const route = router.stack.find((layer) => layer.route?.path === "/meter-readings/ocr-previews");
  const store = route.route.stack.find((layer) => layer.handle.name === "storeOwnedPreview").handle;
  for (const roomId of ["room-b", "missing", undefined]) {
    let error;
    await store({ user, body: { roomId }, file: { buffer: Buffer.from("image"), size: 5 } }, {}, (e) => { error = e; });
    assert.equal(error?.code, "RESOURCE_NOT_FOUND");
  }
});
test("KT-08A service owner preview and signed OCR submit also enforce room ownership", async (t) => {
  fixture(t);
  await assert.rejects(service.createPreview(null, "2026-10", {}, "room-b", "actor-a"), { status: 404, code: "RESOURCE_NOT_FOUND" });
  const old = process.env.JWT_SECRET; process.env.JWT_SECRET = "kt08a-unit-only"; t.after(() => { if (old == null) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; });
  const uploadToken = service.signUploadPayload({ sub: "actor-a", tenantId: null, roomId: "room-b", period: "2026-10", fileName: "unit", exp: Date.now() + 10000 });
  await assert.rejects(service.submitForLandlord({ period: "2026-10", readingValue: 20, uploadToken }, "actor-a"), { status: 404, code: "RESOURCE_NOT_FOUND" });
});
test("KT-08A cleanup retains every referenced image beyond token TTL and only removes an old orphan", async (t) => {
  const names = ["pending", "confirmed", "deleted", "orphan"];
  // The unit runner intentionally shares require.cache across files. Do not
  // assume this module's UPLOAD_DIR changed an already-loaded service. Mock
  // every filesystem operation: this test must never unlink a real file.
  const oldSecret = process.env.JWT_SECRET; process.env.JWT_SECRET = oldSecret || "kt08a-cleanup-unit";
  t.after(() => { if (oldSecret == null) delete process.env.JWT_SECRET; });
  const claims = { sub: "unit", tenantId: null, period: "2026-10", fileName: "pending", exp: Date.now() + 10000 };
  const directory = path.dirname(service.verifyUploadToken(service.signUploadPayload(claims), "unit", null, "2026-10").filePath);
  const removed = [];
  t.mock.method(fs, "existsSync", () => true);
  t.mock.method(fs, "readdirSync", () => names);
  t.mock.method(fs, "statSync", () => ({ mtimeMs: 0 }));
  t.mock.method(fs, "unlinkSync", (target) => removed.push(path.basename(target)));
  t.mock.method(models.ChiSoDien, "findAll", async (options) => { assert.equal(options.where, undefined); return names.slice(0, 3).map((name) => ({ anh_cong_to_url: path.join(directory, name) })); });
  assert.equal(await service.cleanupExpiredUploads(), 1);
  assert.deepEqual(removed, ["orphan"]);
});
