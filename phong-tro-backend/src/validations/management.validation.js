const Joi = require("joi");

const id = Joi.string().guid({ version: ["uuidv4"] });
const buildingFields = {
  ten_can: Joi.string().trim().max(100), dia_chi: Joi.string().trim().max(255), mo_ta: Joi.string().allow(null, "").max(1000),
  quy_dinh_chung: Joi.string().allow(null, "").max(2000), hinh_anh_tong_quan_url: Joi.string().allow(null, "").max(500),
  trang_thai: Joi.string().valid("HOAT_DONG", "NGUNG_HOAT_DONG"),
};
const tenantFields = { ho_ten: Joi.string().trim().max(100), so_dien_thoai: Joi.string().trim().pattern(/^\d{9,15}$/), cccd_giay_to: Joi.string().trim().max(20) };
const expenseFields = {
  loai_khoan_chi: Joi.string().trim().max(50), so_tien: Joi.number().positive(), ngay_phat_sinh: Joi.date().iso(),
  pham_vi: Joi.string().valid("CAN_TRO", "TOAN_CHUOI"), ghi_chu: Joi.string().allow(null, "").max(1000), ma_can: id.allow(null),
};

module.exports = {
  createBuilding: Joi.object({ ...buildingFields, ten_can: buildingFields.ten_can.required(), dia_chi: buildingFields.dia_chi.required() }).unknown(false),
  updateBuilding: Joi.object(buildingFields).min(1).unknown(false),
  createTenant: Joi.object({ ...tenantFields, ho_ten: tenantFields.ho_ten.required(), so_dien_thoai: tenantFields.so_dien_thoai.required(), cccd_giay_to: tenantFields.cccd_giay_to.required() }).unknown(false),
  updateTenant: Joi.object(tenantFields).min(1).unknown(false),
  createExpense: Joi.object({ ...expenseFields, loai_khoan_chi: expenseFields.loai_khoan_chi.required(), so_tien: expenseFields.so_tien.required(), ngay_phat_sinh: expenseFields.ngay_phat_sinh.required(), pham_vi: expenseFields.pham_vi.required() }).unknown(false),
  updateExpense: Joi.object(expenseFields).min(1).unknown(false),
};
