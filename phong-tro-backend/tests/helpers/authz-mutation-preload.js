// Opt-in mutation probe. Loaded only with NODE_OPTIONS while running the disposable test DB.
// It bypasses ownership for exactly one HTTP request carrying the selected test route key.
const http = require("node:http");
const { AsyncLocalStorage } = require("node:async_hooks");
const { CanTro, PhongTro } = require("../../src/models");
const ownership = require("../../src/services/ownership.service");

if (!process.env.AUTHZ_MUTATION_ROUTE) throw new Error("AUTHZ_MUTATION_ROUTE is required for mutation preload");
if (process.env.TEST_DB_NAME !== "qlpt_authz_test" || process.env.TEST_DB_HOST !== "127.0.0.1"
  || Number(process.env.TEST_DB_PORT) !== 3307) throw new Error("Mutation probe requires approved disposable DB");

const scope = new AsyncLocalStorage();
const originalEmit = http.Server.prototype.emit;
http.Server.prototype.emit = function scopedEmit(event, ...args) {
  if (event === "request") {
    const req = args[0];
    return scope.run(req.headers["x-authz-mutation-route"], () => originalEmit.call(this, event, ...args));
  }
  return originalEmit.call(this, event, ...args);
};
const selected = () => scope.getStore() === process.env.AUTHZ_MUTATION_ROUTE;
const originalAssert = ownership.assertOwned;
ownership.assertOwned = async (user, type, id, options) => {
  if (!selected()) return originalAssert(user, type, id, options);
  if (type === "room") return PhongTro.findByPk(id, { transaction: options?.transaction });
  return undefined;
};
const originalBuildings = ownership.getOwnedBuildingIds;
ownership.getOwnedBuildingIds = async (user, transaction) => {
  if (!selected()) return originalBuildings(user, transaction);
  const rows = await CanTro.findAll({ attributes: ["ma_can"], raw: true, transaction });
  return rows.map((row) => row.ma_can);
};
