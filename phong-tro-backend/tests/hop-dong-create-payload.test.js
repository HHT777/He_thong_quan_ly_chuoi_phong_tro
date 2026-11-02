const test = require("node:test");
const assert = require("node:assert/strict");
const { createHopDong } = require("../src/validations/hopDong.validation");

const contract = { ma_phong: "room-a", ngay_bat_dau: "2026-11-01", ngay_ket_thuc: "2027-11-01", gia_thue: 1000000, tien_coc: 1000000, don_gia_dien: 8700, chi_so_dien_ban_dau: 12000, don_gia_nuoc: 80000, dieu_khoan: "Điều khoản", da_co_ban_giay_ky: true };

test("contract creation accepts exactly one tenant source", () => {
  const existing = { ...contract, ma_khach_thue: "123" };
  const fresh = { ...contract, khachThue: { ho_ten: "Khách mới", so_dien_thoai: "0912345678", cccd_giay_to: "012345678901" } };
  assert.equal(createHopDong.validate(existing).error, undefined);
  assert.equal(createHopDong.validate(fresh).error, undefined);
  assert.ok(createHopDong.validate(contract).error);
  assert.ok(createHopDong.validate({ ...existing, khachThue: fresh.khachThue }).error);
  assert.ok(createHopDong.validate({ ...contract, khachThue: { ...fresh.khachThue, so_dien_thoai: "abc" } }).error);
});
