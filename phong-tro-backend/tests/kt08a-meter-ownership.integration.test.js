const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const http = require("node:http");
const { getUploadContext } = require("../src/config/uploadFilesystem");
const sequelize = require("../src/config/database");
const { TaiKhoan, ChuTro, ChiSoDien } = require("../src/models");
const service = require("../src/services/meterReading.service");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6WQAAAAASUVORK5CYII=", "base64");
const digest = (value) => crypto.createHash("sha256").update(value).digest("hex");
const uploadContext = getUploadContext();
const meterDir = uploadContext.resolve("meter");
uploadContext.mkdir(meterDir);
async function snapshot() {
  const db = {};
  for (const model of Object.values(sequelize.models)) {
    const rows = await model.findAll({ raw: true }); rows.sort((a, b) => String(a[model.primaryKeyAttribute]).localeCompare(String(b[model.primaryKeyAttribute])));
    db[model.name] = digest(JSON.stringify(rows));
  }
  const files = {};
  for (const name of fs.readdirSync(meterDir).sort()) files[name] = digest(fs.readFileSync(path.join(meterDir, name)));
  return { db, files };
}
const shape = (body) => ({ code: body.error?.code || body.code, message: body.error?.message || body.message, keys: Object.keys(body).sort(), errorKeys: Object.keys(body.error || {}).sort() });
async function checked(token, url, { method = "GET", body, expected = 200, immutable = method === "GET" || expected >= 400 } = {}) {
  const before = immutable ? await snapshot() : null;
  const result = await request(`/api/v1${url}`, { method, headers: headers(token, { "Idempotency-Key": crypto.randomUUID(), "If-Match": "*" }), ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(result.response.status, expected, `${method} ${url}: ${JSON.stringify(result.body)}`);
  if (immutable) assert.deepEqual(await snapshot(), before, `${method} ${url} must not change DB/audit/files`);
  return result.body;
}
async function preview(token, roomId, period, expected = 200) {
  const before = expected >= 400 ? await snapshot() : null;
  const form = new FormData();
  // Deliberately put the file before the scope fields: no disk write is allowed
  // while multipart ownership fields are still unavailable.
  form.append("file", new Blob([image], { type: "image/png" }), "meter.png");
  if (roomId != null) form.append("roomId", roomId);
  form.append("period", period);
  const result = await request("/api/v1/meter-readings/ocr-previews", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(result.response.status, expected, JSON.stringify(result.body));
  if (before) { assert.deepEqual(await snapshot(), before, "rejected multipart must not create files/audit/DB rows"); assert.equal(result.body.data?.uploadToken, undefined); }
  return result.body;
}
test("KT-08A every owner meter route rejects cross-building access without DB audit or upload effects; own flow and evidence survive TTL", async () => {
  assert.equal(process.env.OCR_BASE_URL, "http://127.0.0.1:18088");
  assert.ok(path.resolve(process.env.UPLOAD_DIR).startsWith(path.resolve(os.tmpdir()) + path.sep));
  assert.ok(!path.resolve(process.env.UPLOAD_DIR).startsWith(path.resolve(__dirname, "../..") + path.sep));
  let ocrCalls = 0; let ocrValue = null;
  const stub = http.createServer((req, res) => { ocrCalls += 1; req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(ocrValue == null ? { success: false } : { success: true, ocr_value: ocrValue })); }); });
  await new Promise((resolve, reject) => { stub.once("error", reject); stub.listen(18088, "127.0.0.1", resolve); });
  try {
    const ownerA = await login(integration.landlord);
    const accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
    const accountB = await TaiKhoan.create({ ten_dang_nhap: `k8a${Date.now()}`.slice(0, 15), mat_khau: "Kt08aOwner123", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
    await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "KT08A owner B", so_dien_thoai: "0987654308" });
    const ownerB = await login({ username: accountB.ten_dang_nhap, password: "Kt08aOwner123" });
    const a = await createFreshRental(ownerA, "kt08a-a"), b = await createFreshRental(ownerB, "kt08a-b");
    const pendingFile = path.join(meterDir, "kt08a-pending.png"), confirmedFile = path.join(meterDir, "kt08a-confirmed.png");
    uploadContext.writeFile(pendingFile, image); uploadContext.writeFile(confirmedFile, image);
    const make = (rental, actor, month, values = {}) => ChiSoDien.create({ ma_phong: rental.room.ma_phong, nam: 2026, thang: month, loai_chi_so: "DINH_KY", khoa_nghiep_vu: `DINH_KY:2026-${String(month).padStart(2, "0")}`, chi_so_moi: 20, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "CHO_XAC_NHAN", nguoi_ghi_nhan_id: actor, ngay_ghi_nhan: new Date("2026-10-28T01:00:00Z"), ...values });
    const readingA = await make(a, accountA.ma_tai_khoan, 10, { anh_cong_to_url: pendingFile });
    const readingB = await make(b, accountB.ma_tai_khoan, 10, { anh_cong_to_url: confirmedFile });
    const missing = crypto.randomUUID();
    const listed = await checked(ownerA, "/meter-readings?pageSize=100");
    assert.ok(listed.data.some((row) => row.id === readingA.ma_chi_so));
    assert.ok(listed.data.every((row) => row.room.buildingId !== b.building.ma_can));
    for (const field of ["buildingId", "roomId"]) {
      const foreign = field === "buildingId" ? b.building.ma_can : b.room.ma_phong;
      assert.deepEqual(shape(await checked(ownerA, `/meter-readings?${field}=${foreign}`, { expected: 404 })), shape(await checked(ownerA, `/meter-readings?${field}=${missing}`, { expected: 404 })));
    }
    for (const [method, suffix, body] of [["GET", "", null], ["PATCH", "", { readingValue: 30, reason: "KT08A" }], ["DELETE", "", { reason: "KT08A" }], ["POST", "/confirmations", {}], ["POST", "/correction-requests", {}]]) {
      const denied = await checked(ownerA, `/meter-readings/${readingB.ma_chi_so}${suffix}`, { method, body, expected: 404 });
      const absent = await checked(ownerA, `/meter-readings/${missing}${suffix}`, { method, body, expected: 404 });
      assert.equal(shape(denied).code, "RESOURCE_NOT_FOUND"); assert.deepEqual(shape(denied), shape(absent));
    }
    assert.deepEqual(shape(await checked(ownerA, `/private-files/${readingB.ma_chi_so}`, { expected: 404 })), shape(await checked(ownerA, `/private-files/${missing}`, { expected: 404 })));
    const callsBefore = ocrCalls;
    const foreignPreview = await preview(ownerA, b.room.ma_phong, "2026-11", 404);
    for (const roomId of [missing, undefined]) assert.deepEqual(shape(await preview(ownerA, roomId, "2026-11", 404)), shape(foreignPreview));
    await preview(a.tenantToken, a.room.ma_phong, "2026-11", 403); assert.equal(ocrCalls, callsBefore);
    // A valid signed token issued before an ownership change must not bypass
    // current ownership. Test fixture signs it; production never issues this now.
    for (const roomId of [b.room.ma_phong, missing]) {
      const uploadToken = service.signUploadPayload({ sub: accountA.ma_tai_khoan, tenantId: null, roomId, period: "2026-11", fileName: "kt08a-confirmed.png", ocrStatus: "RECOGNIZED", ocrValue: "50", exp: Date.now() + 60000 });
      const denied = await checked(ownerA, "/meter-readings/ocr-submit", { method: "POST", body: { period: "2026-11", readingValue: 50, uploadToken }, expected: 404 });
      assert.equal(shape(denied).code, "RESOURCE_NOT_FOUND");
    }
    const manual = { period: "2026-11", readingValue: 50 };
    assert.deepEqual(shape(await checked(ownerA, "/meter-readings/manual", { method: "POST", body: { ...manual, tenantId: b.tenant.ma_khach_thue }, expected: 404 })), shape(await checked(ownerA, "/meter-readings/manual", { method: "POST", body: { ...manual, tenantId: missing }, expected: 404 })));
    for (const [method, suffix] of [["PATCH", ""], ["DELETE", ""], ["POST", "/confirmations"]]) await checked(a.tenantToken, `/meter-readings/${readingA.ma_chi_so}${suffix}`, { method, body: { readingValue: 30, reason: "test" }, expected: 403 });
    await checked(a.tenantToken, "/meter-readings/manual", { method: "POST", body: { ...manual, tenantId: a.tenant.ma_khach_thue }, expected: 403 });
    await checked(a.tenantToken, "/meter-readings/ocr-submit", { method: "POST", body: {}, expected: 403 });
    const ownDetail = await checked(ownerA, `/meter-readings/${readingA.ma_chi_so}`); assert.equal(ownDetail.data.id, readingA.ma_chi_so);
    const beforeFile = await snapshot();
    const fileResponse = await fetch(`${integration.baseUrl}/api/v1/private-files/${readingA.ma_chi_so}`, { headers: headers(ownerA) });
    assert.equal(fileResponse.status, 200); assert.deepEqual(Buffer.from(await fileResponse.arrayBuffer()), image); assert.deepEqual(await snapshot(), beforeFile);
    await checked(ownerA, `/meter-readings/${readingA.ma_chi_so}`, { method: "PATCH", body: { readingValue: 30, reason: "KT08A own edit" } });
    assert.equal(Number((await readingA.reload()).chi_so_moi), 30);
    await checked(ownerA, `/meter-readings/${readingA.ma_chi_so}/confirmations`, { method: "POST", body: {} });
    assert.equal((await readingA.reload()).trang_thai_xac_nhan, "DA_XAC_NHAN");
    uploadContext.utimes(pendingFile, new Date(0), new Date(0)); uploadContext.utimes(confirmedFile, new Date(0), new Date(0));
    const orphan = path.join(meterDir, "kt08a-orphan.png"); uploadContext.writeFile(orphan, image); uploadContext.utimes(orphan, new Date(0), new Date(0));
    const dbBeforeCleanup = (await snapshot()).db;
    const ownPreview = await preview(ownerA, a.room.ma_phong, "2026-11");
    assert.equal(ownPreview.data.ocrStatus, "MANUAL_REQUIRED"); assert.ok(ownPreview.data.uploadToken);
    assert.match(ownPreview.data.warnings[0].message, /nhập tay/);
    assert.ok(fs.existsSync(pendingFile)); assert.ok(fs.existsSync(confirmedFile)); assert.equal(fs.existsSync(orphan), false);
    assert.deepEqual((await snapshot()).db, dbBeforeCleanup);
    const saved = await checked(ownerA, "/meter-readings/ocr-submit", { method: "POST", body: { period: "2026-11", readingValue: 50, uploadToken: ownPreview.data.uploadToken }, expected: 201 });
    assert.equal(saved.data.status, "DA_XAC_NHAN"); assert.equal(saved.data.readingValue, 50);
    ocrValue = "60"; const recognized = await preview(ownerA, a.room.ma_phong, "2026-12"); assert.equal(recognized.data.ocrStatus, "RECOGNIZED");
    await checked(ownerA, "/meter-readings/ocr-submit", { method: "POST", body: { period: "2026-12", readingValue: 60, uploadToken: recognized.data.uploadToken }, expected: 201 });
    const manuallySaved = await checked(ownerA, "/meter-readings/manual", { method: "POST", body: { period: "2027-01", readingValue: 80, tenantId: a.tenant.ma_khach_thue }, expected: 201 });
    assert.equal(manuallySaved.data.status, "DA_XAC_NHAN");
    const removable = await make(a, accountA.ma_tai_khoan, 8);
    await checked(ownerA, `/meter-readings/${removable.ma_chi_so}`, { method: "DELETE", body: { reason: "KT08A own removal" } }); assert.equal((await removable.reload()).da_xoa, true);
    await checked(ownerA, `/meter-readings/${readingA.ma_chi_so}/correction-requests`, { method: "POST", body: {}, expected: 409 });
    await checked(ownerB, `/meter-readings/${readingB.ma_chi_so}`);
  } finally { await new Promise((resolve) => stub.close(resolve)); }
});
