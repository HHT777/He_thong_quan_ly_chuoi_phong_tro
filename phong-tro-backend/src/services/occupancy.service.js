const { ThanhVienPhong } = require("../models");

async function countBillableOccupants(contractId, options = {}) {
  const coTenants = await ThanhVienPhong.count({
    where: { ma_hop_dong: contractId, trang_thai_cu_tru: "DANG_O" },
    transaction: options.transaction,
  });
  return 1 + coTenants;
}

function calculateWaterCharge(unitPrice, occupantCount, ratio = 1) {
  const price = Number(unitPrice);
  const count = Number(occupantCount);
  const periodRatio = Number(ratio);
  if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error("Đơn giá nước trên hợp đồng không hợp lệ"), { status: 422, code: "INVALID_WATER_UNIT_PRICE" });
  if (!Number.isInteger(count) || count < 1) throw Object.assign(new Error("Không có người đang ở để tính tiền nước"), { status: 422, code: "MISSING_BILLABLE_OCCUPANTS" });
  if (!Number.isFinite(periodRatio) || periodRatio < 0 || periodRatio > 1) throw Object.assign(new Error("Tỷ lệ kỳ tính nước không hợp lệ"), { status: 422, code: "INVALID_BILLING_RATIO" });
  return Math.round(price * count * periodRatio * 100) / 100;
}

module.exports = { countBillableOccupants, calculateWaterCharge };
