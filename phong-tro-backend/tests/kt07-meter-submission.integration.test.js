const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const sequelize = require("../src/config/database");
const { TaiKhoan, ChuTro, HopDong, ChiSoDien, ThanhToan, ChiTietThanhToan } = require("../src/models");
const service = require("../src/services/meterReading.service");
const { businessMonth } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createFreshRental, createBaseRental } = require("./helpers/integration-api");
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=", "base64");
async function snapshot() {
  const result = {};
  for (const model of Object.values(sequelize.models)) {
    const rows = await model.findAll({ raw: true }); rows.sort((a, b) => String(a[model.primaryKeyAttribute]).localeCompare(String(b[model.primaryKeyAttribute])));
    result[model.name] = crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  }
  return result;
}
const shape = (body) => ({ code: body.error?.code || body.code, message: body.error?.message || body.message, keys: Object.keys(body).sort(), errorKeys: Object.keys(body.error || {}).sort() });
async function json(token, path, body, expected = 200, extra = {}) {
  const before = await snapshot();
  const result = await request(`/api/v1${path}`, { method: body == null ? "GET" : "POST", headers: headers(token, { "Idempotency-Key": crypto.randomUUID(), ...extra }), ...(body == null ? {} : { body: JSON.stringify(body) }) });
  assert.equal(result.response.status, expected, JSON.stringify(result.body));
  if (body == null || expected >= 400) assert.deepEqual(await snapshot(), before, path);
  return result.body.data ?? result.body;
}
test("KT-07 tenant image-only OCR signed scope oldest period replacement race and owner regression", async () => {
  // Runner must point exclusively to this stub; never start or contact the real OCR.
  assert.equal(process.env.OCR_BASE_URL, "http://127.0.0.1:18087");
  let mode = "150";
  const stub = http.createServer((req, res) => { req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(mode === "fail" ? { success: false } : { success: true, ocr_value: mode })); }); });
  await new Promise((resolve, reject) => { stub.once("error", reject); stub.listen(18087, "127.0.0.1", resolve); });
  try {
    const owner = await login(integration.landlord);
    const account = await TaiKhoan.create({ ten_dang_nhap: `k7b${Date.now()}`.slice(0, 15), mat_khau: "Kt07Owner123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
    await ChuTro.create({ ma_tai_khoan: account.ma_tai_khoan, ho_ten: "KT07 B", so_dien_thoai: "0987654308" });
    const ownerB = await login({ username: account.ten_dang_nhap, password: "Kt07Owner123" });
    const a = await createFreshRental(owner, "kt07-a"), b = await createFreshRental(owner, "kt07-b"), c = await createFreshRental(ownerB, "kt07-c");
    const noContract = await createBaseRental(owner, "kt07-no-contract");
    // A valid account without an active contract is linked explicitly in this fixture.
    const noAccount = await TaiKhoan.create({ ten_dang_nhap: `k7n${Date.now()}`.slice(0, 15), mat_khau: "Kt07NoContract123", vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
    await require("../src/models").KhachThue.update({ ma_tai_khoan: noAccount.ma_tai_khoan }, { where: { ma_khach_thue: noContract.tenant.ma_khach_thue } });
    const noToken = await login({ username: noAccount.ten_dang_nhap, password: "Kt07NoContract123" });
    await json(noToken, "/me/meter-reading-context", null, 404);
    await json(owner, "/me/meter-reading-context", null, 403);
    const month = businessMonth(), [year, m] = month.split("-").map(Number);
    // Put two additional missing months before the current period; no client chooses them.
    const start = new Date(Date.UTC(year, m - 3, 1));
    const first = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
    await HopDong.update({ ngay_bat_dau: `${first}-01` }, { where: { ma_hop_dong: a.contract.ma_hop_dong } });
    await ChiSoDien.update({ nam: start.getUTCFullYear(), thang: start.getUTCMonth() + 1, ngay_ghi_nhan: new Date(`${first}-01T00:00:00+07:00`), chi_so_moi: 120 }, { where: { ma_phong: a.room.ma_phong } });
    const context = await json(a.tenantToken, "/me/meter-reading-context");
    assert.equal(context.period, first); assert.equal(context.isLate, true); assert.equal(context.previousReading.value, 120);
    assert.equal(context.deadline, undefined);
    async function preview(token, fields = {}, content = image, expected = 200) {
      const before = await snapshot(); const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.append(key, value);
      form.append("file", new Blob([content], { type: "image/png" }), "meter.png");
      const result = await request("/api/v1/me/meter-reading-ocr-previews", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      assert.equal(result.response.status, expected, JSON.stringify(result.body)); assert.deepEqual(await snapshot(), before);
      return result.body.data ?? result.body;
    }
    await json(a.tenantToken, "/me/meter-readings", { period: first, readingValue: 150 }, 400);
    for (const key of ["tenantId", "roomId", "khachThueId"]) {
      await json(a.tenantToken, `/me/meter-reading-context?${key}=${b.room.ma_phong}`, null, 400);
      await preview(a.tenantToken, { [key]: b.room.ma_phong }, image, 400);
      await json(a.tenantToken, "/me/meter-readings", { [key]: b.room.ma_phong }, 400);
    }
    await json(a.tenantToken, "/me/meter-reading-context", null, 400, { "x-room-id": b.room.ma_phong });
    const futureDate = new Date(Date.UTC(year, m, 1)); const future = `${futureDate.getUTCFullYear()}-${String(futureDate.getUTCMonth() + 1).padStart(2, "0")}`;
    await preview(a.tenantToken, { period: future }, image, 409);
    await preview(a.tenantToken, { period: "2000-01" }, image, 409);
    await preview(a.tenantToken, {}, Buffer.from("not a PNG"), 415);
    mode = "fail"; const failed = await preview(a.tenantToken);
    assert.equal(failed.ocrStatus, "MANUAL_REQUIRED"); assert.equal(failed.canSubmit, false); assert.equal(failed.uploadToken, null);
    assert.match(failed.warnings[0].message, /liên hệ Chủ trọ/); assert.doesNotMatch(failed.warnings[0].message, /nhập tay/);
    const badSigned = service.signUploadPayload({ sub: a.account.ma_tai_khoan, tenantId: a.tenant.ma_khach_thue, contractId: a.contract.ma_hop_dong, roomId: a.room.ma_phong, period: first, ocrStatus: "MANUAL_REQUIRED", ocrValue: null, fileName: "none", exp: Date.now() + 60000 });
    await json(a.tenantToken, "/me/meter-readings", { uploadToken: badSigned }, 400);
    mode = "119"; const below = await preview(a.tenantToken); assert.equal(below.canSubmit, false);
    await json(a.tenantToken, "/me/meter-readings", { period: first, uploadToken: below.uploadToken }, 422);
    mode = "150"; const good = await preview(a.tenantToken);
    const decoded = JSON.parse(Buffer.from(good.uploadToken.split(".")[0], "base64url").toString());
    const signed = (change) => service.signUploadPayload({ ...decoded, ...change });
    for (const change of [{ roomId: b.room.ma_phong }, { contractId: b.contract.ma_hop_dong }]) await json(a.tenantToken, "/me/meter-readings", { uploadToken: signed(change) }, 404);
    for (const token of [b.tenantToken, c.tenantToken]) await json(token, "/me/meter-readings", { uploadToken: good.uploadToken }, 422);
    const [encoded, signature] = good.uploadToken.split(".");
    const altered = Buffer.from(JSON.stringify({ ...decoded, ocrValue: "999" })).toString("base64url"); assert.notEqual(altered, encoded);
    await json(a.tenantToken, "/me/meter-readings", { uploadToken: `${altered}.${signature}` }, 422);
    await json(a.tenantToken, "/me/meter-readings", { uploadToken: good.uploadToken, period: month }, 409);
    const payload = { uploadToken: good.uploadToken, period: first };
    const race = await Promise.all([0, 1].map(() => request("/api/v1/me/meter-readings", { method: "POST", headers: headers(a.tenantToken, { "Idempotency-Key": crypto.randomUUID() }), body: JSON.stringify(payload) })));
    assert.ok(race.every((r) => [201, 409].includes(r.response.status)), JSON.stringify(race.map((r) => r.body)));
    assert.ok(race.some((r) => r.response.status === 201));
    const saved = race.find((r) => r.response.status === 201).body.data;
    assert.equal(saved.readingValue, 150); assert.equal(saved.status, "CHO_XAC_NHAN");
    assert.equal(await ChiSoDien.count({ where: { ma_phong: a.room.ma_phong, loai_chi_so: "DINH_KY", nam: start.getUTCFullYear(), thang: start.getUTCMonth() + 1 } }), 1);
    const unchanged = await snapshot(); await json(a.tenantToken, "/me/meter-readings", payload, 201); assert.deepEqual(await snapshot(), unchanged);
    mode = "160"; const replacement = await preview(a.tenantToken); const changed = await json(a.tenantToken, "/me/meter-readings", { uploadToken: replacement.uploadToken, period: first }, 201);
    assert.equal(changed.id, saved.id); assert.equal(changed.readingValue, 160);
    const absent = await json(b.tenantToken, `/meter-readings/${crypto.randomUUID()}`, null, 404);
    assert.deepEqual(shape(await json(b.tenantToken, `/meter-readings/${saved.id}`, null, 404)), shape(absent));
    assert.deepEqual(shape(await json(c.tenantToken, `/meter-readings/${saved.id}`, null, 404)), shape(absent));
    assert.equal(shape(absent).code, "RESOURCE_NOT_FOUND");
    await json(owner, `/meter-readings/${saved.id}/confirmations`, {}, 200, { "If-Match": '"fixture"' });
    await json(a.tenantToken, "/me/meter-readings", { uploadToken: replacement.uploadToken, period: first }, 409);
    const next = await json(a.tenantToken, "/me/meter-reading-context"); assert.equal(next.previousReading.value, 160); assert.notEqual(next.period, first);
    // A draft bill for M+1 closes M even though it is not sent, with no cancellation state invented.
    const billDate = new Date(Date.UTC(year, m, 1));
    const bill = await ThanhToan.create({ ma_hop_dong: b.contract.ma_hop_dong, nam: billDate.getUTCFullYear(), thang: billDate.getUTCMonth() + 1,
      loai_thanh_toan: "DINH_KY", tong_phai_tra: 100, tong_da_thanh_toan: 0, so_tien_con_no: 100, trang_thai: "CHUA_THANH_TOAN", da_gui: false });
    await ChiTietThanhToan.create({ ma_thanh_toan: bill.ma_thanh_toan, loai_khoan: "TIEN_PHONG", so_tien: 100, dien_giai: "KT07 draft fixture" });
    const closed = await json(b.tenantToken, "/me/meter-reading-context"); assert.equal(closed.submissionWindowOpen, false); assert.equal(closed.period, null);
    await preview(b.tenantToken, { period: month }, image, 409);
    // The current owner UI submits its manually entered fallback via ocr-submit.
    // Use a period without the contract-initial reading (which deliberately blocks manual).
    mode = "fail";
    const ownerForm = new FormData(); ownerForm.append("period", future); ownerForm.append("roomId", c.room.ma_phong);
    ownerForm.append("file", new Blob([image], { type: "image/png" }), "owner.png");
    const ownerPreview = await request("/api/v1/meter-readings/ocr-previews", { method: "POST", headers: { Authorization: `Bearer ${ownerB}` }, body: ownerForm });
    assert.equal(ownerPreview.response.status, 200); assert.equal(ownerPreview.body.data.ocrStatus, "MANUAL_REQUIRED");
    assert.match(ownerPreview.body.data.warnings[0].message, /nhập tay/);
    const ownerManual = await json(ownerB, "/meter-readings/ocr-submit", { period: future, readingValue: 50, uploadToken: ownerPreview.body.data.uploadToken }, 201);
    assert.equal(ownerManual.status, "DA_XAC_NHAN"); assert.equal(ownerManual.readingValue, 50);
    await json(a.tenantToken, "/meter-readings/manual", { tenantId: a.tenant.ma_khach_thue, period: future, readingValue: 50 }, 403);
  } finally { await new Promise((resolve) => stub.close(resolve)); }
});
