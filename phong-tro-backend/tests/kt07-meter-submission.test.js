const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const models = require("../src/models");
const sequelize = require("../src/config/database");
const service = require("../src/services/meterReading.service");
const config = require("../src/services/systemConfig.service");
const controller = require("../src/controllers/meterReading.controller");
const contract = { ma_hop_dong: "contract-a", ma_khach_thue: "tenant-a", ma_phong: "room-a", ngay_bat_dau: "2026-08-01", don_gia_dien: 3500 };
const now = new Date("2026-10-29T01:00:00Z");
function fixture(t, readings = [], bills = []) {
  const oldSecret = process.env.JWT_SECRET; if (!oldSecret) process.env.JWT_SECRET = "kt07-unit-secret";
  t.after(() => { if (!oldSecret) delete process.env.JWT_SECRET; config.invalidateSystemConfigCache(); });
  config.invalidateSystemConfigCache();
  t.mock.method(models.CauHinhHeThong, "findAll", async () => []);
  t.mock.method(models.HopDong, "findOne", async (options) => { assert.equal(options.where.ma_khach_thue, "tenant-a"); return contract; });
  t.mock.method(models.ChiSoDien, "findAll", async (options) => { assert.equal(options.where.ma_phong, "room-a"); return readings; });
  t.mock.method(models.ThayDongHoDien, "findOne", async () => null);
  t.mock.method(models.ThanhToan, "findAll", async (options) => { assert.equal(options.where.ma_hop_dong, "contract-a"); return bills; });
}
test("KT-07 oldest eligible period skips confirmed months and next-month bills in every real payment state", async (t) => {
  for (const state of ["CHUA_THANH_TOAN", "THANH_TOAN_MOT_PHAN", "DA_THANH_TOAN"]) {
    await t.test(state, async (t) => {
      fixture(t, [{ nam: 2026, thang: 8, trang_thai_xac_nhan: "DA_XAC_NHAN" }], [{ nam: 2026, thang: 10, trang_thai: state }]);
      const result = await service.tenantSelection("tenant-a", undefined, { now });
      assert.equal(result.period, "2026-10"); assert.equal(result.isLate, false);
      await assert.rejects(service.tenantSelection("tenant-a", "2026-09", { now }), { code: "READING_PERIOD_CLOSED", status: 409, message: /Kỳ này đã chốt, liên hệ chủ trọ/ });
    });
  }
});
test("KT-07 period guard rejects future before-contract and bypassing the oldest missing period", async (t) => {
  fixture(t);
  assert.equal((await service.tenantSelection("tenant-a", undefined, { now })).period, "2026-08");
  for (const period of ["2026-07", "2026-11"]) await assert.rejects(service.tenantSelection("tenant-a", period, { now }), { code: "TENANT_READING_PERIOD_INVALID", status: 409 });
  await assert.rejects(service.tenantSelection("tenant-a", "2026-10", { now }), { code: "TENANT_READING_PERIOD_MISMATCH", status: 409 });
});
test("KT-07 no eligible period closes context without a fabricated deadline", async (t) => {
  fixture(t, [8, 9, 10].map((thang) => ({ nam: 2026, thang, trang_thai_xac_nhan: "DA_XAC_NHAN" })));
  t.mock.method(models.PhongTro, "findByPk", async () => ({ ma_phong: "room-a", so_phong: "A1", canTro: { ten_can: "A" } }));
  const context = await service.getContext("tenant-a", undefined, { now });
  assert.equal(context.submissionWindowOpen, false); assert.equal(context.period, null); assert.equal(context.previousReading, null);
  assert.equal(context.deadline, undefined);
  await assert.rejects(service.tenantSelection("tenant-a", "2026-08", { now }), { code: "READING_ALREADY_CONFIRMED", status: 409 });
});
test("KT-07 manual input is rejected before a transaction or any database read", async (t) => {
  t.mock.method(models.HopDong, "findOne", async () => assert.fail("manual payload must not read DB"));
  t.mock.method(sequelize, "transaction", async () => assert.fail("manual payload must not start transaction"));
  await assert.rejects(service.submit("tenant-a", { readingValue: 150, period: "2026-10" }, "actor-a"), { status: 400, code: "TENANT_MANUAL_READING_FORBIDDEN" });
});
test("KT-07 token must bind actor tenant contract room period and recognized OCR number", async (t) => {
  fixture(t); t.mock.method(fs, "existsSync", () => true);
  t.mock.method(models.ChiSoDien, "findOne", async () => assert.fail("invalid token must not reach meter row reads"));
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  const payload = { sub: "actor-a", tenantId: "tenant-a", contractId: "contract-a", roomId: "room-a", period: "2026-08", fileName: "unit.png", ocrValue: "150", ocrStatus: "RECOGNIZED", exp: Date.now() + 60000 };
  for (const change of [{ contractId: "contract-b" }, { roomId: "room-b" }]) await assert.rejects(service.submit("tenant-a", { uploadToken: service.signUploadPayload({ ...payload, ...change }) }, "actor-a"), { status: 404, code: "RESOURCE_NOT_FOUND" });
  await assert.rejects(service.submit("tenant-a", { uploadToken: service.signUploadPayload({ ...payload, tenantId: "tenant-b" }) }, "actor-a"), { code: "UPLOAD_TOKEN_EXPIRED" });
  await assert.rejects(service.submit("tenant-a", { uploadToken: service.signUploadPayload(payload), period: "2026-10" }, "actor-a"), { code: "TENANT_READING_PERIOD_MISMATCH" });
  await assert.rejects(service.submit("tenant-a", { uploadToken: service.signUploadPayload({ ...payload, ocrStatus: "MANUAL_REQUIRED", ocrValue: null }) }, "actor-a"), { code: "OCR_RECOGNITION_REQUIRED" });
  const good = service.signUploadPayload(payload), [encoded, signature] = good.split(".");
  const altered = Buffer.from(JSON.stringify({ ...payload, ocrValue: "999" })).toString("base64url");
  assert.notEqual(encoded, altered);
  await assert.rejects(service.submit("tenant-a", { uploadToken: `${altered}.${signature}` }, "actor-a"), { code: "UPLOAD_TOKEN_EXPIRED" });
});
test("KT-07 JWT contract scope and preview room override fail closed", async (t) => {
  fixture(t); t.mock.method(models.HopDong, "findOne", async () => ({ ...contract, ma_khach_thue: "tenant-b" }));
  await assert.rejects(service.tenantSelection("tenant-a", undefined, { now }), { code: "RESOURCE_NOT_FOUND" });
  await assert.rejects(service.createPreview("tenant-a", undefined, {}, "room-b", "actor-a"), { code: "TENANT_SCOPE_OVERRIDE_FORBIDDEN" });
});
test("KT-07 nearest confirmed chain is used across several missing months, not a fabricated prior value", async (t) => {
  fixture(t); t.mock.method(models.ChiSoDien, "findOne", async (options) => {
    assert.equal(options.where.trang_thai_xac_nhan, "DA_XAC_NHAN"); assert.equal(options.where.ma_phong, "room-a");
    assert.deepEqual(options.order.slice(0, 2), [["nam", "DESC"], ["thang", "DESC"]]);
    return { chi_so_moi: 120, ngay_ghi_nhan: "2026-08-01" };
  });
  assert.equal((await service.tenantPrevious(contract, "2026-10")).value, 120);
});
test("KT-07 context rejects client scope hints and owner role without changing owner endpoints", async () => {
  for (const request of [{ query: { roomId: "room-b" } }, { headers: { "x-tenant-id": "tenant-b" } }, { body: { readingValue: 100 } }]) {
    let error;
    await controller.context({ user: { vai_tro: "KHACH_THUE", ma_khach_thue: "tenant-a" }, query: {}, headers: {}, body: {}, ...request }, { apiSuccess() { assert.fail("must reject hint"); } }, (e) => { error = e; });
    assert.equal(error.status, 400);
  }
});
