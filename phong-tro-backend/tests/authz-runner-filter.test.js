const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { testFiles, safeDatabaseName, assertAuthorizedDatabaseTarget } = require("../scripts/run-test-suite");

test("authz runner rejects a zero-match filter before resetting any database", () => {
  assert.throws(() => testFiles(true, "__no_such_authz_test__"), /No integration test files match filter/);
  assert.throws(() => testFiles(false, "__no_such_authz_test__"), /No unit test files match filter/);
  assert.ok(testFiles(true, "co-tenant-detail").length > 0);
  const baseline = testFiles(true, "!authz-phase1");
  assert.ok(baseline.length > 0);
  assert.ok(baseline.every((file) => !file.includes("authz-phase1")));
  const source = fs.readFileSync(path.resolve(__dirname, "../scripts/run-test-suite.js"), "utf8");
  assert.ok(source.indexOf("const selectedTests = testFiles(true)") < source.indexOf("await resetAndSeed(databaseName)"));
});

test("authz runner keeps strict test database name guard", () => {
  const prior = Object.fromEntries(["TEST_DB_NAME", "TEST_DB_ALLOWED_NAME", "TEST_DB_HOST", "TEST_DB_PORT", "DB_NAME"].map((key) => [key, process.env[key]]));
  try {
    process.env.DB_NAME = "qlpt_dev";
    process.env.TEST_DB_NAME = "qlpt_authz_test";
    process.env.TEST_DB_ALLOWED_NAME = "qlpt_authz_test";
    process.env.TEST_DB_HOST = "127.0.0.1";
    process.env.TEST_DB_PORT = "3307";
    assert.equal(safeDatabaseName(), "qlpt_authz_test");
    for (const unsafe of ["qlpt", "qlpt_dev", "qlpt_test_extra", "../qlpt_test", "qlpt-test"]) {
      process.env.TEST_DB_NAME = unsafe;
      assert.throws(() => safeDatabaseName());
    }
    process.env.DB_NAME = "qlpt_authz_test";
    process.env.TEST_DB_NAME = "qlpt_authz_test";
    assert.throws(() => safeDatabaseName(), /must differ from DB_NAME/);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("authz runner refuses any destructive target outside approved MySQL TCP database", () => {
  const prior = Object.fromEntries(["TEST_DB_ALLOWED_NAME", "TEST_DB_HOST", "TEST_DB_PORT"].map((key) => [key, process.env[key]]));
  try {
    process.env.TEST_DB_ALLOWED_NAME = "qlpt_authz_test";
    process.env.TEST_DB_HOST = "127.0.0.1";
    process.env.TEST_DB_PORT = "3307";
    assert.doesNotThrow(() => assertAuthorizedDatabaseTarget("qlpt_authz_test", "DROP"));
    for (const name of ["qlpt", "qlpt_test", "qlpt_migration_ci"]) {
      assert.throws(() => assertAuthorizedDatabaseTarget(name, "DROP"), /outside approved scope/);
    }
    process.env.TEST_DB_PORT = "3306";
    assert.throws(() => assertAuthorizedDatabaseTarget("qlpt_authz_test", "DROP"), /outside approved scope/);
    process.env.TEST_DB_PORT = "3307";
    process.env.TEST_DB_HOST = "localhost";
    assert.throws(() => assertAuthorizedDatabaseTarget("qlpt_authz_test", "DROP"), /outside approved scope/);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
