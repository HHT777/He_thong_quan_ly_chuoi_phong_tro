const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("first-period bill rounds every charge to VND and keeps the total equal to its lines", async () => {
  const dependencies = {
    sequelize: { Op: {} },
    "../models": {},
    "./ownership.service": {},
    "./khoanPhaiThu.service": {},
    "./meterReading.service": {},
    "./billingAdjustmentDefinition.service": { applicable: async () => [{ ma_khoan_dieu_chinh: "fee-1", loai_khoan: "PHI_PHAT_SINH", so_tien: 1000.49, ten_ly_do: "Phụ thu" }] },
    "./occupancy.service": { countBillableOccupants: async () => 2, calculateWaterCharge: (price, count, ratio) => Math.round(Number(price) * count * ratio * 100) / 100 },
    "../utils/billingPeriod.util": require("../src/utils/billingPeriod.util"),
    "../domain/billing.constants": require("../src/domain/billing.constants"),
    "../utils/billLine.util": require("../src/utils/billLine.util"),
  };
  const file = path.resolve(__dirname, "../src/services/billGeneration.service.js");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), { module, exports: module.exports, require: (name) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; } }, { filename: file });
  const preview = await module.exports.buildPreview({ ma_hop_dong: "contract-1", ma_phong: "room-1", ngay_bat_dau: "2026-10-30", gia_thue: 2666667, don_gia_nuoc: 80000, phi_dich_vu: 100000 }, "2026-10");
  assert.equal(preview.components.water, 10323, "two occupants for two days of October");
  assert.equal(preview.adjustments[0].amount, 1000);
  assert.ok(preview.lines.every((line) => Number.isInteger(line.amount)));
  assert.equal(preview.total, preview.lines.reduce((sum, line) => sum + line.amount, 0));
  assert.match(preview.lineDescriptions.rent, /2\.666\.667 đ\/tháng; 2\/31 ngày/);
  assert.match(preview.lineDescriptions.water, /2 người × 80\.000 đ\/người; 2\/31 ngày/);
});
