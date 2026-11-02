import test from "node:test";
import assert from "node:assert/strict";
import { wholeVnd } from "../src/shared/format-money.mjs";
import { money } from "../src/shared/components/view.js";
import { paymentMoney } from "../src/modules/finance/payments.model.mjs";
import { reportMoney } from "../src/modules/finance/report.model.mjs";
import { renderBillInvoice } from "../src/modules/finance/billInvoice.js";

test("money shown across screens rounds to whole dong without changing stored values", () => {
  const amount = 5_004_548.39;
  assert.equal(wholeVnd(amount), "5.004.548");
  assert.equal(money(amount), "5.004.548 đ");
  assert.equal(money(290_322.58), "290.323 đ");
  assert.equal(paymentMoney(amount), "5.004.548 đ");
  assert.equal(reportMoney(-290_322.58), "−290.323 đ");
  assert.equal(reportMoney(null), "—");
  assert.equal(amount, 5_004_548.39);
});

test("invoice rounds displayed lines and contract rates while keeping old draft context", () => {
  const html = renderBillInvoice({
    thang: 10, nam: 2026, da_gui: false,
    tong_phai_tra: 263_226.29, tong_da_thanh_toan: 0, so_tien_con_no: 263_226.29,
    hopDong: { gia_thue: 1_000_000.6, don_gia_dien: 8_700.5, phongTro: { so_phong: "109" } },
    chiTiets: [{ loai_khoan: "TIEN_NUOC", so_tien: 5_161.29, dien_giai: "Tiền nước" }],
  }, "Nháp", "");
  assert.match(html, /263\.226 đ/);
  assert.match(html, /5\.161 đ/);
  assert.match(html, /1\.000\.001 đ/);
  assert.match(html, /8\.701 đ\/kWh/);
  assert.doesNotMatch(html, /263\.226,29 đ|5\.161,29 đ/);
  assert.match(html, /giá trị lưu không thay đổi/);
});
