const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { TaiKhoan, ChuTro, KhachThue, HopDong, PhongTro, ViPhamHopDong, AuditLog } = require("../src/models");
const { businessDate, addBusinessDays } = require("../src/utils/businessDate.util");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

const errorCode = (result) => result.body.error?.code || result.body.code;
const errorShape = (result) => ({
  status: result.response.status,
  code: errorCode(result),
  message: result.body.error?.message || result.body.message,
  keys: Object.keys(result.body).sort(),
});

test("KT-03 contracts and violations are scoped to the tenant and landlord; expiring is landlord-only", async () => {
  const ownerA = await login(integration.landlord);
  const ownerBName = `kt03b${Date.now()}`.slice(0, 15);
  const ownerBPassword = "Kt03OwnerB123";
  const ownerBAccount = await TaiKhoan.create({
    ten_dang_nhap: ownerBName, mat_khau: ownerBPassword, vai_tro: "CHU_TRO",
    trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  await ChuTro.create({ ma_tai_khoan: ownerBAccount.ma_tai_khoan, ho_ten: "Chủ trọ B", so_dien_thoai: "0987654399" });
  const ownerB = await login({ username: ownerBName, password: ownerBPassword });
  const rentalA = await createFreshRental(ownerA, "kt03-owner-a");
  const sameOwnerOtherTenant = await createFreshRental(ownerA, "kt03-same-owner-other-tenant");
  const rentalB = await createFreshRental(ownerB, "kt03-owner-b");
  const missingId = crypto.randomUUID();

  const ownList = await request("/api/hop-dong?limit=100", { headers: headers(rentalA.tenantToken) });
  assert.equal(ownList.response.status, 200);
  assert.deepEqual(ownList.body.data.map((row) => row.ma_hop_dong), [rentalA.contract.ma_hop_dong]);
  assert.equal(ownList.body.data[0].phongTro.canTro.ten_can, rentalA.building.ten_can);
  const ownerList = await request("/api/hop-dong?limit=100", { headers: headers(ownerA) });
  assert.equal(ownerList.response.status, 200);
  assert.ok(ownerList.body.data.some((row) => row.ma_hop_dong === rentalA.contract.ma_hop_dong));
  assert.ok(!ownerList.body.data.some((row) => row.ma_hop_dong === rentalB.contract.ma_hop_dong));

  await PhongTro.update({ gia_thue: 9000000 }, { where: { ma_phong: rentalA.room.ma_phong } });
  const ownDetail = await request(`/api/hop-dong/${rentalA.contract.ma_hop_dong}`, { headers: headers(rentalA.tenantToken) });
  assert.equal(ownDetail.response.status, 200);
  assert.equal(Number(ownDetail.body.data.gia_thue), 2500000);
  assert.equal(ownDetail.body.data.phongTro.canTro.ten_can, rentalA.building.ten_can);
  assert.equal((await request(`/api/hop-dong/${rentalA.contract.ma_hop_dong}/history`, { headers: headers(rentalA.tenantToken) })).response.status, 200);

  const ownViolation = await request(`/api/v1/contracts/${rentalA.contract.ma_hop_dong}/violations`, {
    method: "POST", headers: headers(ownerA), body: JSON.stringify({ content: "Ghi chú <script>1</script>", clause: "Điều 1", fine: 0 }),
  });
  assert.equal(ownViolation.response.status, 201, JSON.stringify(ownViolation.body));
  const tenantViolations = await request(`/api/v1/contracts/${rentalA.contract.ma_hop_dong}/violations`, { headers: headers(rentalA.tenantToken) });
  assert.equal(tenantViolations.response.status, 200);
  assert.equal(tenantViolations.body.data.length, 1);
  assert.equal((await request(`/api/v1/contracts/${rentalA.contract.ma_hop_dong}/violations`, {
    method: "POST", headers: headers(rentalA.tenantToken), body: JSON.stringify({ content: "Sai quyền", clause: "Điều 1" }),
  })).response.status, 403);

  const beforeDenials = { violations: await ViPhamHopDong.count(), audits: await AuditLog.count() };
  for (const [token, foreignContract] of [
    [rentalA.tenantToken, sameOwnerOtherTenant.contract.ma_hop_dong],
    [rentalA.tenantToken, rentalB.contract.ma_hop_dong],
    [ownerA, rentalB.contract.ma_hop_dong],
  ]) {
    for (const suffix of ["", "/history"]) {
      const foreign = await request(`/api/hop-dong/${foreignContract}${suffix}`, { headers: headers(token) });
      const absent = await request(`/api/hop-dong/${missingId}${suffix}`, { headers: headers(token) });
      assert.deepEqual(errorShape(foreign), errorShape(absent));
      assert.equal(errorCode(foreign), "RESOURCE_NOT_FOUND");
    }
    const foreign = await request(`/api/v1/contracts/${foreignContract}/violations`, { headers: headers(token) });
    const absent = await request(`/api/v1/contracts/${missingId}/violations`, { headers: headers(token) });
    assert.deepEqual(errorShape(foreign), errorShape(absent));
    assert.equal(errorCode(foreign), "RESOURCE_NOT_FOUND");
  }
  for (const targetId of [rentalB.contract.ma_hop_dong, missingId]) {
    const denied = await request(`/api/v1/contracts/${targetId}/violations`, {
      method: "POST", headers: headers(ownerA), body: JSON.stringify({ content: "Không được ghi", clause: "Điều 1" }),
    });
    assert.equal(denied.response.status, 404);
    assert.equal(errorCode(denied), "RESOURCE_NOT_FOUND");
  }
  assert.deepEqual({ violations: await ViPhamHopDong.count(), audits: await AuditLog.count() }, beforeDenials);

  const noContractName = `kt03empty${Date.now()}`.slice(0, 15);
  const noContractPassword = "Kt03Empty123";
  const noContractAccount = await TaiKhoan.create({ ten_dang_nhap: noContractName, mat_khau: noContractPassword, vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false });
  await KhachThue.create({ ma_tai_khoan: noContractAccount.ma_tai_khoan, ho_ten: "Khách chưa có hợp đồng", so_dien_thoai: `09${String(Date.now()).slice(-8)}`, cccd_giay_to: `KT03${Date.now()}`.slice(0, 20) });
  const noContractToken = await login({ username: noContractName, password: noContractPassword });
  const empty = await request("/api/hop-dong", { headers: headers(noContractToken) });
  assert.equal(empty.response.status, 200);
  assert.deepEqual(empty.body.data, []);
  await KhachThue.destroy({ where: { ma_tai_khoan: noContractAccount.ma_tai_khoan } });
  await TaiKhoan.destroy({ where: { ma_tai_khoan: noContractAccount.ma_tai_khoan } });

  const update = await request(`/api/hop-dong/${rentalA.contract.ma_hop_dong}`, {
    method: "PUT", headers: headers(ownerA), body: JSON.stringify({ gia_thue: 2700000, reason: "Thỏa thuận giá mới" }),
  });
  assert.equal(update.response.status, 200, JSON.stringify(update.body));
  const history = await request(`/api/hop-dong/${rentalA.contract.ma_hop_dong}/history`, { headers: headers(rentalA.tenantToken) });
  assert.ok(history.body.data.some((entry) => entry.type === "CHANGE" && JSON.stringify(entry.data.sau_json).includes("2700000")));

  const soon = addBusinessDays(businessDate(), 5);
  await HopDong.update({ ngay_ket_thuc: soon, trang_thai: "SAP_HET_HAN" }, { where: { ma_hop_dong: [rentalA.contract.ma_hop_dong, rentalB.contract.ma_hop_dong] } });
  assert.equal((await request("/api/hop-dong/expiring", { headers: headers(rentalA.tenantToken) })).response.status, 403);
  const ownerExpiring = await request("/api/hop-dong/expiring", { headers: headers(ownerA) });
  assert.equal(ownerExpiring.response.status, 200);
  assert.ok(ownerExpiring.body.data.some((row) => row.ma_hop_dong === rentalA.contract.ma_hop_dong));
  assert.ok(!ownerExpiring.body.data.some((row) => row.ma_hop_dong === rentalB.contract.ma_hop_dong));
});
