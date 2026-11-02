const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const sequelize = require("../src/config/database");
const { ChiSoDien } = require("../src/models");
const { getUploadContext, inside, repositoryRoot } = require("../src/config/uploadFilesystem");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=", "base64");
const context = getUploadContext();
const meterDir = context.resolve("meter");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function files() {
  if (!context.exists(meterDir)) return {};
  return Object.fromEntries(context.list(meterDir).sort().map((name) => {
    const file = context.check(context.resolve("meter", name));
    return [name, hash(fs.readFileSync(file))];
  }));
}
async function database() {
  const snapshot = {};
  for (const model of Object.values(sequelize.models)) {
    const rows = await model.findAll({ raw: true });
    const values = rows.map((row) => JSON.stringify(row)).sort();
    snapshot[model.name] = hash(JSON.stringify(values));
  }
  return snapshot;
}
async function upload(token, route, fields, bytes = image, mime = "image/png", filename = "../../escape/same.png") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), filename);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return request(`/api/v1${route}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
}
const checkStatus = (result, expected) => assert.equal(result.response.status, expected, `HTTP ${result.response.status}; code=${result.body.error?.code || result.body.code || "none"}`);

test("KT-08A real multipart uses session storage, rejects MIME and oversized files, isolates concurrent names and preserves owner OCR manual fallback", async () => {
  assert.equal(process.env.OCR_BASE_URL, "http://127.0.0.1:18089");
  assert.ok(inside(process.env.UPLOAD_TEST_SESSION_ROOT, meterDir));
  assert.equal(inside(repositoryRoot, meterDir), false);
  let ocrValue = "150"; let calls = 0;
  const stub = http.createServer((req, res) => { calls += 1; req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(ocrValue == null ? { success: false } : { success: true, ocr_value: ocrValue })); }); });
  await new Promise((resolve, reject) => { stub.once("error", reject); stub.listen(18089, "127.0.0.1", resolve); });
  try {
    const owner = await login(integration.landlord);
    const rental = await createFreshRental(owner, "kt08-http");
    const initial = await request("/api/v1/me/meter-reading-context", { headers: headers(rental.tenantToken) });
    checkStatus(initial, 200);
    const period = initial.body.data.period;
    const maxBytes = initial.body.data.imagePolicy.maxBytes;
    assert.ok(Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= 16 * 1048576, "fixture limit must remain bounded before allocating a test image");
    const before = files(), dbBefore = await database();
    const previews = await Promise.all([0, 1].map(() => upload(rental.tenantToken, "/me/meter-reading-ocr-previews", { period })));
    for (const result of previews) { checkStatus(result, 200); assert.equal(result.body.data.ocrStatus, "RECOGNIZED"); assert.equal(result.body.data.canSubmit, true); }
    const names = previews.map((result) => JSON.parse(Buffer.from(result.body.data.uploadToken.split(".")[0], "base64url")).fileName);
    assert.notEqual(names[0], names[1]);
    const after = files();
    for (const name of names) {
      assert.match(name, /^[a-f0-9]{32}$/);
      assert.equal(after[name], hash(image));
      assert.ok(inside(context.root, context.check(context.resolve("meter", name))));
    }
    assert.equal(Object.keys(after).length, Object.keys(before).length + 2);
    assert.deepEqual(await database(), dbBefore, "preview must not write DB or audit");
    const submitted = await request("/api/v1/me/meter-readings", { method: "POST", headers: headers(rental.tenantToken, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ period, uploadToken: previews[0].body.data.uploadToken }) });
    checkStatus(submitted, 201);
    const saved = await ChiSoDien.findByPk(submitted.body.data.id);
    assert.equal(path.resolve(saved.anh_cong_to_url), context.resolve("meter", names[0]));
    assert.equal(inside(repositoryRoot, path.resolve(saved.anh_cong_to_url)), false);

    // Both disk-stream tenant storage and buffered owner storage must reject
    // wrong MIME and runtime-size violations without leaving new files.
    const oversized = Buffer.alloc(maxBytes + 1); image.copy(oversized);
    for (const [token, route, fields] of [
      [rental.tenantToken, "/me/meter-reading-ocr-previews", { period }],
      [owner, "/meter-readings/ocr-previews", { period, roomId: rental.room.ma_phong }],
    ]) {
      for (const [bytes, mime, expected] of [[Buffer.from("GIF89a"), "image/gif", 415], [oversized, "image/png", 413]]) {
        const beforeFiles = files(), beforeDB = await database(), beforeCalls = calls;
        const rejected = await upload(token, route, fields, bytes, mime);
        checkStatus(rejected, expected);
        assert.equal(rejected.body.data?.uploadToken, undefined);
        assert.deepEqual(files(), beforeFiles, "rejected MIME/size must not leave an upload");
        assert.deepEqual(await database(), beforeDB, "rejected MIME/size must not write DB/audit");
        assert.equal(calls, beforeCalls, "invalid upload must not reach OCR");
      }
    }
    // Invalid signature with declared PNG is a content rejection, not merely
    // extension filtering. Existing staging retention policy belongs to KT-08B.
    const badDB = await database();
    checkStatus(await upload(rental.tenantToken, "/me/meter-reading-ocr-previews", { period }, Buffer.from("not-a-png")), 415);
    assert.deepEqual(await database(), badDB);

    ocrValue = null;
    const [year, month] = period.split("-").map(Number);
    const next = new Date(Date.UTC(year, month, 1));
    const ownerPeriod = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
    const fallback = await upload(owner, "/meter-readings/ocr-previews", { period: ownerPeriod, roomId: rental.room.ma_phong });
    checkStatus(fallback, 200); assert.equal(fallback.body.data.ocrStatus, "MANUAL_REQUIRED");
    assert.match(fallback.body.data.warnings[0].message, /nhập tay/);
    const ownerSave = await request("/api/v1/meter-readings/ocr-submit", { method: "POST", headers: headers(owner, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ period: ownerPeriod, readingValue: 250, uploadToken: fallback.body.data.uploadToken }) });
    checkStatus(ownerSave, 201); assert.equal(ownerSave.body.data.status, "DA_XAC_NHAN"); assert.equal(ownerSave.body.data.readingValue, 250);
    const ownerReading = await ChiSoDien.findByPk(ownerSave.body.data.id);
    assert.ok(inside(context.root, path.resolve(ownerReading.anh_cong_to_url)));
    assert.equal(inside(repositoryRoot, path.resolve(ownerReading.anh_cong_to_url)), false);
  } finally { await new Promise((resolve) => stub.close(resolve)); }
});
