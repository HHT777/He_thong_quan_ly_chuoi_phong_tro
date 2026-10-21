const test = require("node:test");
const assert = require("node:assert/strict");
const audit = require("../src/services/auditLog.service");
const config = require("../src/services/systemConfig.service");

test("audit helper builds immutable before/after payload for a transaction", async () => {
  const payload = audit.buildAuditPayload({
    actorId: "account-1",
    action: "ACCOUNT_LOCKED",
    entityType: "TaiKhoan",
    entityId: "account-2",
    before: { trang_thai: "HOAT_DONG" },
    after: { trang_thai: "DA_KHOA" },
    reason: "Hết hợp đồng",
    correlationId: "request-1",
  });
  assert.deepEqual(payload.before_json, { trang_thai: "HOAT_DONG" });
  assert.deepEqual(payload.after_json, { trang_thai: "DA_KHOA" });
  assert.equal(payload.actor_id, "account-1");
  await assert.rejects(
    audit.writeAuditLog({ ...payload }),
    (error) => error.code === "AUDIT_TRANSACTION_REQUIRED",
  );
});

test("system config has central defaults and validates numeric overrides", () => {
  const original = process.env.DEBT_CLOSE_DAY;
  delete process.env.DEBT_CLOSE_DAY;
  assert.equal(config.getSystemConfig().debtCloseDay, 10);
  process.env.DEBT_CLOSE_DAY = "invalid";
  assert.throws(() => config.getSystemConfig(), (error) => error.code === "INVALID_SYSTEM_CONFIG");
  if (original === undefined) delete process.env.DEBT_CLOSE_DAY;
  else process.env.DEBT_CLOSE_DAY = original;
});

test("FR-200 validates database-backed configuration domains", () => {
  assert.equal(config.validateSystemConfigValue("billScheduleDay", 28), 28);
  assert.equal(config.validateSystemConfigValue("billScheduleHour", 0), 0);
  assert.throws(() => config.validateSystemConfigValue("billScheduleDay", 29), (error) => error.code === "INVALID_SYSTEM_CONFIG");
  assert.throws(() => config.validateSystemConfigValue("unknown", 1), (error) => error.code === "UNKNOWN_SYSTEM_CONFIG");
});

test("FR-200 validates every public configuration key from the single catalog", () => {
  const entries = Object.entries(config.CONFIG_CATALOG);
  assert.equal(entries.length, 14);
  assert.equal(entries.filter(([, entry]) => entry.type === "integer").length, 13);
  assert.equal(config.CONFIG_CATALOG.contractStatusJobCron, undefined);
  for (const [key, entry] of entries) {
    assert.equal(config.validateSystemConfigValue(key, entry.defaultValue), entry.defaultValue, key);
    assert.ok(entry.description && entry.group, key);
    if (entry.type === "timezone") {
      for (const zone of entry.options) assert.equal(config.validateSystemConfigValue(key, zone), zone);
      assert.throws(() => config.validateSystemConfigValue(key, "UTC"), (error) => error.status === 400 && error.details.key === key);
    } else {
      assert.equal(config.validateSystemConfigValue(key, entry.min), entry.min, key);
      assert.equal(config.validateSystemConfigValue(key, entry.max), entry.max, key);
      for (const invalid of [entry.min - 1, entry.max + 1, 1.5, "", "1x"]) {
        assert.throws(() => config.validateSystemConfigValue(key, invalid), (error) => error.status === 400 && error.details.key === key, key);
      }
    }
  }
  for (const secret of ["JWT_SECRET", "DB_PASSWORD", "DB_HOST", "UPLOAD_PATH"]) assert.equal(config.CONFIG_CATALOG[secret], undefined);
});
