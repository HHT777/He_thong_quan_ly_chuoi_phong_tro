require("dotenv").config();

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const { applyTestAuthDefaults } = require("../src/config/environment");

const root = path.resolve(__dirname, "..");
const testsDir = path.join(root, "tests");
const mode = process.argv[2];

function testFiles(integration, filter = process.argv[3]) {
  const excluded = filter?.startsWith("!") ? filter.slice(1) : null;
  const files = fs.readdirSync(testsDir)
    .filter((name) => name.endsWith(".test.js") && name.includes(".integration.") === integration
      && (!filter || (excluded ? !name.includes(excluded) : name.includes(filter))))
    .sort()
    .map((name) => path.join("tests", name));
  if (files.length === 0) throw new Error(`No ${integration ? "integration" : "unit"} test files match filter: ${filter || "(none)"}`);
  return files;
}

function runNodeTests(files, env = process.env) {
  const result = spawnSync(process.execPath, [
    "--test",
    "--experimental-test-isolation=none",
    "--test-concurrency=1",
    ...files,
  ], { cwd: root, env, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required integration-test variable: ${name}`);
  return value;
}

function safeDatabaseName() {
  const name = required("TEST_DB_NAME");
  if (!/^[A-Za-z0-9_]+_(?:test|ci)$/i.test(name)) {
    throw new Error("TEST_DB_NAME must contain only letters/numbers/underscores and end in _test or _ci");
  }
  if (name === process.env.DB_NAME) throw new Error("TEST_DB_NAME must differ from DB_NAME");
  return name;
}

function assertAuthorizedDatabaseTarget(name, operation) {
  const expectedName = process.env.TEST_DB_ALLOWED_NAME;
  const host = process.env.TEST_DB_HOST;
  const port = Number(process.env.TEST_DB_PORT);
  if (expectedName && (name !== expectedName || host !== "127.0.0.1" || port !== 3307)) {
    throw new Error(`Refusing ${operation}: test DB target is outside approved scope`);
  }
  console.log(`[TEST DB ${operation}] name=${name} host=${host || process.env.DB_HOST} port=${port || process.env.DB_PORT}`);
}

function connectionOptions(database) {
  return {
    host: process.env.TEST_DB_HOST || required("DB_HOST"),
    port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 3306),
    user: process.env.TEST_DB_USER || required("DB_USER"),
    password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
    ...(database ? { database } : {}),
    charset: "utf8mb4",
    multipleStatements: true,
  };
}

function validateLogin(name, value) {
  if (!value || value.length > 15) throw new Error(`${name} must contain 1-15 characters`);
  return value;
}

async function resetAndSeed(databaseName) {
  const admin = await mysql.createConnection(connectionOptions());
  const escapedName = `\`${databaseName}\``;
  assertAuthorizedDatabaseTarget(databaseName, "DROP");
  await admin.query(`DROP DATABASE IF EXISTS ${escapedName}`);
  assertAuthorizedDatabaseTarget(databaseName, "CREATE");
  await admin.query(`CREATE DATABASE ${escapedName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();

  const connection = await mysql.createConnection(connectionOptions(databaseName));
  const source = fs.readFileSync(path.resolve(root, "../data2.md"), "utf8");
  const seed = source
    .slice(0, source.indexOf("-- 3."))
    .replace(/^create database[^;]+;\s*$/gim, "")
    .replace(/^use\s+`[^`]+`;\s*$/gim, "");
  await connection.query(seed);

  const credentials = [
    ["CHU_TRO", validateLogin("TEST_LANDLORD_USERNAME", required("TEST_LANDLORD_USERNAME")), required("TEST_LANDLORD_PASSWORD")],
    ["KHACH_THUE", validateLogin("TEST_TENANT_USERNAME", required("TEST_TENANT_USERNAME")), required("TEST_TENANT_PASSWORD")],
    ["KHACH_THUE", validateLogin("TEST_OTHER_TENANT_USERNAME", required("TEST_OTHER_TENANT_USERNAME")), required("TEST_OTHER_TENANT_PASSWORD")],
  ];
  const used = new Set();
  for (const [role, username, password] of credentials) {
    if (used.has(username)) throw new Error("Integration-test usernames must be distinct");
    used.add(username);
    const [rows] = await connection.query(
      "SELECT maTaiKhoan FROM TaiKhoan WHERE vaiTro = ? ORDER BY maTaiKhoan LIMIT 1 OFFSET ?",
      [role, role === "CHU_TRO" ? 0 : used.size - 2],
    );
    if (!rows[0]) throw new Error(`Seed does not contain a ${role} account`);
    await connection.query(
      "UPDATE TaiKhoan SET tenDangNhap = ?, matKhauHash = ? WHERE maTaiKhoan = ?",
      [username, await bcrypt.hash(password, 10), rows[0].maTaiKhoan],
    );
  }
  await connection.end();
}

async function dropTestDatabase(databaseName) {
  const connection = await mysql.createConnection(connectionOptions());
  assertAuthorizedDatabaseTarget(databaseName, "DROP");
  await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  await connection.end();
}

async function waitUntilReady(baseUrl, server) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Integration server exited with code ${server.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/ready`);
      if (response.ok) return;
    } catch (_) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Integration server did not become ready within 30 seconds");
}

async function runIntegration() {
  const databaseName = safeDatabaseName();
  const selectedTests = testFiles(true);
  required("TEST_NEW_ACCOUNT_PASSWORD");
  const port = Number(process.env.TEST_PORT || 3101);
  const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "qlpt-integration-"));
  const env = applyTestAuthDefaults({
    ...process.env,
    NODE_ENV: "test",
    DB_HOST: process.env.TEST_DB_HOST || process.env.DB_HOST,
    DB_PORT: process.env.TEST_DB_PORT || process.env.DB_PORT,
    DB_USER: process.env.TEST_DB_USER || process.env.DB_USER,
    DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
    DB_NAME: databaseName,
    DB_SYNC: "true",
    DB_SYNC_ALTER: "false",
    PORT: String(port),
    TEST_BASE_URL: baseUrl,
    UPLOAD_DIR: uploadDir,
  });
  let server;
  try {
    await resetAndSeed(databaseName);
    if (process.env.TEST_CHECK_SEED_INVARIANTS === "true") {
      console.log(`[INVARIANTS seed] name=${databaseName} host=${env.DB_HOST} port=${env.DB_PORT}`);
      const seedInvariant = spawnSync(process.execPath, ["scripts/check-invariants.js"], { cwd: root, env, stdio: "inherit" });
      if (seedInvariant.status !== 0) return seedInvariant.status ?? 1;
    }
    server = spawn(process.execPath, ["src/index.js"], { cwd: root, env, stdio: "inherit" });
    await waitUntilReady(baseUrl, server);
    const testStatus = runNodeTests(selectedTests, env);
    if (testStatus !== 0) return testStatus;
    console.log(`[INVARIANTS post-integration] name=${databaseName} host=${env.DB_HOST} port=${env.DB_PORT}`);
    const invariant = spawnSync(process.execPath, ["scripts/check-invariants.js"], { cwd: root, env, stdio: "inherit" });
    return invariant.status ?? 1;
  } finally {
    if (server && server.exitCode === null) server.kill();
    fs.rmSync(uploadDir, { recursive: true, force: true });
    if (process.env.TEST_KEEP_DATABASE !== "true") await dropTestDatabase(databaseName);
  }
}

async function main() {
  if (mode === "unit") process.exitCode = runNodeTests(testFiles(false));
  else if (mode === "integration") process.exitCode = await runIntegration();
  else throw new Error("Usage: node scripts/run-test-suite.js <unit|integration>");
}

if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { testFiles, safeDatabaseName, assertAuthorizedDatabaseTarget };
