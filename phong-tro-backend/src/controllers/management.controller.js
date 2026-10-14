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

  async updateCanTro(req, res, next) {
    try {
      const item = await CanTro.findByPk(req.params.id);
      if (!item) throw notFound("Căn trọ không tồn tại");
      await item.update(req.body);
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
      const data = await KhachThue.findAll({
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
      await item.update(req.body);
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
          data: await KhoanChi.create(req.body),
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
      await item.update(req.body);
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
      await item.destroy();
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
