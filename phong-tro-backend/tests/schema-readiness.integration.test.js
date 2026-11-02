const test = require("node:test");
const assert = require("node:assert/strict");
const sequelize = require("../src/config/database");
const { checkSchema, requiredSchema } = require("../src/services/schemaReadiness.service");

test("schema readiness reads the test DB: complete contract passes and one missing column fails", async () => {
  const actual = await checkSchema(sequelize);
  assert.deepEqual(actual, { ready: true, missing: [] });
  const expected = requiredSchema();
  expected.get("TaiKhoan").push("cot_khong_ton_tai_chi_kiem_thu");
  const outdated = await checkSchema(sequelize, expected);
  assert.equal(outdated.ready, false);
  assert.deepEqual(outdated.missing, ["column:TaiKhoan.cot_khong_ton_tai_chi_kiem_thu"]);
});

test("outdated schema denies API with 503 without exposing missing names; health remains available", async () => {
  const app = require("../src/app");
  const original = app.locals.schemaReady;
  const server = app.listen(0);
  try {
    app.locals.schemaReady = false;
    const address = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${address}/api/v1/debt`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "DB_SCHEMA_OUTDATED");
    assert.doesNotMatch(JSON.stringify(body), /TaiKhoan|cot_khong_ton_tai/);
    const legacy = await fetch(`${address}/api/phong`);
    assert.equal(legacy.status, 503);
    assert.equal((await legacy.json()).code, "DB_SCHEMA_OUTDATED");
    assert.equal((await fetch(`${address}/health`)).status, 200);
    assert.equal((await fetch(`${address}/ready`)).status, 200);
    app.locals.schemaReady = true;
    assert.notEqual((await fetch(`${address}/api/v1/debt`)).status, 503);
  } finally {
    app.locals.schemaReady = original;
    await new Promise((resolve) => server.close(resolve));
  }
});
