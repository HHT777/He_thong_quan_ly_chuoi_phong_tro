const Joi = require("joi");

const khoanPhaiThuValidation = {
  createKhoanPhaiThu: Joi.object({
    ma_hop_dong: Joi.string().max(36),
    ma_phong: Joi.string().max(36).when("ma_hop_dong", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
    ma_khach_thue: Joi.string().max(36).when("ma_hop_dong", { is: Joi.exist(), then: Joi.optional(), otherwise: Joi.required() }),
    ky: Joi.string()
      .pattern(/^\d{4}-\d{2}$/)
      .required(),
    tien_phong: Joi.number().default(0),
    tien_dien: Joi.number().default(0),
    tien_nuoc: Joi.number().default(0),
    phi_dich_vu: Joi.number().default(0),
    phi_phat_sinh: Joi.number().default(0),
    khoan_giam_tru: Joi.number().default(0),
    tong_phai_thanh_toan: Joi.number().min(0),
    han_thanh_toan: Joi.date(),
  }),

  getKhoanPhaiThuList: Joi.object({
    page: Joi.number().min(1),
    limit: Joi.number().min(1),
    ma_phong: Joi.string().max(36),
    ma_khach_thue: Joi.string().max(36),
    trang_thai_thanh_toan: Joi.string(),
    ky: Joi.string(),
  }),
};

const thanhToanValidation = {
  createThanhToan: Joi.object({
    ma_khoan_phai_thu: Joi.string().max(36).required(),
    ngay_thanh_toan: Joi.date().required(),
    so_tien: Joi.number().positive().required(),
    phuong_thuc: Joi.string().required(),
    minh_chung_url: Joi.string().max(500).allow("", null),
    ghi_chu: Joi.string(),
  }),
};

module.exports = {
  khoanPhaiThuValidation,
  thanhToanValidation,
};
