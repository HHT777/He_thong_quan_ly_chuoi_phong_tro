const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { approvedTestTarget, assertSeedTarget } = require("../src/config/testDatabaseSafety");

const root = path.resolve(__dirname, "..");
const approved = {
  NODE_ENV: "test", DB_NAME: "phong_tro", DB_HOST: "127.0.0.1", DB_PORT: "3307",
  TEST_DB_NAME: "qlpt_authz_test", TEST_DB_ALLOWED_NAME: "qlpt_authz_test",
  TEST_DB_HOST: "127.0.0.1", TEST_DB_PORT: "3307", TEST_DB_USER: "root",
};

const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("security startup ignores DB_SYNC and DB_SYNC_ALTER outside approved test DB without calling sync", async () => {
  const { syncSchemaIfApproved } = require("../src/config/testDatabaseSafety");
  const calls = [];
  const sequelize = { async sync(options) { calls.push(options); } };
  const warnings = [];
  const logger = { warn(message) { warnings.push(message); } };
  for (const flags of [{ DB_SYNC: "true" }, { DB_SYNC_ALTER: "true" }, { DB_SYNC: "true", DB_SYNC_ALTER: "true" }]) {
    const result = await syncSchemaIfApproved(sequelize, { ...approved, ...flags, NODE_ENV: "development", DB_NAME: "phong_tro" }, logger);
    assert.equal(result, false);
  }
  assert.equal(calls.length, 0);
  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((line) => !line.includes("phong_tro")));
  assert.equal(await syncSchemaIfApproved(sequelize, { ...approved, DB_SYNC: "true", DB_NAME: "qlpt_authz_test" }, logger), true);
  assert.deepEqual(calls, [{ alter: false }]);
  assert.equal(await syncSchemaIfApproved(sequelize, { ...approved, DB_SYNC: "true", DB_NAME: "other_test" }, logger), false);
  assert.equal(calls.length, 1);
});

test("security seed refuses real DB or missing/mismatched confirmation before connecting", () => {
  assert.throws(() => assertSeedTarget({ ...approved, TEST_DB_NAME: "phong_tro", TEST_DB_ALLOWED_NAME: "phong_tro" }, ["--confirm-db=phong_tro"]), /test database/);
  assert.throws(() => assertSeedTarget({ ...approved, NODE_ENV: "development" }, ["--confirm-db=qlpt_authz_test"]), /NODE_ENV=test/);
  for (const args of [[], ["--confirm-db=wrong_test"]]) assert.throws(() => assertSeedTarget(approved, args), /confirm-db/);
  assert.equal(assertSeedTarget(approved, ["--confirm-db=qlpt_authz_test"]).database, "qlpt_authz_test");
  const seed = source("scripts/seed.js");
  assert.ok(seed.indexOf("assertSeedTarget(process.env") < seed.indexOf('require("../src/config/database")'));
  assert.ok(seed.indexOf("process.env.DB_NAME = target.database") < seed.indexOf('require("../src/config/database")'));
});

test("security reset scripts require exact allowed name and never fall back to DB host or port", () => {
  const scripts = [
    "scripts/run-test-suite.js", "scripts/verify-migrations.js",
    "scripts/verify-collation-upgrade.js", "scripts/verify-g2-migrations.js",
  ];
  for (const file of scripts) {
    const body = source(file);
    assert.match(body, /approvedTestTarget\(/, file);
    assert.doesNotMatch(body, /TEST_DB_HOST\s*\|\|\s*(?:process\.env\.)?DB_HOST|TEST_DB_PORT\s*\|\|\s*(?:process\.env\.)?DB_PORT|TEST_DB_USER\s*\|\|\s*(?:process\.env\.)?DB_USER/, file);
  }
  assert.throws(() => approvedTestTarget({ ...approved, TEST_DB_ALLOWED_NAME: "" }, "qlpt_authz_test"), /TEST_DB_ALLOWED_NAME/);
  assert.throws(() => approvedTestTarget({ ...approved, TEST_DB_HOST: "localhost", DB_HOST: "127.0.0.1" }, "qlpt_authz_test"), /TEST_DB_HOST/);
  assert.throws(() => approvedTestTarget({ ...approved, TEST_DB_PORT: "", DB_PORT: "3307" }, "qlpt_authz_test"), /TEST_DB_PORT/);
  assert.throws(() => approvedTestTarget({ ...approved, TEST_DB_ALLOWED_NAME: "different_test" }, "qlpt_authz_test"), /TEST_DB_ALLOWED_NAME/);
});
