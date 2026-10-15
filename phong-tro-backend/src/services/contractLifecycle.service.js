const { HopDong, LichSuGiaHanHopDong, LichSuSuaHopDong, LichSuChuyenPhong } = require("../models");
const { writeAuditLog, toJsonValue } = require("./auditLog.service");

async function recordChange({ contract, before, after, reason, actorId, transaction, action }) {
  const snapshot = toJsonValue(after || contract);
  const history = await LichSuSuaHopDong.create({
    ma_hop_dong: contract.ma_hop_dong,
    truoc_json: before === undefined ? null : toJsonValue(before),
    sau_json: { action, contract: snapshot },
    ly_do: reason,
    nguoi_sua_id: actorId,
  }, { transaction });
  await writeAuditLog({
    transaction,
    actorId,
    action: `CONTRACT_${action}`,
    entityType: "HopDong",
    entityId: contract.ma_hop_dong,
    before,
    after: snapshot,
    reason,
  });
  return history;
}

async function recordRenewal({ contract, oldEndDate, newEndDate, months, actorId, transaction }) {
  const history = await LichSuGiaHanHopDong.create({
    ma_hop_dong: contract.ma_hop_dong,
    ngay_ket_thuc_cu: oldEndDate,
    ngay_ket_thuc_moi: newEndDate,
    so_thang: months,
    nguoi_duyet_id: actorId,
  }, { transaction });
  await writeAuditLog({
    transaction,
    actorId,
    action: "CONTRACT_RENEWED",
    entityType: "HopDong",
    entityId: contract.ma_hop_dong,
    before: { ngay_ket_thuc: oldEndDate },
    after: { ngay_ket_thuc: newEndDate, so_thang: months },
    reason: "Phê duyệt yêu cầu gia hạn",
  });
  return history;
}

async function getHistory(contractId) {
  const [changes, renewals, transfers] = await Promise.all([
    LichSuSuaHopDong.findAll({ where: { ma_hop_dong: contractId }, order: [["thoi_diem_sua", "DESC"]] }),
    LichSuGiaHanHopDong.findAll({ where: { ma_hop_dong: contractId }, order: [["thoi_diem_duyet", "DESC"]] }),
    LichSuChuyenPhong.findAll({ where: { ma_hop_dong: contractId }, order: [["thoi_diem_tao", "DESC"]] }),
  ]);
  return [
    ...changes.map((row) => ({ type: "CHANGE", occurredAt: row.thoi_diem_sua, data: row })),
    ...renewals.map((row) => ({ type: "RENEWAL", occurredAt: row.thoi_diem_duyet, data: row })),
    ...transfers.map((row) => ({ type: "ROOM_TRANSFER", occurredAt: row.thoi_diem_tao, data: row })),
  ].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
}

function renewalMonths(oldEndDate, newEndDate) {
  const oldDate = new Date(`${oldEndDate}T00:00:00Z`);
  const newDate = new Date(`${newEndDate}T00:00:00Z`);
  const months = (newDate.getUTCFullYear() - oldDate.getUTCFullYear()) * 12 + newDate.getUTCMonth() - oldDate.getUTCMonth();
  const expected = new Date(oldDate);
  expected.setUTCMonth(expected.getUTCMonth() + months);
  return expected.toISOString().slice(0, 10) === String(newEndDate) && [6, 12].includes(months) ? months : null;
}

module.exports = { recordChange, recordRenewal, getHistory, renewalMonths };
