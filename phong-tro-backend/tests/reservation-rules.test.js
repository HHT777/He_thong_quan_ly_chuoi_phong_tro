const test = require("node:test");
const assert = require("node:assert/strict");
const reservationService = require("../src/services/reservation.service");

test("FR-167 validates mandatory reservation terms, amount and expiry", () => {
  assert.throws(() => reservationService.validate({}), (error) => error.code === "INVALID_RESERVATION");
  assert.throws(() => reservationService.validate({ holderName: "A", phone: "0900000000", amount: 0, receivedOn: "2026-10-02", expiresOn: "2026-10-02", terms: "x" }), (error) => error.code === "INVALID_RESERVATION_EXPIRY");
  assert.deepEqual(reservationService.validate({ holderName: "A", phone: "0900000000", amount: 100000, receivedOn: "2026-10-02", expiresOn: "2026-10-03", terms: "Hoàn một phần" }), { name: "A", phone: "0900000000", amount: 100000, receivedOn: "2026-10-02", expiresOn: "2026-10-03", terms: "Hoàn một phần" });
});
