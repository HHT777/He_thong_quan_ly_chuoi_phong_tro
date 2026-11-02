const Joi = require("joi");

const datCocValidation = {
  createDatCoc: Joi.object({
    ma_hop_dong: Joi.string().max(36).required(),
    so_tien_coc: Joi.number().min(0).required(),
    ngay_nhan_coc: Joi.date().allow(null),
  }),

  updateDatCoc: Joi.object({
    trang_thai: Joi.string().valid(
      "CHUA_NHAN",
      "DA_NHAN",
      "DA_HOAN",
      "DA_KHAU_TRU_MOT_PHAN",
      "DA_KHAU_TRU_TOAN_BO",
    ),
    ngay_nhan_coc: Joi.date().allow(null),
    so_tien_da_hoan: Joi.number().min(0),
    so_tien_da_khau_tru: Joi.number().min(0),
  }),
};

module.exports = datCocValidation;
