const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function moduleUnderTest() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/core/idempotency.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

test("F.5 idempotency reuses identical payload, changes with request content and resets after success", async () => {
  const { createRequestKeyStore } = await moduleUnderTest();
  let sequence = 0; const store = createRequestKeyStore(() => `key-${++sequence}`);
  const first = store.keyFor("payment:1", { bill: "1", amount: 1000, date: "2026-10-17" });
  assert.equal(store.keyFor("payment:1", { date: "2026-10-17", amount: 1000, bill: "1" }), first, "same canonical request must reuse its key");
  assert.notEqual(store.keyFor("payment:1", { bill: "1", amount: 2000, date: "2026-10-17" }), first, "changed amount must create a key");
  const changedDate = store.keyFor("payment:1", { bill: "1", amount: 2000, date: "2026-10-18" });
  store.renew("payment:1");
  const renewed = store.keyFor("payment:1", { bill: "1", amount: 2000, date: "2026-10-18" });
  assert.notEqual(renewed, changedDate, "conflict action must issue a fresh key");
  store.complete("payment:1");
  assert.notEqual(store.keyFor("payment:1", { bill: "1", amount: 2000, date: "2026-10-18" }), renewed, "success must retire the old key");
});

test("F.5 VND and required-reason validation rejects blank, text, negative and decimals before API", async () => {
  const { integerVnd, requiredText } = await moduleUnderTest();
  for (const value of ["", "abc", "-1", "1.2", "1.234567"]) assert.throws(() => integerVnd(value, "Số tiền"));
  assert.equal(integerVnd("1000", "Số tiền", { positive: true }), 1000);
  assert.throws(() => requiredText("   ", "Lý do"), /bắt buộc/);
  assert.equal(requiredText("  hợp lệ  ", "Lý do"), "hợp lệ");
});
