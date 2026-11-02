const { Op } = require("sequelize");
const { YeuCau, YeuCauGiaHan, YeuCauTraPhong } = require("../models");

// Callers that write must first hold the same HopDong UPDATE lock. Locking
// reads see the latest committed decision even under InnoDB REPEATABLE READ.
async function findContractRequest(contractId, type, { transaction, excludeId, statuses = ["CHO_XU_LY", "DA_PHE_DUYET"] } = {}) {
  const model = type === "GIA_HAN" ? YeuCauGiaHan : YeuCauTraPhong;
  const details = await model.findAll({ where: { ma_hop_dong: contractId }, attributes: ["ma_yeu_cau"], transaction, raw: true, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
  if (!details.length) return null;
  return YeuCau.findOne({ where: {
    ma_yeu_cau: { [Op.in]: details.map((r) => r.ma_yeu_cau), ...(excludeId ? { [Op.ne]: excludeId } : {}) },
    loai_yeu_cau: type, trang_thai: { [Op.in]: statuses },
  }, order: [["ngay_gui", "DESC"], ["ma_yeu_cau", "ASC"]], transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
}
async function assertNoConflict(contractId, type, options) {
  const otherType = type === "GIA_HAN" ? "TRA_PHONG" : "GIA_HAN";
  if (await findContractRequest(contractId, otherType, options)) {
    throw Object.assign(new Error(otherType === "GIA_HAN" ? "Hợp đồng đang có yêu cầu gia hạn chờ xử lý hoặc đã duyệt" : "Hợp đồng đang có yêu cầu trả phòng chờ xử lý hoặc đã duyệt"), { status: 409, code: "CONTRACT_REQUEST_CONFLICT" });
  }
}
module.exports = { findContractRequest, assertNoConflict };
