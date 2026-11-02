const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("authz runner checks seed before server/tests and stops on invariant failure", () => {
  const runner = fs.readFileSync(path.resolve(__dirname, "../scripts/run-test-suite.js"), "utf8");
  const seed = runner.indexOf("await resetAndSeed(databaseName)");
  const seedCheck = runner.indexOf("[INVARIANTS seed]");
  const server = runner.indexOf('spawn(process.execPath, ["src/index.js"]');
  assert.ok(seed >= 0 && seed < seedCheck && seedCheck < server);
  assert.match(runner, /if \(seedInvariant\.status !== 0\) return seedInvariant\.status \?\? 1/);
  assert.match(runner, /\[INVARIANTS post-integration\]/);
});

test("authz invariants include seven new relationship checks", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../scripts/check-invariants.js"), "utf8");
  for (const name of ["buildingLandlord", "landlordAccount", "roomBuilding", "contractBuilding", "reservationBuilding", "meterReadingBuilding", "billBuilding"]) {
    assert.match(source, new RegExp(`\\b${name}:`));
  }
});
