// FR-192: disposable, explicitly approved G2 migration verification only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const targets = Object.freeze({
  mysql8: { engine: "MySQL8", host: "127.0.0.1", port: 3307, db: "qlpt_g2_mysql_ci", collation: "utf8mb4_0900_ai_ci" },
  mariadb: { engine: "MariaDB", host: "127.0.0.1", port: 3306, db: "qlpt_g2_maria_ci", collation: "utf8mb4_general_ci" },
});
const key = process.argv[2];
if (!Object.hasOwn(targets, key)) throw new Error("Select mysql8 or mariadb; no other database is permitted");
const target = targets[key];
const approved = targets[key];
assert.equal(target.host, approved.host);
assert.equal(target.port, approved.port);
assert.equal(target.db, approved.db);

const options = (withDb = false) => ({
  host: target.host, port: target.port, user: process.env.TEST_DB_USER || "root",
  password: key === "mysql8" ? "" : (process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? ""),
  ...(withDb ? { database: target.db } : {}), charset: "utf8mb4", multipleStatements: true,
});
const label = () => `${target.engine} ${target.host}:${target.port} DB ${target.db}`;
function baseline() {
  const file = key === "mariadb" ? "D:\\backup\\phong_tro_truoc_nang_cap.sql"
    : path.resolve(__dirname, "../tests/fixtures/legacy-25-schema.sql");
  const source = fs.readFileSync(file, "utf8");
  assert.equal((source.match(/^\s*CREATE TABLE /gim) || []).length, 25, "baseline must contain 25 legacy tables");
  assert.doesNotMatch(source, /^\s*(?:USE|CREATE DATABASE|DROP DATABASE)\b/gim);
  assert.doesNotMatch(source, /`phong_tro`\s*\./i);
  return source;
}
async function checkSchema(connection) {
  const [tables] = await connection.query("SELECT TABLE_NAME,TABLE_COLLATION FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  assert.equal(tables.length, 37);
  for (const row of tables) assert.equal(row.TABLE_COLLATION, "utf8mb4_unicode_ci", row.TABLE_NAME);
  const [columns] = await connection.query("SELECT COLUMN_NAME,CHARACTER_SET_NAME,COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SuCo' AND COLUMN_NAME IN ('maSuCo','maSuCoTruoc')");
  assert.equal(columns.length, 2);
  assert.ok(columns.every((row) => row.CHARACTER_SET_NAME === "utf8mb4" && row.COLLATION_NAME === "utf8mb4_unicode_ci"));
  const [fk] = await connection.query("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SuCo' AND COLUMN_NAME='maSuCoTruoc' AND REFERENCED_TABLE_NAME='SuCo' AND REFERENCED_COLUMN_NAME='maSuCo'");
  assert.equal(fk.length, 1);
  const [index] = await connection.query("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SuCo' AND INDEX_NAME='ix_SuCo_maSuCoTruoc'");
  assert.ok(index.length >= 1);
  const doc = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  const expected = new Map([...doc.matchAll(/create table `([^`]+)` \(([\s\S]*?)\) engine=/gi)]
    .map((match) => [match[1].toLowerCase(), [...match[2].matchAll(/^`([^`]+)`\s+/gm)].map((column) => column[1]).sort()]));
  const [actualRows] = await connection.query("SELECT TABLE_NAME,COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE()");
  const actual = new Map();
  for (const row of actualRows) {
    const name = row.TABLE_NAME.toLowerCase();
    if (!actual.has(name)) actual.set(name, []);
    actual.get(name).push(row.COLUMN_NAME);
  }
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());
  for (const [name, names] of expected) assert.deepEqual(actual.get(name).sort(), names, name);
}

async function run() {
  const source = baseline(); // Read and validate the dump BEFORE any database operation.
  const names = fs.readdirSync(path.resolve(__dirname, "../migrations"))
    .filter((name) => /^(00[4-9]|01[0-6])_.*\.sql$/.test(name)).sort();
  assert.equal(names.length, 13);
  const admin = await mysql.createConnection(options());
  let created = false;
  try {
    const [version] = await admin.query("SELECT VERSION() version");
    assert.match(version[0].version, key === "mysql8" ? /^8\.0\./ : /^10\.4\./);
    const [existing] = await admin.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?", [target.db]);
    assert.equal(existing.length, 0, "Approved test DB already exists; refusing to overwrite");
    console.log(`${label()} BEFORE CREATE`);
    await admin.query(`CREATE DATABASE \`${target.db}\` CHARACTER SET utf8mb4 COLLATE ${target.collation}`);
    created = true;
    const connection = await mysql.createConnection(options(true));
    try {
      await connection.query(source);
      for (let pass = 1; pass <= 2; pass += 1) {
        for (const name of names) await connection.query(fs.readFileSync(path.resolve(__dirname, "../migrations", name), "utf8"));
        await checkSchema(connection);
        console.log(`${label()} version=${version[0].version} baseline=${key === "mysql8" ? "MÔ PHỎNG" : "dump thật 25 bảng"} 004-016 pass ${pass}/2 tables=37`);
      }
    } finally { await connection.end(); }
  } finally {
    if (created) {
      console.log(`${label()} BEFORE DROP`);
      await admin.query(`DROP DATABASE \`${target.db}\``);
      const [remaining] = await admin.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?", [target.db]);
      assert.equal(remaining.length, 0);
      console.log(`${label()} removed`);
    }
    await admin.end();
  }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
