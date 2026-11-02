const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("N-10 co-tenant approval checks all canonical identity fields", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../phong-tro-frontend/src/modules/residents-contracts/co-tenants.tab.js"),
    "utf8",
  );

  assert.match(source, /const required = \["name", "phone", "identityNumber", "birthDate", "gender", "permanentAddress", "relationship", "startDate"\]/);
  assert.match(source, /missing\.length \? "disabled"/);
  assert.match(source, /detail\.identityNumber/);
});
