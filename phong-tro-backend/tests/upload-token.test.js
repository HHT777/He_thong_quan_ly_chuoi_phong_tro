const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "unit-upload-token-secret";

test("E.1.2 signed upload token survives module reload and enforces claims", () => {
  const modulePath = require.resolve("../src/services/meterReading.service");
  let service = require(modulePath);
  const payload = { sub: "account-1", tenantId: "tenant-1", roomId: "room-1", period: "2026-10", fileName: "image.jpg", exp: Date.now() + 60_000 };
  const token = service.signUploadPayload(payload);
  delete require.cache[modulePath];
  service = require(modulePath);
  assert.equal(service.verifyUploadToken(token, "account-1", "tenant-1", "2026-10").roomId, "room-1");
  assert.throws(() => service.verifyUploadToken(token, "account-2", "tenant-1", "2026-10"), (error) => error.code === "UPLOAD_TOKEN_EXPIRED");
  assert.throws(() => service.verifyUploadToken(`${token}x`, "account-1", "tenant-1", "2026-10"), (error) => error.code === "UPLOAD_TOKEN_EXPIRED");
  const expired = service.signUploadPayload({ ...payload, exp: Date.now() - 1 });
  assert.throws(() => service.verifyUploadToken(expired, "account-1", "tenant-1", "2026-10"), (error) => error.code === "UPLOAD_TOKEN_EXPIRED");
});
