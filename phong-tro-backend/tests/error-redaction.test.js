const test = require("node:test");
const assert = require("node:assert/strict");
const errorHandler = require("../src/middleware/errorHandler");
const { installApiResponse } = require("../src/utils/apiResponse");

function response() {
  return {
    statusCode: 200,
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("unexpected SQL error is redacted for legacy and v1 APIs while log retains reference and details", () => {
  const previous = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    for (const path of ["/api/phong", "/api/v1/debt"]) {
      const req = { path, headers: {} };
      const res = response();
      installApiResponse(req, res, () => {});
      const error = Object.assign(new Error("Unknown column SecretColumn in MissingTable; SQL SELECT * FROM MissingTable C:\\private\\file.sql"), { name: "SequelizeDatabaseError" });
      errorHandler(error, req, res, () => {});
      assert.equal(res.statusCode, 500);
      const body = JSON.stringify(res.body);
      assert.match(body, /INTERNAL_ERROR/);
      assert.doesNotMatch(body, /SecretColumn|MissingTable|SELECT|private|file\.sql/);
      const reference = res.body.referenceId || res.body.error.details.referenceId;
      assert.ok(reference);
      assert.ok(logs.some(([label, logged]) => label.includes(reference) && logged === error));
    }
  } finally { console.error = previous; }
});

test("expected business error preserves status, code and message", () => {
  const req = { path: "/api/v1/debt", headers: {} };
  const res = response();
  installApiResponse(req, res, () => {});
  errorHandler(Object.assign(new Error("Không tìm thấy tài nguyên"), { status: 404, code: "RESOURCE_NOT_FOUND" }), req, res, () => {});
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "RESOURCE_NOT_FOUND");
  assert.equal(res.body.error.message, "Không tìm thấy tài nguyên");
  const conflict = response();
  installApiResponse(req, conflict, () => {});
  errorHandler(Object.assign(new Error("Yêu cầu đã được gửi với nội dung khác"), { status: 409, code: "IDEMPOTENCY_CONFLICT" }), req, conflict, () => {});
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
  const joi = response();
  errorHandler({ isJoi: true, details: [{ path: ["amount"], message: "bắt buộc" }] }, req, joi, () => {});
  assert.equal(joi.statusCode, 400);
  assert.deepEqual(joi.body.details, [{ field: "amount", message: "bắt buộc" }]);
});
