const { CanTro, PhongTro, KhachThue, HopDong, KhoanChi, ChuTro, TaiKhoan } = require("../models");

function notFound(message) {
  return { status: 404, message };
}

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
      const owner = await ChuTro.findOne({ where: { ma_tai_khoan: req.user.ma_tai_khoan } });
      if (!owner) throw notFound("Không tìm thấy hồ sơ Chủ trọ");
      res
        .status(201)
        .json({
          success: true,
          data: await CanTro.create({ ...req.body, ma_chu_tro: owner.ma_chu_tro, trang_thai: req.body.trang_thai || "HOAT_DONG" }),
          message: "Tạo căn trọ thành công",
        });
    } catch (error) {
      next(error);
    }
  }
  async getCanTro(req, res, next) { try { const item = await CanTro.findByPk(req.params.id, { include: [{ model: PhongTro, as: "phongs" }] }); if (!item) throw notFound("Căn trọ không tồn tại"); res.json({ success: true, data: item }); } catch (error) { next(error); } }

  async updateCanTro(req, res, next) {
    try {
      const item = await CanTro.findByPk(req.params.id);
      if (!item) throw notFound("Căn trọ không tồn tại");
      const patch = {}; for (const key of ["ten_can", "dia_chi", "mo_ta", "quy_dinh_chung", "hinh_anh_tong_quan_url", "trang_thai"]) if (req.body[key] !== undefined) patch[key] = req.body[key];
      if (patch.trang_thai === "NGUNG_HOAT_DONG") { const occupied = await PhongTro.count({ where: { ma_can: item.ma_can, trang_thai: ["DANG_THUE", "DA_GIU", "DANG_XU_LY_TRA_PHONG"] } }); if (occupied) throw { status: 409, message: "Không thể ngừng hoạt động căn còn phòng đang thuê/giữ/xử lý trả" }; }
      await item.update(patch);
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
      res
        .status(201)
        .json({
          success: true,
          data: await KhachThue.create(req.body),
          message: "Tạo khách thuê thành công",
        });
    } catch (error) {
      next(error);
    }
  }

  async updateKhachThue(req, res, next) {
    try {
      const item = await KhachThue.findByPk(req.params.id);
      if (!item) throw notFound("Khách thuê không tồn tại");
      const patch = {}; for (const key of ["ho_ten", "so_dien_thoai", "cccd_giay_to"]) if (req.body[key] !== undefined) patch[key] = req.body[key]; await item.update(patch);
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
      res
        .status(201)
        .json({
          success: true,
          data: await KhoanChi.create({ loai_khoan_chi: String(req.body.loai_khoan_chi || "").trim(), so_tien: Number(req.body.so_tien), ngay_phat_sinh: req.body.ngay_phat_sinh, pham_vi: req.body.pham_vi, ghi_chu: req.body.ghi_chu || null, ma_can: req.body.ma_can || null, trang_thai: "HIEU_LUC" }),
          message: "Tạo khoản chi thành công",
        });
    } catch (error) {
      next(error);
    }
  }

  async updateChiPhi(req, res, next) {
    try {
      const item = await KhoanChi.findByPk(req.params.id);
      if (!item) throw notFound("Khoản chi không tồn tại");
      const patch = {}; for (const key of ["loai_khoan_chi", "ngay_phat_sinh", "pham_vi", "ghi_chu", "ma_can"]) if (req.body[key] !== undefined) patch[key] = req.body[key]; if (req.body.so_tien !== undefined) patch.so_tien = Number(req.body.so_tien); if (!patch.loai_khoan_chi && !item.loai_khoan_chi) throw Object.assign(new Error("Loại khoản chi là bắt buộc"), { status: 422 }); if (patch.so_tien !== undefined && (!Number.isFinite(patch.so_tien) || patch.so_tien < 0)) throw Object.assign(new Error("Số tiền không hợp lệ"), { status: 422 }); await item.update(patch);
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
      const item = await KhoanChi.findByPk(req.params.id);
      if (!item) throw notFound("Khoản chi không tồn tại");
      const reason = String(req.body.reason || "").trim(); if (!reason) throw Object.assign(new Error("Lý do hủy là bắt buộc"), { status: 422 }); await item.update({ trang_thai: "DA_HUY", ly_do_huy: reason, ngay_huy: new Date(), nguoi_huy_id: req.user.ma_tai_khoan });
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
