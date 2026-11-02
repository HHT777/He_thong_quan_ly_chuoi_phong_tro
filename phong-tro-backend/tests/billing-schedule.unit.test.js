const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("automatic billing skips disabled/wrong hour, creates a draft once when due", async () => {
  const config = { timezone: "Asia/Ho_Chi_Minh", billScheduleEnabled: false, billScheduleDay: 2, billScheduleHour: 8, billScheduleBuildingIds: ["building-1"], namedLockTimeoutSeconds: 1 };
  let runLog = null;
  let generated = 0;
  const outcomes = [];
  const models = {
    TaiKhoan: { findAll: async () => [{ ma_tai_khoan: "owner-1" }] },
    NhatKyLapPhieu: {
      findOne: async () => runLog,
      create: async (fields) => { runLog = { ...fields, ma_lan_chay: "run-1", update: async (changes) => Object.assign(runLog, changes) }; return runLog; },
    },
    ChiTietNhatKyLapPhieu: { findOrCreate: async ({ defaults }) => outcomes.push(defaults) },
    HopDong: { findByPk: async () => ({ ma_phong: "room-1" }) },
  };
  const dependencies = {
    crypto: require("node:crypto"),
    "../config/database": {},
    "../models": models,
    "./billGeneration.service": { generate: async () => { generated += 1; return { created: [{ ma_hop_dong: "contract-1" }], skipped: [], rooms: [{ roomId: "room-1", contractId: "contract-1" }] }; } },
    "./systemConfig.service": { getPersistedSystemConfig: async () => config },
    "./dbNamedLock.service": { withNamedLock: async (_name, work) => work() },
    "./auditLog.service": { writeAuditLog: async () => {} },
    "./ownership.service": { assertOwned: async () => {}, getOwnedBuildingIds: async () => ["building-1"] },
  };
  const file = path.resolve(__dirname, "../src/services/billingCron.service.js");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), { module, exports: module.exports, require: (name) => { if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`); return dependencies[name]; } }, { filename: file });
  const dueTime = new Date("2027-07-02T08:00:00+07:00");
  assert.equal((await module.exports.run({ now: dueTime })).due, false);
  config.billScheduleEnabled = true;
  assert.equal((await module.exports.run({ now: new Date("2027-07-02T07:00:00+07:00") })).due, false);
  const first = await module.exports.run({ now: dueTime });
  assert.equal(first.due, true);
  assert.equal(first.created, 1);
  assert.equal(first.sent, 0);
  assert.equal(generated, 1);
  assert.equal(outcomes[0].ket_qua, "DA_LAP");
  const repeated = await module.exports.run({ now: dueTime });
  assert.equal(repeated.alreadyRan, true);
  assert.equal(repeated.created, 0);
  assert.equal(generated, 1);
});
