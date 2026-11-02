const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const sequelize = require("../src/config/database");
const controller = require("../src/controllers/meterReading.controller");
const meterService = require("../src/services/meterReading.service");
const replacement = require("../src/services/meterReplacement.service");

const user = { vai_tro: "CHU_TRO", ma_tai_khoan: "owner-account" };

function setup(t, lockedStatus = "DA_XAC_NHAN") {
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building" }]);
  t.mock.method(meterService, "previousReading", async () => 0);
  t.mock.method(models.LichSuChinhSuaChiSoDien, "create", async () => assert.fail("confirmed reading must not create edit history"));
  let writes = 0;
  t.mock.method(models.ChiSoDien, "findByPk", async (id, options) => {
    if (id !== "reading") return null;
    if (!options?.lock) return { ma_chi_so: id, ma_phong: "room", phongTro: { ma_can: "building" } };
    return { ma_chi_so: id, ma_phong: "room", trang_thai_xac_nhan: lockedStatus,
      da_xoa: lockedStatus === "DELETED", update() { writes += 1; assert.fail("confirmed or deleted reading must not be written"); } };
  });
  return () => writes;
}

async function invoke(method, body) {
  let result;
  await controller[method](
    { user, params: { readingId: "reading" }, body, get: () => "test-header" },
    { apiSuccess: (data) => { result = data; }, apiError: (status, code) => { result = { status, code }; } },
    (error) => { result = error; },
  );
  return result;
}

test("pending meter edit and delete reject a reading confirmed after the initial lookup", async (t) => {
  const writes = setup(t);
  assert.equal((await invoke("update", { readingValue: 20, reason: "Ảnh mờ" })).code, "READING_ALREADY_CONFIRMED");
  assert.equal((await invoke("remove", { reason: "Gửi nhầm" })).code, "CONFIRMED_READING_CANNOT_BE_DELETED");
  assert.equal(writes(), 0);
});

test("deleted meter reading cannot be edited, deleted again or confirmed", async (t) => {
  const writes = setup(t, "DELETED");
  assert.equal((await invoke("update", { readingValue: 20, reason: "Ảnh mờ" })).code, "RESOURCE_NOT_FOUND");
  assert.equal((await invoke("remove", { reason: "Gửi nhầm" })).code, "RESOURCE_NOT_FOUND");
  assert.equal((await invoke("confirm", {})).code, "RESOURCE_NOT_FOUND");
  assert.equal(writes(), 0);
});

test("replacement consumption adds the old and new meter segments", () => {
  const oldMeter = { chi_so_cuoi_cu: 1230, san_luong_cu_uoc_tinh: null, chi_so_dau_moi: 5 };
  const estimated = { chi_so_cuoi_cu: null, san_luong_cu_uoc_tinh: 20, chi_so_dau_moi: 5 };
  assert.deepEqual(replacement.consumption(oldMeter, 1200, 17), { oldKwh: 30, newKwh: 12, totalKwh: 42 });
  assert.deepEqual(replacement.consumption(estimated, 1200, 17), { oldKwh: 20, newKwh: 12, totalKwh: 32 });
  assert.deepEqual(replacement.consumption(null, 1200, 1230), { oldKwh: null, newKwh: null, totalKwh: 30 });
  assert.throws(() => replacement.consumption(oldMeter, 1200, 4), { code: "INVALID_ELECTRICITY_AMOUNT" });
});

test("estimated old consumption requires a reason and valid readings", () => {
  const input = { period: "2026-10", replacementDate: "2026-10-15", estimatedOldKwh: 20, newStartReading: 5 };
  assert.throws(() => replacement.validate(input, 1200), { code: "REASON_REQUIRED" });
  assert.equal(replacement.validate({ ...input, reason: "Công tơ cũ hỏng" }, 1200).san_luong_cu_uoc_tinh, 20);
  assert.throws(() => replacement.validate({ ...input, oldFinalReading: 1201, reason: "Sai" }, 1200), { code: "METER_REPLACEMENT_SOURCE_REQUIRED" });
  assert.throws(() => replacement.validate({ period: "2026-10", replacementDate: "2026-10-15", oldFinalReading: 1199, newStartReading: 5, reason: "Thay" }, 1200), { code: "READING_BELOW_PREVIOUS" });
});

test("the following period uses the confirmed new meter reading as its minimum", async (t) => {
  t.mock.method(models.ThayDongHoDien, "findOne", async () => null);
  t.mock.method(models.ChiSoDien, "findOne", async () => ({ chi_so_moi: 17 }));
  assert.equal(await meterService.submissionMinimum("room", "2026-11"), 17);
});

test("a foreign owner cannot create a replacement", async (t) => {
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner" }));
  t.mock.method(models.PhongTro, "findByPk", async () => ({ ma_phong: "foreign-room", ma_can: "foreign-building" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "own-building" }]);
  t.mock.method(models.ThayDongHoDien, "create", async () => assert.fail("foreign replacement must not be inserted"));
  await assert.rejects(replacement.create({ roomId: "foreign-room", period: "2026-10" }, {}, user), { status: 404, code: "RESOURCE_NOT_FOUND" });
});

test("a room cannot record a second replacement in the same period", async (t) => {
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner" }));
  t.mock.method(models.PhongTro, "findByPk", async () => ({ ma_phong: "room", ma_can: "building" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building" }]);
  t.mock.method(models.ThayDongHoDien, "findOne", async () => ({ ma_thay_dong_ho: "existing" }));
  t.mock.method(models.ThayDongHoDien, "create", async () => assert.fail("second replacement must not be inserted"));
  await assert.rejects(replacement.create({ roomId: "room", period: "2026-10" }, {}, user), { status: 409, code: "METER_ALREADY_REPLACED" });
});

test("replacement refuses an already confirmed end-of-period reading", async (t) => {
  t.mock.method(sequelize, "transaction", async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
  t.mock.method(models.ChuTro, "findOne", async () => ({ ma_chu_tro: "owner" }));
  t.mock.method(models.PhongTro, "findByPk", async () => ({ ma_phong: "room", ma_can: "building" }));
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building" }]);
  t.mock.method(models.ThayDongHoDien, "findOne", async () => null);
  t.mock.method(models.HopDong, "findAll", async () => []);
  t.mock.method(meterService, "periodBaseline", async () => 1200);
  t.mock.method(models.ChiSoDien, "findOne", async () => ({ trang_thai_xac_nhan: "DA_XAC_NHAN" }));
  t.mock.method(models.ThayDongHoDien, "create", async () => assert.fail("confirmed period must not be replaced"));
  await assert.rejects(replacement.create({ roomId: "room", period: "2026-10", replacementDate: "2026-10-15", oldFinalReading: 1230, newStartReading: 5, reason: "Thay công tơ" }, {}, user),
    { status: 409, code: "METER_READING_ALREADY_CONFIRMED" });
});
