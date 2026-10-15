const { ThongBao, SuCo, HopDong } = require("../models");

class TenantController {
  async listNotifications(req, res, next) {
    try {
      const data = await ThongBao.findAll({
        where: { ma_tai_khoan: req.user.ma_tai_khoan },
        order: [["thoi_diem_tao", "DESC"]],
      });
      res.json({ success: true, data, message: "Lấy thông báo thành công" });
    } catch (error) {
      next(error);
    }
  }

  async createIssue(req, res, next) {
    try {
      if (!req.body.noi_dung || !req.body.loai_su_co || !req.body.muc_do_uu_tien)
        return res
          .status(400)
          .json({ success: false, message: "Vui lòng nhập nội dung sự cố" });
      const contract = await HopDong.findOne({ where: { ma_khach_thue: req.user.ma_khach_thue, trang_thai: { [require("sequelize").Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } } });
      if (!contract) return res.status(404).json({ success: false, message: "Không có hợp đồng hiệu lực" });
      const data = await SuCo.create({
        ma_nguoi_gui: req.user.ma_tai_khoan,
        ma_phong: contract.ma_phong,
        loai_su_co: req.body.loai_su_co,
        muc_do_uu_tien: req.body.muc_do_uu_tien,
        mo_ta: req.body.noi_dung,
        hinh_anh_url: req.body.hinh_anh_url || null,
        trang_thai: "CHO_TIEP_NHAN",
      });
      res
        .status(201)
        .json({ success: true, data, message: "Đã gửi thông báo sự cố" });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TenantController();
