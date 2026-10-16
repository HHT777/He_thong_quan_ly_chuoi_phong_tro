const test = require("node:test");
const assert = require("node:assert/strict");
const sequelize = require("../src/config/database");
const { AuditLog, PhongTro } = require("../src/models");
const { writeAuditLog } = require("../src/services/auditLog.service");
const { integration, login, createFreshRental } = require("./helpers/integration-api");

test("AUD-01..06 audit is transactional and never stores password material", async () => {
  const landlordToken = await login(integration.landlord);
  const fresh = await createFreshRental(landlordToken, "audit-integrity");
  const accountLogs = await AuditLog.findAll({ where: { action: "TENANT_ACCOUNT_CREATED", entity_id: fresh.account.ma_tai_khoan } });
  assert.equal(accountLogs.length, 1);
  assert.doesNotMatch(JSON.stringify(accountLogs), /"(?:mat_khau|matKhau|mat_khau_hash|matKhauHash|password|passwordHash)"\s*:/i);

  const room = await PhongTro.create({ ma_can: fresh.building.ma_can, so_phong: `AUD-${Date.now()}`, dien_tich: 20, gia_thue: 1000000, so_nguoi_toi_da: 1, trang_thai: "TRONG" });
  await assert.rejects(() => sequelize.transaction(async (transaction) => {
    await room.update({ trang_thai: "DA_GIU" }, { transaction });
    await writeAuditLog({ transaction, actorId: null, action: "TEST_AUDIT_FAILURE", entityType: "PhongTro", entityId: room.ma_phong });
  }),
    (error) => error.code === "INVALID_AUDIT_LOG",
  );
  await room.reload(); assert.equal(room.trang_thai, "TRONG", "business update must roll back when audit fails");
});
