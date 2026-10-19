const test = require("node:test");
const assert = require("node:assert/strict");
const integration = require("./helpers/integration-env");
const { ThanhToan, GiaoDichThanhToan } = require("../src/models");
const { createFreshRental } = require("./helpers/integration-api");

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

  const missingKey = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord),
    body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, so_tien: firstAmount, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(missingKey.response.status, 400);

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
  assert.equal(repeated.body.data.ma_giao_dich, first.body.data.ma_giao_dich);

  const conflictingAmount = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord, { "Idempotency-Key": paymentKey }),
    body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, ngay_thanh_toan: new Date().toISOString(), so_tien: firstAmount + 1, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(conflictingAmount.response.status, 409);

  const otherBill = listed.body.data.find((item) => item.ma_thanh_toan !== bill.ma_thanh_toan && Number(item.so_tien_con_no) > 0);
  assert.ok(otherBill, "seed must contain another outstanding bill");
  const conflictingBill = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord, { "Idempotency-Key": paymentKey }),
    body: JSON.stringify({ ma_khoan_phai_thu: otherBill.ma_thanh_toan, ngay_thanh_toan: new Date().toISOString(), so_tien: firstAmount, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(conflictingBill.response.status, 409);

  const overpay = await request("/api/khoan-phai-thu/payment/create", {
    method: "POST",
    headers: headers(landlord, { "Idempotency-Key": `finance-over-${Date.now()}` }),
    body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, ngay_thanh_toan: new Date().toISOString(), so_tien: total, phuong_thuc: "CHUYEN_KHOAN" }),
  });
  assert.equal(overpay.response.status, 409);
  assert.equal(overpay.body.error?.code || overpay.body.code, "PAYMENT_EXCEEDS_OUTSTANDING");

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
  assert.ok(Number(stats.body.data.cash_collected) >= firstAmount);
  assert.ok(Number(stats.body.data.deposit_offset) >= 0);
});

test("FR-143 report and finance query routes reject invalid filters", async () => {
  const landlord = await login(integration.landlord);
  const bad = [
    ["/api/v1/reports/cashflow?periodType=month", "REPORT_PERIOD_INCOMPLETE"],
    ["/api/v1/reports/cashflow?periodType=week&periodValue=2026-10", "REPORT_PERIOD_TYPE_INVALID"],
    ["/api/v1/reports/cashflow?periodType=month&periodValue=2026-13", "REPORT_PERIOD_VALUE_INVALID"],
    ["/api/v1/reports/cashflow?periodType=year&periodValue=2026&from=2026-01-01", "REPORT_PERIOD_CONFLICT"],
    ["/api/v1/reports/cashflow?other=x", "INVALID_QUERY_PARAMETER"],
    ["/api/khoan-phai-thu/payment/stats?startDate=2026-02-30&endDate=2026-12-31", "INVALID_QUERY_PARAMETER"],
    ["/api/khoan-phai-thu?ky=2026-13", "INVALID_QUERY_PARAMETER"],
    ["/api/v1/debt?surprise=1", "INVALID_QUERY_PARAMETER"],
    ["/api/v1/meter-readings?page=one", "INVALID_QUERY_PARAMETER"],
  ];
  for (const [url, code] of bad) {
    const response = await request(url, { headers: { Authorization: `Bearer ${landlord}` } });
    assert.equal(response.response.status, 400, `${url}: ${JSON.stringify(response.body)}`);
    assert.equal(response.body.error?.code || response.body.code, code, url);
  }
  const missing = await request("/api/v1/reports/cashflow?periodType=year&periodValue=2026&buildingId=00000000-0000-4000-8000-000000000001", { headers: { Authorization: `Bearer ${landlord}` } });
  assert.equal(missing.response.status, 404, JSON.stringify(missing.body));
  assert.equal(missing.body.error.code, "RESOURCE_NOT_FOUND");
});

test("FR-143 partial payments use distinct keys, retry safely and serialize overpayment", async () => {
  const landlord = await login(integration.landlord);
  const rental = await createFreshRental(landlord, "partial-race");
  const bill = await ThanhToan.create({ ma_hop_dong: rental.contract.ma_hop_dong, nam: 2027, thang: 8, loai_thanh_toan: "DINH_KY", tong_phai_tra: 1000, tong_da_thanh_toan: 0, so_tien_con_no: 1000, trang_thai: "CHUA_THANH_TOAN" });
  const pay = (amount, key) => request("/api/khoan-phai-thu/payment/create", { method: "POST", headers: headers(landlord, { "Idempotency-Key": key }), body: JSON.stringify({ ma_khoan_phai_thu: bill.ma_thanh_toan, so_tien: amount, phuong_thuc: "CHUYEN_KHOAN", ngay_thanh_toan: "2026-10-17" }) });
  const keyA = `partial-a-${bill.ma_thanh_toan}`;
  const keyB = `partial-b-${bill.ma_thanh_toan}`;
  const first = await pay(100, keyA);
  const second = await pay(200, keyB);
  assert.equal(first.response.status, 201, JSON.stringify(first.body));
  assert.equal(second.response.status, 201, JSON.stringify(second.body));
  assert.notEqual(first.body.data.ma_giao_dich, second.body.data.ma_giao_dich);
  const repeat = await pay(100, keyA);
  assert.equal(repeat.response.status, 201);
  assert.equal(repeat.body.data.ma_giao_dich, first.body.data.ma_giao_dich);
  const conflict = await pay(101, keyA);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.code, "IDEMPOTENCY_CONFLICT");
  const over = await pay(701, `partial-over-${bill.ma_thanh_toan}`);
  assert.equal(over.response.status, 409);
  assert.equal(over.body.code, "PAYMENT_EXCEEDS_OUTSTANDING");
  const raced = await Promise.all([pay(500, `partial-c-${bill.ma_thanh_toan}`), pay(500, `partial-d-${bill.ma_thanh_toan}`)]);
  assert.deepEqual(raced.map(({ response }) => response.status).sort(), [201, 409]);
  await bill.reload();
  assert.equal(Number(bill.so_tien_con_no), 200);
  assert.equal(await GiaoDichThanhToan.count({ where: { ma_thanh_toan: bill.ma_thanh_toan } }), 3);
});
