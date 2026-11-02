const sequelize = require("../config/database");
const { HopDong, ViPhamHopDong } = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

async function create(contractId, payload, actorId) {
  const content = String(payload.content || payload.noiDung || "").trim();
  const clause = String(payload.clause || payload.dieuKhoan || "").trim();
  if (!content || !clause) throw fail(422, "INVALID_CONTRACT_VIOLATION", "Nội dung và điều khoản liên quan là bắt buộc");
  const fine = payload.fine ?? payload.mucPhat ?? null;
  if (fine !== null && (!Number.isFinite(Number(fine)) || Number(fine) < 0)) throw fail(422, "INVALID_VIOLATION_FINE", "Mức phạt không hợp lệ");
  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findByPk(contractId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!contract) throw fail(404, "CONTRACT_NOT_FOUND", "Hợp đồng không tồn tại");
    const row = await ViPhamHopDong.create({ noi_dung: content, dieu_khoan_lien_quan: clause, muc_phat: fine, ma_hop_dong: contractId }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "CONTRACT_VIOLATION_RECORDED", entityType: "ViPhamHopDong", entityId: row.ma_vi_pham, after: { contractId, fine }, reason: content });
    return row;
  });
}
async function list(contractId) { return ViPhamHopDong.findAll({ where: { ma_hop_dong: contractId }, order: [["ngay_ghi_nhan", "DESC"]] }); }
module.exports = { create, list };
