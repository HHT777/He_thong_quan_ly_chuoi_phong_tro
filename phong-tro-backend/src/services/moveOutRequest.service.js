const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  TaiKhoan, KhachThue, HopDong, PhongTro, YeuCau, YeuCauTraPhong, BienBanTraPhong, ThongBao,
} = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { businessDate, addBusinessDays } = require("../utils/businessDate.util");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

const dateOnly = businessDate;
const addDays = addBusinessDays;

async function approve({ request, approvedDate, earlyReturnReason, actorId, transaction }) {
  const detail = await YeuCauTraPhong.findOne({
    where: { ma_yeu_cau: request.ma_yeu_cau }, transaction, lock: transaction.LOCK.UPDATE,
  });
  const contract = detail && await HopDong.findByPk(detail.ma_hop_dong, {
    transaction, lock: transaction.LOCK.UPDATE,
  });
  if (!contract || contract.trang_thai === "DA_THANH_LY") {
    throw fail(409, "Hợp đồng không còn hiệu lực để trả phòng", "CONTRACT_NOT_ACTIVE");
  }
  const normalizedDate = dateOnly(approvedDate || detail.ngay_tra_du_kien || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw fail(422, "Ngày trả đã duyệt là bắt buộc", "APPROVED_MOVE_OUT_DATE_REQUIRED");
  }
  const reason = String(earlyReturnReason || detail.ly_do_tra_som || "").trim();
  const earliestNormalDate = addDays(request.ngay_gui, 30);
  if (normalizedDate < earliestNormalDate && !reason) {
    throw fail(422, "Trả phòng sớm hơn 30 ngày phải có lý do ngoại lệ", "EARLY_MOVE_OUT_REASON_REQUIRED");
  }
  await detail.update({
    ngay_tra_da_duyet: normalizedDate,
    ly_do_tra_som: normalizedDate < earliestNormalDate ? reason : detail.ly_do_tra_som,
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

module.exports = { approve, revoke, processDueMoveOuts, dateOnly, addDays };
