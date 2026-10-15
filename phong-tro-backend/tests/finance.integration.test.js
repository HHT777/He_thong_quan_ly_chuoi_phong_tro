const test = require("node:test");
const assert = require("node:assert/strict");
const integration = require("./helpers/integration-env");

const baseUrl = integration.baseUrl;
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json().catch(() => ({})) };
}
async function login({ username, password }) {
  const result = await request("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ten_dang_nhap: username, mat_khau: password }),
  });
  assert.equal(result.response.status, 200);
  return result.body.data.token;
}
function headers(token, extra = {}) { return { Authorization: `Bearer ${token}`, "content-type": "application/json", ...extra }; }

test("UC-20/22/11/12/23 real finance flow: bill, multiple payments, debt and overpay rollback", async () => {
  const landlord = await login(integration.landlord);
  const listed = await request("/api/khoan-phai-thu?limit=100", {
    headers: { Authorization: `Bearer ${landlord}` },
  });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
  const bill = listed.body.data.find((item) => Number(item.so_tien_con_no) > 1);
  assert.ok(bill, "seed must contain an outstanding bill");
  const total = Number(bill.so_tien_con_no);
  const firstAmount = Math.max(1, Math.floor(total / 2));

  const paymentKey = `finance-${Date.now()}-1`;
  const first = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord, { "Idempotency-Key": paymentKey }),
    body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, ngay_thanh_toan: new Date().toISOString(), so_tien: firstAmount, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(first.response.status, 201);
  const repeated = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord, { "Idempotency-Key": paymentKey }),
    body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, ngay_thanh_toan: new Date().toISOString(), so_tien: firstAmount, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(repeated.response.status, 201);
  assert.equal(repeated.body.data.ma_thanh_toan, first.body.data.ma_thanh_toan);

  const overpay = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord, { "Idempotency-Key": `finance-over-${Date.now()}` }),
    body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, ngay_thanh_toan: new Date().toISOString(), so_tien: total, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(overpay.response.status, 422);

  const debt = await request("/api/v1/debt", { headers: { Authorization: `Bearer ${landlord}` } });
  assert.equal(debt.response.status, 200);
  const debtBill = debt.body.data.find((item) => item.ma_thanh_toan === bill.ma_thanh_toan);
  assert.equal(Number(debtBill.tong_da_thanh_toan), Number(bill.tong_da_thanh_toan) + firstAmount);
  assert.equal(Number(debtBill.so_tien_con_no), total - firstAmount);

  const stats = await request(`/api/khoan-phai-thu/payment/stats?startDate=2026-01-01&endDate=2026-12-31`, {
    headers: { Authorization: `Bearer ${landlord}` },
  });
  assert.equal(stats.response.status, 200, JSON.stringify(stats.body));
  assert.equal(Array.isArray(stats.body.data), false);
  assert.ok(Number(stats.body.data.count) >= 1);
  assert.ok(Number(stats.body.data.total_amount) >= firstAmount);
});
