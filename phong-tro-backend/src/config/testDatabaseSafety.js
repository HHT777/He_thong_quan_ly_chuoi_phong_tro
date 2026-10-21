const { isSafeTestDatabase } = require("./environment");

function approvedTestTarget(env, databaseName, { expectedPort = 3307 } = {}) {
  if (!isSafeTestDatabase(databaseName)) throw new Error("Target must be a _test or _ci test database");
  if (!env.TEST_DB_ALLOWED_NAME || databaseName !== env.TEST_DB_ALLOWED_NAME) {
    throw new Error("Target must exactly match TEST_DB_ALLOWED_NAME");
  }
  if (env.TEST_DB_HOST !== "127.0.0.1") throw new Error("TEST_DB_HOST must be 127.0.0.1");
  const port = Number(env.TEST_DB_PORT);
  if (!env.TEST_DB_PORT || !Number.isInteger(port) || port !== expectedPort) {
    throw new Error(`TEST_DB_PORT must be ${expectedPort}`);
  }
  return { database: databaseName, host: "127.0.0.1", port };
}

function assertSeedTarget(env, args) {
  if (env.NODE_ENV !== "test") throw new Error("seed requires NODE_ENV=test");
  const target = approvedTestTarget(env, env.TEST_DB_NAME);
  if (args.length !== 1 || args[0] !== `--confirm-db=${target.database}`) {
    throw new Error(`seed requires --confirm-db=${target.database}`);
  }
  if (!env.TEST_DB_USER) throw new Error("seed requires TEST_DB_USER");
  return target;
}

async function syncSchemaIfApproved(sequelize, env = process.env, logger = console, { schemaReady = true } = {}) {
  const requested = env.DB_SYNC === "true" || env.DB_SYNC_ALTER === "true" || env.DB_SYNC_FORCE === "true";
  if (!requested) return false;
  if (env.NODE_ENV !== "test" || env.DB_SYNC_FORCE === "true") {
    logger.warn("[DB SAFETY] Schema sync disabled outside an approved test database");
    return false;
  }
  if (!schemaReady) {
    logger.warn("[DB SAFETY] Schema sync disabled because schema is outdated");
    return false;
  }
  try {
    const target = approvedTestTarget(env, env.DB_NAME);
    if (env.DB_HOST !== target.host || Number(env.DB_PORT) !== target.port) {
      throw new Error("Runtime database target differs from approved test target");
    }
  } catch (_) {
    logger.warn("[DB SAFETY] Schema sync disabled outside an approved test database");
    return false;
  }
  if (env.DB_SYNC !== "true") {
    logger.warn("[DB SAFETY] DB_SYNC_ALTER alone does not enable schema sync");
    return false;
  }
  await sequelize.sync({ alter: env.DB_SYNC_ALTER === "true" });
  return true;
}

module.exports = { approvedTestTarget, assertSeedTarget, syncSchemaIfApproved };
