const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("N-10 co-tenant frontend submits the canonical identityNumber field", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../phong-tro-frontend/assets/js/pages/mvpForms.page.js"),
    "utf8",
  );

  assert.match(source, /name="identityNumber"/);
  assert.doesNotMatch(source, /name="idNumber"/);
  assert.match(source, /name="birthDate"/);
  assert.match(source, /name="permanentAddress"/);
  assert.match(source, /name="relationship"/);
  assert.match(source, /name="startDate"/);
});
