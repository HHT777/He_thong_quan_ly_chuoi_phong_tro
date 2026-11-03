const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-192 landlord create form submits previous incident only at creation and has no unlink button", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/operations/incidents.tab.js"), "utf8");
  const model = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/operations/incident-form.mjs"), "utf8");
  assert.match(source, /name: "previousIncidentId", label: "Sự cố trước/);
  assert.match(model, /previousIncidentId: raw\.previousIncidentId \|\| undefined/);
  assert.match(source, /previousIncidents\.filter\(\(row\) => String\(row\.ma_phong\) === String\(roomId\)\)/);
  assert.doesNotMatch(source, /\/incidents\/\$\{[^}]+\}\/previous/);
});

test("FR-192 incident list loading failure offers retry", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/shared/components/view.js"), "utf8");
  assert.match(source, /data-list-retry>Thử lại<\/button>/);
  assert.match(source, /\[data-list-retry\].*renderList\(context, config\)/);
});
