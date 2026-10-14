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
