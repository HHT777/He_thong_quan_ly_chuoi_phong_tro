const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateBill,
  calculateWaterBill,
} = require("../src/utils/calculation.util");

test("BR-03 calculates VND bill components without negative totals", () => {
  const result = calculateBill(
    { gia_thue: 3000000, phi_dich_vu: 150000 },
    { thanh_tien: 105000, tien_nuoc: 100000 },
    { gia_tri_giam: 50000 },
  );
  assert.deepEqual(result, {
    tien_phong: 3000000,
    tien_dien: 105000,
    tien_nuoc: 100000,
    phi_dich_vu: 150000,
    phi_phat_sinh: 0,
    khoan_giam_tru: 50000,
    tong_phai_thanh_toan: 3305000,
  });
});

test("BR-23 water amount is based on occupants and not meter OCR", () => {
  assert.equal(calculateWaterBill(3), 300000);
});
