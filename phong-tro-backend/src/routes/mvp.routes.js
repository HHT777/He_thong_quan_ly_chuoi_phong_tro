const express = require("express");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const auth = require("../middleware/auth");
const authorize = require("../middleware/authorize");
const billService = require("../services/khoanPhaiThu.service");
const moveOutService = require("../services/moveOut.service");
const incidentService = require("../services/incident.service");
const coTenantService = require("../services/coTenant.service");
const cashflowReportService = require("../services/cashflowReport.service");
const billAdjustmentService = require("../services/billAdjustment.service");
const billGenerationService = require("../services/billGeneration.service");
const {
  TaiKhoan, KhachThue, HopDong, PhongTro, ChiSoDien, ThanhToan,
  GiaoDichThanhToan, ChiTietThanhToan, TienCoc, BienBanTraPhong,
  KhoanKhauTru, YeuCau, YeuCauGiaHan, YeuCauTraPhong,
  DeXuatBanCungPhong, SuCo, ThanhVienPhong, ThongBao, KhoanThu, KhoanChi, TaiSan,
} = require("../models");

const router = express.Router();
router.use(auth);
const landlord = authorize("CHU_TRO");
const tenant = authorize("KHACH_THUE");
const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const data = (res, value, status = 200) => res.status(status).json({ success: true, data: value });
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
    if (!req.body.newPassword || req.body.newPassword === "1") throw fail(422, "Mật khẩu mới không hợp lệ");
    await account.update({ mat_khau: req.body.newPassword, bat_buoc_doi_mat_khau: false });
    return data(res, { changed: true });
  } catch (e) { next(e); }
});

router.post("/accounts", landlord, async (req, res, next) => {
  try {
    const tenantRow = await KhachThue.findByPk(req.body.tenantId);
    if (!tenantRow) throw fail(404, "Khách thuê không tồn tại");
    if (tenantRow.ma_tai_khoan) throw fail(409, "Khách thuê đã có tài khoản");
    const account = await sequelize.transaction(async (transaction) => {
      const row = await TaiKhoan.create({ ten_dang_nhap: req.body.username || tenantRow.so_dien_thoai, mat_khau: req.body.password || "1", vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG", bat_buoc_doi_mat_khau: true }, { transaction });
      await tenantRow.update({ ma_tai_khoan: row.ma_tai_khoan }, { transaction });
      return row;
    });
    return data(res, account, 201);
  } catch (e) { next(e); }
});
router.patch("/accounts/:id/status", landlord, async (req, res, next) => {
  try { const account = await TaiKhoan.findByPk(req.params.id); if (!account) throw fail(404, "Tài khoản không tồn tại"); if (!["HOAT_DONG", "DA_KHOA"].includes(req.body.status)) throw fail(422, "Trạng thái không hợp lệ"); await account.update({ trang_thai: req.body.status }); return data(res, account); } catch (e) { next(e); }
});
router.post("/accounts/reset-password", landlord, async (req, res, next) => {
  try { const tenantRow = await KhachThue.findByPk(req.body.tenantId); const account = tenantRow?.ma_tai_khoan ? await TaiKhoan.findByPk(tenantRow.ma_tai_khoan) : null; if (!account) throw fail(404, "Tài khoản không tồn tại"); await account.update({ mat_khau: "1", bat_buoc_doi_mat_khau: true }); return data(res, { reset: true }); } catch (e) { next(e); }
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
    const result = await billAdjustmentService.adjust(req.params.id, req.body);
    return data(res, result, 201);
  } catch (e) { next(e); }
}
router.post("/bills/:id/adjustments", landlord, adjustBill);

router.post("/bills/generate", landlord, async (req, res, next) => {
  try {
    return data(res, await billGenerationService.generate(req.body.period), 201);
  } catch (e) { next(e); }
});
router.get("/debt", async (req, res, next) => {
  try {
    const where = { so_tien_con_no: { [Op.gt]: 0 } };
    const include = [{
      model: HopDong,
      as: "hopDong",
      required: req.user.vai_tro === "KHACH_THUE",
      where: req.user.vai_tro === "KHACH_THUE" ? { ma_khach_thue: req.user.ma_khach_thue } : undefined,
      include: [
        { model: KhachThue, as: "khachThue", attributes: ["ma_khach_thue", "ho_ten"] },
        { model: PhongTro, as: "phongTro", attributes: ["ma_phong", "ma_can"] },
      ],
    }];
    return data(res, await ThanhToan.findAll({ where, include, order: [["nam", "ASC"], ["thang", "ASC"]] }));
  } catch (e) { next(e); }
});
router.post("/jobs/close-overdue-debt", landlord, async (req, res, next) => { try { return data(res, { processed: (await billService.getOverdueBills()).length }); } catch (e) { next(e); } });
router.post("/jobs/remind-due-bills", landlord, async (req, res, next) => { try { const bills = await billService.getOverdueBills(); let created = 0; for (const bill of bills) { const tenantRow = await KhachThue.findByPk(bill.hopDong.ma_khach_thue); if (tenantRow?.ma_tai_khoan) { await ThongBao.create({ loai_thong_bao: "NHAC_THANH_TOAN", noi_dung: `Khoản kỳ ${bill.nam}-${String(bill.thang).padStart(2, "0")} còn ${bill.so_tien_con_no}đ`, thoi_diem_tao: new Date(), ma_tai_khoan: tenantRow.ma_tai_khoan }); created += 1; } } return data(res, { created }); } catch (e) { next(e); } });

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
  try { const row = await TaiSan.findByPk(req.params.id); if (!row) throw fail(404, "Tài sản không tồn tại"); await row.destroy(); return data(res, { deleted: true }); } catch (e) { next(e); }
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
      if (type === "TRA_PHONG") await YeuCauTraPhong.create({ ma_yeu_cau: request.ma_yeu_cau, ma_hop_dong: contract.ma_hop_dong }, { transaction });
      return request;
    }); return data(res, row, 201);
  } catch (e) { next(e); }
});
router.get("/requests", async (req, res, next) => { try { return data(res, await YeuCau.findAll({ where: req.user.vai_tro === "KHACH_THUE" ? { ma_khach_thue: req.user.ma_khach_thue } : {}, order: [["ngay_gui", "DESC"]] })); } catch (e) { next(e); } });
router.patch("/requests/:id", landlord, async (req, res, next) => {
  try {
    const status = req.body.status === "DA_DUYET" ? "DA_PHE_DUYET" : req.body.status;
    if (!["DA_PHE_DUYET", "TU_CHOI"].includes(status)) throw fail(422, "Trạng thái không hợp lệ");
    const result = await sequelize.transaction(async (transaction) => {
      const row = await YeuCau.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!row) throw fail(404, "Yêu cầu không tồn tại");
      if (row.trang_thai !== "CHO_XU_LY") throw fail(409, "Yêu cầu này đã được xử lý");
      await row.update({ trang_thai: status }, { transaction });
      let automation = null;
      if (status === "DA_PHE_DUYET" && row.loai_yeu_cau === "GIA_HAN") {
        const detail = await YeuCauGiaHan.findOne({ where: { ma_yeu_cau: row.ma_yeu_cau }, transaction, lock: transaction.LOCK.UPDATE });
        if (!detail?.ngay_ket_thuc_de_xuat) throw fail(422, "Yêu cầu gia hạn thiếu ngày kết thúc đề xuất");
        const contract = await HopDong.findByPk(detail.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE });
        if (!contract || contract.trang_thai === "DA_THANH_LY") throw fail(409, "Hợp đồng không còn hiệu lực để gia hạn");
        if (String(detail.ngay_ket_thuc_de_xuat) <= String(contract.ngay_ket_thuc)) throw fail(422, "Ngày gia hạn phải sau ngày kết thúc hiện tại");
        await contract.update({ ngay_ket_thuc: detail.ngay_ket_thuc_de_xuat, trang_thai: "DANG_HIEU_LUC" }, { transaction });
        automation = { type: "CONTRACT_RENEWED", contractId: contract.ma_hop_dong, endDate: contract.ngay_ket_thuc };
      }
      if (status === "DA_PHE_DUYET" && row.loai_yeu_cau === "TRA_PHONG") {
        const detail = await YeuCauTraPhong.findOne({ where: { ma_yeu_cau: row.ma_yeu_cau }, transaction, lock: transaction.LOCK.UPDATE });
        const contract = detail ? await HopDong.findByPk(detail.ma_hop_dong, { transaction, lock: transaction.LOCK.UPDATE }) : null;
        if (!contract || contract.trang_thai === "DA_THANH_LY") throw fail(409, "Hợp đồng không còn hiệu lực để trả phòng");
        await PhongTro.update({ trang_thai: "DANG_XU_LY_TRA_PHONG" }, { where: { ma_phong: contract.ma_phong }, transaction });
        automation = { type: "MOVE_OUT_OPENED", contractId: contract.ma_hop_dong, roomId: contract.ma_phong };
      }
      if (status === "DA_PHE_DUYET" && row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG") {
        const member = await coTenantService.approve(row, transaction);
        automation = {
          type: "CO_TENANT_ADMITTED",
          memberId: member.ma_thanh_vien_phong,
          roomId: member.ma_phong,
        };
      }
      const tenantRow = await KhachThue.findByPk(row.ma_khach_thue, { transaction });
      if (tenantRow?.ma_tai_khoan) await ThongBao.create({ loai_thong_bao: "KET_QUA_YEU_CAU", noi_dung: status === "DA_PHE_DUYET" ? `Yêu cầu ${row.loai_yeu_cau} của bạn đã được phê duyệt.` : `Yêu cầu ${row.loai_yeu_cau} của bạn đã bị từ chối.`, thoi_diem_tao: new Date(), ma_tai_khoan: tenantRow.ma_tai_khoan }, { transaction });
      return { request: row, automation };
    });
    return data(res, result);
  } catch (e) { next(e); }
});
router.post(["/requests/:id/withdraw", "/requests/:id/revoke"], (req, res) => res.status(409).json({ success: false, message: "Schema data2.md không có trạng thái rút yêu cầu; không thể lưu thao tác này an toàn" }));

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

router.post("/incidents", async (req, res, next) => {
  try {
    const roomId = req.body.roomId;
    if (!roomId || !req.body.description) throw fail(422, "Thiếu thông tin sự cố");
    const priority = incidentPriority(req.body.priority);
    return data(res, await SuCo.create({
      ma_nguoi_gui: req.user.ma_tai_khoan,
      ma_phong: roomId,
      loai_su_co: req.body.type || req.body.title || "KHAC",
      muc_do_uu_tien: priority,
      mo_ta: req.body.description,
      hinh_anh_url: req.body.imageUrl || null,
      trang_thai: "CHO_TIEP_NHAN",
    }), 201);
  } catch (e) { next(e); }
});
router.get("/incidents", async (req, res, next) => { try { return data(res, await SuCo.findAll({ where: req.user.vai_tro === "KHACH_THUE" ? { ma_nguoi_gui: req.user.ma_tai_khoan, da_xoa: false } : { da_xoa: false }, order: [["ngay_gui", "DESC"]] })); } catch (e) { next(e); } });
router.patch("/incidents/:id", landlord, async (req, res, next) => {
  try {
    return data(res, await incidentService.update(
      req.params.id,
      req.body,
      req.user.ma_tai_khoan,
    ));
  } catch (e) { next(e); }
});
router.delete("/incidents/:id", landlord, async (req, res, next) => {
  try {
    return data(res, await incidentService.softDelete(
      req.params.id,
      req.body.reason,
      req.user.ma_tai_khoan,
    ));
  } catch (e) { next(e); }
});

router.post("/co-tenants", tenant, async (req, res, next) => {
  try {
    return data(res, await coTenantService.propose(
      req.user.ma_khach_thue,
      req.body,
    ), 201);
  } catch (e) { next(e); }
});
router.get("/co-tenants", async (req, res, next) => { try { const where = {}; if (req.user.vai_tro === "KHACH_THUE") { const contracts = await HopDong.findAll({ where: { ma_khach_thue: req.user.ma_khach_thue }, attributes: ["ma_hop_dong"], raw: true }); where.ma_hop_dong = { [Op.in]: contracts.map((c) => c.ma_hop_dong) }; } return data(res, await ThanhVienPhong.findAll({ where })); } catch (e) { next(e); } });
router.patch("/co-tenants/:id", landlord, async (req, res, next) => { try { const row = await ThanhVienPhong.findByPk(req.params.id); if (!row) throw fail(404, "Thành viên phòng không tồn tại"); if (req.body.status === "DA_ROI") await row.update({ trang_thai_cu_tru: "DA_ROI", ngay_roi: req.body.leaveDate || new Date() }); return data(res, row); } catch (e) { next(e); } });

router.get("/notifications", async (req, res, next) => { try { return data(res, await ThongBao.findAll({ where: { ma_tai_khoan: req.user.ma_tai_khoan }, order: [["thoi_diem_tao", "DESC"]] })); } catch (e) { next(e); } });
router.patch("/notifications/:id/read", async (req, res, next) => { try { const row = await ThongBao.findOne({ where: { ma_thong_bao: req.params.id, ma_tai_khoan: req.user.ma_tai_khoan } }); if (!row) throw fail(404, "Thông báo không tồn tại"); await row.update({ da_doc: true }); return data(res, row); } catch (e) { next(e); } });
router.post("/notifications/broadcast", landlord, async (req, res, next) => {
  try {
    const subject = String(req.body.subject || "").trim(); const content = String(req.body.content || "").trim();
    if (!subject || !content) throw fail(422, "Tiêu đề và nội dung thông báo là bắt buộc");
    const where = { vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG" };
    if (Array.isArray(req.body.recipientIds) && req.body.recipientIds.length) where.ma_tai_khoan = { [Op.in]: req.body.recipientIds };
    const recipients = await TaiKhoan.findAll({ where, attributes: ["ma_tai_khoan"] });
    await ThongBao.bulkCreate(recipients.map((account) => ({ loai_thong_bao: "THONG_BAO_CHU_TRO", noi_dung: `[${subject}] ${content}`, thoi_diem_tao: new Date(), ma_tai_khoan: account.ma_tai_khoan })));
    return data(res, { recipients: recipients.length }, 201);
  } catch (e) { next(e); }
});
router.get("/reports/cashflow", landlord, async (req, res, next) => {
  try {
    return data(res, await cashflowReportService.getCashflow({
      from: req.query.from,
      to: req.query.to,
      buildingId: req.query.buildingId,
    }));
  } catch (e) { next(e); }
});

module.exports = router;
