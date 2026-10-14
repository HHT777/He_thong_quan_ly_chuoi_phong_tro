const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.resolve(__dirname, "..", relative), "utf8");

test("CT-016 integration runner isolates, resets and removes only an explicit test database", () => {
  const runner = read("scripts/run-test-suite.js");
  assert.match(runner, /required\("TEST_DB_NAME"\)/);
  assert.match(runner, /end in _test or _ci/);
  assert.match(runner, /TEST_DB_NAME must differ from DB_NAME/);
  assert.match(runner, /DROP DATABASE IF EXISTS/);
  assert.match(runner, /resetAndSeed/);
  assert.match(runner, /finally/);
  assert.match(runner, /dropTestDatabase/);
});

test("CT-016 main test command includes regression and integration suites", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.test, /test:unit/);
  assert.match(pkg.scripts.test, /test:integration/);
  assert.equal(pkg.scripts["test:unit"], "node scripts/run-test-suite.js unit");
  assert.equal(pkg.scripts["test:integration"], "node scripts/run-test-suite.js integration");
});

test("CT-016 integration tests obtain logins from environment-backed fixture config", () => {
  const files = fs.readdirSync(__dirname).filter((name) => name.endsWith(".integration.test.js"));
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, file), "utf8");
    assert.doesNotMatch(source, /mat_khau:\s*["']\d{6}["']/i, file);
    assert.doesNotMatch(source, /login\(["'][^"']+["']\)/, file);
  }
});
