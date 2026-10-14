const assert = require("node:assert/strict");
const integration = require("./integration-env");

let sequence = 0;

async function request(path, options = {}) {
  const response = await fetch(`${integration.baseUrl}${path}`, options);
  return { response, body: await response.json().catch(() => ({})) };
}

function headers(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, "content-type": "application/json", ...extra };
}

async function login(credentials) {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ten_dang_nhap: credentials.username, mat_khau: credentials.password }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  return result.body.data.token;
}

function uniqueValues() {
  sequence += 1;
  const digits = `${Date.now()}${sequence}`.slice(-8);
  return {
    suffix: `${Date.now()}-${sequence}`,
    phone: `09${digits}`,
    identity: `IT${Date.now()}${sequence}`.slice(0, 20),
  };
}

async function createBaseRental(landlordToken, label = "integration") {
  const unique = uniqueValues();
  const building = await request("/api/management/can-tro", {
    method: "POST", headers: headers(landlordToken),
    body: JSON.stringify({ ten_can: `${label} ${unique.suffix}`, dia_chi: "Dia chi integration" }),
  });
  assert.equal(building.response.status, 201, JSON.stringify(building.body));
  const room = await request("/api/phong", {
    method: "POST", headers: headers(landlordToken),
    body: JSON.stringify({ ma_can: building.body.data.ma_can, so_phong: `IT-${unique.suffix}`, dien_tich: 25, gia_thue: 2500000, so_nguoi_toi_da: 2, trang_thai: "TRONG" }),
  });
  assert.equal(room.response.status, 201, JSON.stringify(room.body));
  const tenant = await request("/api/management/khach-thue", {
    method: "POST", headers: headers(landlordToken),
    body: JSON.stringify({ ho_ten: `Tenant ${unique.suffix}`, so_dien_thoai: unique.phone, cccd_giay_to: unique.identity }),
  });
  assert.equal(tenant.response.status, 201, JSON.stringify(tenant.body));
  return { building: building.body.data, room: room.body.data, tenant: tenant.body.data, unique };
}

async function createFreshRental(landlordToken, label = "integration", { createAccount = true } = {}) {
  const fresh = await createBaseRental(landlordToken, label);
  const contract = await request("/api/hop-dong", {
    method: "POST", headers: headers(landlordToken),
    body: JSON.stringify({
      ma_khach_thue: fresh.tenant.ma_khach_thue, ma_phong: fresh.room.ma_phong,
      ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30",
      gia_thue: 2500000, tien_coc: 2500000, don_gia_dien: 3500, don_gia_nuoc: 100000,
      dieu_khoan: "Integration test contract", ngay_nhan_coc: "2026-10-01",
    }),
  });
  assert.equal(contract.response.status, 201, JSON.stringify(contract.body));
  let account;
  let tenantToken;
  if (createAccount) {
    account = await request("/api/v1/accounts", {
      method: "POST", headers: headers(landlordToken),
      body: JSON.stringify({ tenantId: fresh.tenant.ma_khach_thue }),
    });
    assert.equal(account.response.status, 201, JSON.stringify(account.body));
    tenantToken = await login({ username: fresh.unique.phone, password: integration.newAccountPassword });
  }
  return { ...fresh, contract: contract.body.data, account: account?.body.data, tenantToken };
}

module.exports = { integration, request, headers, login, uniqueValues, createBaseRental, createFreshRental };
