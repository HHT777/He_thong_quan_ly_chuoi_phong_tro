const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, HopDong, PhongTro, KhachThue, AuditLog } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("FR-184 owner can print only own contract; tenant forbidden and foreign/missing IDs opaque", async () => {
  const ownerA = await login(integration.landlord);
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `printb${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("LocalTest123", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Chủ trọ B", so_dien_thoai: "0987654321" });
  const ownerB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const rentalA = await createFreshRental(ownerA, "print-a");
  const rentalB = await createFreshRental(ownerB, "print-b", { createAccount: false });
  await HopDong.update({ gia_thue: 2100000, dieu_khoan: `<script>alert("x")</script> O'Neil` }, { where: { ma_hop_dong: rentalA.contract.ma_hop_dong } });
  await PhongTro.update({ gia_thue: 9900000, so_phong: rentalA.room.so_phong }, { where: { ma_phong: rentalB.room.ma_phong } });
  await KhachThue.update({ cccd_giay_to: "123456789012" }, { where: { ma_khach_thue: rentalA.tenant.ma_khach_thue } });
  const url = (id) => `/api/hop-dong/${id}/print`;
  const auditBefore = await AuditLog.count();
  const own = await fetch(`${integration.baseUrl}${url(rentalA.contract.ma_hop_dong)}`, { headers: headers(ownerA) });
  const html = await own.text();
  assert.equal(own.status, 200);
  assert.match(own.headers.get("content-type"), /text\/html/);
  assert.match(own.headers.get("cache-control"), /no-store/);
  assert.match(own.headers.get("content-security-policy"), /default-src 'none'/);
  assert.match(html, /2\.100\.000 đ/);
  assert.doesNotMatch(html, /9\.900\.000 đ|123456789012|<script>/);
  assert.match(html, /•••• 9012/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; O&#39;Neil/);
  assert.equal(await AuditLog.count(), auditBefore);

  const otherOwn = await fetch(`${integration.baseUrl}${url(rentalB.contract.ma_hop_dong)}`, { headers: headers(ownerB) });
  assert.equal(otherOwn.status, 200);
  const foreign = await request(url(rentalB.contract.ma_hop_dong), { headers: headers(ownerA) });
  const missing = await request(url("00000000-0000-0000-0000-000000000000"), { headers: headers(ownerA) });
  assert.equal(foreign.response.status, 404);
  assert.equal(missing.response.status, 404);
  assert.equal(foreign.body.code, "RESOURCE_NOT_FOUND");
  assert.equal(missing.body.code, "RESOURCE_NOT_FOUND");
  assert.equal(JSON.stringify(foreign.body), JSON.stringify(missing.body).replace(/"correlationId":"[^"]+"/, `"correlationId":"${foreign.body.correlationId}"`));
  const tenant = await request(url(rentalA.contract.ma_hop_dong), { headers: headers(rentalA.tenantToken) });
  assert.equal(tenant.response.status, 403);
});
