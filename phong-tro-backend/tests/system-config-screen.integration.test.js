const test = require("node:test");
const assert = require("node:assert/strict");
const { AuditLog, CauHinhHeThong, ThanhToan } = require("../src/models");
const config = require("../src/services/systemConfig.service");
const { integration, request, headers, login } = require("./helpers/integration-api");

test("FR-200 lists only public settings and rejects tenant or unauthenticated access", async () => {
  const landlord = await login(integration.landlord);
  const tenant = await login(integration.tenant);
  const listed = await request("/api/v1/system-config", { headers: headers(landlord) });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
  const rows = listed.body.data;
  assert.equal(rows.length, 14);
  assert.deepEqual(new Set(rows.map((row) => row.key)), new Set(Object.keys(config.CONFIG_CATALOG)));
  for (const row of rows) {
    assert.equal(row.khoa, row.key);
    assert.equal(row.gia_tri, row.value);
    assert.ok(row.description && row.group && row.type && row.domain);
    assert.equal(row.defaultValue, config.CONFIG_CATALOG[row.key].defaultValue);
  }
  assert.equal(rows.some((row) => row.key === "contractStatusJobCron"), false);
  assert.equal(rows.some((row) => /JWT|DB_|PATH|SECRET/i.test(row.key)), false);
  for (const method of ["GET", "PUT", "POST"]) {
    const path = method === "GET" ? "/api/v1/system-config" : method === "PUT" ? "/api/v1/system-config/overdueDay" : "/api/v1/system-config/overdueDay/reset";
    const unauth = await request(path, { method });
    assert.equal(unauth.response.status, 401, path);
    const forbidden = await request(path, { method, headers: headers(tenant), body: method === "PUT" ? JSON.stringify({ value: 6 }) : undefined });
    assert.equal(forbidden.response.status, 403, path);
  }
});

test("FR-200 every setting validates, applies without restart, resets and audits exactly once", async () => {
  const landlord = await login(integration.landlord);
  const oldBill = await ThanhToan.findOne({ order: [["ma_thanh_toan", "ASC"]] });
  const oldAmount = oldBill ? String(oldBill.tong_phai_tra) : null;
  for (const [key, entry] of Object.entries(config.CONFIG_CATALOG)) {
    const value = entry.type === "timezone" ? "Asia/Saigon" : entry.defaultValue === entry.max ? entry.min : entry.defaultValue + 1;
    const invalidValue = entry.type === "timezone" ? "UTC" : entry.max + 1;
    const path = `/api/v1/system-config/${encodeURIComponent(key)}`;
    const invalid = await request(path, { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value: invalidValue }) });
    assert.equal(invalid.response.status, 400, `${key}: ${JSON.stringify(invalid.body)}`);
    assert.equal(invalid.body.error.code, "INVALID_SYSTEM_CONFIG");
    assert.equal(invalid.body.error.details.key, key);
    const prior = await request("/api/v1/system-config", { headers: headers(landlord) });
    const before = prior.body.data.find((row) => row.key === key).value;
    const priorRow = await CauHinhHeThong.findOne({ where: { khoa: key } });
    const priorPersisted = priorRow ? (typeof priorRow.gia_tri === "string" ? (() => { try { return JSON.parse(priorRow.gia_tri); } catch (_) { return priorRow.gia_tri; } })() : priorRow.gia_tri) : null;
    const auditBefore = await AuditLog.count({ where: { entity_type: "CauHinhHeThong", action: "SYSTEM_CONFIG_UPDATED" } });
    const changed = await request(path, { method: "PUT", headers: headers(landlord), body: JSON.stringify({ value }) });
    assert.equal(changed.response.status, 200, `${key}: ${JSON.stringify(changed.body)}`);
    config.invalidateSystemConfigCache();
    assert.equal((await config.getPersistedSystemConfig())[key], value, key);
    const current = await request("/api/v1/system-config", { headers: headers(landlord) });
    const row = current.body.data.find((item) => item.key === key);
    assert.equal(row.value, value, key);
    assert.ok(row.updatedAt && row.updatedBy?.username, key);
    assert.equal(await AuditLog.count({ where: { entity_type: "CauHinhHeThong", action: "SYSTEM_CONFIG_UPDATED" } }), auditBefore + 1, key);
    const audit = await AuditLog.findOne({ where: { entity_type: "CauHinhHeThong", action: "SYSTEM_CONFIG_UPDATED" }, order: [["id", "DESC"]] });
    assert.deepEqual(audit.before_json, priorRow ? { key, value: priorPersisted } : null, `${key}: audit records persisted predecessor`);
    assert.deepEqual(audit.after_json, { key, value });
    assert.doesNotMatch(JSON.stringify(audit), /JWT_SECRET|DB_PASSWORD|password|token/i);
    const resetBefore = await AuditLog.count({ where: { entity_type: "CauHinhHeThong", action: "SYSTEM_CONFIG_RESET" } });
    const restored = await request(`${path}/reset`, { method: "POST", headers: headers(landlord) });
    assert.equal(restored.response.status, 200, `${key}: ${JSON.stringify(restored.body)}`);
    config.invalidateSystemConfigCache();
    assert.equal((await config.getPersistedSystemConfig())[key], entry.defaultValue, key);
    assert.equal(await AuditLog.count({ where: { entity_type: "CauHinhHeThong", action: "SYSTEM_CONFIG_RESET" } }), resetBefore + 1, key);
    const resetAudit = await AuditLog.findOne({ where: { entity_type: "CauHinhHeThong", action: "SYSTEM_CONFIG_RESET" }, order: [["id", "DESC"]] });
    assert.deepEqual(resetAudit.before_json, { key, value });
    assert.deepEqual(resetAudit.after_json, { key, value: entry.defaultValue });
    assert.ok(before !== undefined, `${key}: read exposes the effective value`);
  }
  if (oldBill) {
    await oldBill.reload();
    assert.equal(String(oldBill.tong_phai_tra), oldAmount, "Changing schedule settings must not recalculate existing bills");
  }
});
