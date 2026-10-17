const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src", file), "utf8");

test("FR-144..157/164/175/176 bill screen uses canonical routes, payloads and retry keys", () => {
  const source = read("modules/finance/bills.tab.js");
  assert.match(source, /post\("\/v1\/bills\/preview", \{ period: .* contractIds:/s);
  assert.match(source, /post\("\/v1\/bills\/generate", \{ period: .* contractIds:/s);
  assert.match(source, /\/v1\/bills\/\$\{row\.ma_thanh_toan\}\/adjustments/);
  assert.match(source, /reason: raw\.reason\.trim\(\)/);
  assert.match(source, /\/mark-paid/);
  assert.match(source, /\/v1\/bills\/mark-all-paid/);
  assert.match(source, /"Idempotency-Key": retryKey\(scope\)/);
  assert.match(source, /\/v1\/payments\/\$\{payment\.ma_giao_dich\}\/cancel/);
  assert.match(source, /payment\.nguon_thanh_toan === "KHAU_TRU_COC"/);
  assert.match(source, /\/v1\/billing-adjustments/);
  assert.match(source, /escapeHtml/);
  assert.match(source, /button\.disabled = true/);
});

test("F.5 shared API client exposes status and server error code", () => {
  const source = read("core/api.js");
  assert.match(source, /error\.status = response\.status/);
  assert.match(source, /error\.code = code/);
  assert.match(source, /ADJUSTMENT_EXCEEDS_OUTSTANDING/);
});
