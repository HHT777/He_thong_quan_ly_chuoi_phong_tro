const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    actor_id: { type: DataTypes.STRING(36), allowNull: false },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity_type: { type: DataTypes.STRING(100), allowNull: false },
    entity_id: { type: DataTypes.STRING(100), allowNull: false },
    before_json: { type: DataTypes.JSON, allowNull: true },
    after_json: { type: DataTypes.JSON, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    correlation_id: { type: DataTypes.STRING(100), allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "audit_log", timestamps: false, charset: "utf8mb4", collate: "utf8mb4_unicode_ci" },
);

module.exports = AuditLog;
