const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const service = require("../src/services/meterReading.service");

test("FR-065 landlord OCR has separate preview/submit routes and signed token claims", () => {
  const routes = fs.readFileSync(path.resolve(__dirname, "../src/routes/meterReading.routes.js"), "utf8");
  assert.match(routes, /\/meter-readings\/ocr-previews/); assert.match(routes, /\/meter-readings\/ocr-submit/);
  process.env.UPLOAD_TOKEN_SECRET = "ocr-test-secret";
  const token = service.signUploadPayload({ sub: "owner", tenantId: null, roomId: "room-1", period: "2026-10", fileName: "x.png", exp: Date.now() + 10000 });
  assert.equal(service.verifyUploadToken(token, "owner", null, "2026-10").roomId, "room-1");
  assert.throws(() => service.verifyUploadToken(token, "other", null, "2026-10"), (e) => e.code === "UPLOAD_TOKEN_EXPIRED");
  assert.throws(() => service.verifyUploadToken(token, "owner", null, "2026-10", Date.now() + 20000), (e) => e.code === "UPLOAD_TOKEN_EXPIRED");
});

test("FR-065 OCR failure is represented as MANUAL_REQUIRED instead of throwing", async () => {
  const original = global.fetch; global.fetch = async () => ({ ok: false, json: async () => ({}) });
  try { const result = await service.callOcr(path.resolve(__dirname, "../package.json")); assert.equal(result.status, "MANUAL_REQUIRED"); } finally { global.fetch = original; }
});

test("FR-065 OCR read and timeout have deterministic fallback statuses", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ success: true, ocr_value: "321" }) });
    assert.deepEqual(await service.callOcr(path.resolve(__dirname, "../package.json")), { status: "RECOGNIZED", rawValue: "321", numericValue: 321 });
    global.fetch = async () => { const error = new Error("timeout"); error.name = "AbortError"; throw error; };
    const timeout = await service.callOcr(path.resolve(__dirname, "../package.json")); assert.equal(timeout.status, "MANUAL_REQUIRED"); assert.equal(timeout.warning.code, "OCR_TIMEOUT");
  } finally { global.fetch = original; }
});

test("FR-065 distinguishes an unreadable image from an offline OCR service", async () => {
  const original = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => ({ success: false, error_code: "OCR_FAILED" }) });
    const unreadable = await service.callOcr(path.resolve(__dirname, "../package.json"));
    assert.equal(unreadable.warning.code, "OCR_FAILED");
    global.fetch = async () => { throw new Error("connect refused"); };
    const offline = await service.callOcr(path.resolve(__dirname, "../package.json"));
    assert.equal(offline.warning.code, "OCR_UNAVAILABLE");
  } finally { global.fetch = original; }
});
