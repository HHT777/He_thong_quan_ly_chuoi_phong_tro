const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("NguoiO", {
  ma_nguoi_o: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ma_khach_thue: { type: DataTypes.INTEGER, allowNull: false },
  ho_ten: { type: DataTypes.STRING(150), allowNull: false },
  cccd: { type: DataTypes.STRING(50), allowNull: false },
  so_dien_thoai: { type: DataTypes.STRING(20), allowNull: true },
  ngay_sinh: { type: DataTypes.DATEONLY, allowNull: true },
  gioi_tinh: { type: DataTypes.STRING(20), allowNull: true },
  dia_chi_thuong_tru: { type: DataTypes.STRING(255), allowNull: true },
  quan_he: { type: DataTypes.STRING(80), allowNull: true },
  ngay_bat_dau_o: { type: DataTypes.DATEONLY, allowNull: true },
  trang_thai: { type: DataTypes.ENUM("CHO_DUYET", "DA_DUYET", "TU_CHOI"), defaultValue: "CHO_DUYET" },
  ly_do: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "nguoi_o", timestamps: false });
