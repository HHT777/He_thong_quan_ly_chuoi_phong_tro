const { Op } = require("sequelize");
const { HopDong, ChiSoDien, PhongTro } = require("../models");
const { assertOwned, getOwnedBuildingIds } = require("./ownership.service");
const billService = require("./khoanPhaiThu.service");
const meterReadingService = require("./meterReading.service");
const adjustmentDefinitionService = require("./billingAdjustmentDefinition.service");
const { countBillableOccupants, calculateWaterCharge } = require("./occupancy.service");
const { firstPeriodRatio, prorateMonthlyAmount, parsePeriod, daysInMonth } = require("../utils/billingPeriod.util");
const { BILL_LINE_TYPES } = require("../domain/billing.constants");
const { sumSignedLineAmounts } = require("../utils/billLine.util");

function calculateWater(unitPrice, occupantCount) { return calculateWaterCharge(unitPrice, occupantCount); }

async function buildPreview(contract, period) {
  const { year, month } = parsePeriod(period);
  const meter = await ChiSoDien.findOne({
    where: { ma_phong: contract.ma_phong, nam: year, thang: month, loai_chi_so: "DINH_KY", da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN" },
  });
  if (!meter) throw Object.assign(new Error("Phòng chưa có chỉ số điện đã xác nhận"), { status: 422, code: "MISSING_CONFIRMED_METER" });
  const [previous, occupantCount, definitions] = await Promise.all([
    meterReadingService.previousReading(contract.ma_phong, period, undefined, meter.ngay_ghi_nhan),
    countBillableOccupants(contract.ma_hop_dong, { atDate: `${period}-${String(daysInMonth(year, month)).padStart(2, "0")}` }),
    adjustmentDefinitionService.applicable(contract.ma_hop_dong, period),
  ]);
  const electricity = Math.round((Number(meter.chi_so_moi) - previous) * Number(meter.don_gia_ap_dung));
  if (!Number.isFinite(electricity) || electricity < 0) throw Object.assign(new Error("Sản lượng điện của kỳ không hợp lệ"), { status: 422, code: "INVALID_ELECTRICITY_AMOUNT" });
  const ratio = firstPeriodRatio(contract.ngay_bat_dau, period);
  const rent = prorateMonthlyAmount(contract.gia_thue, ratio);
  const water = calculateWaterCharge(contract.don_gia_nuoc, occupantCount, ratio);
  const serviceFee = prorateMonthlyAmount(contract.phi_dich_vu, ratio);
  const adjustments = definitions.map((row) => ({ id: row.ma_khoan_dieu_chinh, type: row.loai_khoan, amount: Number(row.so_tien), description: row.ten_ly_do }));
  const lines = [
    { type: BILL_LINE_TYPES.RENT, amount: rent },
    { type: BILL_LINE_TYPES.ELECTRICITY, amount: electricity },
    { type: BILL_LINE_TYPES.WATER, amount: water },
    { type: BILL_LINE_TYPES.SERVICE_FEE, amount: serviceFee },
    ...adjustments.filter((row) => row.type === BILL_LINE_TYPES.INCIDENTAL_FEE),
  ].filter((line) => line.amount > 0);
  let capacity = sumSignedLineAmounts(lines);
  for (const row of adjustments.filter((item) => item.type === BILL_LINE_TYPES.DISCOUNT)) {
    const applied = Math.min(row.amount, capacity); if (applied > 0) { lines.push({ type: row.type, amount: -applied, id: row.id }); capacity -= applied; }
  }
  return {
    contractId: contract.ma_hop_dong, roomId: contract.ma_phong, period, ratio, occupantCount,
    components: { rent, electricity, water, serviceFee }, adjustments, lines, total: sumSignedLineAmounts(lines),
  };
}

async function eligibleContracts(period, contractIds, actorId) {
  const { year, month } = parsePeriod(period);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;
  const where = {
    trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
    ngay_bat_dau: { [Op.lte]: end }, ngay_ket_thuc: { [Op.gte]: start },
  };
  if (Array.isArray(contractIds) && contractIds.length) where.ma_hop_dong = { [Op.in]: [...new Set(contractIds)] };
  const actor = actorId ? { vai_tro: "CHU_TRO", ma_tai_khoan: actorId } : null;
  if (actor && Array.isArray(contractIds) && contractIds.length) {
    for (const id of new Set(contractIds)) await assertOwned(actor, "contract", id);
  }
  const ownedBuildings = actor ? await getOwnedBuildingIds(actor) : null;
  return HopDong.findAll({ where, order: [["ma_phong", "ASC"]],
    ...(ownedBuildings ? { include: [{ model: PhongTro, as: "phongTro", required: true, where: { ma_can: { [Op.in]: ownedBuildings } } }] } : {}) });
}

async function preview(period, contractIds, actorId) {
  const contracts = await eligibleContracts(period, contractIds, actorId); const previews = []; const skipped = [];
  for (const contract of contracts) {
    try { previews.push(await buildPreview(contract, period)); }
    catch (error) { skipped.push({ contractId: contract.ma_hop_dong, roomId: contract.ma_phong, reason: error.code || error.message || "BILL_PREVIEW_FAILED" }); }
  }
  return { previews, skipped };
}

async function generate(period, actorId, contractIds) {
  const result = await preview(period, contractIds, actorId); const created = []; const skipped = [...result.skipped];
  for (const item of result.previews) {
    try {
      created.push(await billService.createKhoanPhaiThu({
        ma_hop_dong: item.contractId, ky: period,
        tien_phong: item.components.rent, tien_dien: item.components.electricity,
        tien_nuoc: item.components.water, phi_dich_vu: item.components.serviceFee,
        phi_phat_sinh: 0, khoan_giam_tru: 0, adjustments: item.adjustments,
        tong_phai_thanh_toan: item.total,
      }, actorId));
    } catch (error) {
      skipped.push({ contractId: item.contractId, roomId: item.roomId, reason: error.code || error.message || "BILL_GENERATION_FAILED" });
    }
  }
  return { created, skipped };
}

module.exports = { calculateWater, buildPreview, eligibleContracts, preview, generate };
