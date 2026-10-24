const express = require("express");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const moveOutService = require("../services/moveOut.service");
const incidentService = require("../services/incident.service");
const coTenantService = require("../services/coTenant.service");
const cashflowReportService = require("../services/cashflowReport.service");
const cashflowExportService = require("../services/cashflowExport.service");
const dashboardSummaryService = require("../services/dashboardSummary.service");
const dashboardInsightsService = require("../services/dashboardInsights.service");
const { validateQuery } = require("../utils/queryValidation");
const { attachRequestRooms } = require("../utils/requestBuildingScope");
const { businessDate } = require("../utils/businessDate.util");
const billAdjustmentService = require("../services/billAdjustment.service");
const billGenerationService = require("../services/billGeneration.service");
const billingAdjustmentDefinitionService = require("../services/billingAdjustmentDefinition.service");
const billingCronService = require("../services/billingCron.service");
const debtLifecycleService = require("../services/debtLifecycle.service");
const paymentLifecycleService = require("../services/paymentLifecycle.service");
const tenantAccountService = require("../services/tenantAccount.service");
const reservationService = require("../services/reservation.service");
const { getOwnedBuildingIds, notFoundError } = require("../services/ownership.service");
const contractViolationService = require("../services/contractViolation.service");
const contractLifecycleService = require("../services/contractLifecycle.service");
const moveOutRequestService = require("../services/moveOutRequest.service");
const { writeAuditLog } = require("../services/auditLog.service");
const { listSystemConfig, saveSystemConfig } = require("../services/systemConfig.service");
const {
  TaiKhoan, KhachThue, HopDong, PhongTro, ChiSoDien, ThanhToan,
  GiaoDichThanhToan, ChiTietThanhToan, TienCoc, BienBanTraPhong,
  KhoanKhauTru, YeuCau, YeuCauGiaHan, YeuCauTraPhong,
  DeXuatBanCungPhong, SuCo, ThanhVienPhong, ThongBao, KhoanThu, KhoanChi, TaiSan, SuCoTaiSan, DatGiuPhong, ViPhamHopDong, DanhMucSuCo,
} = require("../models");

const router = express.Router();
router.use(auth);
const landlord = authorize("CHU_TRO");
const tenant = authorize("KHACH_THUE");
const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const data = (res, value, status = 200) => res.status(status).json({ success: true, data: value });
router.get("/dashboard/summary", landlord, async (req, res, next) => {
  try {
    if (Object.keys(req.query).some((key) => key !== "period")) throw fail(400, "Tham số báo cáo không hợp lệ", "INVALID_PERIOD");
    return data(res, await dashboardSummaryService.getDashboardSummary(req.user, req.query.period));
  } catch (error) { return next(error); }
});
router.get("/dashboard/insights", landlord, async (req, res, next) => {
  try { return data(res, await dashboardInsightsService.getDashboardInsights(req.user, req.query)); }
  catch (error) { return next(error); }
});
const INCIDENT_PRIORITIES = Object.freeze(["THAP", "TRUNG_BINH", "CAO", "KHAN_CAP"]);
const incidentPriority = (value) => {
  const priority = value || "TRUNG_BINH";
  if (!INCIDENT_PRIORITIES.includes(priority)) {
    throw fail(422, "Mức độ ưu tiên sự cố không hợp lệ", "INVALID_INCIDENT_PRIORITY");
  }
  return priority;
};

router.patch("/account/password", async (req, res, next) => {
  try {
    const account = await TaiKhoan.findByPk(req.user.ma_tai_khoan);
    if (!account || !await bcrypt.compare(req.body.currentPassword || "", account.mat_khau)) throw fail(422, "Mật khẩu hiện tại không đúng");
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(req.body.newPassword || "") || req.body.newPassword === "1") throw fail(422, "Mật khẩu mới phải có ít nhất 8 ký tự gồm chữ và số");
    await account.update({ mat_khau: req.body.newPassword, bat_buoc_doi_mat_khau: false });
    return data(res, { changed: true });
  } catch (e) { next(e); }
});

router.post("/accounts", landlord, async (req, res, next) => {
  try {
    return data(res, await tenantAccountService.create(req.body.tenantId, req.user.ma_tai_khoan), 201);
  } catch (e) { next(e); }
});
router.patch("/accounts/:id/status", landlord, async (req, res, next) => {
  try { return data(res, await tenantAccountService.updateStatus(req.params.id, req.body.status, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.post("/accounts/reset-password", landlord, async (req, res, next) => {
  try { return data(res, await tenantAccountService.resetPassword(req.body.tenantId, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});

router.get("/reservations", landlord, async (req, res, next) => {
  try {
    const today = businessDate();
    const rows = await DatGiuPhong.findAll({ include: [{ model: PhongTro, as: "phongTro" }], order: [["han_giu", "ASC"]] });
    return data(res, rows.map((row) => ({ ...row.toJSON(), quaHan: row.trang_thai === "DANG_GIU" && String(row.han_giu) < today })));
  } catch (e) { next(e); }
});
router.post("/reservations", landlord, async (req, res, next) => {
  try { return data(res, await reservationService.create(req.body, req.user.ma_tai_khoan), 201); } catch (e) { next(e); }
});
router.get("/reservations/:id/extension-history", landlord, async (req, res, next) => {
  try {
    const { error, value } = Joi.string().guid({ version: "uuidv4" }).required().validate(req.params.id);
    if (error) throw fail(400, "Mã giữ phòng không hợp lệ", "INVALID_RESERVATION_ID");
    return data(res, await reservationService.extensionHistory(value, req.user));
  } catch (error) { next(error); }
});
router.get("/reservations/:id/cancellation-quote", landlord, async (req, res, next) => {
  try {
    const id = Joi.string().guid({ version: "uuidv4" }).required().validate(req.params.id);
    const amount = Joi.number().min(0).required().validate(req.query.refundAmount);
    if (id.error || amount.error || Object.keys(req.query).some((key) => key !== "refundAmount")) throw fail(400, "Tham số báo giá không hợp lệ", "INVALID_RESERVATION_QUOTE_QUERY");
    return data(res, await reservationService.cancellationQuote(id.value, amount.value, req.user));
  } catch (error) { next(error); }
});
router.patch("/reservations/:id/extend", landlord, async (req, res, next) => {
  try { return data(res, await reservationService.extend(req.params.id, req.body, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.post("/reservations/:id/cancel", landlord, async (req, res, next) => {
  try { return data(res, await reservationService.cancel(req.params.id, req.body, req.user.ma_tai_khoan, req.user)); } catch (e) { next(e); }
});
router.get("/system-config", landlord, async (req, res, next) => {
  try { return data(res, await listSystemConfig()); } catch (error) { return next(error); }
});
router.put("/system-config/:key", landlord, async (req, res, next) => {
  try {
    if (!req.body || req.body.value === undefined) throw fail(400, "Giá trị cấu hình là bắt buộc", "INVALID_SYSTEM_CONFIG");
    return data(res, await saveSystemConfig(req.params.key, req.body.value, req.user.ma_tai_khoan));
  } catch (error) { return next(error); }
});
router.post("/system-config/:key/reset", landlord, async (req, res, next) => {
  try { return data(res, await saveSystemConfig(req.params.key, undefined, req.user.ma_tai_khoan, { restore: true })); }
  catch (error) { return next(error); }
});
router.get("/incident-categories", async (req, res, next) => { try { return data(res, await DanhMucSuCo.findAll({ where: req.user.vai_tro === "CHU_TRO" ? {} : { dang_hoat_dong: true }, order: [["thu_tu", "ASC"], ["ten", "ASC"]] })); } catch (e) { next(e); } });
router.post("/incident-categories", landlord, async (req, res, next) => { try { const code = String(req.body.code || "").trim(); const name = String(req.body.name || "").trim(); if (!code || !name) throw fail(422, "Mã và tên danh mục là bắt buộc"); return data(res, await DanhMucSuCo.create({ ma: code, ten: name, thu_tu: Number(req.body.order || 0) }), 201); } catch (e) { next(e); } });
router.get("/contracts/:id/violations", async (req, res, next) => {
  try {
    const contract = await HopDong.findByPk(req.params.id); if (!contract || (req.user.vai_tro === "KHACH_THUE" && contract.ma_khach_thue !== req.user.ma_khach_thue)) throw fail(404, "Không tìm thấy hợp đồng");
    return data(res, await contractViolationService.list(req.params.id));
  } catch (e) { next(e); }
});
router.post("/contracts/:id/violations", landlord, async (req, res, next) => {
  try { return data(res, await contractViolationService.create(req.params.id, req.body, req.user.ma_tai_khoan), 201); } catch (e) { next(e); }
});

router.post("/discounts", landlord, (req, res, next) => {
  req.params.id = req.body.billId || req.body.paymentId;
  if (!req.params.id) return next(fail(422, "data2.md chỉ lưu giảm trừ trong một khoản phải thu; billId là bắt buộc"));
  req.body.delta = -Math.abs(Number(req.body.value || 0));
  req.body.reason = req.body.reason || "Giảm trừ";
  return adjustBill(req, res, next);
});
async function adjustBill(req, res, next) {
  try {
    const result = await billAdjustmentService.adjust(req.params.id, req.body, req.user.ma_tai_khoan);
    return data(res, result, 201);
  } catch (e) { next(e); }
}
router.post("/bills/:id/adjustments", landlord, adjustBill);

router.get("/billing-adjustments", landlord, async (req, res, next) => {
  try { return data(res, await billingAdjustmentDefinitionService.list(req.query.contractId, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.post("/billing-adjustments", landlord, async (req, res, next) => {
  try { return data(res, await billingAdjustmentDefinitionService.create(req.body, req.user.ma_tai_khoan), 201); } catch (e) { next(e); }
});
router.patch("/billing-adjustments/:id", landlord, async (req, res, next) => {
  try { return data(res, await billingAdjustmentDefinitionService.update(req.params.id, req.body, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.post("/billing-adjustments/:id/toggle", landlord, async (req, res, next) => {
  try { return data(res, await billingAdjustmentDefinitionService.setEnabled(req.params.id, req.body.enabled === true, req.body.reason, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});

router.post("/bills/preview", landlord, async (req, res, next) => {
  try { return data(res, await billGenerationService.preview(req.body.period, req.body.contractIds, req.user.ma_tai_khoan, req.body.buildingIds)); } catch (e) { next(e); }
});

router.get("/bills/summary", landlord, async (req, res, next) => {
  try { validateQuery(req.query, { strings: ["ma_can", "issuance", "search"], periods: ["ky"] }); return data(res, await require("../services/khoanPhaiThu.service").getSummary(req.query, req.user)); } catch (e) { next(e); }
});
router.post("/bills/send-preview", landlord, async (req, res, next) => {
  try { return data(res, await billingCronService.sendPreview(req.body.billIds, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.post("/bills/send", landlord, async (req, res, next) => {
  try { return data(res, await billingCronService.sendBatch(req.body.billIds, req.user.ma_tai_khoan, new Date(), { resend: req.body.resend === true, key: req.get("Idempotency-Key") })); } catch (e) { next(e); }
});
router.get("/bills/schedule", landlord, async (req, res, next) => {
  try { return data(res, await billingCronService.scheduleStatus(new Date(), req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.put("/bills/schedule", landlord, async (req, res, next) => {
  try { await require("../services/systemConfig.service").saveBillingSchedule(req.body, req.user.ma_tai_khoan); return data(res, await billingCronService.scheduleStatus(new Date(), req.user.ma_tai_khoan)); } catch (e) { next(e); }
});

router.post("/bills/generate", landlord, async (req, res, next) => {
  try {
    return data(res, await billGenerationService.generate(req.body.period, req.user.ma_tai_khoan, req.body.contractIds, req.body.buildingIds), 201);
  } catch (e) { next(e); }
});
router.get("/debt", async (req, res, next) => {
  try {
    validateQuery(req.query);
    return data(res, await debtLifecycleService.listDebt({ tenantId: req.user.vai_tro === "KHACH_THUE" ? req.user.ma_khach_thue : undefined, requester: req.user }));
  } catch (e) { next(e); }
});
router.post("/bills/:id/mark-paid", landlord, async (req, res, next) => { try { return data(res, await paymentLifecycleService.markPaid(req.params.id, req.get("Idempotency-Key"), req.user.ma_tai_khoan), 201); } catch (e) { next(e); } });
router.post("/bills/mark-all-paid", landlord, async (req, res, next) => { try { return data(res, await paymentLifecycleService.markAllPaid({ buildingId: req.body.buildingId, period: req.body.period, key: req.get("Idempotency-Key"), actorId: req.user.ma_tai_khoan }), 201); } catch (e) { next(e); } });
router.post("/payments/:id/cancel", landlord, async (req, res, next) => { try { return data(res, await paymentLifecycleService.cancel(req.params.id, req.body.reason, req.user.ma_tai_khoan)); } catch (e) { next(e); } });
router.post("/jobs/debt-lifecycle", landlord, async (req, res, next) => { try { return data(res, await debtLifecycleService.run({ now: req.body.now ? new Date(req.body.now) : new Date(), actorId: req.user.ma_tai_khoan })); } catch (e) { next(e); } });
router.post("/jobs/close-overdue-debt", landlord, async (req, res, next) => { try { return data(res, await debtLifecycleService.run({ now: req.body.now ? new Date(req.body.now) : new Date(), actorId: req.user.ma_tai_khoan })); } catch (e) { next(e); } });
router.post("/jobs/remind-due-bills", landlord, async (req, res, next) => { try { return data(res, await debtLifecycleService.run({ now: req.body.now ? new Date(req.body.now) : new Date(), actorId: req.user.ma_tai_khoan })); } catch (e) { next(e); } });
router.post("/jobs/billing", landlord, async (req, res, next) => { try { return data(res, await billingCronService.run({ now: process.env.NODE_ENV === "test" && req.body.now ? new Date(req.body.now) : new Date(), actorId: req.user.ma_tai_khoan, force: process.env.NODE_ENV === "test" && req.body.force === true })); } catch (e) { next(e); } });

// Tài sản được quản lý theo thứ bậc Căn trọ → Phòng → Tài sản.
router.get("/assets", landlord, async (req, res, next) => {
  try { return data(res, await TaiSan.findAll({ include: [{ model: PhongTro, as: "phongTro" }], order: [["ten_tai_san", "ASC"]] })); } catch (e) { next(e); }
});
router.post("/assets", landlord, async (req, res, next) => {
  try {
    const name = String(req.body.name || req.body.ten_tai_san || "").trim();
    const roomId = req.body.roomId || req.body.ma_phong;
    if (!name || !roomId) throw fail(422, "Tên tài sản và phòng là bắt buộc");
    if (!await PhongTro.findByPk(roomId)) throw fail(404, "Phòng không tồn tại");
    return data(res, await TaiSan.create({ ten_tai_san: name, so_luong: Number(req.body.quantity || req.body.so_luong || 1), tinh_trang: req.body.condition || req.body.tinh_trang || null, ghi_chu: req.body.note || req.body.ghi_chu || null, ma_phong: roomId }), 201);
  } catch (e) { next(e); }
});
router.put("/assets/:id", landlord, async (req, res, next) => {
  try {
    const row = await TaiSan.findByPk(req.params.id); if (!row) throw fail(404, "Tài sản không tồn tại");
    const roomId = req.body.roomId || req.body.ma_phong;
    if (roomId && !await PhongTro.findByPk(roomId)) throw fail(404, "Phòng không tồn tại");
    await row.update({ ...(req.body.name || req.body.ten_tai_san ? { ten_tai_san: req.body.name || req.body.ten_tai_san } : {}), ...(req.body.quantity !== undefined || req.body.so_luong !== undefined ? { so_luong: Number(req.body.quantity ?? req.body.so_luong) } : {}), ...(req.body.condition !== undefined || req.body.tinh_trang !== undefined ? { tinh_trang: req.body.condition ?? req.body.tinh_trang } : {}), ...(req.body.note !== undefined || req.body.ghi_chu !== undefined ? { ghi_chu: req.body.note ?? req.body.ghi_chu } : {}), ...(roomId ? { ma_phong: roomId } : {}) });
    return data(res, row);
  } catch (e) { next(e); }
});
router.delete("/assets/:id", landlord, async (req, res, next) => {
  try { const result = await sequelize.transaction(async (transaction) => { const row = await TaiSan.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }); if (!row) throw fail(404, "Tài sản không tồn tại"); const [incidents, settlements] = await Promise.all([SuCoTaiSan.count({ where: { ma_tai_san: row.ma_tai_san }, transaction }), KhoanKhauTru.count({ where: { ma_tai_san: row.ma_tai_san }, transaction })]); if (incidents || settlements) throw fail(409, "Không thể xóa tài sản đã liên kết sự cố hoặc biên bản trả phòng"); await row.destroy({ transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "ASSET_DELETED", entityType: "TaiSan", entityId: row.ma_tai_san, before: row }); return { deleted: true }; }); return data(res, result); } catch (e) { next(e); }
});

router.post("/requests", tenant, async (req, res, next) => {
  try {
    const type = req.body.type; if (!["GIA_HAN", "TRA_PHONG", "DE_XUAT_BAN_CUNG_PHONG"].includes(type)) throw fail(422, "Loại yêu cầu không hợp lệ");
    if (type === "DE_XUAT_BAN_CUNG_PHONG") {
      return data(res, await coTenantService.propose(req.user.ma_khach_thue, req.body), 201);
    }
    const contract = await HopDong.findOne({ where: { ma_khach_thue: req.user.ma_khach_thue, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } } }); if (!contract) throw fail(404, "Không có hợp đồng hiệu lực");
    const row = await sequelize.transaction(async (transaction) => {
      const request = await YeuCau.create({ loai_yeu_cau: type, noi_dung: req.body.content || type, trang_thai: "CHO_XU_LY", ma_khach_thue: req.user.ma_khach_thue }, { transaction });
      if (type === "GIA_HAN") await YeuCauGiaHan.create({ ma_yeu_cau: request.ma_yeu_cau, ma_hop_dong: contract.ma_hop_dong, ngay_ket_thuc_de_xuat: req.body.requestedEndDate }, { transaction });
      if (type === "TRA_PHONG") await YeuCauTraPhong.create({
        ma_yeu_cau: request.ma_yeu_cau, ma_hop_dong: contract.ma_hop_dong,
        ngay_tra_du_kien: req.body.date || req.body.expectedMoveOutDate || null,
        ly_do_tra_som: req.body.earlyReturnReason || null,
      }, { transaction });
      return request;
    }); return data(res, row, 201);
  } catch (e) { next(e); }
});
router.get("/requests", async (req, res, next) => {
  try {
    const requests = await YeuCau.findAll({ where: req.user.vai_tro === "KHACH_THUE" ? { ma_khach_thue: req.user.ma_khach_thue } : {}, order: [["ngay_gui", "DESC"]] });
    if (!requests.length) return data(res, []);
    const ids = requests.map((row) => row.ma_yeu_cau);
    const where = { ma_yeu_cau: { [Op.in]: ids } };
    const [renewals, moveOuts, proposals] = await Promise.all([
      YeuCauGiaHan.findAll({ where, attributes: ["ma_yeu_cau", "ma_hop_dong"], raw: true }),
      YeuCauTraPhong.findAll({ where, attributes: ["ma_yeu_cau", "ma_hop_dong"], raw: true }),
      DeXuatBanCungPhong.findAll({ where, attributes: ["ma_yeu_cau", "ma_phong"], raw: true }),
    ]);
    const contractIds = [...new Set([...renewals, ...moveOuts].map((row) => row.ma_hop_dong))];
    const contracts = contractIds.length ? await HopDong.findAll({ where: { ma_hop_dong: { [Op.in]: contractIds } }, attributes: ["ma_hop_dong", "ma_phong"], raw: true }) : [];
    return data(res, attachRequestRooms(requests, renewals, moveOuts, proposals, contracts));
  } catch (e) { next(e); }
});
router.patch("/requests/:id", landlord, async (req, res, next) => {
  try {
    const status = req.body.status === "DA_DUYET" ? "DA_PHE_DUYET" : req.body.status;
    if (!["DA_PHE_DUYET", "TU_CHOI"].includes(status)) throw fail(422, "Trạng thái không hợp lệ");
    const result = await sequelize.transaction(async (transaction) => {
      const row = await YeuCau.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw fail(404, "Yêu cầu không tồn tại");
      if (row.trang_thai !== "CHO_XU_LY") throw fail(409, "Yêu cầu này đã được xử lý");
      if (status === "TU_CHOI" && !String(req.body.reason || "").trim()) throw fail(400, "Lý do từ chối là bắt buộc", "REQUEST_REJECTION_REASON_REQUIRED");
      await row.update({ trang_thai: status, ly_do_xu_ly: req.body.reason || null, ngay_duyet: new Date(), nguoi_xu_ly_id: req.user.ma_tai_khoan }, { transaction });
      if (status === "TU_CHOI" && row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG") {
        const proposal = await DeXuatBanCungPhong.findByPk(row.ma_yeu_cau, { transaction, lock: transaction.LOCK.UPDATE });
        if (proposal) await proposal.update({ ly_do_tu_choi: String(req.body.reason).trim(), nguoi_xu_ly_id: req.user.ma_tai_khoan, ngay_xu_ly: new Date() }, { transaction });
      }
      let automation = null;
      if (status === "DA_PHE_DUYET" && row.loai_yeu_cau === "GIA_HAN") {
        const detail = await YeuCauGiaHan.findOne({ where: { ma_yeu_cau: row.ma_yeu_cau }, transaction, lock: transaction.LOCK.UPDATE });
        if (!detail?.ngay_ket_thuc_de_xuat) throw fail(422, "Yêu cầu gia hạn thiếu ngày kết thúc đề xuất");
        const contract = await HopDong.findByPk(detail.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE });
        if (!contract || contract.trang_thai !== "SAP_HET_HAN") throw fail(409, "Chỉ có thể gia hạn hợp đồng sắp hết hạn", "CONTRACT_NOT_EXPIRING");
        if (String(detail.ngay_ket_thuc_de_xuat) <= String(contract.ngay_ket_thuc)) throw fail(422, "Ngày gia hạn phải sau ngày kết thúc hiện tại");
        const oldEndDate = contract.ngay_ket_thuc;
        const months = contractLifecycleService.renewalMonths(oldEndDate, detail.ngay_ket_thuc_de_xuat);
        if (!months) throw fail(422, "Gia hạn chỉ chấp nhận gói 6 hoặc 12 tháng", "INVALID_RENEWAL_PACKAGE");
        await contract.update({ ngay_ket_thuc: detail.ngay_ket_thuc_de_xuat, trang_thai: "DANG_HIEU_LUC" }, { transaction });
        await contractLifecycleService.recordRenewal({ contract, oldEndDate, newEndDate: detail.ngay_ket_thuc_de_xuat, months, actorId: req.user.ma_tai_khoan, transaction });
        automation = { type: "CONTRACT_RENEWED", contractId: contract.ma_hop_dong, endDate: contract.ngay_ket_thuc };
      }
      if (status === "DA_PHE_DUYET" && row.loai_yeu_cau === "TRA_PHONG") {
        automation = await moveOutRequestService.approve({
          request: row,
          approvedDate: req.body.approvedMoveOutDate,
          earlyReturnReason: req.body.earlyReturnReason || req.body.reason,
          actorId: req.user.ma_tai_khoan,
          transaction,
        });
      }
      if (status === "DA_PHE_DUYET" && row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG") {
        const member = await coTenantService.approve(row, transaction, req.user.ma_tai_khoan);
        automation = {
          type: "CO_TENANT_ADMITTED",
          memberId: member.ma_thanh_vien_phong,
          roomId: member.ma_phong,
        };
      }
      const tenantRow = await KhachThue.findByPk(row.ma_khach_thue, { transaction });
      if (tenantRow?.ma_tai_khoan) await require("../services/notification.service").createIdempotent({ loai_thong_bao: "KET_QUA_YEU_CAU", noi_dung: status === "DA_PHE_DUYET" ? `Yêu cầu ${row.loai_yeu_cau} của bạn đã được phê duyệt.` : `Yêu cầu ${row.loai_yeu_cau} của bạn đã bị từ chối. Lý do: ${String(req.body.reason || "").trim()}`, thoi_diem_tao: new Date(), ma_tai_khoan: tenantRow.ma_tai_khoan, khoa_su_kien: `YEU_CAU_KET_QUA:${row.ma_yeu_cau}:${status}` }, { transaction });
      await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "REQUEST_DECIDED", entityType: "YeuCau", entityId: row.ma_yeu_cau, after: { status, reason: req.body.reason || null } });
      return { request: row, automation };
    });
    return data(res, result);
  } catch (e) { next(e); }
});
router.post("/requests/:id/revoke", landlord, async (req, res, next) => {
  try {
    return data(res, await moveOutRequestService.revoke(req.params.id, req.body.reason, req.user.ma_tai_khoan));
  } catch (e) { next(e); }
});

router.get("/move-outs", landlord, async (req, res, next) => {
  try {
    const buildingIds = await getOwnedBuildingIds(req.user);
    const contracts = await HopDong.findAll({
      attributes: ["ma_hop_dong"],
      include: [{ model: PhongTro, as: "phongTro", attributes: [], required: true, where: { ma_can: { [Op.in]: buildingIds } } }],
      raw: true,
    });
    const details = await YeuCauTraPhong.findAll({
      where: { ma_hop_dong: { [Op.in]: contracts.map((row) => row.ma_hop_dong) } }, raw: true,
    });
    const requests = await YeuCau.findAll({
      where: { loai_yeu_cau: "TRA_PHONG", ma_yeu_cau: { [Op.in]: details.map((row) => row.ma_yeu_cau) } },
      order: [["ngay_gui", "DESC"]],
      raw: true,
    });
    const contractByRequest = new Map(details.map((row) => [row.ma_yeu_cau, row.ma_hop_dong]));
    return data(res, requests.map((row) => ({ ...row, ma_hop_dong: contractByRequest.get(row.ma_yeu_cau) || null })));
  } catch (e) { next(e); }
});

router.post("/move-outs/:contractId/settle", landlord, async (req, res, next) => {
  try {
    const result = await moveOutService.settle(
      req.params.contractId,
      req.body,
      req.user.ma_tai_khoan,
    );
    return data(res, result, 200);
  } catch (e) { next(e); }
});
router.get("/move-outs/:contractId/context", landlord, async (req, res, next) => {
  try { return data(res, await moveOutService.getContext(req.params.contractId, req.user.ma_tai_khoan)); } catch (e) { next(e); }
});
router.post("/move-outs/:id/deposit-refunds", landlord, async (req, res, next) => {
  try { return data(res, await moveOutService.recordDepositRefund(req.params.id, req.body, req.user.ma_tai_khoan), 201); } catch (e) { next(e); }
});

router.post("/incidents", async (req, res, next) => {
  try {
    return data(res, await incidentService.create({ ...req.body, priority: incidentPriority(req.body.priority) }, req.user), 201);
  } catch (e) { next(e); }
});
router.delete("/incidents/:id/previous", landlord, async (req, res, next) => {
  try { return data(res, await incidentService.unlinkPrevious(req.params.id, req.user)); } catch (e) { next(e); }
});
router.get("/incidents", async (req, res, next) => {
  try {
    const where = { da_xoa: false };
    if (req.user.vai_tro === "KHACH_THUE") where.ma_nguoi_gui = req.user.ma_tai_khoan;
    else {
      const buildingIds = await getOwnedBuildingIds(req.user);
      const rooms = await PhongTro.findAll({ where: { ma_can: { [Op.in]: buildingIds } }, attributes: ["ma_phong"], raw: true });
      where.ma_phong = { [Op.in]: rooms.map((room) => room.ma_phong) };
    }
    return data(res, await SuCo.findAll({ where, order: [["ngay_gui", "DESC"]] }));
  } catch (e) { next(e); }
});
router.patch("/incidents/:id", landlord, async (req, res, next) => {
  try {
    return data(res, await incidentService.update(
      req.params.id,
      req.body,
      req.user,
    ));
  } catch (e) { next(e); }
});
router.delete("/incidents/:id", landlord, async (req, res, next) => {
  try {
    return data(res, await incidentService.softDelete(
      req.params.id,
      req.body.reason,
      req.user,
    ));
  } catch (e) { next(e); }
});

router.get("/co-tenant-proposals/:id", async (req, res, next) => {
  try {
    const { error, value } = Joi.string().guid({ version: "uuidv4" }).required().validate(req.params.id);
    if (error) throw fail(400, "Mã đề xuất không hợp lệ", "INVALID_PROPOSAL_ID");
    return data(res, await coTenantService.getProposal(value, req.user));
  } catch (error) { next(error); }
});
router.post("/co-tenants", tenant, async (req, res, next) => {
  try {
    return data(res, await coTenantService.propose(
      req.user.ma_khach_thue,
      req.body,
      req.user.ma_tai_khoan,
    ), 201);
  } catch (e) { next(e); }
});
router.get("/co-tenants", async (req, res, next) => { try { const where = {}; if (req.user.vai_tro === "KHACH_THUE") { const contracts = await HopDong.findAll({ where: { ma_khach_thue: req.user.ma_khach_thue }, attributes: ["ma_hop_dong"], raw: true }); where.ma_hop_dong = { [Op.in]: contracts.map((c) => c.ma_hop_dong) }; } return data(res, await ThanhVienPhong.findAll({ where })); } catch (e) { next(e); } });
router.patch("/co-tenants/:id", landlord, async (req, res, next) => { try { const row = await sequelize.transaction(async (transaction) => { const member = await ThanhVienPhong.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }); if (!member) throw fail(404, "Thành viên phòng không tồn tại"); const before = member.get({ plain: true }); if (req.body.status === "DA_ROI") await member.update({ trang_thai_cu_tru: "DA_ROI", ngay_roi: req.body.leaveDate || new Date() }, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "CO_TENANT_UPDATED", entityType: "ThanhVienPhong", entityId: member.ma_thanh_vien_phong, before, after: member }); return member; }); return data(res, row); } catch (e) { next(e); } });

router.get("/notifications", async (req, res, next) => { try { return data(res, await ThongBao.findAll({ where: { ma_tai_khoan: req.user.ma_tai_khoan }, order: [["thoi_diem_tao", "DESC"]] })); } catch (e) { next(e); } });
router.patch("/notifications/:id/read", async (req, res, next) => { try { const row = await ThongBao.findOne({ where: { ma_thong_bao: req.params.id, ma_tai_khoan: req.user.ma_tai_khoan } }); if (!row) throw fail(404, "Thông báo không tồn tại"); await row.update({ da_doc: true }); return data(res, row); } catch (e) { next(e); } });
router.post("/notifications/broadcast", landlord, async (req, res, next) => {
  try {
    const subject = String(req.body.subject || "").trim(); const content = String(req.body.content || "").trim();
    if (!subject || !content) throw fail(422, "Tiêu đề và nội dung thông báo là bắt buộc");
    const buildingIds = await getOwnedBuildingIds(req.user);
    const contracts = await HopDong.findAll({
      attributes: ["ma_khach_thue"],
      include: [{ model: PhongTro, as: "phongTro", attributes: [], required: true, where: { ma_can: { [Op.in]: buildingIds } } }],
      raw: true,
    });
    const tenantIds = [...new Set(contracts.map((row) => row.ma_khach_thue))];
    const tenants = await KhachThue.findAll({ where: { ma_khach_thue: { [Op.in]: tenantIds } }, attributes: ["ma_tai_khoan"], raw: true });
    const ownedAccountIds = [...new Set(tenants.map((row) => row.ma_tai_khoan).filter(Boolean))];
    const requested = Array.isArray(req.body.recipientIds) && req.body.recipientIds.length ? [...new Set(req.body.recipientIds)] : null;
    if (requested?.some((id) => !ownedAccountIds.includes(id))) throw notFoundError();
    const where = { vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG", ma_tai_khoan: { [Op.in]: requested || ownedAccountIds } };
    const recipients = await TaiKhoan.findAll({ where, attributes: ["ma_tai_khoan"] });
    if (requested && recipients.length !== requested.length) throw notFoundError();
    const crypto = require("node:crypto");
    const maBroadcast = String(req.body.maBroadcast || crypto.randomUUID());
    let sent = 0; let skipped = 0;
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100);
      try {
        const result = await sequelize.transaction(async (transaction) => {
          let batchSent = 0;
          for (const account of batch) {
            const created = await require("../services/notification.service").createIdempotent({ ma_tai_khoan: account.ma_tai_khoan, loai_thong_bao: "THONG_BAO_CHU_TRO", noi_dung: `[${subject}] ${content}`, khoa_su_kien: `BROADCAST:${maBroadcast}`, thoi_diem_tao: new Date() }, { transaction });
            if (created.created) batchSent += 1;
          }
          return batchSent;
        });
        sent += result;
        skipped += batch.length - result;
      } catch (error) {
        skipped += batch.length;
        console.error("[BROADCAST] batch failed", { maBroadcast, batchSize: batch.length, error: error.message });
      }
    }
    return data(res, { maBroadcast, recipients: recipients.length, sent, skipped }, 201);
  } catch (e) { next(e); }
});
const cashflowFilters = (query, ownedBuildingIds) => ({
  from: query.from, to: query.to, buildingId: query.buildingId,
  periodType: query.periodType, periodValue: query.periodValue, ownedBuildingIds,
});
router.get("/reports/cashflow", landlord, async (req, res, next) => {
  try {
    validateQuery(req.query, { allowed: ["from", "to", "buildingId", "periodType", "periodValue"] });
    const ownedBuildingIds = await getOwnedBuildingIds(req.user);
    return data(res, await cashflowReportService.getCashflow(cashflowFilters(req.query, ownedBuildingIds)));
  } catch (e) { next(e); }
});
router.get("/reports/cashflow.xlsx", landlord, async (req, res, next) => {
  try {
    validateQuery(req.query, { allowed: ["from", "to", "buildingId", "periodType", "periodValue"] });
    const ownedBuildingIds = await getOwnedBuildingIds(req.user);
    const { filename, buffer } = await cashflowExportService.exportCashflow(cashflowFilters(req.query, ownedBuildingIds));
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.set("Content-Disposition", `attachment; filename="${filename}"`);
    res.set("Cache-Control", "private, no-store");
    return res.status(200).send(buffer);
  } catch (e) { next(e); }
});

module.exports = router;
