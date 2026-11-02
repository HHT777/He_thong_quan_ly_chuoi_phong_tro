const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  SuCo,
  PhongTro,
  HopDong,
  ChiPhiSuCoKhachThue,
  KhoanChi,
  ThongBao,
} = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { businessDate } = require("../utils/businessDate.util");
const { assertOwned, notFoundError } = require("./ownership.service");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const dateOnly = businessDate;

async function validatePreviousIncident(previousId, roomId, newId, user, transaction) {
  if (!roomId) throw fail(422, "Không thể liên kết sự cố khu vực chung", "INCIDENT_COMMON_AREA_LINK_UNSUPPORTED");
  const seen = new Set([newId]);
  let currentId = previousId;
  let first = true;
  let depth = 0;
  while (currentId) {
    if (++depth > 64) throw fail(409, "Chuỗi sự cố quá dài hoặc có vòng", "INCIDENT_CHAIN_TOO_DEEP");
    if (seen.has(currentId)) throw fail(409, "Liên kết sự cố tạo thành vòng", "INCIDENT_LINK_CYCLE");
    seen.add(currentId);
    const current = await SuCo.findByPk(currentId, { transaction });
    if (!current || current.da_xoa) throw notFoundError();
    if (first) {
      await assertOwned(user, "incident", currentId, { transaction });
      if (!current.ma_phong || current.ma_phong !== roomId) {
        throw fail(422, "Sự cố trước phải cùng phòng", "INCIDENT_PREVIOUS_ROOM_MISMATCH");
      }
      if (current.trang_thai !== "DA_XU_LY") {
        throw fail(409, "Sự cố trước chưa xử lý xong", "INCIDENT_PREVIOUS_NOT_COMPLETED");
      }
    }
    currentId = current.ma_su_co_truoc;
    first = false;
  }
}

async function create(payload, user) {
  const roomId = payload.roomId;
  const previousId = payload.previousIncidentId || null;
  const responsible = payload.responsible || null;
  if (previousId && !roomId) throw fail(422, "Không thể liên kết sự cố khu vực chung", "INCIDENT_COMMON_AREA_LINK_UNSUPPORTED");
  if (!roomId || !String(payload.description || "").trim()) {
    throw fail(422, "Thiếu thông tin sự cố", "INCIDENT_REQUIRED_FIELDS");
  }
  if (responsible && !["CHU_TRO", "KHACH_THUE"].includes(responsible)) {
    throw fail(422, "Người chịu phí không hợp lệ", "INVALID_COST_RESPONSIBILITY");
  }
  if (previousId && user.vai_tro !== "CHU_TRO") {
    throw fail(403, "Chỉ Chủ trọ được liên kết sự cố", "FORBIDDEN");
  }
  return sequelize.transaction(async (transaction) => {
    if (user.vai_tro === "CHU_TRO") await assertOwned(user, "room", roomId, { transaction });
    const incident = SuCo.build({
      ma_nguoi_gui: user.ma_tai_khoan,
      ma_phong: roomId,
      loai_su_co: payload.type || payload.title || "KHAC",
      muc_do_uu_tien: payload.priority || "TRUNG_BINH",
      mo_ta: payload.description,
      ...(user.vai_tro === "CHU_TRO" && responsible ? { doi_tuong_chiu_phi: responsible } : {}),
      hinh_anh_url: payload.imageUrl || null,
      trang_thai: user.vai_tro === "CHU_TRO" ? "DANG_XU_LY" : "CHO_TIEP_NHAN",
      ...(user.vai_tro === "CHU_TRO" ? { nguoi_tiep_nhan_id: user.ma_tai_khoan, ngay_tiep_nhan: new Date() } : {}),
    });
    if (previousId) {
      await validatePreviousIncident(previousId, roomId, incident.ma_su_co, user, transaction);
      incident.ma_su_co_truoc = previousId;
    }
    await incident.save({ transaction });
    await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "INCIDENT_CREATED", entityType: "SuCo", entityId: incident.ma_su_co, after: { roomId, hasPrevious: Boolean(previousId), responsible: incident.doi_tuong_chiu_phi || null } });
    return incident;
  });
}

async function unlinkPrevious(incidentId, user) {
  return sequelize.transaction(async (transaction) => {
    await assertOwned(user, "incident", incidentId, { transaction });
    const incident = await SuCo.findByPk(incidentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!incident || incident.da_xoa) throw notFoundError();
    if (!incident.ma_su_co_truoc) throw fail(409, "Sự cố không có liên kết", "INCIDENT_PREVIOUS_NOT_SET");
    const links = await financialLinks(incidentId, transaction);
    if (incident.trang_thai === "DA_XU_LY" || links.expense || links.pendingTenantCharge) {
      throw fail(409, "Chi phí sự cố đã chốt", "INCIDENT_FINANCE_FINALIZED");
    }
    await incident.update({ ma_su_co_truoc: null, ngay_chinh_sua: new Date() }, { transaction });
    await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "INCIDENT_PREVIOUS_UNLINKED", entityType: "SuCo", entityId: incidentId, after: { hasPrevious: false } });
    return incident;
  });
}

async function financialLinks(incidentId, transaction) {
  const [expense, pendingTenantCharge] = await Promise.all([
    KhoanChi.findOne({ where: { ma_su_co: incidentId }, transaction, lock: transaction.LOCK.UPDATE }),
    ChiPhiSuCoKhachThue.findOne({ where: { ma_su_co: incidentId }, transaction, lock: transaction.LOCK.UPDATE }),
  ]);
  return { expense, pendingTenantCharge };
}

async function createFinancialBranch(incident, payload, transaction) {
  const cost = Number(payload.cost);
  if (!Number.isFinite(cost) || cost < 0) {
    throw fail(422, "Chi phí sửa chữa không hợp lệ", "INVALID_INCIDENT_COST");
  }
  if (!["CHU_TRO", "KHACH_THUE"].includes(payload.responsible)) {
    throw fail(422, "Đối tượng chịu phí không hợp lệ", "INVALID_COST_RESPONSIBILITY");
  }
  if (!String(payload.note || "").trim()) {
    throw fail(422, "Kết quả xử lý là bắt buộc", "INCIDENT_RESULT_REQUIRED");
  }

  const links = await financialLinks(incident.ma_su_co, transaction);
  if (links.expense || links.pendingTenantCharge) {
    throw fail(409, "Sự cố đã có bản ghi tài chính", "INCIDENT_FINANCE_ALREADY_EXISTS");
  }
  if (cost === 0) return null;

  if (payload.responsible === "CHU_TRO") {
    const room = await PhongTro.findByPk(incident.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) throw fail(404, "Phòng của sự cố không tồn tại", "INCIDENT_ROOM_NOT_FOUND");
    return KhoanChi.create({
      loai_khoan_chi: "SUA_CHUA",
      so_tien: cost,
      ngay_phat_sinh: dateOnly(),
      pham_vi: "CAN_TRO",
      ghi_chu: `Chủ trọ chịu phí sự cố: ${String(payload.note).trim()}`,
      ma_can: room.ma_can,
      ma_su_co: incident.ma_su_co,
    }, { transaction });
  }

  const tenantId = payload.responsibleTenantId || payload.tenantId;
  if (!tenantId || !String(payload.responsibilityBasis || "").trim()) {
    throw fail(422, "Phải xác định khách chịu phí và căn cứ trách nhiệm", "TENANT_RESPONSIBILITY_REQUIRED");
  }
  const incidentDate = dateOnly(incident.ngay_gui);
  const contract = await HopDong.findOne({
    where: {
      ma_khach_thue: tenantId,
      ma_phong: incident.ma_phong,
      ngay_bat_dau: { [Op.lte]: incidentDate },
      ngay_ket_thuc: { [Op.gte]: incidentDate },
    },
    order: [["ngay_bat_dau", "DESC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!contract) throw fail(422, "Khách chịu phí không thuê phòng tại thời điểm xảy ra sự cố", "RESPONSIBLE_CONTRACT_NOT_FOUND");

  return ChiPhiSuCoKhachThue.create({
    ma_su_co: incident.ma_su_co,
    ma_hop_dong: contract.ma_hop_dong,
    so_tien: cost,
    can_cu_trach_nhiem: String(payload.responsibilityBasis).trim(),
    trang_thai: "CHO_KHAU_TRU",
  }, { transaction });
}

async function update(incidentId, payload, user) {
  return sequelize.transaction(async (transaction) => {
    await assertOwned(user, "incident", incidentId, { transaction });
    if (Object.hasOwn(payload, "previousIncidentId") || Object.hasOwn(payload, "ma_su_co_truoc") || Object.hasOwn(payload, "maSuCoTruoc")) {
      throw fail(409, "Chỉ được liên kết khi tạo sự cố mới", "INCIDENT_LINK_CREATE_ONLY");
    }
    const incident = await SuCo.findByPk(incidentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!incident || incident.da_xoa) throw fail(404, "Sự cố không tồn tại", "INCIDENT_NOT_FOUND");
    if (incident.trang_thai === "DA_XU_LY") throw fail(409, "Sự cố đã xử lý không thể mở lại", "INCIDENT_ALREADY_COMPLETED");

    const nextStatus = payload.status || incident.trang_thai;
    const allowed = incident.trang_thai === "CHO_TIEP_NHAN"
      ? ["CHO_TIEP_NHAN", "DANG_XU_LY"]
      : ["DANG_XU_LY", "DA_XU_LY"];
    if (!allowed.includes(nextStatus)) throw fail(409, "Chuyển trạng thái sự cố không hợp lệ", "INVALID_INCIDENT_TRANSITION");

    const patch = { ngay_chinh_sua: new Date() };
    if (nextStatus === "DANG_XU_LY" && incident.trang_thai === "CHO_TIEP_NHAN") {
      Object.assign(patch, {
        trang_thai: "DANG_XU_LY",
        nguoi_tiep_nhan_id: user.ma_tai_khoan,
        ngay_tiep_nhan: new Date(),
      });
    }
    if (nextStatus === "DA_XU_LY") {
      await createFinancialBranch(incident, payload, transaction);
      Object.assign(patch, {
        trang_thai: "DA_XU_LY",
        doi_tuong_chiu_phi: payload.responsible,
        chi_phi_sua_chua: Number(payload.cost),
        ket_qua_xu_ly: String(payload.note).trim(),
        thiet_bi_thay_the: payload.replacement || null,
        ngay_hoan_tat: new Date(),
      });
      await require("./notification.service").createIdempotent({
        loai_thong_bao: "KET_QUA_SU_CO",
        noi_dung: `Sự cố đã được xử lý: ${String(payload.note).trim()}`,
        thoi_diem_tao: new Date(),
        ma_su_co: incident.ma_su_co,
        ma_tai_khoan: incident.ma_nguoi_gui,
        khoa_su_kien: `KET_QUA_SU_CO:${incident.ma_su_co}`,
      }, { transaction });
    }
    await incident.update(patch, { transaction });
    await writeAuditLog({
      transaction, actorId: user.ma_tai_khoan, action: "INCIDENT_UPDATED", entityType: "SuCo", entityId: incident.ma_su_co,
      after: { status: incident.trang_thai, cost: incident.chi_phi_sua_chua, responsible: incident.doi_tuong_chiu_phi },
    });
    return incident;
  });
}

async function softDelete(incidentId, reason, user) {
  const normalizedReason = String(reason || "").trim();

  return sequelize.transaction(async (transaction) => {
    await assertOwned(user, "incident", incidentId, { transaction });
    if (!normalizedReason) throw fail(422, "Lý do xóa sự cố là bắt buộc", "DELETE_REASON_REQUIRED");
    const incident = await SuCo.findByPk(incidentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!incident || incident.da_xoa) throw fail(404, "Sự cố không tồn tại", "INCIDENT_NOT_FOUND");
    const links = await financialLinks(incident.ma_su_co, transaction);
    const hasProcessingData = incident.trang_thai !== "CHO_TIEP_NHAN"
      || incident.nguoi_tiep_nhan_id
      || incident.ket_qua_xu_ly
      || incident.chi_phi_sua_chua !== null;
    if (hasProcessingData || links.expense || links.pendingTenantCharge) {
      throw fail(409, "Chỉ được xóa báo cáo chờ tiếp nhận chưa có dữ liệu xử lý", "INCIDENT_CANNOT_BE_DELETED");
    }
    await incident.update({
      da_xoa: true,
      ly_do_xoa: normalizedReason,
      ngay_xoa: new Date(),
      nguoi_xoa_id: user.ma_tai_khoan,
    }, { transaction });
    await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "INCIDENT_SOFT_DELETED", entityType: "SuCo", entityId: incident.ma_su_co, reason: normalizedReason });
    return incident;
  });
}

module.exports = { create, unlinkPrevious, validatePreviousIncident, update, softDelete };
