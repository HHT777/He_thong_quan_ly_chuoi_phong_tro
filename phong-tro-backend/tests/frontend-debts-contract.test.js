const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/finance/debts.tab.js"), "utf8");

test("FR-165/172/173/196 debt screen groups server debt and separates post-liquidation debt", () => {
  assert.match(source, /get\("\/v1\/debt"\)/);
  assert.match(source, /debtGroup\?\.buildingId/);
  assert.match(source, /debtGroup\?\.roomId/);
  assert.match(source, /debtGroup\?\.tenantId/);
  assert.match(source, /row\.isOverdue/);
  assert.match(source, /row\.debtAgeDays/);
  assert.match(source, /Nhóm này không tham gia tuổi nợ định kỳ/);
  assert.doesNotMatch(source, /Date\.now\(\).*debtAge|new Date\(row\..*\).*debtAge/s);
});

test("FR-165 debt collection uses payload-bound idempotency and supports locked tenants", () => {
  assert.match(source, /post\("\/khoan-phai-thu\/payment\/create", payload/);
  assert.match(source, /"Idempotency-Key": requestKeys\.keyFor\(scope, payload\)/);
  assert.match(source, /requestKeys\.complete\(scope\)/);
  assert.match(source, /IDEMPOTENCY_CONFLICT/);
  assert.match(source, /Tạo yêu cầu mới/);
  assert.match(source, /tài khoản khách đã khóa/);
  assert.match(source, /integerVnd\(raw\.so_tien/);
  assert.match(source, /submit\.disabled = true/);
});

test("FR-165 debt screen escapes server-provided names and errors", () => {
  assert.match(source, /escapeHtml\(row\.hopDong\?\.khachThue\?\.ho_ten/);
  assert.match(source, /escapeHtml\(error\.message\)/);
});
