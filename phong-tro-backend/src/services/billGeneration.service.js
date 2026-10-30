const { Op } = require("sequelize");
const { HopDong, ChiSoDien, PhongTro, KhachThue, CanTro, ThanhToan } = require("../models");
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
  const firstPeriod = String(contract.ngay_bat_dau).slice(0, 7) === period;
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const meterPeriod = `${previousDate.getUTCFullYear()}-${String(previousDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const meter = firstPeriod ? null : await ChiSoDien.findOne({
    where: { ma_phong: contract.ma_phong, nam: previousDate.getUTCFullYear(), thang: previousDate.getUTCMonth() + 1, loai_chi_so: "DINH_KY", da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN" },
  });
  if (!firstPeriod && !meter) throw Object.assign(new Error("Phòng chưa có chỉ số điện kỳ trước đã xác nhận"), { status: 422, code: "MISSING_CONFIRMED_METER" });
  const [previous, occupantCount, definitions] = await Promise.all([
    firstPeriod ? Promise.resolve(0) : meterReadingService.previousReading(contract.ma_phong, meterPeriod, undefined, meter.ngay_ghi_nhan),
    countBillableOccupants(contract.ma_hop_dong, { atDate: `${period}-${String(daysInMonth(year, month)).padStart(2, "0")}` }),
    adjustmentDefinitionService.applicable(contract.ma_hop_dong, period),
  ]);
  const electricity = firstPeriod ? 0 : Math.round((Number(meter.chi_so_moi) - previous) * Number(meter.don_gia_ap_dung));
  if (!Number.isFinite(electricity) || electricity < 0) throw Object.assign(new Error("Sản lượng điện của kỳ không hợp lệ"), { status: 422, code: "INVALID_ELECTRICITY_AMOUNT" });
  const ratio = firstPeriodRatio(contract.ngay_bat_dau, period);
  const rent = prorateMonthlyAmount(contract.gia_thue, ratio);
  const water = Math.round(calculateWaterCharge(contract.don_gia_nuoc, occupantCount, ratio));
  const serviceFee = prorateMonthlyAmount(contract.phi_dich_vu, ratio);
  const adjustments = definitions.map((row) => ({ id: row.ma_khoan_dieu_chinh, type: row.loai_khoan, amount: Math.round(Number(row.so_tien)), description: row.ten_ly_do }));
  const periodDays = ratio < 1 ? `; ${Math.round(ratio * daysInMonth(year, month))}/${daysInMonth(year, month)} ngày` : "";
  const lineDescriptions = {
    rent: `Giá hợp đồng ${Number(contract.gia_thue).toLocaleString("vi-VN")} đ/tháng${periodDays}`,
    electricity: firstPeriod ? "Kỳ đầu hợp đồng: 0 đ" : `${Number(meter.chi_so_moi) - previous} kWh × ${Number(meter.don_gia_ap_dung).toLocaleString("vi-VN")} đ/kWh`,
    water: `${occupantCount} người × ${Number(contract.don_gia_nuoc).toLocaleString("vi-VN")} đ/người${periodDays}`,
    serviceFee: `Theo hợp đồng ${Number(contract.phi_dich_vu).toLocaleString("vi-VN")} đ/tháng${periodDays}`,
  };
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
    components: { rent, electricity, water, serviceFee }, adjustments, lineDescriptions, lines, total: sumSignedLineAmounts(lines),
  };
}

async function eligibleContracts(period, contractIds, actorId, buildingIds) {
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
  if (Array.isArray(buildingIds) && buildingIds.some((id) => ownedBuildings && !ownedBuildings.includes(id))) throw Object.assign(new Error("Không tìm thấy căn"), { status: 404, code: "RESOURCE_NOT_FOUND" });
  const scope = Array.isArray(buildingIds) && buildingIds.length ? buildingIds : ownedBuildings;
  return HopDong.findAll({ where, order: [["ma_phong", "ASC"]],
    include: [
      { model: KhachThue, as: "khachThue", attributes: ["ma_khach_thue", "ho_ten"] },
      { model: PhongTro, as: "phongTro", required: Boolean(scope), ...(scope ? { where: { ma_can: { [Op.in]: scope } } } : {}) },
    ] });
}

async function preview(period, contractIds, actorId, buildingIds) {
  const contracts = await eligibleContracts(period, contractIds, actorId, buildingIds); const previews = []; const skipped = [];
  for (const contract of contracts) {
    const { year, month } = parsePeriod(period);
    const existing = await ThanhToan.findOne({ where: { ma_hop_dong: contract.ma_hop_dong, nam: year, thang: month, loai_thanh_toan: "DINH_KY" } });
    if (existing) { skipped.push({ contractId: contract.ma_hop_dong, roomId: contract.ma_phong, reason: "BILL_ALREADY_EXISTS" }); continue; }
    try { previews.push(await buildPreview(contract, period)); }
    catch (error) { skipped.push({ contractId: contract.ma_hop_dong, roomId: contract.ma_phong, reason: String(error.code || "BILL_PREVIEW_FAILED").slice(0, 60) }); }
  }
  const rooms = await PhongTro.findAll({ where: { ...(buildingIds?.length ? { ma_can: { [Op.in]: buildingIds } } : actorId ? { ma_can: { [Op.in]: await getOwnedBuildingIds({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }) } } : {}) }, include: [{ model: CanTro, as: "canTro" }], order: [["so_phong", "ASC"]] });
  const contractByRoom = new Map(contracts.map((item) => [item.ma_phong, item]));
  const readyByRoom = new Map(previews.map((item) => [item.roomId, item]));
  const skippedByRoom = new Map(skipped.map((item) => [item.roomId, item]));
  return { previews, skipped, rooms: rooms.filter((room) => !contractIds?.length || contractByRoom.has(room.ma_phong)).map((room) => { const contract = contractByRoom.get(room.ma_phong); const ready = readyByRoom.get(room.ma_phong); return { roomId: room.ma_phong, roomName: room.so_phong, buildingId: room.ma_can, buildingName: room.canTro?.ten_can || null, tenantName: contract?.khachThue?.ho_ten || null, contractId: contract?.ma_hop_dong || null, eligible: Boolean(ready), reasonCode: ready ? null : skippedByRoom.get(room.ma_phong)?.reason || "NO_ACTIVE_CONTRACT", estimatedTotal: ready?.total ?? null }; }) };
}

async function generate(period, actorId, contractIds, buildingIds) {
  const result = await preview(period, contractIds, actorId, buildingIds); const created = []; const skipped = [...result.skipped];
  for (const item of result.previews) {
    try {
      created.push(await billService.createKhoanPhaiThu({
        ma_hop_dong: item.contractId, ky: period,
        tien_phong: item.components.rent, tien_dien: item.components.electricity,
        tien_nuoc: item.components.water, phi_dich_vu: item.components.serviceFee,
        phi_phat_sinh: 0, khoan_giam_tru: 0, adjustments: item.adjustments, lineDescriptions: item.lineDescriptions,
        tong_phai_thanh_toan: item.total,
      }, actorId));
    } catch (error) {
      skipped.push({ contractId: item.contractId, roomId: item.roomId, reason: String(error.code || "BILL_GENERATION_FAILED").slice(0, 60), stage: "GENERATE" });
    }
  }
  return { created, skipped, rooms: result.rooms };
}

module.exports = { calculateWater, buildPreview, eligibleContracts, preview, generate };
