const crypto = require("node:crypto");

function isSafeTestDatabase(name) {
  return /^[A-Za-z0-9_]+_(?:test|ci)$/i.test(String(name || ""));
}

function applyTestAuthDefaults(env = process.env) {
  const database = env.DB_NAME || env.TEST_DB_NAME;
  if (env.NODE_ENV !== "test" || !isSafeTestDatabase(database)) return env;
  if (!String(env.JWT_SECRET || "").trim()) env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  if (!String(env.JWT_EXPIRE || "").trim()) env.JWT_EXPIRE = "7d";
  return env;
}

function assertRuntimeAuthConfig(env = process.env) {
  if (!String(env.JWT_SECRET || "").trim()) throw new Error("JWT_SECRET is required");
  if (!String(env.JWT_EXPIRE || "").trim()) throw new Error("JWT_EXPIRE is required");
}

module.exports = { applyTestAuthDefaults, assertRuntimeAuthConfig, isSafeTestDatabase };
