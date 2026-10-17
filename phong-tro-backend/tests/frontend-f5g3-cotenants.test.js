const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("FR-166 co-tenant screen shows identity, validates rejection and next-period departure", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/residents-contracts/co-tenants.tab.js"), "utf8");
  for (const field of ["cccd_giay_to", "ngay_sinh", "gioi_tinh", "dia_chi_thuong_tru", "quan_he"]) assert.match(source, new RegExp(field));
  assert.match(source, /requiredText\(raw\.reason/);
  assert.match(source, /raw\.leaveDate < nextPeriod\(\)/);
  assert.match(source, /status: "DA_ROI"/);
  assert.match(source, /không trả đủ thông tin định danh/);
  assert.doesNotMatch(source, /\bfetch\(/);
});
