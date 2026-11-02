const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHopDong } = require("../src/validations/hopDong.validation");

const validContract = {
  ma_khach_thue: "tenant-id",
  ma_phong: "room-id",
  ngay_bat_dau: "2026-10-01",
  ngay_ket_thuc: "2027-09-30",
  gia_thue: 2500000,
  tien_coc: 2500000,
  don_gia_dien: 3500,
  chi_so_dien_ban_dau: 0,
  don_gia_nuoc: 100000,
  dieu_khoan: "Hop dong test",
};

test("FR-036/182 requires an explicit signed-paper confirmation", () => {
  assert.ok(createHopDong.validate(validContract).error);
  assert.ok(createHopDong.validate({ ...validContract, da_co_ban_giay_ky: false }).error);
  assert.equal(createHopDong.validate({ ...validContract, da_co_ban_giay_ky: true }).error, undefined);
});

test("contract client sends the signed-paper confirmation as a boolean", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../phong-tro-frontend/src/modules/residents-contracts/contracts.tab.js"),
    "utf8",
  );
  assert.match(source, /name:\s*"da_co_ban_giay_ky"[\s\S]*type:\s*"checkbox"/);
  assert.match(source, /da_co_ban_giay_ky:\s*raw\.da_co_ban_giay_ky\s*===\s*"true"/);
  assert.match(source, /chi_so_dien_ban_dau:\s*Number\(raw\.chi_so_dien_ban_dau\)/);
});
