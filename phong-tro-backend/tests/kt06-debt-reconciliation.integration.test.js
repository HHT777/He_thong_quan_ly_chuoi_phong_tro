const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const sequelize = require("../src/config/database");
const { TaiKhoan, ChuTro, HopDong, TienCoc, ThanhToan, ChiTietThanhToan, GiaoDichThanhToan, KhoanThu } = require("../src/models");
const billing = require("../src/services/tenantBilling.service");
const debt = require("../src/services/debtLifecycle.service");
const bills = require("../src/services/khoanPhaiThu.service");
const { businessDate } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");
const root = "/api/khoan-phai-thu", summaryPath = "/api/v1/me/billing-summary";
async function snapshot() {
  const result = {};
  for (const model of Object.values(sequelize.models)) {
    const rows = await model.findAll({ raw: true });
    rows.sort((a, b) => String(a[model.primaryKeyAttribute]).localeCompare(String(b[model.primaryKeyAttribute])));
    result[model.name] = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }
  return result;
}
// fetch forbids GET bodies: use HTTP transport to verify they cannot select a tenant.
async function read(token, path, { body, extraHeaders = {}, status = 200 } = {}) {
  const before = await snapshot();
  let result;
  if (body) {
    const bytes = JSON.stringify(body);
    result = await new Promise((resolve, reject) => {
      const req = http.request(new URL(path, integration.baseUrl), { method: "GET", headers: headers(token, { ...extraHeaders, "content-length": Buffer.byteLength(bytes) }) }, (res) => {
        let raw = ""; res.on("data", (part) => { raw += part; }); res.on("end", () => resolve({ response: { status: res.statusCode }, body: JSON.parse(raw) }));
      }); req.on("error", reject); req.end(bytes);
    });
  } else result = await request(path, { headers: headers(token, extraHeaders) });
  assert.deepEqual(await snapshot(), before, `GET must not write: ${path}`);
  assert.equal(result.response.status, status, `${path}: ${JSON.stringify(result.body)}`);
  return result.body;
}
const errorShape = (body) => ({ code: body.error?.code || body.code, message: body.error?.message || body.message, keys: Object.keys(body).sort(), errorKeys: Object.keys(body.error || {}).sort() });

test("KT-06 debt reconciliation after close partial collection full collection cancellation and JWT scope", async () => {
  async function owner(label, phone) {
    const username = `k6${label}${Date.now()}`.slice(0, 15);
    const account = await TaiKhoan.create({ ten_dang_nhap: username, mat_khau: "Kt06Owner123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
    await ChuTro.create({ ma_tai_khoan: account.ma_tai_khoan, ho_ten: `KT06 owner ${label}`, so_dien_thoai: phone });
    return { token: await login({ username, password: "Kt06Owner123" }), user: { vai_tro: "CHU_TRO", ma_tai_khoan: account.ma_tai_khoan } };
  }
  const ownerA = await owner("a", "0987654306"), ownerB = await owner("b", "0987654307");
  const a = await createFreshRental(ownerA.token, "kt06-a"), b = await createFreshRental(ownerA.token, "kt06-b"), c = await createFreshRental(ownerB.token, "kt06-c");
  const user = { vai_tro: "KHACH_THUE", ma_khach_thue: a.tenant.ma_khach_thue, ma_tai_khoan: a.account.ma_tai_khoan };
  const [year, month] = businessDate().split("-").map(Number);
  const period = (offset) => { const date = new Date(Date.UTC(year, month - 1 + offset, 1)); return { nam: date.getUTCFullYear(), thang: date.getUTCMonth() + 1 }; };
  async function bill(contract, offset, total, { sent = true, type = "DINH_KY" } = {}) {
    const row = await ThanhToan.create({ ...period(offset), ma_hop_dong: contract.ma_hop_dong, loai_thanh_toan: type, tong_phai_tra: total, tong_da_thanh_toan: 0, so_tien_con_no: total, trang_thai: total ? "CHUA_THANH_TOAN" : "DA_THANH_TOAN", da_gui: sent, ngay_gui: sent ? new Date() : null });
    await ChiTietThanhToan.create({ ma_thanh_toan: row.ma_thanh_toan, loai_khoan: "TIEN_PHONG", so_tien: total, dien_giai: "KT06 stored amount" }); return row;
  }
  const old = await bill(a.contract, -1, 900), current = await bill(a.contract, 0, 1000), future = await bill(a.contract, 1, 777);
  const draft = await bill(a.contract, -2, 888, { sent: false }), post = await bill(a.contract, -1, 200, { sent: false, type: "SAU_THANH_LY" });
  const foreign = await bill(b.contract, 0, 5000), foreignOwner = await bill(c.contract, 0, 6000);
  const historical = await HopDong.create({ ...c.contract, ma_hop_dong: crypto.randomUUID(), ma_khach_thue: a.tenant.ma_khach_thue, ngay_bat_dau: "2025-01-01", ngay_ket_thuc: "2025-12-31", ngay_thanh_ly: "2025-12-31", trang_thai: "DA_THANH_LY" });
  await TienCoc.create({ ma_hop_dong: historical.ma_hop_dong, so_tien_coc: 0, trang_thai: "CHUA_NHAN", ngay_nhan_coc: null, so_tien_da_hoan: 0, so_tien_da_khau_tru: 0 });
  const shared = await bill(historical, -1, 300);
  for (const [parent, amount] of [[old, null], [old, 125], [current, null], [current, 125]]) {
    await GiaoDichThanhToan.create({ ma_thanh_toan: parent.ma_thanh_toan, so_tien: amount, trang_thai_xac_nhan: "CHO_XAC_NHAN", nguon_thanh_toan: "THU_TIEN" });
  }
  const otherPayment = await GiaoDichThanhToan.create({ ma_thanh_toan: foreign.ma_thanh_toan, so_tien: null, trang_thai_xac_nhan: "CHO_XAC_NHAN" });
  // Deposit offset is a stored ledger fixture; collection/cancellation below use real owner APIs.
  await GiaoDichThanhToan.create({ ma_thanh_toan: current.ma_thanh_toan, so_tien: 50, trang_thai_xac_nhan: "DA_XAC_NHAN", thoi_diem_xac_nhan: new Date(), nguon_thanh_toan: "KHAU_TRU_COC" });
  await sequelize.transaction((transaction) => bills.updateBillStatus(current.ma_thanh_toan, transaction));
  const closePeriod = period(-1);
  const closed = await debt.run({ now: new Date(Date.UTC(closePeriod.nam, closePeriod.thang - 1, 11, 1)), actorId: ownerA.user.ma_tai_khoan });
  assert.deepEqual(closed.errors, []); await old.reload(); assert.equal(old.da_chot_cong_no, true); assert.equal(Number(old.so_tien_chot_cong_no), 900);

  async function reconcile(remaining, paid) {
    const summary = (await read(a.tenantToken, summaryPath)).data;
    const tenantDebt = (await read(a.tenantToken, "/api/v1/debt")).data;
    const ownerDebtA = (await read(ownerA.token, "/api/v1/debt")).data;
    const ownerDebtB = (await read(ownerB.token, "/api/v1/debt")).data;
    const tenantDetail = (await read(a.tenantToken, `${root}/${old.ma_thanh_toan}`)).data;
    const ownerDetail = (await read(ownerA.token, `${root}/${old.ma_thanh_toan}`)).data;
    assert.equal(Number(tenantDetail.so_tien_con_no), remaining, `period=${closePeriod.nam}-${closePeriod.thang} tenant=A tenant detail vs expected`);
    assert.equal(Number(ownerDetail.so_tien_con_no), remaining, "owner detail vs tenant detail");
    assert.equal(Number(ownerDetail.so_tien_chot_cong_no), 900); assert.equal(Number(ownerDetail.tong_da_thanh_toan), paid);
    assert.equal(summary.current.remainingAmount, 950); assert.equal(summary.current.depositOffset, 50); assert.equal(summary.current.cashReceived, 0); assert.equal(summary.current.pendingCount, 2);
    assert.equal(summary.oldDebt.remainingAmount, remaining + 300); assert.equal(summary.totalRemainingDue, 950 + remaining + 300);
    assert.equal(summary.postLiquidationDebt.remainingAmount, 200);
    const ids = tenantDebt.map((r) => r.ma_thanh_toan);
    assert.equal(ids.includes(old.ma_thanh_toan), remaining > 0);
    assert.ok(!ids.includes(draft.ma_thanh_toan) && !ids.includes(future.ma_thanh_toan) && !ids.includes(foreign.ma_thanh_toan) && !ids.includes(foreignOwner.ma_thanh_toan));
    assert.equal(ownerDebtA.some((r) => r.ma_thanh_toan === future.ma_thanh_toan), true);
    assert.equal(ownerDebtA.some((r) => r.ma_thanh_toan === shared.ma_thanh_toan), false);
    assert.equal(ownerDebtB.some((r) => r.ma_thanh_toan === shared.ma_thanh_toan), true);
    assert.equal(tenantDebt.filter((r) => r.loai_thanh_toan === "DINH_KY").reduce((sum, r) => sum + Number(r.so_tien_con_no), 0), summary.totalRemainingDue);
    if (remaining > 0) { assert.equal(Number(tenantDebt.find((r) => r.ma_thanh_toan === old.ma_thanh_toan).so_tien_con_no), remaining); assert.equal(Number(ownerDebtA.find((r) => r.ma_thanh_toan === old.ma_thanh_toan).so_tien_con_no), remaining); }
    const history = (await read(a.tenantToken, `${root}/payment/list?ma_thanh_toan=${old.ma_thanh_toan}&limit=100`)).data;
    const valid = history.filter((r) => r.trang_thai_xac_nhan === "DA_XAC_NHAN");
    assert.equal(valid.reduce((sum, r) => sum + Number(r.so_tien), 0), paid);
    assert.equal(Number(tenantDetail.tong_phai_tra), remaining + paid);
    assert.equal(tenantDetail.chiTiets.reduce((sum, r) => sum + Number(r.so_tien), 0), 900);
    assert.equal(history.filter((r) => r.trang_thai_xac_nhan === "CHO_XAC_NHAN").length, 2);
    assert.doesNotMatch(JSON.stringify(tenantDebt), /so_tien_chot_cong_no|cccd|nguoi_gui_id/);
    return history;
  }
  await reconcile(900, 0);
  async function collect(amount, parent = old) {
    const result = await request(`${root}/payment/create`, { method: "POST", headers: headers(ownerA.token, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify({ ma_khoan_phai_thu: parent.ma_thanh_toan, so_tien: amount, ngay_thanh_toan: businessDate(), phuong_thuc: "CHUYEN_KHOAN" }) });
    assert.equal(result.response.status, 201, JSON.stringify(result.body)); return result.body.data;
  }
  const partial = await collect(200); await reconcile(700, 200);
  assert.equal(Number((await read(a.tenantToken, `${root}/payment/${partial.ma_giao_dich}`)).data.so_tien), 200);
  await collect(700); const paidHistory = await reconcile(0, 900); assert.equal(paidHistory.length, 4);
  const ownerSummary = (await read(ownerA.token, `/api/v1/bills/summary?ky=${closePeriod.nam}-${String(closePeriod.thang).padStart(2, "0")}&ma_can=${a.building.ma_can}`)).data;
  assert.equal(Number(ownerSummary.totalPaid), 900); assert.equal(Number(ownerSummary.totalDebt), 0);
  const cancel = await request(`/api/v1/payments/${partial.ma_giao_dich}/cancel`, { method: "POST", headers: headers(ownerA.token), body: JSON.stringify({ reason: "KT06 cancellation fixture" }) });
  assert.equal(cancel.response.status, 200, JSON.stringify(cancel.body)); await reconcile(200, 700);
  const receipt = await KhoanThu.findOne({ where: { ma_giao_dich_thanh_toan: partial.ma_giao_dich } }); assert.equal(receipt.trang_thai_ghi_nhan, "DA_HUY");
  await collect(5000, foreign);
  const zeroSummary = (await read(b.tenantToken, summaryPath)).data;
  assert.equal(zeroSummary.totalRemainingDue, 0); assert.equal(zeroSummary.current.count, 1);
  assert.deepEqual((await read(b.tenantToken, "/api/v1/debt")).data, []);
  assert.equal((await read(b.tenantToken, `${root}/${foreign.ma_thanh_toan}`)).data.trang_thai, "DA_THANH_TOAN");
  assert.equal((await read(b.tenantToken, `${root}/payment/list?ma_thanh_toan=${foreign.ma_thanh_toan}`)).data.length, 2);

  // Freeze business time via service arguments, never via a client-controlled route.
  const boundary = new Date(Date.UTC(year, month, 1, 0) - 7 * 3600000);
  for (const now of [new Date(boundary.getTime() - 1), boundary]) {
    const before = await snapshot();
    const summary = await billing.getSummary(user, { now });
    const projected = await billing.debtViews(await debt.listDebt({ tenantId: user.ma_khach_thue, requester: user, now }), user, now);
    assert.equal(projected.filter((r) => r.loai_thanh_toan === "DINH_KY").reduce((sum, r) => sum + Number(r.so_tien_con_no), 0), summary.totalRemainingDue);
    assert.equal(summary.current.remainingAmount, now < boundary ? 950 : 777);
    assert.equal(summary.oldDebt.remainingAmount, now < boundary ? 500 : 1450);
    assert.deepEqual(await snapshot(), before);
  }
  for (const key of ["tenantId", "khachThueId", "ma_khach_thue"]) {
    for (const path of ["/api/v1/debt", summaryPath]) await read(a.tenantToken, `${path}?${key}=${b.tenant.ma_khach_thue}`, { status: 400 });
    const hinted = await read(a.tenantToken, "/api/v1/debt", { body: { [key]: b.tenant.ma_khach_thue }, extraHeaders: { [key]: b.tenant.ma_khach_thue, "x-tenant-id": b.tenant.ma_khach_thue } });
    assert.ok(hinted.data.every((r) => ![foreign.ma_thanh_toan, foreignOwner.ma_thanh_toan].includes(r.ma_thanh_toan)));
    await read(a.tenantToken, summaryPath, { body: { [key]: b.tenant.ma_khach_thue }, status: 400 });
    assert.equal((await read(a.tenantToken, summaryPath, { extraHeaders: { [key]: b.tenant.ma_khach_thue } })).data.totalRemainingDue, 1450);
  }
  const absentBill = await read(a.tenantToken, `${root}/${crypto.randomUUID()}`, { status: 404 });
  for (const id of [foreign.ma_thanh_toan, foreignOwner.ma_thanh_toan]) assert.deepEqual(errorShape(await read(a.tenantToken, `${root}/${id}`, { status: 404 })), errorShape(absentBill));
  const absentPayment = await read(a.tenantToken, `${root}/payment/${crypto.randomUUID()}`, { status: 404 });
  assert.deepEqual(errorShape(await read(a.tenantToken, `${root}/payment/${otherPayment.ma_giao_dich}`, { status: 404 })), errorShape(absentPayment));
  assert.equal(errorShape(absentBill).code, "RESOURCE_NOT_FOUND"); await read(ownerA.token, summaryPath, { status: 403 });
  const claims = jwt.decode(a.tenantToken); delete claims.exp; delete claims.iat;
  const expired = jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: -1 }); await read(expired, "/api/v1/debt", { status: 401 });
});
