const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const KhoanPhaiThu = sequelize.define(
  "KhoanPhaiThu",
  {
    ma_khoan_phai_thu: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ma_phong: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ma_khach_thue: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ky: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    tien_phong: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    tien_dien: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    tien_nuoc: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    phi_dich_vu: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    phi_phat_sinh: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    khoan_giam_tru: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },
    tong_phai_thanh_toan: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    han_thanh_toan: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    trang_thai_thanh_toan: {
      type: DataTypes.ENUM(
        "CHUA_THANH_TOAN",
        "THANH_TOAN_MOT_PHAN",
        "DA_THANH_TOAN",
        "QUA_HAN",
      ),
      defaultValue: "CHUA_THANH_TOAN",
      allowNull: false,
    },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    da_ghi_no: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ngay_ghi_no: { type: DataTypes.DATE, allowNull: true },
    so_tien_ghi_no: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  },
  {
    tableName: "khoan_phai_thu",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["ma_phong", "ky"],
      },
    ],
  },
);

module.exports = KhoanPhaiThu;
