const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("CT-017 database verification queries use valid aggregate syntax and aliases", () => {
  const seed = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  const verification = seed.slice(seed.indexOf("-- 3."));

  assert.notEqual(verification.length, 0, "verification section must exist");
  assert.doesNotMatch(verification, /count\s*\(\s*_\s*\)/i);
  assert.doesNotMatch(verification, /count\s*\(\s*\\\*\s*\)/i);
  assert.doesNotMatch(verification, /\bso\*ban_ghi\b/i);
});
