const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/operations/move-outs.tab.js"), "utf8");

test("FR-096/187/188 move-out screen follows context, settlement and refund contracts", () => {
  assert.match(source, /get\(`\/v1\/move-outs\/\$\{row\.ma_hop_dong\}\/context`\)/);
  assert.match(source, /post\(`\/v1\/move-outs\/\$\{row\.ma_hop_dong\}\/settle`, payload\)/);
  assert.match(source, /assetDeductions/);
  assert.match(source, /violationDeductions/);
  assert.match(source, /finalElectricityReading/);
  assert.doesNotMatch(source, /finalWater|waterReading|chỉ số nước/i);
  assert.match(source, /deposit-refunds/);
  assert.match(source, /khoaChongTrung: requestKeys\.keyFor\(scope, identity\)/);
  assert.match(source, /requestKeys\.complete\(scope\)/);
  assert.match(source, /await confirmAction\(/);
  assert.match(source, /escapeHtml/);
});
