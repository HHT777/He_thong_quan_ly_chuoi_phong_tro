const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sequelize = require("../src/config/database");
const { TaiKhoan, KhachThue, AuditLog } = require("../src/models");
const authService = require("../src/services/auth.service");
const auth = require("../src/middleware/auth");

process.env.JWT_SECRET ||= "kt02-password-session-test-secret";
process.env.JWT_EXPIRE ||= "1h";

async function runAuth(token, route, method = "GET") {
  const baseUrl = route.startsWith("/api/auth/") ? "/api/auth" : "/api/v1";
  const path = route.slice(baseUrl.length);
  const req = { headers: { authorization: `Bearer ${token}` }, baseUrl, path, method };
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let passed = false;
  let nextError;
  await auth(req, res, (error) => { nextError = error; passed = !error; });
  return { passed, req, res, nextError };
}

test("KT-02 requires the old password and validates new input before writes", async (t) => {
  const originals = { transaction: sequelize.transaction, findByPk: TaiKhoan.findByPk, create: AuditLog.create };
  t.after(() => { sequelize.transaction = originals.transaction; TaiKhoan.findByPk = originals.findByPk; AuditLog.create = originals.create; });
  let updates = 0;
  let audits = 0;
  let reads = 0;
  sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });
  TaiKhoan.findByPk = async () => {
    reads += 1;
    return {
      ma_tai_khoan: "account-1", ten_dang_nhap: "tenant", vai_tro: "KHACH_THUE",
      bat_buoc_doi_mat_khau: false, mat_khau: "mock-hash",
      checkPassword: async () => false,
      update: async () => { updates += 1; },
    };
  };
  AuditLog.create = async () => { audits += 1; };
  for (const [oldPassword, newPassword, code] of [
    ["", "Valid1234", "CURRENT_PASSWORD_REQUIRED"],
    ["wrong", "short", "INVALID_NEW_PASSWORD"],
    ["wrong", "abcdefgh", "INVALID_NEW_PASSWORD"],
    ["wrong", "Valid1234", "CURRENT_PASSWORD_INCORRECT"],
  ]) {
    await assert.rejects(authService.changeTenantPassword("account-1", oldPassword, newPassword), { status: 422, code });
  }
  assert.equal(reads, 1);
  assert.equal(updates, 0);
  assert.equal(audits, 0);
});

test("KT-02 rotates token after a transactional password change; old and claimless tokens get 401", async (t) => {
  const originals = {
    transaction: sequelize.transaction, findByPk: TaiKhoan.findByPk,
    findTenant: KhachThue.findOne, createAudit: AuditLog.create,
  };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    TaiKhoan.findByPk = originals.findByPk;
    KhachThue.findOne = originals.findTenant;
    AuditLog.create = originals.createAudit;
  });
  const oldHash = await bcrypt.hash("1", 4);
  const account = {
    ma_tai_khoan: "account-1", ten_dang_nhap: "tenant", vai_tro: "KHACH_THUE",
    trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: true, mat_khau: oldHash,
    khachThue: { ma_khach_thue: "tenant-1" },
    checkPassword(password) { return bcrypt.compare(password, this.mat_khau); },
    async update(values) {
      this.mat_khau = await bcrypt.hash(values.mat_khau, 4);
      this.bat_buoc_doi_mat_khau = values.bat_buoc_doi_mat_khau;
    },
  };
  const audit = [];
  sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });
  TaiKhoan.findByPk = async () => account;
  KhachThue.findOne = async () => ({ ma_khach_thue: "tenant-1" });
  AuditLog.create = async (row) => { audit.push(row); return row; };
  const oldToken = authService.issueTenantSession(account, "tenant-1", true).token;
  const result = await authService.changeTenantPassword("account-1", "1", "Valid1234");
  assert.deepEqual(Object.keys(result).sort(), ["changed", "token", "user"]);
  assert.equal(result.user.mustChangePassword, false);
  assert.equal(result.user.bat_buoc_doi_mat_khau, false);
  assert.equal(audit.length, 1);
  assert.doesNotMatch(JSON.stringify(audit), /Valid1234|"mat_khau"|"token"|passwordFingerprint/);
  assert.doesNotMatch(JSON.stringify(result.user), /Valid1234|"mat_khau"|passwordFingerprint/);
  assert.equal(await bcrypt.compare("Valid1234", account.mat_khau), true);
  assert.equal((await runAuth(oldToken, "/api/auth/profile")).res.statusCode, 401);
  const claimless = jwt.sign({ ma_tai_khoan: "account-1", vai_tro: "KHACH_THUE", ma_khach_thue: "tenant-1" }, process.env.JWT_SECRET);
  assert.equal((await runAuth(claimless, "/api/auth/profile")).res.statusCode, 401);
  assert.equal((await runAuth(result.token, "/api/auth/profile")).passed, true);
  assert.equal((await runAuth(result.token, "/api/v1/notifications")).passed, true);
});

test("KT-02 initial tenant password token permits only profile and password route with 403 elsewhere", async (t) => {
  const original = TaiKhoan.findByPk;
  t.after(() => { TaiKhoan.findByPk = original; });
  const account = {
    ma_tai_khoan: "account-1", ten_dang_nhap: "tenant", vai_tro: "KHACH_THUE",
    trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: true, mat_khau: "hashed-password",
    khachThue: { ma_khach_thue: "tenant-1" },
  };
  TaiKhoan.findByPk = async () => account;
  const tenant = authService.issueTenantSession(account, "tenant-1", true).token;
  assert.equal((await runAuth(tenant, "/api/auth/profile")).passed, true);
  assert.equal((await runAuth(tenant, "/api/v1/account/password", "PATCH")).passed, true);
  for (const [route, method] of [["/api/v1/notifications", "GET"], ["/api/v1/account/password", "GET"]]) {
    const denied = await runAuth(tenant, route, method);
    assert.equal(denied.res.statusCode, 403);
    assert.equal(denied.res.body.code, "PASSWORD_CHANGE_REQUIRED");
  }
  const normalTenant = authService.issueTenantSession(account, "tenant-1").token;
  assert.equal((await runAuth(normalTenant, "/api/v1/notifications")).passed, true);
});

test("KT-02 login sets forced-change claim only for tenant password 1", async (t) => {
  const original = TaiKhoan.findOne;
  t.after(() => { TaiKhoan.findOne = original; });
  const account = {
    ma_tai_khoan: "account-1", ten_dang_nhap: "user", vai_tro: "KHACH_THUE",
    trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: true, mat_khau: "hashed-password",
    khachThue: { ma_khach_thue: "tenant-1" }, checkPassword: async () => true,
  };
  TaiKhoan.findOne = async () => account;
  assert.equal((await authService.login("user", "1")).user.mustChangePassword, true);
  assert.equal((await authService.login("user", "Normal1234")).user.mustChangePassword, false);
  account.vai_tro = "CHU_TRO";
  account.khachThue = null;
  assert.equal(Boolean((await authService.login("user", "1")).user.mustChangePassword), false);
});
