const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { TaiKhoan, KhachThue } = require("../models");
const sequelize = require("../config/database");
const { writeAuditLog } = require("./auditLog.service");

class AuthService {
  passwordFingerprint(passwordHash) {
    return crypto.createHmac("sha256", process.env.JWT_SECRET).update(passwordHash).digest("hex").slice(0, 16);
  }

  issueTenantSession(account, tenantId, mustChangePassword = false) {
    const claims = {
      ma_tai_khoan: account.ma_tai_khoan,
      ten_dang_nhap: account.ten_dang_nhap,
      vai_tro: "KHACH_THUE",
      ma_khach_thue: tenantId,
      bat_buoc_doi_mat_khau: account.bat_buoc_doi_mat_khau,
      mustChangePassword,
      passwordFingerprint: this.passwordFingerprint(account.mat_khau),
    };
    const { passwordFingerprint, ...user } = claims;
    return { token: jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE }), user };
  }

  async changeTenantPassword(accountId, currentPassword, newPassword) {
    const invalid = (code, message) => { throw Object.assign(new Error(message), { status: 422, code }); };
    if (typeof currentPassword !== "string" || !currentPassword) invalid("CURRENT_PASSWORD_REQUIRED", "Cần nhập mật khẩu hiện tại");
    if (typeof newPassword !== "string" || !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword) || newPassword === "1") invalid("INVALID_NEW_PASSWORD", "Mật khẩu mới phải có ít nhất 8 ký tự gồm chữ và số");
    return sequelize.transaction(async (transaction) => {
      const account = await TaiKhoan.findByPk(accountId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!account || account.vai_tro !== "KHACH_THUE" || !await account.checkPassword(currentPassword)) invalid("CURRENT_PASSWORD_INCORRECT", "Mật khẩu hiện tại không đúng");
      const tenant = await KhachThue.findOne({ where: { ma_tai_khoan: accountId }, attributes: ["ma_khach_thue"], transaction });
      if (!tenant) invalid("TENANT_PROFILE_MISSING", "Tài khoản khách thuê không hợp lệ");
      const wasRequired = account.bat_buoc_doi_mat_khau;
      await account.update({ mat_khau: newPassword, bat_buoc_doi_mat_khau: false }, { transaction });
      await writeAuditLog({ transaction, actorId: accountId, action: "PASSWORD_CHANGED", entityType: "TaiKhoan", entityId: accountId, before: { bat_buoc_doi_mat_khau: wasRequired }, after: { bat_buoc_doi_mat_khau: false } });
      return { changed: true, ...this.issueTenantSession(account, tenant.ma_khach_thue) };
    });
  }
  async login(ten_dang_nhap, mat_khau) {
    // Find account
    const taiKhoan = await TaiKhoan.findOne({
      where: { ten_dang_nhap },
      include: [
        {
          model: KhachThue,
          as: "khachThue",
          required: false,
        },
      ],
    });

    if (!taiKhoan) {
      throw {
        status: 401,
        message: "Tên đăng nhập hoặc mật khẩu không chính xác",
      };
    }

    // Check password
    const isValidPassword = await taiKhoan.checkPassword(mat_khau);
    if (!isValidPassword) {
      throw {
        status: 401,
        message: "Tên đăng nhập hoặc mật khẩu không chính xác",
      };
    }

    // Check account status
    if (taiKhoan.trang_thai === "DA_KHOA") {
      throw {
        status: 403,
        message: "Tài khoản của bạn đã bị khóa",
      };
    }

    if (taiKhoan.vai_tro === "KHACH_THUE") return this.issueTenantSession(
      taiKhoan,
      taiKhoan.khachThue?.ma_khach_thue || null,
      taiKhoan.bat_buoc_doi_mat_khau === true || mat_khau === "1",
    );

    // Generate token
    const token = jwt.sign(
      {
        ma_tai_khoan: taiKhoan.ma_tai_khoan,
        ten_dang_nhap: taiKhoan.ten_dang_nhap,
        vai_tro: taiKhoan.vai_tro,
        ma_khach_thue: taiKhoan.khachThue?.ma_khach_thue || null,
        bat_buoc_doi_mat_khau: taiKhoan.bat_buoc_doi_mat_khau,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE },
    );

    return {
      token,
      user: {
        ma_tai_khoan: taiKhoan.ma_tai_khoan,
        ten_dang_nhap: taiKhoan.ten_dang_nhap,
        vai_tro: taiKhoan.vai_tro,
        ma_khach_thue: taiKhoan.khachThue?.ma_khach_thue || null,
        bat_buoc_doi_mat_khau: taiKhoan.bat_buoc_doi_mat_khau,
      },
    };
  }

  async registerKhachThue(data) {
    // Check if username exists
    const existingAccount = await TaiKhoan.findOne({
      where: { ten_dang_nhap: data.ten_dang_nhap },
    });

    if (existingAccount) {
      throw {
        status: 400,
        message: "Tên đăng nhập này đã được sử dụng",
      };
    }

    const { taiKhoan, khachThue } = await sequelize.transaction(async (transaction) => {
      // data2.md đặt FK trên KhachThue.maTaiKhoan, vì vậy tài khoản phải tạo trước.
      const account = await TaiKhoan.create({
        ten_dang_nhap: data.ten_dang_nhap,
        mat_khau: data.mat_khau,
        vai_tro: "KHACH_THUE",
        trang_thai: "HOAT_DONG",
        bat_buoc_doi_mat_khau: true,
      }, { transaction });
      const tenant = await KhachThue.create({
        ho_ten: data.ho_ten,
        so_dien_thoai: data.so_dien_thoai,
        cccd_giay_to: data.cccd_giay_to,
        ma_tai_khoan: account.ma_tai_khoan,
      }, { transaction });
      return { taiKhoan: account, khachThue: tenant };
    });

    return {
      ma_tai_khoan: taiKhoan.ma_tai_khoan,
      ten_dang_nhap: taiKhoan.ten_dang_nhap,
      vai_tro: taiKhoan.vai_tro,
      khachThue: khachThue,
    };
  }

  async getProfile(maTaiKhoan) {
    const taiKhoan = await TaiKhoan.findByPk(maTaiKhoan, {
      include: [
        {
          model: KhachThue,
          as: "khachThue",
          required: false,
        },
      ],
    });

    if (!taiKhoan) {
      throw {
        status: 404,
        message: "Không tìm thấy tài khoản",
      };
    }

    if (taiKhoan.vai_tro === "KHACH_THUE") {
      return {
        ma_tai_khoan: taiKhoan.ma_tai_khoan, ten_dang_nhap: taiKhoan.ten_dang_nhap,
        vai_tro: taiKhoan.vai_tro, trang_thai: taiKhoan.trang_thai,
        bat_buoc_doi_mat_khau: taiKhoan.bat_buoc_doi_mat_khau,
        mustChangePassword: taiKhoan.bat_buoc_doi_mat_khau === true,
        khachThue: taiKhoan.khachThue && {
          ma_khach_thue: taiKhoan.khachThue.ma_khach_thue,
          ho_ten: taiKhoan.khachThue.ho_ten,
          so_dien_thoai: taiKhoan.khachThue.so_dien_thoai,
        },
      };
    }
    return taiKhoan;
  }
}

module.exports = new AuthService();
