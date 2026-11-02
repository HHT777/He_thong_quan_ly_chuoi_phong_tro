const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-165 debt payment button reveals the form and keeps submit distinct from cancel", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/finance/debts.tab.js"), "utf8");
  assert.match(source, /workspace\.scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(source, /revealPaymentForm\(workspace, 'input\[name="so_tien"\]'\)/);
  assert.match(source, /data-cancel-payment>Hủy<\/button><button type="submit"/);
  assert.match(source, /form\.querySelector\('button\[type="submit"\]'\)/);
});
