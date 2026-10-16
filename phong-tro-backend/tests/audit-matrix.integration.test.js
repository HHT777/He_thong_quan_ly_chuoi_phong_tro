const test = require("node:test");
const assert = require("node:assert/strict");
const sequelize = require("../src/config/database");
const { AuditLog, TaiKhoan } = require("../src/models");
const { writeAuditLog } = require("../src/services/auditLog.service");

const operations = [
  "ACCOUNT_LOCK", "ACCOUNT_UNLOCK", "ACCOUNT_PASSWORD_RESET", "CONTRACT_CREATED", "CONTRACT_UPDATED", "ROOM_TRANSFERRED",
  "METER_READING_CONFIRMED", "METER_READING_UPDATED", "METER_READING_SOFT_DELETED", "EXPENSE_CREATED", "EXPENSE_UPDATED", "EXPENSE_CANCELLED",
  "REQUEST_DECIDED", "REQUEST_REVOKED", "BILL_ADJUSTMENT_CREATED", "BILL_ADJUSTMENT_TOGGLED", "CO_TENANT_UPDATED", "INCIDENT_SOFT_DELETED",
  "ROOM_PRICE_UPDATED", "SYSTEM_CONFIG_UPDATED", "PAYMENT_CANCELLED", "PAYMENT_MARKED_PAID", "PAYMENTS_MARKED_PAID", "MOVE_OUT_SETTLED", "DEPOSIT_REFUND_RECORDED",
];

test("AUD-01..06 audit matrix writes exactly one safe row per operation", async () => {
  const actor = await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } });
  for (const action of operations) {
    const entityId = `audit-matrix-${action}`;
    await sequelize.transaction((transaction) => writeAuditLog({ transaction, actorId: actor.ma_tai_khoan, action, entityType: "AuditMatrix", entityId, before: { password: "secret" }, after: { passwordHash: "secret" }, metadata: { token: "secret" } }));
    const rows = await AuditLog.findAll({ where: { action, entity_id: entityId } });
    assert.equal(rows.length, 1, action);
    assert.doesNotMatch(JSON.stringify(rows.map((row) => ({ before: row.before_json, after: row.after_json }))), /password|hash|token/i, action);
  }
});

test("AUD-01..06 audit failure rolls back the transaction for the matrix operation", async () => {
  const actor = await TaiKhoan.findOne({ where: { vai_tro: "CHU_TRO" } });
  await assert.rejects(() => sequelize.transaction(async (transaction) => {
    await writeAuditLog({ transaction, actorId: null, action: "ROOM_TRANSFERRED", entityType: "AuditMatrix", entityId: "rollback" });
    await writeAuditLog({ transaction, actorId: actor.ma_tai_khoan, action: "ROOM_TRANSFERRED", entityType: "AuditMatrix", entityId: "rollback" });
  }), (error) => error.code === "INVALID_AUDIT_LOG");
  assert.equal(await AuditLog.count({ where: { entity_id: "rollback" } }), 0);
});
