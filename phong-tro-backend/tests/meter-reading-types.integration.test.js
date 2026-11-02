const test = require("node:test");
const assert = require("node:assert/strict");
const { ChiSoDien, TaiKhoan } = require("../src/models");
const { integration, request, headers, login, createFreshRental } = require("./helpers/integration-api");

test("FR-065/183 history API returns four persisted reading types", async () => {
  const landlord = await login(integration.landlord);
  const fresh = await createFreshRental(landlord, "meter-types");
  const actor = await TaiKhoan.findOne({ where: { ten_dang_nhap: integration.landlord.username } });
  const types = ["DINH_KY", "DAU_HOP_DONG", "CHOT_TRA_PHONG", "CHUYEN_PHONG"];
  for (const [index, type] of types.entries()) await ChiSoDien.create({ ma_phong: fresh.room.ma_phong, nam: 2027, thang: 2, loai_chi_so: type, khoa_nghiep_vu: `TEST_TYPE:${index}:${fresh.room.ma_phong}`, chi_so_moi: index + 1, don_gia_ap_dung: 3500, trang_thai_xac_nhan: "CHO_XAC_NHAN", nguoi_ghi_nhan_id: actor.ma_tai_khoan });
  const response = await request("/api/v1/meter-readings?period=2027-02&pageSize=100", { headers: headers(landlord) });
  assert.equal(response.response.status, 200, JSON.stringify(response.body));
  const actual = response.body.data.filter((row) => row.room.id === fresh.room.ma_phong).map((row) => row.readingType).sort();
  assert.deepEqual(actual, [...types].sort());
});
