const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { TaiKhoan, ChuTro, CanTro, PhongTro, DatGiuPhong, ThanhToan, HopDong } = require("../src/models");
const { businessMonth } = require("../src/utils/businessDate.util");
const { integration, request, headers, login } = require("./helpers/integration-api");

test("BE-1 dashboard summary partitions real rooms and periodic bills by landlord", async () => {
  const ownerA = await login(integration.landlord);
  const tenant = await login(integration.tenant);
  const accountB = await TaiKhoan.create({
    ten_dang_nhap: `dash${Date.now()}`.slice(0, 15), mat_khau: await bcrypt.hash("dashboard-fixture", 10),
    vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: false,
  });
  const profileB = await ChuTro.create({ ma_tai_khoan: accountB.ma_tai_khoan, ho_ten: "Dashboard B", so_dien_thoai: "0987654321" });
  const ownerB = jwt.sign({ ma_tai_khoan: accountB.ma_tai_khoan, ten_dang_nhap: accountB.ten_dang_nhap, vai_tro: "CHU_TRO" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const buildingB = await CanTro.create({ ma_chu_tro: profileB.ma_chu_tro, ten_can: "Dashboard B building", dia_chi: "Test" });
  const roomB = await PhongTro.create({ ma_can: buildingB.ma_can, so_phong: "B-101", dien_tich: 20, gia_thue: 2000000, so_nguoi_toi_da: 2, trang_thai: "DA_GIU" });
  const holdB = await DatGiuPhong.create({ ma_phong: roomB.ma_phong, ho_ten_nguoi_giu: "Holder B", so_dien_thoai: "0912345678", so_tien_giu: 100000, ngay_nhan: "2026-10-01", han_giu: "2026-10-31", dieu_kien: "Test", trang_thai: "DANG_GIU", nguoi_thuc_hien_id: accountB.ma_tai_khoan });
  try {
    const period = "2026-10";
    const a = await request(`/api/v1/dashboard/summary?period=${period}`, { headers: headers(ownerA) });
    const b = await request(`/api/v1/dashboard/summary?period=${period}`, { headers: headers(ownerB) });
    assert.equal(a.response.status, 200, JSON.stringify(a.body));
    assert.equal(b.response.status, 200, JSON.stringify(b.body));
    const profileA = await ChuTro.findOne({ where: { ma_tai_khoan: (await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } })).ma_tai_khoan } });
    for (const [result, profile] of [[a, profileA], [b, profileB]]) {
      const buildings = await CanTro.findAll({ where: { ma_chu_tro: profile.ma_chu_tro }, attributes: ["ma_can"], raw: true });
      const buildingIds = buildings.map((row) => row.ma_can);
      const rooms = await PhongTro.findAll({ where: { ma_can: { [Op.in]: buildingIds } }, attributes: ["trang_thai"], raw: true });
      const bills = await ThanhToan.findAll({
        where: { nam: 2026, thang: 10, loai_thanh_toan: "DINH_KY" },
        include: [{ model: HopDong, as: "hopDong", required: true,
          include: [{ model: PhongTro, as: "phongTro", required: true, where: { ma_can: { [Op.in]: buildingIds } } }] }],
      });
      const data = result.body.data;
      assert.equal(data.period, period);
      assert.equal(data.rooms.total, rooms.length);
      assert.equal(Object.values(data.rooms.byStatus).reduce((sum, value) => sum + value, 0), data.rooms.total);
      assert.equal(data.rooms.byStatus.DA_GIU, rooms.filter((room) => room.trang_thai === "DA_GIU").length);
      assert.equal(data.bills.total, bills.length);
      assert.equal(data.bills.daThu, bills.filter((bill) => Number(bill.so_tien_con_no) === 0).length);
      assert.equal(data.bills.conNo, bills.filter((bill) => Number(bill.so_tien_con_no) > 0 && !bill.qua_han).length);
      assert.equal(data.bills.quaHan, bills.filter((bill) => Number(bill.so_tien_con_no) > 0 && bill.qua_han).length);
      assert.equal(data.bills.daThu + data.bills.conNo + data.bills.quaHan, data.bills.total);
    }
    assert.equal(b.body.data.rooms.total, 1);
    assert.equal(b.body.data.rooms.byStatus.DA_GIU, 1);
    assert.equal(b.body.data.bills.total, 0);
    console.log(`[BE-1 dashboard sample] ${JSON.stringify({ ownerA: a.body.data, ownerB: b.body.data })}`);
    const defaultPeriod = await request("/api/v1/dashboard/summary", { headers: headers(ownerA) });
    assert.equal(defaultPeriod.response.status, 200);
    assert.equal(defaultPeriod.body.data.period, businessMonth());
    for (const invalid of ["2026-13", "2026-1", "2026-10-01"]) {
      const result = await request(`/api/v1/dashboard/summary?period=${invalid}`, { headers: headers(ownerA) });
      assert.equal(result.response.status, 400);
      assert.equal(result.body.error.code, "INVALID_PERIOD");
    }
    const forbidden = await request(`/api/v1/dashboard/summary?period=${period}`, { headers: headers(tenant) });
    assert.equal(forbidden.response.status, 403);
    const anonymous = await request(`/api/v1/dashboard/summary?period=${period}`);
    assert.equal(anonymous.response.status, 401);
  } finally {
    await holdB.destroy();
    await roomB.destroy();
    await buildingB.destroy();
    await profileB.destroy();
    await accountB.destroy();
  }
});
