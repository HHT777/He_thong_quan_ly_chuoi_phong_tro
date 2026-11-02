const test = require("node:test");
const assert = require("node:assert/strict");
const { PhongTro } = require("../src/models");
const integration = require("./helpers/integration-env");
const baseUrl = integration.baseUrl;
async function request(path, options = {}) { const response = await fetch(`${baseUrl}${path}`, options); return { response, body: await response.json().catch(() => ({})) }; }
async function login({ username, password }) { const r = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ten_dang_nhap: username, mat_khau: password }) }); assert.equal(r.response.status, 200); return r.body.data.token; }
const headers = (token) => ({ Authorization: `Bearer ${token}`, "content-type": "application/json" });

test("UC-08/17/18/19/25 operations flow and ownership", async () => {
  const tenant = await login(integration.tenant);
  const landlord = await login(integration.landlord);
  const context = await request(`/api/v1/me/meter-reading-context?period=${new Date().toISOString().slice(0, 7)}`, { headers: { Authorization: `Bearer ${tenant}` } });
  assert.equal(context.response.status, 200);
  await PhongTro.update({ so_nguoi_toi_da: 99 }, { where: { ma_phong: context.body.data.room.id.replace("room_", "") } });
  const incident = await request("/api/v1/incidents", { method: "POST", headers: headers(tenant), body: JSON.stringify({ roomId: context.body.data.room.id.replace("room_", ""), title: "Nuoc ro", description: "Can sua voi" }) });
  assert.equal(incident.response.status, 201);
  const accepted = await request(`/api/v1/incidents/${incident.body.data.ma_su_co}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DANG_XU_LY" }) });
  assert.equal(accepted.response.status, 200);
  const completed = await request(`/api/v1/incidents/${incident.body.data.ma_su_co}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_XU_LY", responsible: "CHU_TRO", cost: 100000, note: "Da sua voi nuoc" }) });
  assert.equal(completed.response.status, 200);
  const reopen = await request(`/api/v1/incidents/${incident.body.data.ma_su_co}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DANG_XU_LY" }) });
  assert.equal(reopen.response.status, 409);
  const coTenant = await request("/api/v1/co-tenants", { method: "POST", headers: headers(tenant), body: JSON.stringify({
    name: "Nguoi O Test", phone: "0909000000", identityNumber: "079203009999",
    birthDate: "2003-06-15", gender: "NAM", permanentAddress: "TP Ho Chi Minh",
    relationship: "BAN", startDate: "2026-10-15", note: "Ban",
  }) });
  assert.equal(coTenant.response.status, 201);
  const approved = await request(`/api/v1/requests/${coTenant.body.data.request.ma_yeu_cau}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "DA_DUYET" }) });
  assert.equal(approved.response.status, 200);
  const rejectedProposal = await request("/api/v1/co-tenants", { method: "POST", headers: headers(tenant), body: JSON.stringify({
    name: "Nguoi Bi Tu Choi", phone: "0909000001", identityNumber: "079203009998", birthDate: "2004-06-15", gender: "NU",
    permanentAddress: "TP Ho Chi Minh", relationship: "BAN", startDate: "2026-11-01",
  }) });
  assert.equal(rejectedProposal.response.status, 201);
  const rejected = await request(`/api/v1/requests/${rejectedProposal.body.data.request.ma_yeu_cau}`, { method: "PATCH", headers: headers(landlord), body: JSON.stringify({ status: "TU_CHOI", reason: "Thiếu giấy xác nhận cư trú" }) });
  assert.equal(rejected.response.status, 200, JSON.stringify(rejected.body));
  assert.match((await request("/api/v1/notifications", { headers: { Authorization: `Bearer ${tenant}` } })).body.data.find((row) => row.khoa_su_kien?.includes(rejectedProposal.body.data.request.ma_yeu_cau))?.noi_dung || "", /Thiếu giấy xác nhận cư trú/);
  const notifications = await request("/api/v1/notifications", { headers: { Authorization: `Bearer ${tenant}` } });
  assert.equal(notifications.response.status, 200);
  const report = await request("/api/v1/reports/cashflow", { headers: { Authorization: `Bearer ${landlord}` } });
  assert.equal(report.response.status, 200);
  assert.ok(Number.isFinite(report.body.data.totalCollected));
});
