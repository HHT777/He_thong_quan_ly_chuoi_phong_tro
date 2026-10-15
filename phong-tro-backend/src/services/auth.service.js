const jwt = require("jsonwebtoken");
const { TaiKhoan, KhachThue } = require("../models");
const sequelize = require("../config/database");

class AuthService {
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

    return taiKhoan;
  }
}

module.exports = new AuthService();
