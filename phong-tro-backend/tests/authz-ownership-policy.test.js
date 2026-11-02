const test = require("node:test");
const assert = require("node:assert/strict");
const { assertOwned, notFoundError } = require("../src/services/ownership.service");

test("authz ownership policy fails closed for unmapped resource types", async () => {
  await assert.rejects(
    assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: "owner" }, "unregisteredResource", "id"),
    { status: 500, code: "OWNERSHIP_RESOURCE_UNMAPPED" },
  );
  await assert.rejects(
    assertOwned({ vai_tro: "KHACH_THUE", ma_khach_thue: "tenant" }, "unregisteredResource", "id"),
    { status: 500, code: "OWNERSHIP_RESOURCE_UNMAPPED" },
  );
});

test("authz tenant cannot access building, expense or report-scoped resources", async () => {
  for (const type of ["building", "expense", "reservation", "deposit", "moveOut", "adjustment"]) {
    await assert.rejects(
      assertOwned({ vai_tro: "KHACH_THUE", ma_khach_thue: "tenant" }, type, "id"),
      { status: 403, code: "FORBIDDEN" },
    );
  }
});

test("authz missing and foreign resource share opaque not-found response", () => {
  const missing = notFoundError();
  const foreign = notFoundError();
  assert.deepEqual({ status: missing.status, code: missing.code, message: missing.message },
    { status: foreign.status, code: foreign.code, message: foreign.message });
  assert.equal(missing.status, 404);
  assert.doesNotMatch(missing.message, /id|uuid/i);
});
