const models = require("../models");
const sequelize = require("../config/database");

// The model registry is the single runtime contract; schema-contract.test.js
// compares the same registry with data2.md.
function requiredSchema() {
  const tables = new Map();
  for (const model of Object.values(models)) {
    if (!model?.tableName || tables.has(model.tableName)) continue;
    tables.set(model.tableName, Object.values(model.rawAttributes).map((attribute) => attribute.field));
  }
  return tables;
}

async function checkSchema(db = sequelize, expected = requiredSchema()) {
  const [rows] = await db.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
  );
  const actual = new Map();
  for (const row of rows) {
    const table = String(row.TABLE_NAME).toLowerCase();
    if (!actual.has(table)) actual.set(table, new Set());
    actual.get(table).add(String(row.COLUMN_NAME).toLowerCase());
  }
  const missing = [];
  for (const [table, columns] of expected) {
    const found = actual.get(table.toLowerCase());
    if (!found) missing.push(`table:${table}`);
    else for (const column of columns) {
      if (!found.has(column.toLowerCase())) missing.push(`column:${table}.${column}`);
    }
  }
  return { ready: missing.length === 0, missing };
}

module.exports = { requiredSchema, checkSchema };
