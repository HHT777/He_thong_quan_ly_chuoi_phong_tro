const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const service = require("../src/services/reservation.service");

test("FR-169 quote and cancellation share exact cent calculation", () => {
  assert.deepEqual(service.calculateCancellation({ so_tien_giu: "1000000.00" }, "300000"), {
    refundAmount: "300000.00", nonRefundAmount: "700000.00", basis: "Theo số tiền hoàn Chủ trọ đề xuất; phần còn lại của tiền giữ chỗ không hoàn",
  });
  assert.throws(() => service.calculateCancellation({ so_tien_giu: "100.00" }, "101"), (error) => error.code === "REFUND_EXCEEDS_HOLD");
});

test("FR-168/169 read routes validate with Joi and contain no mutations", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/routes/mvp.routes.js"), "utf8");
  const block = source.slice(source.indexOf('router.get("/reservations/:id/extension-history"'), source.indexOf('router.patch("/reservations/:id/extend"'));
  assert.match(block, /Joi\.string\(\)\.guid/);
  assert.match(block, /cancellationQuote/);
  assert.doesNotMatch(block, /\.create\(|\.update\(/);
});
