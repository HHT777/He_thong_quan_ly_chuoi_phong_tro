const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { TaiKhoan, ChuTro, CanTro, PhongTro } = require("../src/models");
const { integration, request, headers, login } = require("./helpers/integration-api");

test("FR-024/026 owner sees only owned rooms and opaque 404 for foreign building or room", async () => {
  const ownerA = await login(integration.landlord);
  const tenant = await login(integration.tenant);
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `room${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("room-owner-fixture", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  const profileB = await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Room owner B", so_dien_thoai: "0987654321" });
  const ownerB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const buildingB = await CanTro.create({ ma_chu_tro: profileB.ma_chu_tro, ten_can: "Other owner rooms", dia_chi: "Test" });
  const roomB = await PhongTro.create({ ma_can: buildingB.ma_can, so_phong: "SAME-101", dien_tich: 20, gia_thue: 2000000, so_nguoi_toi_da: 2, trang_thai: "TRONG" });
  try {
    const foreignBuilding = await request(`/api/phong?ma_can=${buildingB.ma_can}`, { headers: headers(ownerA) });
    assert.equal(foreignBuilding.response.status, 404, JSON.stringify(foreignBuilding.body));
    const accountA = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
    const profileA = await ChuTro.findOne({ where: { ma_tai_khoan: accountA.ma_tai_khoan } });
    const ownedA = await CanTro.findAll({ where: { ma_chu_tro: profileA.ma_chu_tro }, attributes: ["ma_can"], raw: true });
    const roomCountA = await PhongTro.count({ where: { ma_can: ownedA.map((row) => row.ma_can) } });
    const listA = await request("/api/phong?limit=1", { headers: headers(ownerA) });
    const listB = await request("/api/phong?limit=1", { headers: headers(ownerB) });
    assert.equal(listA.response.status, 200, JSON.stringify(listA.body));
    assert.equal(listB.response.status, 200, JSON.stringify(listB.body));
    assert.equal(listA.body.pagination.total, roomCountA);
    assert.equal(listB.body.pagination.total, 1);
    assert.ok(listA.body.data.every((row) => row.ma_can !== buildingB.ma_can));
    assert.deepEqual(listB.body.data.map((row) => row.ma_phong), [roomB.ma_phong]);

    const missingBuilding = await request("/api/phong?ma_can=00000000-0000-4000-8000-000000000001", { headers: headers(ownerA) });
    const foreignRoom = await request(`/api/phong/${roomB.ma_phong}`, { headers: headers(ownerA) });
    const missingRoom = await request("/api/phong/00000000-0000-4000-8000-000000000001", { headers: headers(ownerA) });
    for (const result of [foreignBuilding, missingBuilding, foreignRoom, missingRoom]) {
      assert.equal(result.response.status, 404, JSON.stringify(result.body));
      assert.equal(result.body.code, "RESOURCE_NOT_FOUND");
    }
    const ownRoom = await request(`/api/phong/${roomB.ma_phong}`, { headers: headers(ownerB) });
    assert.equal(ownRoom.response.status, 200, JSON.stringify(ownRoom.body));
    assert.equal(ownRoom.body.data.ma_phong, roomB.ma_phong);
    const tenantList = await request("/api/phong", { headers: headers(tenant) });
    assert.equal(tenantList.response.status, 403);
    const anonymousList = await request("/api/phong");
    assert.equal(anonymousList.response.status, 401);
  } finally {
    await roomB.destroy();
    await buildingB.destroy();
    await profileB.destroy();
    await accountB.destroy();
  }
});
