const test = require("node:test");
const assert = require("node:assert/strict");
const { AuditLog, TaiKhoan, PhongTro } = require("../src/models");
const phongService = require("../src/services/phong.service");
const { integration, login, createFreshRental } = require("./helpers/integration-api");

test("AUD-01..06 audit is transactional and never stores password material", async () => {
  const landlordToken = await login(integration.landlord);
  const fresh = await createFreshRental(landlordToken, "audit-integrity");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const accountLogs = await AuditLog.findAll({ where: { action: "TENANT_ACCOUNT_CREATED", entity_id: fresh.account.ma_tai_khoan } });
  assert.equal(accountLogs.length, 1);
  assert.doesNotMatch(JSON.stringify(accountLogs), /"(?:mat_khau|matKhau|mat_khau_hash|matKhauHash|password|passwordHash)"\s*:/i);

  const room = await PhongTro.findByPk(fresh.room.ma_phong); const originalPrice = Number(room.gia_thue);
  AuditLog.addHook("beforeCreate", "audit-rollback-regression", () => { throw new Error("AUDIT_FAILURE"); });
  try {
    await assert.rejects(() => phongService.updatePhong(room.ma_phong, { gia_thue: originalPrice + 100000 }, actor.ma_tai_khoan), /AUDIT_FAILURE/);
  } finally { AuditLog.removeHook("beforeCreate", "audit-rollback-regression"); }
  await room.reload(); assert.equal(Number(room.gia_thue), originalPrice, "business update must roll back when audit fails");

  await phongService.updatePhong(room.ma_phong, { gia_thue: originalPrice + 100000 }, actor.ma_tai_khoan);
  assert.equal(await AuditLog.count({ where: { action: "ROOM_PRICE_UPDATED", entity_id: room.ma_phong } }), 1);
});
