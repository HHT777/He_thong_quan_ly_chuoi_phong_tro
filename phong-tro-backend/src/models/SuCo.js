const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

module.exports = sequelize.define("SuCo", {
  ma_su_co: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ma_khach_thue: { type: DataTypes.INTEGER, allowNull: false },
  ma_phong: { type: DataTypes.INTEGER, allowNull: false },
  tieu_de: { type: DataTypes.STRING(200), allowNull: false },
  mo_ta: { type: DataTypes.TEXT, allowNull: false },
  trang_thai: { type: DataTypes.ENUM("MOI", "DANG_XU_LY", "HOAN_TAT", "DA_HUY"), defaultValue: "MOI" },
  ben_chiu_chi_phi: { type: DataTypes.ENUM("CHU_TRO", "KHACH_THUE", "CHUA_XAC_DINH"), defaultValue: "CHUA_XAC_DINH" },
  chi_phi: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  ghi_chu_xu_ly: { type: DataTypes.TEXT, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: "su_co", timestamps: false });
