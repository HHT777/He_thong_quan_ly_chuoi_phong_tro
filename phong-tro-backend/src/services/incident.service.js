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

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const dateOnly = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

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

async function update(incidentId, payload, actorId) {
  return sequelize.transaction(async (transaction) => {
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
        nguoi_tiep_nhan_id: actorId,
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
      transaction, actorId, action: "INCIDENT_UPDATED", entityType: "SuCo", entityId: incident.ma_su_co,
      after: { status: incident.trang_thai, cost: incident.chi_phi_sua_chua, responsible: incident.doi_tuong_chiu_phi },
    });
    return incident;
  });
}

async function softDelete(incidentId, reason, actorId) {
  const normalizedReason = String(reason || "").trim();
  if (!normalizedReason) throw fail(422, "Lý do xóa sự cố là bắt buộc", "DELETE_REASON_REQUIRED");

  return sequelize.transaction(async (transaction) => {
    const incident = await SuCo.findByPk(incidentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!incident || incident.da_xoa) throw fail(404, "Sự cố không tồn tại", "INCIDENT_NOT_FOUND");
    const links = await financialLinks(incident.ma_su_co, transaction);
    const hasProcessingData = incident.trang_thai !== "CHO_TIEP_NHAN"
      || incident.nguoi_tiep_nhan_id
      || incident.ket_qua_xu_ly
      || incident.chi_phi_sua_chua !== null
      || incident.doi_tuong_chiu_phi;
    if (hasProcessingData || links.expense || links.pendingTenantCharge) {
      throw fail(409, "Chỉ được xóa báo cáo chờ tiếp nhận chưa có dữ liệu xử lý", "INCIDENT_CANNOT_BE_DELETED");
    }
    await incident.update({
      da_xoa: true,
      ly_do_xoa: normalizedReason,
      ngay_xoa: new Date(),
      nguoi_xoa_id: actorId,
    }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "INCIDENT_SOFT_DELETED", entityType: "SuCo", entityId: incident.ma_su_co, reason: normalizedReason });
    return incident;
  });
}

module.exports = { update, softDelete };
