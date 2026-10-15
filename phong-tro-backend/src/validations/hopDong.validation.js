const Joi = require("joi");

const hopDongValidation = {
  createHopDong: Joi.object({
    ma_khach_thue: Joi.string().max(36).required(),
    ma_phong: Joi.string().max(36).required(),
    ngay_bat_dau: Joi.date().required(),
    ngay_ket_thuc: Joi.date().required(),
    gia_thue: Joi.number().positive().required(),
    tien_coc: Joi.number().min(0).required(),
    don_gia_dien: Joi.number().min(0).required(),
    chi_so_dien_ban_dau: Joi.number().integer().min(0).required(),
    don_gia_nuoc: Joi.number().min(0).required(),
    dieu_khoan: Joi.string().max(255).required(),
    da_co_ban_giay_ky: Joi.boolean().valid(true).required(),
    phi_dich_vu: Joi.number().min(0).default(0),
    goi_gia_han_cho_phep: Joi.string().valid("6", "12", "6,12").allow(null),
    ngay_nhan_coc: Joi.date().allow(null),
  }),

  updateHopDong: Joi.object({
    ngay_ket_thuc: Joi.date(),
    gia_thue: Joi.number().positive(),
    don_gia_dien: Joi.number().min(0),
    don_gia_nuoc: Joi.number().min(0),
    dieu_khoan: Joi.string().max(255),
    trang_thai: Joi.string().valid(
      "DANG_HIEU_LUC",
      "SAP_HET_HAN",
      "HET_HAN",
      "DA_THANH_LY",
    ),
    ngay_thanh_ly: Joi.date().allow(null),
    phi_dich_vu: Joi.number().min(0),
    goi_gia_han_cho_phep: Joi.string().valid("6", "12", "6,12").allow(null),
    reason: Joi.string().trim().min(1).max(1000).required(),
  }).min(2),

  renewHopDong: Joi.object({
    ngay_bat_dau_moi: Joi.date().required(),
    ngay_ket_thuc_moi: Joi.date().required(),
    gia_thue_moi: Joi.number().positive(),
  }),
};

module.exports = hopDongValidation;
