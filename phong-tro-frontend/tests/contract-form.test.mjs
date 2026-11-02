import test from "node:test";
import assert from "node:assert/strict";
import { formatVnd, parseVnd, contractDraftFeedback, contractServerErrors } from "../src/modules/residents-contracts/contract-form.js";

test("contract money stays an integer while the input uses thousand separators", () => {
  assert.equal(formatVnd("10000000"), "10.000.000");
  assert.equal(parseVnd("10.000.000", "tien_coc"), 10000000);
  for (const value of ["-1", "1.5", "abc", "1,000", "9007199254740992"]) {
    assert.throws(() => parseVnd(value, "gia_thue"));
  }
});

test("contract feedback blocks reversed dates and warns about large deposits and short terms", () => {
  const raw = { gia_thue: "1.000.000", tien_coc: "4.000.000", don_gia_dien: "8.700", don_gia_nuoc: "80.000", ngay_bat_dau: "2026-10-29", ngay_ket_thuc: "2026-10-31" };
  assert.equal(contractDraftFeedback(raw).warnings.length, 2);
  assert.match(contractDraftFeedback({ ...raw, ngay_ket_thuc: "2026-10-28" }).errors.ngay_ket_thuc, /sau ngày bắt đầu/);
  assert.deepEqual(contractServerErrors({ message: "Lỗi validation", details: [{ field: "gia_thue", message: "Invalid" }] }), { gia_thue: "Giá thuê không hợp lệ." });
});
