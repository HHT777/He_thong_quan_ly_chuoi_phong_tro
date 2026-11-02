const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MeterUpload = sequelize.define(
  "MeterUpload",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    token: { type: DataTypes.STRING(100), unique: true, allowNull: false },
    account_id: { type: DataTypes.INTEGER, allowNull: false },
    period: { type: DataTypes.STRING(7), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    ocr_status: { type: DataTypes.STRING(30), allowNull: false },
    ocr_value: { type: DataTypes.STRING(32), allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "meter_upload", timestamps: false },
);

module.exports = MeterUpload;
