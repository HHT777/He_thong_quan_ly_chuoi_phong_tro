const test = require("node:test");
const assert = require("node:assert/strict");
const models = require("../src/models");
const service = require("../src/services/coTenant.service");

test("room context lists the same current occupants it counts, including members linked to older contracts", async (t) => {
  const contract = { ma_hop_dong: "contract-current", ma_phong: "room-1", ma_khach_thue: "tenant-1" };
  const room = { ma_phong: "room-1", ma_can: "building-1", so_phong: "101", so_nguoi_toi_da: 3, trang_thai: "DANG_THUE" };
  const people = [
    { ma_phong: "room-1", ma_hop_dong: "contract-old", ho_ten: "Person A", so_dien_thoai: "00000000001", cccd_giay_to: "TEST0001", trang_thai_cu_tru: "DANG_O" },
    { ma_phong: "room-1", ma_hop_dong: "contract-old", ho_ten: "Person B", so_dien_thoai: "00000000002", cccd_giay_to: "TEST0002", trang_thai_cu_tru: "DANG_O" },
  ];
  let roomReads = 0;
  t.mock.method(models.HopDong, "findAll", async () => [contract]);
  t.mock.method(models.PhongTro, "findAll", async () => [room]);
  t.mock.method(models.CanTro, "findAll", async () => [{ ma_can: "building-1", ten_can: "Building" }]);
  t.mock.method(models.KhachThue, "findByPk", async () => ({ so_dien_thoai: "00000000000" }));
  t.mock.method(models.YeuCau, "findAll", async () => []);
  t.mock.method(models.DeXuatBanCungPhong, "findAll", async () => []);
  t.mock.method(models.ThanhVienPhong, "findAll", async (options) => {
    if (options.where.ma_phong) { roomReads += 1; return people; }
    return [];
  });

  const result = await service.context({ ma_khach_thue: "tenant-1" });
  assert.equal(roomReads, 1);
  assert.equal(result.contracts[0].currentOccupants, 3);
  assert.deepEqual(result.roomMembers.map((person) => person.ho_ten), ["Person A", "Person B"]);
  assert.equal(result.roomMembers.every((person) => person.roomId === "room-1" && !person.isPrincipal), true);
  assert.equal(result.members.length, 0);
  assert.equal(result.roomMembers.some((person) => person.so_dien_thoai === "00000000001"), false);
});
