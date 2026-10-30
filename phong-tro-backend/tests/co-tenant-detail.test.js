const test = require("node:test");
const assert = require("node:assert/strict");
const { toJsonValue } = require("../src/services/auditLog.service");

test("FR-166 audit snapshots discard identity, address and birth date recursively", () => {
  const snapshot = toJsonValue({ identityNumber: "079", birthDate: "2003-05-12", permanentAddress: "secret", nested: { cccd_giay_to: "079", ngay_sinh: "2003-05-12", dia_chi_thuong_tru: "secret", roomId: "room" } });
  assert.deepEqual(snapshot, { nested: { roomId: "room" } });
});

test("FR-166 detail route validates bounded request ID before reading proposal", () => {
  const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../src/routes/mvp.routes.js"), "utf8");
  const block = source.slice(source.indexOf('router.get("/co-tenant-proposals/:id"'), source.indexOf('router.post("/co-tenants"'));
  assert.match(block, /Joi\.string\(\)\.max\(36\)\.pattern/);
  assert.match(block, /getProposal/);
  assert.doesNotMatch(block, /\.create\(|\.update\(/);
});
