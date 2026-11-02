import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expensePayload, filterExpenses } from "../src/modules/finance/cashflow.model.mjs";

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

test("lọc khoản chi theo căn và ngày phát sinh, gồm hai ngày biên", () => {
  const rows = [
    { ma_can: "can-a", ngay_phat_sinh: "2026-10-01" },
    { ma_can: "can-a", ngay_phat_sinh: "2026-10-15" },
    { ma_can: "can-a", ngay_phat_sinh: "2026-10-31" },
    { ma_can: "can-b", ngay_phat_sinh: "2026-10-15" },
  ];
  assert.deepEqual(filterExpenses(rows, { buildingId: "can-a", fromDate: "2026-10-15", toDate: "2026-10-31" }), [rows[1], rows[2]]);
  assert.deepEqual(filterExpenses(rows, { fromDate: "2026-10-15", toDate: "2026-10-15" }), [rows[1], rows[3]]);
  assert.match(readFileSync(new URL("../src/modules/finance/cashflow.tab.js", import.meta.url), "utf8"), /data-expense-from-date.*data-expense-to-date/s);
});
