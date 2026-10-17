const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-195 contract screen pre-fills reservation and transfers only to server-listed vacant rooms", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/residents-contracts/contracts.tab.js"), "utf8");
  assert.match(source, /chi_so_dien_ban_dau/);
  assert.match(source, /da_co_ban_giay_ky/);
  assert.match(source, /ma_dat_giu/);
  assert.match(source, /\/hop-dong\/\$\{encodeURIComponent\(row\.ma_hop_dong\)\}\/history/);
  assert.match(source, /room\.trang_thai === "TRONG"/);
  assert.match(source, /finalElectricityReading/);
  assert.match(source, /initialElectricityReading/);
  assert.match(source, /\/transfers/);
  assert.match(source, /escapeHtml\(item\.detail\)/);
  assert.doesNotMatch(source, /\bfetch\(/);
});
