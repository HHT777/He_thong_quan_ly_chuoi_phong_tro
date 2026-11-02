const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { AuditLog, ChiSoDien } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

async function postMultipart(path, token, fields, content = "meter") {
  const form = new FormData(); for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", new Blob([content], { type: "image/png" }), "meter.png");
  return request(path, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
}

test("FR-065 landlord OCR preview, manual fallback, monotonic reading, audit and RBAC", async () => {
  const ocrServer = http.createServer((req, res) => { req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ success: true, ocr_value: "125" })); }); });
  await new Promise((resolve) => ocrServer.listen(8000, "127.0.0.1", resolve));
  try {
    const owner = await login(integration.landlord); const fresh = await createFreshRental(owner, "ocr-landlord"); const before = await AuditLog.count({ where: { action: "METER_READING_MANUAL_CREATED" } });
    const preview = await postMultipart("/api/v1/meter-readings/ocr-previews", owner, { period: "2026-11", roomId: fresh.room.ma_phong });
    assert.equal(preview.response.status, 200, JSON.stringify(preview.body)); assert.equal(preview.body.data.ocrStatus, "RECOGNIZED");
    const saved = await request("/api/v1/meter-readings/ocr-submit", { method: "POST", headers: { Authorization: `Bearer ${owner}`, "content-type": "application/json", "Idempotency-Key": `ocr-${Date.now()}` }, body: JSON.stringify({ period: "2026-11", readingValue: 125, uploadToken: preview.body.data.uploadToken }) });
    assert.equal(saved.response.status, 201, JSON.stringify(saved.body)); assert.equal(saved.body.data.status, "DA_XAC_NHAN"); assert.equal(await AuditLog.count({ where: { action: "METER_READING_MANUAL_CREATED" } }), before + 1);
    const below = await postMultipart("/api/v1/meter-readings/ocr-previews", owner, { period: "2026-12", roomId: fresh.room.ma_phong });
    const rejected = await request("/api/v1/meter-readings/ocr-submit", { method: "POST", headers: { Authorization: `Bearer ${owner}`, "content-type": "application/json", "Idempotency-Key": `ocr-below-${Date.now()}` }, body: JSON.stringify({ period: "2026-12", readingValue: 124, uploadToken: below.body.data.uploadToken }) });
    assert.equal(rejected.response.status, 400);
    const bad = await postMultipart("/api/v1/meter-readings/ocr-previews", owner, { period: "2026-13", roomId: fresh.room.ma_phong }, "bad"); assert.equal(bad.response.status, 400);
    const tenantLogin = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ten_dang_nhap: integration.tenant.username, mat_khau: integration.tenant.password }) });
    const forbidden = await postMultipart("/api/v1/meter-readings/ocr-previews", tenantLogin.body.data.token, { period: "2026-11", roomId: fresh.room.ma_phong }); assert.equal(forbidden.response.status, 403);
    assert.equal(await ChiSoDien.count({ where: { ma_phong: fresh.room.ma_phong, nam: 2026, thang: 11 } }), 1);
  } finally { await new Promise((resolve) => ocrServer.close(resolve)); }
});
