const jwt = require("jsonwebtoken");
const { TaiKhoan, KhachThue } = require("../models");
const authService = require("../services/auth.service");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token không được cung cấp",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.vai_tro === "KHACH_THUE") {
      const account = await TaiKhoan.findByPk(decoded.ma_tai_khoan, {
        attributes: ["ma_tai_khoan", "ten_dang_nhap", "vai_tro", "trang_thai", "bat_buoc_doi_mat_khau", "mat_khau"],
        include: [{ model: KhachThue, as: "khachThue", attributes: ["ma_khach_thue"], required: false }],
      });
      const tenantId = account?.khachThue?.ma_khach_thue;
      if (!account || account.trang_thai !== "HOAT_DONG" || account.vai_tro !== "KHACH_THUE"
        || !tenantId || String(tenantId) !== String(decoded.ma_khach_thue)
        || !decoded.passwordFingerprint || decoded.passwordFingerprint !== authService.passwordFingerprint(account.mat_khau)) {
        return res.status(401).json({ success: false, message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn" });
      }
      req.user = { ...decoded, ten_dang_nhap: account.ten_dang_nhap, bat_buoc_doi_mat_khau: account.bat_buoc_doi_mat_khau, ma_khach_thue: tenantId };
      delete req.user.passwordFingerprint;
      if (decoded.mustChangePassword === true) {
        const route = `${req.baseUrl || ""}${req.path || ""}`;
        if (!((req.method === "GET" && route === "/api/auth/profile") || (req.method === "PATCH" && route === "/api/v1/account/password"))) {
          return res.status(403).json({ success: false, code: "PASSWORD_CHANGE_REQUIRED", message: "Cần đổi mật khẩu trước khi tiếp tục" });
        }
      }
    } else req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};

module.exports = authMiddleware;
