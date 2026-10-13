const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const service = require("../src/services/tenantAccount.service");

const source = (relativePath) => fs.readFileSync(path.resolve(__dirname, "../src", relativePath), "utf8");

test("CT-009 derives username only from the tenant phone", () => {
  assert.equal(service.usernameFor({ so_dien_thoai: " 0901234567 " }), "0901234567");
  assert.throws(() => service.usernameFor({ so_dien_thoai: "" }), (error) => error.code === "INVALID_TENANT_PHONE");
});

test("CT-009 account creation checks contract and deposit in one transaction", () => {
  const accountService = source("services/tenantAccount.service.js");
  const route = source("routes/mvp.routes.js");
  assert.match(accountService, /sequelize\.transaction/);
  assert.match(accountService, /requireRentalEligibility/);
  assert.match(accountService, /HopDong\.findOne/);
  assert.match(accountService, /TienCoc\.findOne/);
  assert.match(accountService, /ten_dang_nhap: username/);
  assert.match(accountService, /mat_khau: "1"/);
  assert.match(accountService, /vai_tro: "KHACH_THUE"/);
  assert.doesNotMatch(accountService.slice(accountService.indexOf("function accountDto"), accountService.indexOf("function usernameFor")), /\n\s+mat_khau:/);
  const createRoute = route.slice(route.indexOf('router.post("/accounts"'), route.indexOf('router.patch("/accounts/:id/status"'));
  assert.match(createRoute, /tenantAccountService\.create\(req\.body\.tenantId\)/);
  assert.doesNotMatch(createRoute, /req\.body\.(username|password)/);
});
