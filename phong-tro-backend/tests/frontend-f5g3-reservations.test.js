const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-167..170 reservation screen uses server overdue, vacant rooms and cancellation response", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/residents-contracts/reservations.tab.js"), "utf8");
  assert.match(source, /room\.trang_thai === "TRONG"/);
  assert.match(source, /row\.quaHan/);
  assert.match(source, /post\("\/v1\/reservations"/);
  assert.match(source, /\/extend`/);
  assert.match(source, /\/cancel`/);
  assert.match(source, /result\.data\.so_tien_hoan/);
  assert.match(source, /qlpt:contract-reservation/);
  assert.doesNotMatch(source, /\bfetch\(/);
});
