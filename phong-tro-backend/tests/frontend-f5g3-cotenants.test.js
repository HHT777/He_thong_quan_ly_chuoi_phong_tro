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
  assert.match(source, /co-tenant-proposals/);
  assert.match(source, /identityNumber/);
  assert.match(source, /currentOccupants/);
  assert.match(source, /CO_TENANT_IDENTITY_INCOMPLETE/);
  assert.doesNotMatch(source, /\bfetch\(/);
});

test("FR-166 generic requests screen does not approve co-tenant proposal without identity detail", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/residents-contracts/requests.tab.js"), "utf8");
  assert.match(source, /item\.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG"/);
  assert.match(source, /Cần đối chiếu hồ sơ định danh/);
  assert.match(source, /#\/residents-contracts\/co-tenants/);
  assert.match(source, /requiredText\(raw\.reason/);
  assert.doesNotMatch(source, /window\.(alert|prompt|confirm)/);
});

test("FR-166 resident actions use shared escaped confirmation dialog", () => {
  const view = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/shared/components/view.js"), "utf8");
  assert.match(view, /export function confirmAction/);
  assert.match(view, /\[data-confirm-message\]"\)\.textContent = message/);
  assert.match(view, /if \(result === false\) return/);
});
