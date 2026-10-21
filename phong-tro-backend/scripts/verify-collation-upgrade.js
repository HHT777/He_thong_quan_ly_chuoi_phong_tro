// Manual destructive verification. Only the two explicitly approved disposable DBs are allowed.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { approvedTestTarget } = require("../src/config/testDatabaseSafety");

const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");
const LEGACY_DUMP = "D:\\backup\\phong_tro_truoc_nang_cap.sql";
const TARGETS = Object.freeze({
  mysql8: { label: "MySQL8", host: "127.0.0.1", port: 3307, database: "qlpt_collation_m8_ci", defaultCollation: "utf8mb4_0900_ai_ci" },
  mariadb: { label: "MariaDB", host: "127.0.0.1", port: 3306, database: "qlpt_collation_maria_ci", defaultCollation: "utf8mb4_general_ci" },
});

function assertTarget(config) {
  const expected = Object.values(TARGETS).find((target) => target.database === config.database);
  assert.ok(expected, "unapproved database target");
  assert.equal(config.host, expected.host);
  assert.equal(config.port, expected.port);
  assert.equal(config.defaultCollation, expected.defaultCollation);
}

function connectionOptions(config, withDatabase = false) {
  assertTarget(config);
  approvedTestTarget(process.env, config.database, { expectedPort: config.port });
  if (!process.env.TEST_DB_USER) throw new Error("TEST_DB_USER is required");
  return {
    host: config.host, port: config.port,
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD ?? "",
    ...(withDatabase ? { database: config.database } : {}),
    charset: "utf8mb4", multipleStatements: true,
  };
}

function logDdl(config, verb) {
  console.log(`${config.label} ${config.host}:${config.port} DB ${config.database} BEFORE ${verb}`);
}

async function makeDatabase(admin, config) {
  assertTarget(config);
  const [existing] = await admin.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?", [config.database]);
  assert.equal(existing.length, 0, `${config.database} already exists; refusing to overwrite it`);
  logDdl(config, "CREATE");
  await admin.query(`CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE ${config.defaultCollation}`);
}

async function removeDatabase(admin, config) {
  assertTarget(config);
  logDdl(config, "DROP");
  await admin.query(`DROP DATABASE \`${config.database}\``);
  const [remaining] = await admin.execute("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME=?", [config.database]);
  assert.equal(remaining.length, 0, `${config.database} was not removed`);
  console.log(`${config.label} ${config.host}:${config.port} DB ${config.database} removed`);
}

function baseline(config) {
  if (config.label === "MariaDB") {
    const source = fs.readFileSync(LEGACY_DUMP, "utf8");
    assert.equal((source.match(/^CREATE TABLE /gim) || []).length, 25, "legacy dump must contain exactly 25 tables");
    assert.doesNotMatch(source, /^\s*(?:USE|CREATE DATABASE|DROP DATABASE)\b/gim, "dump must not select another database");
    assert.doesNotMatch(source, /`phong_tro`\s*\./i, "dump must not qualify the real database");
    return source;
  }
  // MySQL 8 cannot import the MariaDB dump (generated-column error 3105).
  // This is a SIMULATION: the historical 25-table schema, not the real old dump.
  const source = fs.readFileSync(path.resolve(__dirname, "../tests/fixtures/legacy-25-schema.sql"), "utf8");
  assert.equal((source.match(/^create table /gim) || []).length, 25, "historical baseline must contain exactly 25 tables");
  return source;
}

function migrationNames() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((name) => /^(00[4-9]|01[0-5])_.*\.sql$/.test(name)).sort();
  assert.equal(files.length, 12, "expected migrations 004 through 015");
  return files;
}

async function applyMigrations(connection, names, mutation = false) {
  for (const name of names) {
    let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
    if (mutation && name.startsWith("009_")) {
      const broken = sql.replace("DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;", "DEFAULT CHARSET=utf8mb4;");
      assert.notEqual(broken, sql, "negative test must actually remove COLLATE from migration 009");
      sql = broken;
    }
    await connection.query(sql);
  }
}

async function assertSchema(connection) {
  const [tables] = await connection.query("SELECT TABLE_NAME, TABLE_COLLATION FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  assert.equal(tables.length, 37, "expected 37 tables after upgrade");
  for (const table of tables) assert.equal(table.TABLE_COLLATION, "utf8mb4_unicode_ci", table.TABLE_NAME);
  const documentation = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  const expected = new Map();
  for (const match of documentation.matchAll(/create table `([^`]+)` \(([\s\S]*?)\) engine=/gi)) {
    expected.set(match[1].toLowerCase(), [...match[2].matchAll(/^`([^`]+)`\s+/gm)].map((column) => column[1]).sort());
  }
  assert.equal(expected.size, 37, "data2.md must document 37 tables");
  const [columns] = await connection.query("SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION");
  const actual = new Map();
  for (const row of columns) {
    const tableName = row.TABLE_NAME.toLowerCase();
    if (!actual.has(tableName)) actual.set(tableName, []);
    actual.get(tableName).push(row.COLUMN_NAME);
  }
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort(), "tables differ from data2.md");
  for (const [table, names] of expected) assert.deepEqual(actual.get(table).sort(), names, `${table} columns differ from data2.md`);
  const [mismatches] = await connection.query(`
    SELECT k.CONSTRAINT_NAME, k.TABLE_NAME, k.COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
    JOIN INFORMATION_SCHEMA.COLUMNS child ON child.TABLE_SCHEMA=k.TABLE_SCHEMA AND child.TABLE_NAME=k.TABLE_NAME AND child.COLUMN_NAME=k.COLUMN_NAME
    JOIN INFORMATION_SCHEMA.COLUMNS parent ON parent.TABLE_SCHEMA=k.REFERENCED_TABLE_SCHEMA AND parent.TABLE_NAME=k.REFERENCED_TABLE_NAME AND parent.COLUMN_NAME=k.REFERENCED_COLUMN_NAME
    WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL AND child.CHARACTER_SET_NAME IS NOT NULL
      AND (child.CHARACTER_SET_NAME<>parent.CHARACTER_SET_NAME OR child.COLLATION_NAME<>parent.COLLATION_NAME)
  `);
  assert.deepEqual(mismatches, [], "FK string charset/collation mismatch");
}

async function runTarget(config) {
  assertTarget(config);
  const admin = await mysql.createConnection(connectionOptions(config));
  let created = false;
  try {
    const [version] = await admin.query("SELECT VERSION() AS version");
    assert.match(version[0].version, config.label === "MySQL8" ? /^8\.0\./ : /^10\.4\./);
    console.log(`${config.label} version=${version[0].version} baseline=${config.label === "MariaDB" ? "real-25-table-dump" : "simulated-25-table-schema"}`);
    const source = baseline(config); // Validate before any CREATE.
    const names = migrationNames();

    await makeDatabase(admin, config);
    created = true;
    let connection = await mysql.createConnection(connectionOptions(config, true));
    try {
      await connection.query(source);
      await applyMigrations(connection, names.slice(0, names.findIndex((name) => name.startsWith("009_"))));
      let negativeError;
      try { await applyMigrations(connection, names.filter((name) => name.startsWith("009_")), true); }
      catch (error) { negativeError = error; }
      assert.ok(negativeError, "negative test must fail when 009 CREATE TABLE omits COLLATE");
      console.log(`${config.label} mutation 009 RED: ${negativeError.code || negativeError.errno} ${negativeError.message}`);
    } finally { await connection.end(); }

    await removeDatabase(admin, config);
    created = false;
    await makeDatabase(admin, config);
    created = true;
    connection = await mysql.createConnection(connectionOptions(config, true));
    try {
      await connection.query(source);
      for (let pass = 1; pass <= 2; pass += 1) {
        await applyMigrations(connection, names);
        await assertSchema(connection);
        console.log(`${config.label} migrations 004-015 pass ${pass}/2: 37 tables, collation/FK OK`);
      }
    } finally { await connection.end(); }
  } finally {
    if (created) await removeDatabase(admin, config);
    await admin.end();
  }
}

const selected = process.argv[2];
if (!Object.hasOwn(TARGETS, selected)) throw new Error("Usage: node scripts/verify-collation-upgrade.js mysql8|mariadb");
runTarget(TARGETS[selected]).catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
