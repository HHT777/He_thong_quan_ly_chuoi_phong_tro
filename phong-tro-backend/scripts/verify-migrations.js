require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const database = String(process.env.MIGRATION_TEST_DB_NAME || "").trim();
if (!/^[A-Za-z0-9_]+_(?:test|ci)$/i.test(database)) throw new Error("MIGRATION_TEST_DB_NAME must end in _test or _ci");
if (database === process.env.DB_NAME) throw new Error("Migration copy must differ from DB_NAME");

const options = (withDatabase = false) => ({
  host: process.env.TEST_DB_HOST || process.env.DB_HOST,
  port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 3306),
  user: process.env.TEST_DB_USER || process.env.DB_USER,
  password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
  ...(withDatabase ? { database } : {}),
  charset: "utf8mb4",
  multipleStatements: true,
});

function baselineSql() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  return source.slice(0, source.indexOf("-- 3."))
    .replace(/^create database[^;]+;\s*$/gim, "")
    .replace(/^use\s+`[^`]+`;\s*$/gim, "");
}

function documentedSchema() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  const tables = new Map();
  for (const match of source.matchAll(/create table `([^`]+)` \(([\s\S]*?)\) engine=/gi)) {
    tables.set(match[1], [...match[2].matchAll(/^`([^`]+)`\s+/gm)].map((column) => column[1]).sort());
  }
  return tables;
}

async function actualSchema(connection) {
  const [rows] = await connection.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? ORDER BY TABLE_NAME, ORDINAL_POSITION",
    [database],
  );
  const tables = new Map();
  for (const row of rows) {
    const tableName = String(row.TABLE_NAME).toLowerCase();
    if (!tables.has(tableName)) tables.set(tableName, []);
    tables.get(tableName).push(row.COLUMN_NAME);
  }
  for (const columns of tables.values()) columns.sort();
  return tables;
}

async function run() {
  const admin = await mysql.createConnection(options(false));
  const quoted = `\`${database}\``;
  await admin.query(`DROP DATABASE IF EXISTS ${quoted}`);
  await admin.query(`CREATE DATABASE ${quoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  const connection = await mysql.createConnection(options(true));
  try {
    await connection.query(baselineSql());
    const [beforeRows] = await connection.query("SELECT (SELECT COUNT(*) FROM HopDong) contracts, (SELECT COUNT(*) FROM PhongTro) rooms, (SELECT COUNT(*) FROM TaiKhoan) accounts");
    await connection.query("SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS LichSuChuyenPhong, LichSuGiaHanHopDong, LichSuSuaHopDong; ALTER TABLE HopDong DROP COLUMN goiGiaHanChoPhep, DROP COLUMN phiDichVu, DROP COLUMN daCoBanGiayKy; SET FOREIGN_KEY_CHECKS=1;");
    const migrations = fs.readdirSync(path.resolve(__dirname, "../migrations"))
      .filter((name) => /^(00[4-9]|010|011)_.*\.sql$/.test(name))
      .sort();
    for (let pass = 1; pass <= 2; pass += 1) {
      for (const name of migrations) {
        await connection.query(fs.readFileSync(path.resolve(__dirname, "../migrations", name), "utf8"));
      }
    }
    const [afterRows] = await connection.query("SELECT (SELECT COUNT(*) FROM HopDong) contracts, (SELECT COUNT(*) FROM PhongTro) rooms, (SELECT COUNT(*) FROM TaiKhoan) accounts");
    if (JSON.stringify(beforeRows[0]) !== JSON.stringify(afterRows[0])) throw new Error("Migration changed existing core row counts");
    const expected = documentedSchema();
    const actual = await actualSchema(connection);
    const expectedNames = new Set([...expected.keys()].map((table) => table.toLowerCase()));
    const missingTables = [...expected.keys()].filter((table) => !actual.has(table.toLowerCase()));
    const extraTables = [...actual.keys()].filter((table) => !expectedNames.has(table));
    const columnMismatches = [...expected].filter(([table, columns]) => JSON.stringify(columns) !== JSON.stringify(actual.get(table.toLowerCase()) || []));
    if (missingTables.length || extraTables.length || columnMismatches.length) {
      throw new Error(JSON.stringify({ missingTables, extraTables, columnMismatches }));
    }
    console.log(JSON.stringify({ database, passes: 2, migrations, preservedRows: afterRows[0], tables: actual.size }));
  } finally {
    await connection.end();
    const cleanup = await mysql.createConnection(options(false));
    await cleanup.query(`DROP DATABASE IF EXISTS ${quoted}`);
    await cleanup.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
