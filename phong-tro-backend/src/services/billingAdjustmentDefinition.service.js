const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { KhoanDieuChinh, HopDong, PhongTro } = require("../models");
const { BILL_LINE_TYPES } = require("../domain/billing.constants");
const { writeAuditLog } = require("./auditLog.service");
const { parsePeriod } = require("../utils/billingPeriod.util");
const { assertOwned, getOwnedBuildingIds } = require("./ownership.service");
const ownerUser = (actorId) => ({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId });

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

function normalize(payload, existing = null) {
  const type = payload.type ?? payload.loaiKhoan ?? existing?.loai_khoan;
  const name = String(payload.name ?? payload.reason ?? payload.tenLyDo ?? existing?.ten_ly_do ?? "").trim();
  const amount = Number(payload.amount ?? payload.soTien ?? existing?.so_tien);
  const mode = payload.mode ?? payload.cheDo ?? existing?.che_do;
  const periodValue = payload.period ?? (existing?.nam_ap_dung && existing?.thang_ap_dung ? `${existing.nam_ap_dung}-${String(existing.thang_ap_dung).padStart(2, "0")}` : null);
  const startDate = payload.startDate ?? payload.ngayBatDau ?? existing?.ngay_bat_dau ?? null;
  if (![BILL_LINE_TYPES.INCIDENTAL_FEE, BILL_LINE_TYPES.DISCOUNT].includes(type)) throw fail(422, "INVALID_ADJUSTMENT_TYPE", "Loại khoản điều chỉnh không hợp lệ");
  if (!name || !Number.isFinite(amount) || amount <= 0) throw fail(422, "INVALID_ADJUSTMENT_AMOUNT", "Tên/lý do và số tiền lớn hơn 0 là bắt buộc");
  if (!['CO_DINH', 'THEO_KY'].includes(mode)) throw fail(422, "INVALID_ADJUSTMENT_MODE", "Chế độ khoản điều chỉnh không hợp lệ");
  let period = null;
  if (mode === "THEO_KY") period = parsePeriod(periodValue);
  if (mode === "CO_DINH" && !/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ""))) throw fail(422, "ADJUSTMENT_START_DATE_REQUIRED", "Khoản cố định cần ngày bắt đầu");
  return { type, name, amount, mode, period, startDate: mode === "CO_DINH" ? String(startDate).slice(0, 10) : null };
}

async function create(payload, actorId) {
  const value = normalize(payload);
  const contractId = payload.contractId ?? payload.maHopDong;
  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findByPk(contractId, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned(ownerUser(actorId), "contract", contractId, { transaction });
    if (!contract || contract.trang_thai === "DA_THANH_LY") throw fail(404, "CONTRACT_NOT_ACTIVE", "Hợp đồng không còn hiệu lực");
    const row = await KhoanDieuChinh.create({
      ma_hop_dong: contractId, loai_khoan: value.type, ten_ly_do: value.name, so_tien: value.amount,
      che_do: value.mode, thang_ap_dung: value.period?.month || null, nam_ap_dung: value.period?.year || null,
      ngay_bat_dau: value.startDate, trang_thai: "DANG_AP_DUNG", nguoi_tao_id: actorId,
    }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "BILLING_ADJUSTMENT_CREATED", entityType: "KhoanDieuChinh", entityId: row.ma_khoan_dieu_chinh, after: row });
    return row;
  });
}

async function update(id, payload, actorId) {
  return sequelize.transaction(async (transaction) => {
    const row = await KhoanDieuChinh.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned(ownerUser(actorId), "adjustment", id, { transaction });
    if (row.trang_thai !== "DANG_AP_DUNG") throw fail(409, "ADJUSTMENT_DISABLED", "Khoản đã tắt không thể sửa");
    const before = row.get({ plain: true }); const value = normalize(payload, row);
    await row.update({ loai_khoan: value.type, ten_ly_do: value.name, so_tien: value.amount, che_do: value.mode, thang_ap_dung: value.period?.month || null, nam_ap_dung: value.period?.year || null, ngay_bat_dau: value.startDate, ngay_cap_nhat: new Date(), nguoi_cap_nhat_id: actorId }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "BILLING_ADJUSTMENT_UPDATED", entityType: "KhoanDieuChinh", entityId: id, before, after: row });
    return row;
  });
}

async function setEnabled(id, enabled, reasonValue, actorId) {
  const reason = String(reasonValue || "").trim();
  if (!enabled && !reason) throw fail(422, "DISABLE_REASON_REQUIRED", "Lý do tắt khoản điều chỉnh là bắt buộc");
  return sequelize.transaction(async (transaction) => {
    const row = await KhoanDieuChinh.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned(ownerUser(actorId), "adjustment", id, { transaction });
    const next = enabled ? "DANG_AP_DUNG" : "DA_TAT";
    if (row.trang_thai === next) return row;
    const before = row.get({ plain: true });
    await row.update({ trang_thai: next, ngay_tat: enabled ? null : new Date(), ly_do_tat: enabled ? null : reason, ngay_cap_nhat: new Date(), nguoi_cap_nhat_id: actorId }, { transaction });
    await writeAuditLog({ transaction, actorId, action: enabled ? "BILLING_ADJUSTMENT_ENABLED" : "BILLING_ADJUSTMENT_DISABLED", entityType: "KhoanDieuChinh", entityId: id, before, after: row, reason: reason || null });
    return row;
  });
}

async function applicable(contractId, period, options = {}) {
  const { year, month } = parsePeriod(period); const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
  return KhoanDieuChinh.findAll({
    where: { ma_hop_dong: contractId, trang_thai: "DANG_AP_DUNG", [Op.or]: [
      { che_do: "THEO_KY", nam_ap_dung: year, thang_ap_dung: month },
      { che_do: "CO_DINH", ngay_bat_dau: { [Op.lte]: monthEnd } },
    ] }, transaction: options.transaction, order: [["ngay_tao", "ASC"], ["ma_khoan_dieu_chinh", "ASC"]],
  });
}

async function list(contractId, actorId) {
  const actor = ownerUser(actorId);
  if (contractId) await assertOwned(actor, "contract", contractId);
  const buildings = await getOwnedBuildingIds(actor);
  return KhoanDieuChinh.findAll({ where: contractId ? { ma_hop_dong: contractId } : {},
    include: [{ model: HopDong, as: "hopDong", required: true,
      include: [{ model: PhongTro, as: "phongTro", required: true, where: { ma_can: { [Op.in]: buildings } } }] }],
    order: [["ngay_tao", "DESC"]] });
}

module.exports = { normalize, create, update, setEnabled, applicable, list };
