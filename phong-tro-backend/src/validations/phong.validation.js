const Joi = require("joi");

const phongValidation = {
  createPhong: Joi.object({
    ma_can: Joi.string().max(36).required().messages({
      "any.required": "Mã căn không được để trống",
    }),
    gia_thue: Joi.number().positive().required().messages({
      "number.positive": "Giá thuê phải lớn hơn 0",
      "any.required": "Giá thuê không được để trống",
    }),
    trang_thai: Joi.string().valid(
      "TRONG",
      "DANG_THUE",
      "DANG_XU_LY_TRA_PHONG",
      "NGUNG_SU_DUNG",
    ),
    so_phong: Joi.string().max(255).required(),
    dien_tich: Joi.number().positive().required(),
    so_nguoi_toi_da: Joi.number().integer().positive().required(),
    noi_that_mo_ta: Joi.string().max(1000).allow("", null),
  }),

  updatePhong: Joi.object({
    gia_thue: Joi.number().positive(),
    trang_thai: Joi.string().valid(
      "TRONG",
      "DANG_THUE",
      "DANG_XU_LY_TRA_PHONG",
      "NGUNG_SU_DUNG",
    ),
    so_phong: Joi.string().max(255),
    dien_tich: Joi.number().positive(),
    so_nguoi_toi_da: Joi.number().integer().positive(),
    noi_that_mo_ta: Joi.string().max(1000).allow("", null),
  }),

  getPhong: Joi.object({
    page: Joi.number().min(1),
    limit: Joi.number().min(1),
    ma_can: Joi.string().max(36),
    trang_thai: Joi.string(),
  }),
};

module.exports = phongValidation;
