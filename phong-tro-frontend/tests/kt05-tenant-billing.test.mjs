import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summaryMarkup, billsMarkup, postDebtMarkup, billDetailMarkup, paymentsMarkup, billListPath, paymentListPath, requestLoader } from "../src/modules/tenant/tenant-billing.model.mjs";
const bill = { ma_thanh_toan: "bill-a", thang: 10, nam: 2026, loai_thanh_toan: "DINH_KY", trang_thai: "THANH_TOAN_MOT_PHAN", tong_phai_tra: 1000, tong_da_thanh_toan: 350, so_tien_con_no: 650, hopDong: { phongTro: { so_phong: "A1", gia_thue: 9999999 } }, chiTiets: [] };
const summary = { businessDate: "2026-10-06", currentPeriod: "2026-10", current: { totalDue: 1000, cashReceived: 300, depositOffset: 50, settledAmount: 350, remainingAmount: 650, pendingCount: 1 }, oldDebt: { remainingAmount: 400 }, totalRemainingDue: 7123, isOverdue: true, postLiquidationDebt: { remainingAmount: 200, bills: [] } };

test("KT-05 summary renders server numbers independently and separates cash deposit old and post-liquidation debt", () => {
  const html = summaryMarkup(summary);
  assert.match(html, /Đã thanh toán/);
  assert.doesNotMatch(html, /gồm bù cọc/);
  assert.match(html, /Đã thu \(tiền thực nhận\)<\/dt><dd>300 đ/);
  assert.match(html, /Đã bù từ cọc<\/dt><dd>50 đ/);
  assert.match(html, /Tổng còn cần thanh toán<\/dt><dd>7\.123 đ/);
  assert.match(html, /Nợ cũ còn thiếu<\/dt><dd>400 đ/); assert.match(html, /Có khoản đang quá hạn/);
  assert.match(postDebtMarkup(summary.postLiquidationDebt), /<h2>Nợ sau thanh lý<\/h2>/);
  assert.doesNotMatch(postDebtMarkup(summary.postLiquidationDebt), /không cộng vào tổng/);
  assert.match(postDebtMarkup(summary.postLiquidationDebt), /200 đ/);
});

test("KT-05 stored signed bill lines and null pending amounts are shown without reconstructing charges", () => {
  const html = billDetailMarkup({ ...bill, chiTiets: [{ loai_khoan: "GIAM_TRU", so_tien: -123, dien_giai: "Ưu đãi" }, { loai_khoan: "DIEU_CHINH_GIAM", so_tien: -20, dien_giai: "Sửa sai" }] });
  assert.match(html, /-123 đ/); assert.match(html, /-20 đ/); assert.doesNotMatch(html, /9\.999\.999/);
  const payments = paymentsMarkup([{ thoi_diem_ghi_nhan: "2026-10-06", so_tien: null, nguon_thanh_toan: "THU_TIEN", trang_thai_xac_nhan: "CHO_XAC_NHAN" },
    { so_tien: 50, nguon_thanh_toan: "KHAU_TRU_COC", trang_thai_xac_nhan: "DA_XAC_NHAN" }, { so_tien: 999, trang_thai_xac_nhan: "DA_HUY" }]);
  assert.match(payments, /Chưa có số tiền/); assert.match(payments, /Chờ xác nhận/); assert.match(payments, /Bù từ cọc/); assert.match(payments, /Đã hủy/);
});

test("KT-05 empty pagination and period endpoints preserve the selected server pages", () => {
  assert.match(billsMarkup([]), /Chưa có phiếu/);
  const html = billsMarkup([bill], { page: 2, totalPages: 3, hasNext: true, hasPrev: true });
  assert.match(html, /class="tenant-bills-table"/);
  assert.match(html, /<th>Đã thanh toán<\/th>/);
  assert.doesNotMatch(html, /gồm bù cọc/);
  assert.match(html, /Trang 2 \/ 3/); assert.match(html, /data-bill-next/); assert.match(html, /data-bill-prev/);
  assert.equal(billListPath("2026-09", 2), "/khoan-phai-thu?ky=2026-09&page=2&limit=20");
  assert.equal(paymentListPath("a/b", 3), "/khoan-phai-thu/payment/list?ma_thanh_toan=a%2Fb&page=3&limit=20");
});

test("KT-05 all dynamic invoice descriptions payment statuses and names are escaped", () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const row = { ...bill, ma_thanh_toan: hostile, trang_thai: hostile, hopDong: { phongTro: { so_phong: hostile } }, chiTiets: [{ loai_khoan: hostile, so_tien: null, dien_giai: hostile }] };
  for (const html of [billsMarkup([row]), billDetailMarkup(row), paymentsMarkup([{ nguon_thanh_toan: hostile, trang_thai_xac_nhan: hostile, so_tien: null }])]) {
    assert.doesNotMatch(html, /<img|<script/); assert.match(html, /&lt;img/);
  }
});

test("KT-05 loader deduplicates double clicks and older period results cannot replace the latest period", async () => {
  const requests = []; const resolvers = {}; const displayed = [];
  const load = requestLoader({ get: (path) => { requests.push(path); return new Promise((resolve) => { resolvers[path] = resolve; }); } },
    { active: () => true, loading() {}, ready: (value) => displayed.push(value), error: (error) => { throw error; } });
  const first = load("old-period"); assert.equal(load("old-period"), first);
  const latest = load("new-period"); resolvers["new-period"]("new"); await latest;
  resolvers["old-period"]("old"); await first;
  assert.deepEqual(requests, ["old-period", "new-period"]); assert.deepEqual(displayed, ["new"]);
});

test("KT-05 loader network failure offers a real retry without inventing zero totals", async () => {
  let count = 0; let retry; let rendered;
  const load = requestLoader({ get: async () => { if (++count === 1) throw new Error("offline"); return summary; } }, {
    active: () => true, loading() {}, ready: (value) => { rendered = value; }, error: (error, callback) => { assert.equal(error.message, "offline"); retry = callback; },
  });
  await load("summary"); assert.equal(rendered, undefined); await retry(); assert.equal(rendered, summary);
});

test("KT-05 loader leaves protected 401 to the shared session and ignores results after closing", async () => {
  let active = true; let finish; let errors = 0; let ready = 0;
  const hooks = { active: () => active, loading() {}, ready() { ready += 1; }, error() { errors += 1; } };
  await requestLoader({ get: async () => { throw Object.assign(new Error("expired"), { status: 401 }); } }, hooks)("summary");
  const pending = requestLoader({ get: () => new Promise((resolve) => { finish = resolve; }) }, hooks)("detail");
  active = false; finish({ data: bill }); await pending;
  assert.equal(errors, 0); assert.equal(ready, 0);
});

test("KT-05 tenant view only reads APIs, has no financial arithmetic or payment/upload actions", () => {
  const tab = readFileSync(new URL("../src/modules/tenant/tenant-finance.tab.js", import.meta.url), "utf8");
  const model = readFileSync(new URL("../src/modules/tenant/tenant-billing.model.mjs", import.meta.url), "utf8");
  assert.match(tab, /\/v1\/me\/billing-summary/); assert.match(tab, /isk19:session-expired/); assert.match(tab, /event.key === "Escape"/);
  assert.match(tab, /type="month"/); assert.match(tab, /trigger.disabled = true/);
  assert.doesNotMatch(tab + model, /\.post\(|\.patch\(|\.put\(|\.delete\(|mark-paid|payment\/create|type="file"|\.reduce\(|Math\.round/);
});
