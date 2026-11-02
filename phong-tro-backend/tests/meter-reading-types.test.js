const test = require("node:test");
const assert = require("node:assert/strict");
const { toDto } = require("../src/services/meterReading.service");

test("FR-065/183 DTO preserves all reading types and schema legacy default", () => {
  for (const type of ["DINH_KY", "DAU_HOP_DONG", "CHOT_TRA_PHONG", "CHUYEN_PHONG"]) {
    assert.equal(toDto({ ma_chi_so: "r", nam: 2026, thang: 10, ma_phong: "p", chi_so_moi: 10, don_gia_ap_dung: 3500, loai_chi_so: type }).readingType, type);
  }
  assert.equal(toDto({ ma_chi_so: "r", nam: 2026, thang: 10, ma_phong: "p", chi_so_moi: 10, don_gia_ap_dung: 3500 }).readingType, "DINH_KY");
});
