const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const auth = require("../src/middleware/auth");
const authorize = require("../src/middleware/authorize");
const { TaiKhoan } = require("../src/models");
const authService = require("../src/services/auth.service");

process.env.JWT_SECRET ||= "kt01-unit-session-secret";
process.env.JWT_EXPIRE ||= "1h";

function token(claims, options) {
  return jwt.sign({ passwordFingerprint: authService.passwordFingerprint("kt01-hash"), ...claims }, process.env.JWT_SECRET, options);
}

async function run(middleware, authorization) {
  const req = { headers: authorization ? { authorization } : {} };
  const res = {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextError;
  let passed = false;
  await middleware(req, res, (error) => { nextError = error; passed = !error; });
  return { req, res, passed, nextError };
}

test("KT-01 rejects absent, malformed and expired JWT before querying account", async (t) => {
  const original = TaiKhoan.findByPk;
  let reads = 0;
  TaiKhoan.findByPk = async () => { reads += 1; return null; };
  t.after(() => { TaiKhoan.findByPk = original; });
  for (const header of [undefined, "Bearer bad-token", `Bearer ${token({ ma_tai_khoan: 1, vai_tro: "CHU_TRO" }, { expiresIn: -1 })}`]) {
    const result = await run(auth, header);
    assert.equal(result.res.statusCode, 401);
    assert.equal(result.passed, false);
  }
  assert.equal(reads, 0);
});

test("KT-01 uses current tenant account state and rejects stale tenant or locked account", async (t) => {
  const original = TaiKhoan.findByPk;
  const account = { ma_tai_khoan: 7, ten_dang_nhap: "tenant", vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG", mat_khau: "kt01-hash", khachThue: { ma_khach_thue: 17 } };
  TaiKhoan.findByPk = async () => account;
  t.after(() => { TaiKhoan.findByPk = original; });
  const valid = await run(auth, `Bearer ${token({ ma_tai_khoan: 7, vai_tro: "KHACH_THUE", ma_khach_thue: 17 })}`);
  assert.equal(valid.passed, true);
  assert.equal(valid.req.user.ma_khach_thue, 17);
  for (const claims of [
    { ma_tai_khoan: 7, vai_tro: "KHACH_THUE", ma_khach_thue: 18 },
  ]) assert.equal((await run(auth, `Bearer ${token(claims)}`)).res.statusCode, 401);
  account.trang_thai = "DA_KHOA";
  assert.equal((await run(auth, `Bearer ${token({ ma_tai_khoan: 7, vai_tro: "KHACH_THUE", ma_khach_thue: 17 })}`)).res.statusCode, 401);
  account.trang_thai = "HOAT_DONG";
  TaiKhoan.findByPk = async () => null;
  assert.equal((await run(auth, `Bearer ${token({ ma_tai_khoan: 7, vai_tro: "KHACH_THUE", ma_khach_thue: 17 })}`)).res.statusCode, 401);
});

test("KT-01 role guard rejects tenant on owner route and owner on tenant route", async () => {
  for (const [role, allowed] of [["KHACH_THUE", "CHU_TRO"], ["CHU_TRO", "KHACH_THUE"]]) {
    const result = await run(authorize(allowed));
    const req = { user: { vai_tro: role } };
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    authorize(allowed)(req, res, () => { throw new Error("Forbidden role reached route"); });
    assert.equal(res.statusCode, 403);
    assert.equal(result.res.statusCode, 401);
  }
});

test("KT-01 tenant profile response does not expose password hash", async (t) => {
  const original = TaiKhoan.findByPk;
  TaiKhoan.findByPk = async (_id, options) => {
    assert.equal(options.include[0].as, "khachThue");
    return { ma_tai_khoan: 7, vai_tro: "KHACH_THUE", mat_khau: "private-hash", khachThue: { ma_khach_thue: 17 } };
  };
  t.after(() => { TaiKhoan.findByPk = original; });
  const profile = await authService.getProfile(7);
  assert.equal(profile.khachThue.ma_khach_thue, 17);
  assert.equal(Object.hasOwn(profile, "mat_khau"), false);
});

test("KT-01 existing login issues a signed token for the active tenant account", async (t) => {
  const original = TaiKhoan.findOne;
  TaiKhoan.findOne = async () => ({
    ma_tai_khoan: 7, ten_dang_nhap: "tenant", vai_tro: "KHACH_THUE",
    trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false, mat_khau: "kt01-hash",
    khachThue: { ma_khach_thue: 17 }, checkPassword: async (value) => value === "correct",
  });
  t.after(() => { TaiKhoan.findOne = original; });
  const result = await authService.login("tenant", "correct");
  assert.equal(result.user.vai_tro, "KHACH_THUE");
  assert.equal(result.user.ma_khach_thue, 17);
  assert.equal(jwt.verify(result.token, process.env.JWT_SECRET).ma_tai_khoan, 7);
  assert.equal(JSON.stringify(result).includes("correct"), false);
});

test("KT-01 existing login rejects wrong password and locked account without issuing a token", async (t) => {
  const original = TaiKhoan.findOne;
  const account = { trang_thai: "HOAT_DONG", checkPassword: async (value) => value === "correct" };
  TaiKhoan.findOne = async () => account;
  t.after(() => { TaiKhoan.findOne = original; });
  await assert.rejects(authService.login("tenant", "wrong"), { status: 401 });
  account.trang_thai = "DA_KHOA";
  await assert.rejects(authService.login("tenant", "correct"), { status: 403 });
});
