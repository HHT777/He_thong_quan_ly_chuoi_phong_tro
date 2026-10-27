import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expensePayload } from "../src/modules/finance/cashflow.model.mjs";

test("thu chi giữ tab riêng và lập payload khoản chi có phạm vi căn", () => {
  const tab = readFileSync(new URL("../src/modules/finance/cashflow.tab.js", import.meta.url), "utf8");
  assert.match(tab, /route: "\/finance\/cashflow"/);
  assert.match(tab, /context\.api\.put/);
  assert.match(tab, /method: "DELETE"/);
  const payload = expensePayload({ loai_khoan_chi: "VE_SINH", so_tien: "300000", ngay_phat_sinh: "2026-10-25", pham_vi: "CAN_TRO", ma_can: "can-a", ghi_chu: " Lau don " }, ["VE_SINH"]);
  assert.deepEqual(payload, { loai_khoan_chi: "VE_SINH", so_tien: 300000, ngay_phat_sinh: "2026-10-25", pham_vi: "CAN_TRO", ma_can: "can-a", ghi_chu: "Lau don" });
  assert.throws(() => expensePayload({ ...payload, so_tien: "-1" }, ["VE_SINH"]));
  assert.throws(() => expensePayload({ ...payload, ngay_phat_sinh: "bad" }, ["VE_SINH"]));
  assert.deepEqual(expensePayload({ ...payload, pham_vi: "TOAN_CHUOI" }, ["VE_SINH"]).ma_can, null);
});
