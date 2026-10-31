import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canCancel, canConfirm, defaultStatus, ellipsis, paymentBadge, paymentDate, paymentMoney, paymentQuery } from "../src/modules/finance/payments.model.mjs";

const source = readFileSync(fileURLToPath(new URL("../src/modules/finance/payments.tab.js", import.meta.url)), "utf8");

test("payment states carry text, tone and icon; deposit offsets cannot be selected or cancelled", () => {
  for (const status of ["CHO_XAC_NHAN", "DA_XAC_NHAN", "DA_HUY"]) {
    const badge = paymentBadge({ trang_thai_xac_nhan: status });
    assert.ok(badge.label && badge.tone && badge.icon);
  }
  assert.equal(defaultStatus(1), "CHO_XAC_NHAN");
  assert.equal(defaultStatus(0), "ALL");
  assert.equal(canConfirm({ trang_thai_xac_nhan: "CHO_XAC_NHAN", nguon_thanh_toan: "KHAU_TRU_COC" }), false);
  assert.equal(canCancel({ trang_thai_xac_nhan: "DA_XAC_NHAN", nguon_thanh_toan: "KHAU_TRU_COC" }), false);
  assert.equal(canCancel({ trang_thai_xac_nhan: "DA_XAC_NHAN", nguon_thanh_toan: "THU_TIEN" }), true);
});

test("payment labels, date and server query use existing fields", () => {
  assert.equal(paymentMoney(500000), "500.000 đ");
  assert.match(paymentDate("2026-10-30T01:30:00Z"), /30\/10\/2026.*08:30/);
  assert.equal(ellipsis("Tên khách rất dài", 10), "Tên khách…");
  assert.equal(paymentQuery({ building: "can-1", page: 2 }), "/khoan-phai-thu/payment/list?limit=20&page=2&ma_can=can-1");
  assert.equal(paymentQuery({ building: "can-1", status: "CHO_XAC_NHAN", page: 2 }), "/khoan-phai-thu/payment/list?limit=20&page=2&ma_can=can-1&trang_thai_xac_nhan=CHO_XAC_NHAN");
  assert.equal(paymentQuery({ status: "DA_HUY" }), "/khoan-phai-thu/payment/list?limit=20&page=1&trang_thai_xac_nhan=DA_HUY");
});

test("screen uses server pagination, aborts stale reads and keeps failed selections", () => {
  assert.match(source, /AbortController/);
  assert.match(source, /sequence !== state\.sequence/);
  assert.match(source, /response\.pagination\?\.total/);
  assert.match(source, /state\.selected\.delete\(row\.ma_giao_dich\); success/);
  assert.match(source, /class="payment-skeleton"/);
  assert.match(source, /Không có giao dịch thanh toán trong phạm vi này/);
  assert.match(source, /empty-state--error/);
  assert.match(source, /class="payment-cards"/);
  assert.match(source, /data-status/);
  assert.match(source, /state\.status = event\.target\.value; state\.page = 1/);
  const bar = source.match(/const selectionBar = \(\) => \{.*?\};\n    const render/s)?.[0];
  assert.ok(bar);
  assert.doesNotMatch(bar, /paymentMoney|\.reduce\(/);
});

test("cancel requires a trimmed reason and recorded payments use stable idempotency keys", () => {
  assert.match(source, /reason\.trim\(\) \? \{\} : \{ reason:/);
  assert.match(source, /keys\.keyFor\(scope, payload\)/);
  assert.match(source, /keys\.complete\(scope\)/);
  assert.match(source, /PAYMENT_EXCEEDS_OUTSTANDING|error\.status === 409/);
  assert.match(source, /canCancel\(row\)/);
  assert.doesNotMatch(source, /escapeHtml\(row\.ma_phong\)|\$\{row\.ma_phong\}/);
});
