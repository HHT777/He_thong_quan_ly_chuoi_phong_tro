const { CanTro, PhongTro, KhachThue, HopDong, KhoanChi, ChuTro, TaiKhoan } = require("../models");
const sequelize = require("../config/database");
const schemas = require("../validations/management.validation");
const { writeAuditLog } = require("../services/auditLog.service");

function notFound(message) {
  return { status: 404, message };
}
function validated(schema, payload) { const { error, value } = schema.validate(payload, { abortEarly: false, stripUnknown: false }); if (error) { error.isJoi = true; throw error; } return value; }
async function validateExpenseScope(value, transaction) { if (value.pham_vi === "CAN_TRO") { if (!value.ma_can || !(await CanTro.findByPk(value.ma_can, { transaction }))) throw Object.assign(new Error("Căn trọ không tồn tại"), { status: 422 }); } else if (value.pham_vi === "TOAN_CHUOI") value.ma_can = null; return value; }

class ManagementController {
  async listCanTro(req, res, next) {
    try {
      const data = await CanTro.findAll({
        include: [{ model: PhongTro, as: "phongs" }],
        order: [["ma_can", "ASC"]],
      });
      res.json({
        success: true,
        data,
        message: "Lấy danh sách căn trọ thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async createCanTro(req, res, next) {
    try {
      const value = validated(schemas.createBuilding, req.body);
      const owner = await ChuTro.findOne({ where: { ma_tai_khoan: req.user.ma_tai_khoan } });
      if (!owner) throw notFound("Không tìm thấy hồ sơ Chủ trọ");
      const created = await sequelize.transaction(async (transaction) => { const row = await CanTro.create({ ...value, ma_chu_tro: owner.ma_chu_tro, trang_thai: value.trang_thai || "HOAT_DONG" }, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "BUILDING_CREATED", entityType: "CanTro", entityId: row.ma_can, after: row }); return row; });
      res
        .status(201)
        .json({
          success: true,
          data: created,
          message: "Tạo căn trọ thành công",
        });
    } catch (error) {
      next(error);
    }
  }
  async getCanTro(req, res, next) { try { const item = await CanTro.findByPk(req.params.id, { include: [{ model: PhongTro, as: "phongs" }] }); if (!item) throw notFound("Căn trọ không tồn tại"); res.json({ success: true, data: item }); } catch (error) { next(error); } }

  async updateCanTro(req, res, next) {
    try {
      const patch = validated(schemas.updateBuilding, req.body); const item = await sequelize.transaction(async (transaction) => { const row = await CanTro.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }); if (!row) throw notFound("Căn trọ không tồn tại"); const before = row.get({ plain: true }); if (patch.trang_thai === "NGUNG_HOAT_DONG") { const occupied = await PhongTro.count({ where: { ma_can: row.ma_can, trang_thai: ["DANG_THUE", "DA_GIU", "DANG_XU_LY_TRA_PHONG"] }, transaction }); if (occupied) throw { status: 409, message: "Không thể ngừng hoạt động căn còn phòng đang thuê/giữ/xử lý trả" }; } await row.update(patch, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "BUILDING_UPDATED", entityType: "CanTro", entityId: row.ma_can, before, after: row }); return row; });
      res.json({
        success: true,
        data: item,
        message: "Cập nhật căn trọ thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCanTro(req, res, next) {
    try {
      const item = await CanTro.findByPk(req.params.id);
      if (!item) throw notFound("Căn trọ không tồn tại");
      const roomCount = await PhongTro.count({ where: { ma_can: item.ma_can } });
      if (roomCount > 0) throw { status: 409, message: "Không thể xóa căn đã có phòng; hãy chuyển sang Ngừng hoạt động" };
      await item.destroy();
      res.json({
        success: true,
        data: null,
        message: "Xóa căn trọ thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async listKhachThue(req, res, next) {
    try {
      const where = {}; if (req.query.q) { const { Op } = require("sequelize"); where[Op.or] = [{ ho_ten: { [Op.like]: `%${req.query.q}%` } }, { so_dien_thoai: { [Op.like]: `%${req.query.q}%` } }, { cccd_giay_to: { [Op.like]: `%${req.query.q}%` } }]; }
      const data = await KhachThue.findAll({ where,
        include: [
          { model: HopDong, as: "hopDongs" },
          { model: TaiKhoan, as: "taiKhoan", attributes: ["ma_tai_khoan", "ten_dang_nhap", "vai_tro", "trang_thai", "bat_buoc_doi_mat_khau"] },
        ],
        order: [["ma_khach_thue", "ASC"]],
      });
      res.json({
        success: true,
        data,
        message: "Lấy danh sách khách thuê thành công",
      });
    } catch (error) {
      next(error);
    }
  }
  async getKhachThue(req, res, next) { try { const item = await KhachThue.findByPk(req.params.id, { include: [{ model: HopDong, as: "hopDongs" }, { model: TaiKhoan, as: "taiKhoan" }] }); if (!item) throw notFound("Khách thuê không tồn tại"); res.json({ success: true, data: item }); } catch (error) { next(error); } }

  async createKhachThue(req, res, next) {
    try {
      const value = validated(schemas.createTenant, req.body);
      res
        .status(201)
        .json({
          success: true,
          data: await KhachThue.create(value),
          message: "Tạo khách thuê thành công",
        });
    } catch (error) {
      next(error);
    }
  }

  async updateKhachThue(req, res, next) {
    try {
      const item = await KhachThue.findByPk(req.params.id); const value = validated(schemas.updateTenant, req.body);
      if (!item) throw notFound("Khách thuê không tồn tại");
      await item.update(value);
      res.json({
        success: true,
        data: item,
        message: "Cập nhật khách thuê thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteKhachThue(req, res, next) {
    try {
      const item = await KhachThue.findByPk(req.params.id);
      if (!item) throw notFound("Khách thuê không tồn tại");
      const contractCount = await HopDong.count({ where: { ma_khach_thue: item.ma_khach_thue } });
      if (contractCount > 0) throw { status: 409, message: "Không thể xóa khách thuê đã có lịch sử hợp đồng" };
      await item.destroy();
      res.json({
        success: true,
        data: null,
        message: "Xóa khách thuê thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async listChiPhi(req, res, next) {
    try {
      const data = await KhoanChi.findAll({ order: [["ngay_phat_sinh", "DESC"]] });
      res.json({
        success: true,
        data,
        message: "Lấy danh sách chi phí thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async createChiPhi(req, res, next) {
    try {
      const value = validated(schemas.createExpense, req.body);
      const created = await sequelize.transaction(async (transaction) => { await validateExpenseScope(value, transaction); const row = await KhoanChi.create({ ...value, trang_thai: "HIEU_LUC" }, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "EXPENSE_CREATED", entityType: "KhoanChi", entityId: row.ma_khoan_chi, after: row }); return row; });
      res
        .status(201)
        .json({
          success: true,
          data: created,
          message: "Tạo khoản chi thành công",
        });
    } catch (error) {
      next(error);
    }
  }

  async updateChiPhi(req, res, next) {
    try {
      const patch = validated(schemas.updateExpense, req.body); const item = await sequelize.transaction(async (transaction) => { const row = await KhoanChi.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }); if (!row) throw notFound("Khoản chi không tồn tại"); if (row.trang_thai === "DA_HUY") throw Object.assign(new Error("Khoản chi đã hủy"), { status: 409 }); const before = row.get({ plain: true }); const merged = { ...before, ...patch }; await validateExpenseScope(merged, transaction); await row.update(patch.pham_vi === "TOAN_CHUOI" ? { ...patch, ma_can: null } : patch, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "EXPENSE_UPDATED", entityType: "KhoanChi", entityId: row.ma_khoan_chi, before, after: row }); return row; });
      res.json({
        success: true,
        data: item,
        message: "Cập nhật khoản chi thành công",
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteChiPhi(req, res, next) {
    try {
      const reason = String(req.body.reason || "").trim(); if (!reason) throw Object.assign(new Error("Lý do hủy là bắt buộc"), { status: 422 }); await sequelize.transaction(async (transaction) => { const item = await KhoanChi.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }); if (!item) throw notFound("Khoản chi không tồn tại"); if (item.trang_thai === "DA_HUY") throw Object.assign(new Error("Khoản chi đã hủy"), { status: 409 }); const before = item.get({ plain: true }); await item.update({ trang_thai: "DA_HUY", ly_do_huy: reason, ngay_huy: new Date(), nguoi_huy_id: req.user.ma_tai_khoan }, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "EXPENSE_CANCELLED", entityType: "KhoanChi", entityId: item.ma_khoan_chi, before, after: item, reason }); });
      res.json({
        success: true,
        data: null,
        message: "Xóa khoản chi thành công",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ManagementController();
