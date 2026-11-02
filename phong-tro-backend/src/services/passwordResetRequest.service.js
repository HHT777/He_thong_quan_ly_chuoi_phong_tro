const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { TaiKhoan, KhachThue, HopDong, PhongTro, CanTro, ChuTro, YeuCau } = require("../models");
const { createIdempotent } = require("./notification.service");

const REQUEST_TYPE = "DAT_LAI_MAT_KHAU";
const MAX_REQUESTS_PER_HOUR = 3;

function failure(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

async function create(phone) {
  const normalizedPhone = String(phone || "").trim();
  if (!/^(?:0|\+84)\d{9,10}$/.test(normalizedPhone)) {
    failure(422, "INVALID_PHONE", "Số điện thoại không hợp lệ");
  }

  return sequelize.transaction(async (transaction) => {
    const tenant = await KhachThue.findOne({
      where: { so_dien_thoai: normalizedPhone },
      include: [{ model: TaiKhoan, as: "taiKhoan", required: true, attributes: ["ma_tai_khoan", "trang_thai", "vai_tro"] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!tenant) failure(404, "PHONE_NOT_FOUND", "Số điện thoại không tồn tại");
    if (tenant.taiKhoan.vai_tro !== "KHACH_THUE" || tenant.taiKhoan.trang_thai !== "HOAT_DONG") {
      failure(403, "ACCOUNT_NOT_ACTIVE", "Tài khoản đang bị khóa, vui lòng liên hệ Chủ trọ");
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const pending = await YeuCau.findOne({
      where: { ma_khach_thue: tenant.ma_khach_thue, loai_yeu_cau: REQUEST_TYPE, trang_thai: "CHO_XU_LY" },
      transaction,
    });
    if (pending) failure(409, "PASSWORD_RESET_PENDING", "Bạn đã có yêu cầu đặt lại mật khẩu đang chờ xử lý");

    const recentCount = await YeuCau.count({
      where: { ma_khach_thue: tenant.ma_khach_thue, loai_yeu_cau: REQUEST_TYPE, ngay_gui: { [Op.gte]: since } },
      transaction,
    });
    if (recentCount >= MAX_REQUESTS_PER_HOUR) failure(429, "PASSWORD_RESET_RATE_LIMITED", "Bạn đã gửi quá số lần cho phép. Vui lòng thử lại sau");

    const request = await YeuCau.create({
      loai_yeu_cau: REQUEST_TYPE,
      noi_dung: "Khách thuê yêu cầu đặt lại mật khẩu",
      trang_thai: "CHO_XU_LY",
      ma_khach_thue: tenant.ma_khach_thue,
    }, { transaction });

    const contract = await HopDong.findOne({
      where: { ma_khach_thue: tenant.ma_khach_thue, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } },
      include: [{
        model: PhongTro,
        as: "phongTro",
        required: true,
        include: [{ model: CanTro, as: "canTro", required: true, include: [{ model: ChuTro, as: "chuTro", required: true }] }],
      }],
      transaction,
    });
    const ownerAccountId = contract?.phongTro?.canTro?.chuTro?.ma_tai_khoan;
    if (ownerAccountId) {
      await createIdempotent({
        ma_tai_khoan: ownerAccountId,
        loai_thong_bao: "YEU_CAU_DAT_LAI_MAT_KHAU",
        noi_dung: `Khách thuê ${tenant.ho_ten} vừa gửi yêu cầu đặt lại mật khẩu.`,
        khoa_su_kien: `YEU_CAU_DAT_LAI_MAT_KHAU:${request.ma_yeu_cau}`,
      }, { transaction });
    }
    return { ma_yeu_cau: request.ma_yeu_cau, trang_thai: request.trang_thai };
  });
}

module.exports = { create, REQUEST_TYPE, MAX_REQUESTS_PER_HOUR };
