const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OutboxEvent = sequelize.define(
  "OutboxEvent",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    event_id: { type: DataTypes.STRING(100), unique: true, allowNull: false },
    event_type: { type: DataTypes.STRING(100), allowNull: false },
    aggregate_id: { type: DataTypes.STRING(100), allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: false },
    published_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "outbox_event", timestamps: false },
);

module.exports = OutboxEvent;
