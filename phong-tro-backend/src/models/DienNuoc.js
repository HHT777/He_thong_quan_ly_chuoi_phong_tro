const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DienNuoc = sequelize.define(
  "DienNuoc",
  {
    ma_dien_nuoc: {
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
      allowNull: true,
    },
    ky: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    chi_so_dau: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    chi_so_cuoi: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    luong_su_dung: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    don_gia: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    thanh_tien: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    so_nguoi: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tien_nuoc: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    nguoi_nhap: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    hinh_anh_minh_chung: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    trang_thai_xac_nhan: {
      type: DataTypes.ENUM("CHO_XAC_NHAN", "DA_XAC_NHAN", "CAN_DIEU_CHINH"),
      defaultValue: "CHO_XAC_NHAN",
      allowNull: false,
    },
    ocr_value: { type: DataTypes.STRING(32), allowNull: true },
    entry_mode: {
      type: DataTypes.ENUM(
        "OCR_ACCEPTED",
        "OCR_CORRECTED",
        "MANUAL_AFTER_OCR_FAILURE",
        "LANDLORD_MANUAL",
      ),
      allowNull: true,
    },
    correction_requested: { type: DataTypes.BOOLEAN, defaultValue: false },
    correction_reason: { type: DataTypes.TEXT, allowNull: true },
    evidence_path: { type: DataTypes.STRING(500), allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    confirmed_at: { type: DataTypes.DATE, allowNull: true },
    confirmed_by: { type: DataTypes.INTEGER, allowNull: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  {
    tableName: "dien_nuoc",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["ma_phong", "ky"],
      },
    ],
  },
);

module.exports = DienNuoc;
