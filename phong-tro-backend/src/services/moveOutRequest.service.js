const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  TaiKhoan, KhachThue, HopDong, PhongTro, CanTro, YeuCau, YeuCauTraPhong, BienBanTraPhong, ThongBao,
} = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { assertOwned, notFoundError, getLandlordAccountForRoom } = require("./ownership.service");
const { findContractRequest, assertNoConflict } = require("./requestConflict.service");
const notification = require("./notification.service");
const { businessDate, addBusinessDays } = require("../utils/businessDate.util");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

const dateOnly = businessDate;
const addDays = addBusinessDays;

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}
function validateDate(value, contract, sentAt, reason, { today = dateOnly(), approval = false } = {}) {
  const status = approval ? 409 : 400;
  if (!validDate(value)) throw fail(status, "Ngày trả phải là ngày hợp lệ theo định dạng yyyy-mm-dd", "INVALID_MOVE_OUT_DATE");
  if (value < today) throw fail(status, "Ngày trả không được ở quá khứ", "MOVE_OUT_DATE_IN_PAST");
  if (!validDate(contract.ngay_ket_thuc) || value > contract.ngay_ket_thuc) throw fail(status, "Ngày trả không được sau ngày hết hạn hiện tại của hợp đồng", "MOVE_OUT_AFTER_CONTRACT_END");
  if (value < addDays(sentAt, 30) && !String(reason || "").trim()) throw fail(approval ? 409 : 400, "Trả sớm hơn mốc 30 ngày cần lý do ngoại lệ và Chủ trọ quyết định", "EARLY_MOVE_OUT_REASON_REQUIRED");
}
function eligibility(contract, today = dateOnly()) {
  if (!["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai)) return "CONTRACT_NOT_ACTIVE";
  if (!validDate(contract.ngay_ket_thuc)) return "CONTRACT_END_DATE_MISSING";
  if (contract.ngay_ket_thuc < today) return "CONTRACT_EXPIRED";
  if (!contract.phongTro || contract.phongTro.trang_thai !== "DANG_THUE" || !contract.phongTro.canTro) return "ROOM_NOT_AVAILABLE_FOR_MOVE_OUT_REQUEST";
  return null;
}
async function contractState(contract, today, transaction, excludeId) {
  const reason = eligibility(contract, today);
  if (reason) return reason;
  if (await BienBanTraPhong.findOne({ where: { ma_hop_dong: contract.ma_hop_dong }, transaction })) return "MOVE_OUT_ALREADY_SETTLED";
  if (await findContractRequest(contract.ma_hop_dong, "TRA_PHONG", { transaction, excludeId })) return "MOVE_OUT_ALREADY_PENDING_OR_APPROVED";
  if (await findContractRequest(contract.ma_hop_dong, "GIA_HAN", { transaction })) return "CONTRACT_REQUEST_CONFLICT";
  return null;
}
const contractInclude = [{ model: PhongTro, as: "phongTro", include: [{ model: CanTro, as: "canTro" }] }];
async function context(user) {
  const today = dateOnly();
  const rows = await HopDong.findAll({ where: { ma_khach_thue: user.ma_khach_thue }, include: contractInclude, order: [["ngay_ket_thuc", "DESC"], ["ma_hop_dong", "ASC"]] });
  const contracts = [];
  for (const row of rows) {
    const reasonCode = await contractState(row, today);
    contracts.push({ contractId: row.ma_hop_dong, buildingName: row.phongTro?.canTro?.ten_can ?? null, roomName: row.phongTro?.so_phong ?? null, contractStatus: row.trang_thai, currentEndDate: row.ngay_ket_thuc, eligible: !reasonCode, reasonCode });
  }
  return { today, minimumNormalMoveOutDate: addDays(today, 30), contracts };
}
function validatePayload(body) {
  const allowed = ["type", "contractId", "expectedMoveOutDate", "date", "content", "earlyReturnReason"];
  if (!body || Object.keys(body).some((k) => !allowed.includes(k)) || body.type !== "TRA_PHONG" || typeof body.contractId !== "string" || !body.contractId.trim()) throw fail(400, "Vui lòng chọn hợp đồng từ danh sách của bạn", "INVALID_MOVE_OUT_PAYLOAD");
  if (body.date != null && body.expectedMoveOutDate != null && body.date !== body.expectedMoveOutDate) throw fail(400, "Hai ngày trả không khớp", "INVALID_MOVE_OUT_DATE");
  if (typeof body.content !== "string" || !body.content.trim() || body.content.trim().length > 1000) throw fail(400, "Nội dung từ 1 đến 1000 ký tự là bắt buộc", "INVALID_MOVE_OUT_CONTENT");
  if (body.earlyReturnReason != null && (typeof body.earlyReturnReason !== "string" || body.earlyReturnReason.trim().length > 1000)) throw fail(400, "Lý do ngoại lệ tối đa 1000 ký tự", "INVALID_MOVE_OUT_REASON");
}
async function create(user, body) {
  validatePayload(body);
  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findByPk(body.contractId, { transaction, lock: transaction.LOCK.UPDATE });
    await assertOwned(user, "contract", body.contractId, { transaction });
    if (!contract || contract.ma_khach_thue !== user.ma_khach_thue) throw notFoundError();
    // Load FK context after the parent lock, avoiding nullable joined row locks.
    contract.phongTro = await PhongTro.findByPk(contract.ma_phong, { include: [{ model: CanTro, as: "canTro" }], transaction });
    const now = new Date(), today = dateOnly(now);
    const reasonCode = await contractState(contract, today, transaction);
    if (reasonCode) throw fail(409, "Hợp đồng chưa thể gửi yêu cầu trả phòng; vui lòng cập nhật trạng thái", reasonCode);
    const value = body.expectedMoveOutDate ?? body.date;
    validateDate(value, contract, now, body.earlyReturnReason, { today });
    const row = await YeuCau.create({ loai_yeu_cau: "TRA_PHONG", ma_khach_thue: user.ma_khach_thue, trang_thai: "CHO_XU_LY", noi_dung: body.content.trim(), ngay_gui: now }, { transaction });
    await YeuCauTraPhong.create({ ma_yeu_cau: row.ma_yeu_cau, ma_hop_dong: contract.ma_hop_dong, ngay_tra_du_kien: value, ly_do_tra_som: body.earlyReturnReason?.trim() || null }, { transaction });
    const owner = await getLandlordAccountForRoom(contract.ma_phong, transaction);
    if (!owner) throw fail(409, "Chưa có Chủ trọ nhận yêu cầu", "CONTRACT_OWNER_MISSING");
    await notification.createIdempotent({ ma_tai_khoan: owner, loai_thong_bao: "YEU_CAU", noi_dung: "Có yêu cầu trả phòng mới chờ xử lý.", thoi_diem_tao: now, khoa_su_kien: `YEU_CAU_MOI:${row.ma_yeu_cau}` }, { transaction });
    await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "MOVE_OUT_REQUEST_CREATED", entityType: "YeuCau", entityId: row.ma_yeu_cau, after: { contractId: contract.ma_hop_dong, requestedDate: value } });
    return row;
  });
}

async function approve({ request, approvedDate, earlyReturnReason, actorId, transaction }) {
  const detail = await YeuCauTraPhong.findOne({
    where: { ma_yeu_cau: request.ma_yeu_cau }, transaction, lock: transaction.LOCK.UPDATE,
  });
  const contract = detail && await HopDong.findByPk(detail.ma_hop_dong, {
    transaction, lock: transaction.LOCK.UPDATE,
  });
  if (!contract || contract.ma_khach_thue !== request.ma_khach_thue || !["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai) || contract.ngay_ket_thuc < dateOnly()) {
    throw fail(409, "Hợp đồng không còn hiệu lực để trả phòng", "CONTRACT_NOT_ACTIVE");
  }
  const normalizedDate = approvedDate || detail.ngay_tra_du_kien || "";
  const reason = typeof earlyReturnReason === "string" ? earlyReturnReason.trim() : "";
  if (reason.length > 1000) throw fail(400, "Lý do ngoại lệ tối đa 1000 ký tự", "INVALID_MOVE_OUT_REASON");
  validateDate(normalizedDate, contract, request.ngay_gui, reason, { approval: true });
  await assertNoConflict(contract.ma_hop_dong, "TRA_PHONG", { transaction });
  if (await findContractRequest(contract.ma_hop_dong, "TRA_PHONG", { transaction, excludeId: request.ma_yeu_cau })) throw fail(409, "Có yêu cầu trả phòng khác chưa kết thúc", "MOVE_OUT_ALREADY_PENDING_OR_APPROVED");
  const room = await PhongTro.findByPk(contract.ma_phong, { transaction });
  if (!room || room.trang_thai !== "DANG_THUE" || await BienBanTraPhong.findOne({ where: { ma_hop_dong: contract.ma_hop_dong }, transaction })) throw fail(409, "Phòng không còn đủ điều kiện duyệt trả phòng", "MOVE_OUT_NO_LONGER_ELIGIBLE");
  await detail.update({
    ngay_tra_da_duyet: normalizedDate,
    ly_do_tra_som: normalizedDate < addDays(request.ngay_gui, 30) ? reason : detail.ly_do_tra_som,
  }, { transaction });
  return {
    type: "MOVE_OUT_SCHEDULED", contractId: contract.ma_hop_dong,
    roomId: contract.ma_phong, approvedMoveOutDate: normalizedDate, actorId,
  };
}

async function revoke(requestId, reasonValue, actorId) {
  const reason = String(reasonValue || "").trim();
  if (!reason) throw fail(422, "Lý do rút duyệt là bắt buộc", "REQUEST_REVOKE_REASON_REQUIRED");
  return sequelize.transaction(async (transaction) => {
    await assertOwned({ vai_tro: "CHU_TRO", ma_tai_khoan: actorId }, "request", requestId, { transaction });
    const request = await YeuCau.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request) throw fail(404, "Yêu cầu không tồn tại", "REQUEST_NOT_FOUND");
    if (request.loai_yeu_cau !== "TRA_PHONG" || request.trang_thai !== "DA_PHE_DUYET") {
      throw fail(409, "Chỉ được rút duyệt yêu cầu trả phòng đã phê duyệt", "REQUEST_NOT_REVOCABLE");
    }
    const detail = await YeuCauTraPhong.findByPk(request.ma_yeu_cau, { transaction, lock: transaction.LOCK.UPDATE });
    const contract = detail && await HopDong.findByPk(detail.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE });
    if (!contract || contract.trang_thai === "DA_THANH_LY") {
      throw fail(409, "Không thể rút duyệt sau khi thanh lý", "MOVE_OUT_ALREADY_SETTLED");
    }
    const report = await BienBanTraPhong.findOne({
      where: { ma_hop_dong: contract.ma_hop_dong }, transaction, lock: transaction.LOCK.UPDATE,
    });
    if (report) throw fail(409, "Hợp đồng đã có biên bản quyết toán", "MOVE_OUT_ALREADY_SETTLED");
    if (detail.ngay_tra_da_duyet && dateOnly() >= detail.ngay_tra_da_duyet) {
      throw fail(409, "Chỉ được rút duyệt trước ngày trả", "MOVE_OUT_REVOKE_TOO_LATE");
    }
    const room = await PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    const before = request.get({ plain: true });
    await request.update({ trang_thai: "DA_RUT", ly_do_xu_ly: reason, ngay_rut_duyet: new Date(), nguoi_xu_ly_id: actorId }, { transaction });
    if (room && room.trang_thai !== "DANG_THUE") await room.update({ trang_thai: "DANG_THUE" }, { transaction });
    const tenant = await KhachThue.findByPk(request.ma_khach_thue, { transaction });
    if (tenant?.ma_tai_khoan) {
      await require("./notification.service").createIdempotent({
        loai_thong_bao: "RUT_DUYET_TRA_PHONG",
        noi_dung: `Chủ trọ đã rút duyệt yêu cầu trả phòng. Lý do: ${reason}`,
        thoi_diem_tao: new Date(), ma_tai_khoan: tenant.ma_tai_khoan,
        khoa_su_kien: `RUT_DUYET_TRA_PHONG:${request.ma_yeu_cau}`,
      }, { transaction });
    }
    await writeAuditLog({
      transaction, actorId, action: "MOVE_OUT_APPROVAL_REVOKED", entityType: "YeuCau",
      entityId: request.ma_yeu_cau, before, after: request, reason,
    });
    return request;
  });
}

async function processOneDueRequest(requestId, today, actorId) {
  return sequelize.transaction(async (transaction) => {
    const request = await YeuCau.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!request || request.loai_yeu_cau !== "TRA_PHONG" || request.trang_thai !== "DA_PHE_DUYET") return false;
    const detail = await YeuCauTraPhong.findByPk(requestId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!detail?.ngay_tra_da_duyet || detail.ngay_tra_da_duyet > today) return false;
    const contract = await HopDong.findByPk(detail.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE });
    if (!contract || contract.trang_thai === "DA_THANH_LY") return false;
    const room = await PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room || room.trang_thai === "DANG_XU_LY_TRA_PHONG") return false;
    if (room.trang_thai !== "DANG_THUE") return false;
    await room.update({ trang_thai: "DANG_XU_LY_TRA_PHONG" }, { transaction });
    const tenant = await KhachThue.findByPk(request.ma_khach_thue, { transaction });
    if (tenant?.ma_tai_khoan) {
      await require("./notification.service").createIdempotent({
        loai_thong_bao: "BAT_DAU_TRA_PHONG",
        noi_dung: `Phòng đã chuyển sang xử lý trả phòng theo ngày được duyệt ${detail.ngay_tra_da_duyet}.`,
        thoi_diem_tao: new Date(), ma_tai_khoan: tenant.ma_tai_khoan,
        khoa_su_kien: `BAT_DAU_TRA_PHONG:${request.ma_yeu_cau}:${detail.ngay_tra_da_duyet}`,
      }, { transaction });
    }
    await writeAuditLog({
      transaction, actorId, action: "MOVE_OUT_DUE_STARTED", entityType: "YeuCau",
      entityId: request.ma_yeu_cau, after: { roomId: room.ma_phong, approvedMoveOutDate: detail.ngay_tra_da_duyet },
    });
    return true;
  });
}

async function processDueMoveOuts({ now = new Date(), actorId } = {}) {
  const today = dateOnly(now);
  const systemActor = actorId || (await TaiKhoan.findOne({
    where: { vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" }, order: [["ma_tai_khoan", "ASC"]],
  }))?.ma_tai_khoan;
  if (!systemActor) throw fail(409, "Không có tài khoản chủ trọ cho tác vụ", "CRON_ACTOR_NOT_FOUND");
  const due = await YeuCauTraPhong.findAll({
    where: { ngay_tra_da_duyet: { [Op.lte]: today } }, attributes: ["ma_yeu_cau"], order: [["ngay_tra_da_duyet", "ASC"]],
  });
  let processed = 0;
  for (const detail of due) {
    if (await processOneDueRequest(detail.ma_yeu_cau, today, systemActor)) processed += 1;
  }
  return { due: due.length, processed, date: today };
}

module.exports = { approve, revoke, processDueMoveOuts, dateOnly, addDays, validDate, validateDate, validatePayload, context, create };
