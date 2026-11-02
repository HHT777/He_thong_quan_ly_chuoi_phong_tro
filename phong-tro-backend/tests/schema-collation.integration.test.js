const test = require("node:test");
const assert = require("node:assert/strict");
const sequelize = require("../src/config/database");

test("schema contract: every table and foreign-key string pair uses utf8mb4_unicode_ci", async () => {
  const [tables] = await sequelize.query(`
    SELECT TABLE_NAME, TABLE_COLLATION
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
  `);
  assert.equal(tables.length, 37, "all documented tables must exist");
  for (const table of tables) {
    assert.equal(table.TABLE_COLLATION, "utf8mb4_unicode_ci", `table ${table.TABLE_NAME}`);
  }

  const [pairs] = await sequelize.query(`
    SELECT k.CONSTRAINT_NAME, k.TABLE_NAME AS childTable, k.COLUMN_NAME AS childColumn,
           k.REFERENCED_TABLE_NAME AS parentTable, k.REFERENCED_COLUMN_NAME AS parentColumn,
           child.CHARACTER_SET_NAME AS childCharset, child.COLLATION_NAME AS childCollation,
           parent.CHARACTER_SET_NAME AS parentCharset, parent.COLLATION_NAME AS parentCollation
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    JOIN INFORMATION_SCHEMA.COLUMNS child
      ON child.TABLE_SCHEMA=k.TABLE_SCHEMA AND child.TABLE_NAME=k.TABLE_NAME AND child.COLUMN_NAME=k.COLUMN_NAME
    JOIN INFORMATION_SCHEMA.COLUMNS parent
      ON parent.TABLE_SCHEMA=k.REFERENCED_TABLE_SCHEMA AND parent.TABLE_NAME=k.REFERENCED_TABLE_NAME
      AND parent.COLUMN_NAME=k.REFERENCED_COLUMN_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL
      AND child.CHARACTER_SET_NAME IS NOT NULL
  `);
  assert.ok(pairs.length > 0, "foreign-key string columns must be checked");
  for (const pair of pairs) {
    const label = `${pair.CONSTRAINT_NAME}: ${pair.childTable}.${pair.childColumn} -> ${pair.parentTable}.${pair.parentColumn}`;
    assert.equal(pair.childCharset, pair.parentCharset, `${label} charset`);
    assert.equal(pair.childCollation, pair.parentCollation, `${label} collation`);
    assert.equal(pair.childCollation, "utf8mb4_unicode_ci", `${label} canonical collation`);
  }
});
