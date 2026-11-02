const test = require("node:test");
const assert = require("node:assert/strict");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("KT-02 tenant initial password is restricted until changed; old JWT is rejected and new JWT works", async () => {
  const ownerToken = await login(integration.landlord);
  const fresh = await createFreshRental(ownerToken, "kt02-password", { createAccount: false });
  const account = await request("/api/v1/accounts", {
    method: "POST", headers: headers(ownerToken),
    body: JSON.stringify({ tenantId: fresh.tenant.ma_khach_thue }),
  });
  assert.equal(account.response.status, 201);

  const wrongLogin = await request("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ten_dang_nhap: fresh.unique.phone, mat_khau: "wrong" }),
  });
  assert.equal(wrongLogin.response.status, 401);
  assert.equal(wrongLogin.body.data?.token, undefined);

  const initialLogin = await request("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ten_dang_nhap: fresh.unique.phone, mat_khau: "1" }),
  });
  assert.equal(initialLogin.response.status, 200);
  assert.equal(initialLogin.body.data.user.mustChangePassword, true);
  const oldToken = initialLogin.body.data.token;
  const restricted = await request("/api/v1/notifications", { headers: headers(oldToken) });
  assert.equal(restricted.response.status, 403);
  assert.equal(restricted.body.error?.code || restricted.body.code, "PASSWORD_CHANGE_REQUIRED");
  const profile = await request("/api/auth/profile", { headers: headers(oldToken) });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.mustChangePassword, true);
  assert.equal(profile.body.data.khachThue.ho_ten, fresh.tenant.ho_ten);
  assert.doesNotMatch(JSON.stringify(profile.body), /matKhauHash|passwordFingerprint|"mat_khau"|"token"/);

  for (const body of [
    { currentPassword: "1" },
    { currentPassword: "1", newPassword: "short" },
    { currentPassword: "wrong", newPassword: integration.newAccountPassword },
  ]) {
    const rejected = await request("/api/v1/account/password", {
      method: "PATCH", headers: headers(oldToken), body: JSON.stringify(body),
    });
    assert.equal(rejected.response.status, 422);
    assert.equal(rejected.body.data?.token, undefined);
    assert.doesNotMatch(JSON.stringify(rejected.body), /passwordFingerprint|matKhauHash|"mat_khau"/);
  }

  const changed = await request("/api/v1/account/password", {
    method: "PATCH", headers: headers(oldToken),
    body: JSON.stringify({ currentPassword: "1", newPassword: integration.newAccountPassword }),
  });
  assert.equal(changed.response.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.data.changed, true);
  assert.equal(changed.body.data.user.mustChangePassword, false);
  assert.ok(changed.body.data.token);
  assert.doesNotMatch(JSON.stringify(changed.body), /passwordFingerprint|matKhauHash|"mat_khau"/);

  assert.equal((await request("/api/auth/profile", { headers: headers(oldToken) })).response.status, 401);
  assert.equal((await request("/api/auth/profile", { headers: headers(changed.body.data.token) })).response.status, 200);
  assert.equal((await request("/api/v1/notifications", { headers: headers(changed.body.data.token) })).response.status, 200);
  assert.equal((await request("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ten_dang_nhap: fresh.unique.phone, mat_khau: "1" }),
  })).response.status, 401);
  assert.ok(await login({ username: fresh.unique.phone, password: integration.newAccountPassword }));
  assert.equal((await request("/api/auth/profile", { headers: headers(ownerToken) })).response.status, 200);

  const ownerChanged = await request("/api/v1/account/password", {
    method: "PATCH", headers: headers(ownerToken),
    body: JSON.stringify({ currentPassword: integration.landlord.password, newPassword: "Kt02Owner1234" }),
  });
  assert.equal(ownerChanged.response.status, 200);
  assert.equal(ownerChanged.body.data.user.vai_tro, "CHU_TRO");
  assert.equal(ownerChanged.body.data.user.mustChangePassword, false);
  assert.equal((await request("/api/auth/profile", { headers: headers(ownerToken) })).response.status, 401);
  assert.equal((await request("/api/auth/profile", { headers: headers(ownerChanged.body.data.token) })).response.status, 200);
  assert.ok(await login({ username: integration.landlord.username, password: "Kt02Owner1234" }));
});
