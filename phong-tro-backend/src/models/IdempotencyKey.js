const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const IdempotencyKey = sequelize.define(
  "IdempotencyKey",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    scope: { type: DataTypes.STRING(150), allowNull: false },
    key: { type: DataTypes.STRING(150), allowNull: false },
    response_status: { type: DataTypes.INTEGER, allowNull: false },
    response_json: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "idempotency_key",
    timestamps: false,
    indexes: [{ unique: true, fields: ["scope", "key"] }],
  },
);

module.exports = IdempotencyKey;
