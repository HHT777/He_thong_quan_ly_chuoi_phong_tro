const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("YeuCau", {
  ma_yeu_cau: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  loai: { type: DataTypes.ENUM("GIA_HAN", "TRA_PHONG"), allowNull: false },
  ma_khach_thue: { type: DataTypes.INTEGER, allowNull: false },
  ma_hop_dong: { type: DataTypes.INTEGER, allowNull: true },
  noi_dung: { type: DataTypes.TEXT, allowNull: true },
  ngay_du_kien: { type: DataTypes.DATE, allowNull: true },
  yeu_cau_tra_som: { type: DataTypes.BOOLEAN, defaultValue: false },
  ngay_duyet: { type: DataTypes.DATE, allowNull: true },
  so_thang_gia_han: { type: DataTypes.INTEGER, allowNull: true },
  trang_thai: { type: DataTypes.ENUM("CHO_DUYET", "DA_DUYET", "TU_CHOI", "DA_RUT"), defaultValue: "CHO_DUYET" },
  ly_do_xu_ly: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "yeu_cau", timestamps: false });
