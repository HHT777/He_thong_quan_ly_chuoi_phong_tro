const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { testFiles, safeDatabaseName } = require("../scripts/run-test-suite");

test("authz runner rejects a zero-match filter before resetting any database", () => {
  assert.throws(() => testFiles(true, "__no_such_authz_test__"), /No integration test files match filter/);
  assert.throws(() => testFiles(false, "__no_such_authz_test__"), /No unit test files match filter/);
  assert.ok(testFiles(true, "co-tenant-detail").length > 0);
  const source = fs.readFileSync(path.resolve(__dirname, "../scripts/run-test-suite.js"), "utf8");
  assert.ok(source.indexOf("const selectedTests = testFiles(true)") < source.indexOf("await resetAndSeed(databaseName)"));
});

test("authz runner keeps strict test database name guard", () => {
  const previous = process.env.TEST_DB_NAME;
  const originalDevName = process.env.DB_NAME;
  try {
    process.env.DB_NAME = "qlpt_dev";
    process.env.TEST_DB_NAME = "qlpt_authz_test";
    assert.equal(safeDatabaseName(), "qlpt_authz_test");
    for (const unsafe of ["qlpt", "qlpt_dev", "qlpt_test_extra", "../qlpt_test", "qlpt-test"]) {
      process.env.TEST_DB_NAME = unsafe;
      assert.throws(() => safeDatabaseName());
    }
    process.env.DB_NAME = "qlpt_authz_test";
    process.env.TEST_DB_NAME = "qlpt_authz_test";
    assert.throws(() => safeDatabaseName(), /must differ from DB_NAME/);
  } finally {
    if (previous === undefined) delete process.env.TEST_DB_NAME;
    else process.env.TEST_DB_NAME = previous;
    if (originalDevName === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = originalDevName;
  }
});
