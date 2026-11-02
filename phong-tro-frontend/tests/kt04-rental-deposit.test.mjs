import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { depositMarkup, loadDepositSection } from "../src/modules/tenant/rental-deposit.model.mjs";

const payload = (deposit = {}) => ({
  deposit: { so_tien_coc: "2000000.00", ngay_nhan_coc: "2026-10-01", trang_thai: "DA_NHAN", so_tien_da_khau_tru: "0.00", so_tien_da_hoan: "0.00", ...deposit },
  settlement: null, deductions: [], refunds: [], dataWarnings: [],
});
function slot() {
  const error = { textContent: "" };
  const node = { isConnected: true, innerHTML: "", retry: null, error,
    querySelector: (selector) => selector === "[data-deposit-error]" ? error : { addEventListener: (_event, callback) => { node.retry = callback; } },
  };
  return node;
}

test("KT-04 receipt depends on both server status and date, including zero and unreceived records", () => {
  const unreceived = depositMarkup(payload({ trang_thai: "CHUA_NHAN", ngay_nhan_coc: null, so_tien_coc: "0.00" }));
  assert.match(unreceived, /Phải cọc theo hồ sơ<\/dt><dd>0 đ/);
  assert.match(unreceived, /Ghi nhận nhận cọc<\/dt><dd>Chưa nhận/);
  assert.doesNotMatch(unreceived, /Đã ghi nhận nhận cọc/);
  for (const state of ["DA_NHAN", "DA_HOAN", "DA_KHAU_TRU_MOT_PHAN", "DA_KHAU_TRU_TOAN_BO"]) {
    assert.match(depositMarkup(payload({ trang_thai: state })), /Đã ghi nhận nhận cọc/);
    assert.doesNotMatch(depositMarkup(payload({ trang_thai: state, ngay_nhan_coc: null })), /Đã ghi nhận nhận cọc/);
  }
});

test("KT-04 absent deposit and null amounts are not disguised as received or zero", () => {
  assert.match(depositMarkup({ ...payload(), deposit: null }), /Chưa có cọc/);
  const markup = depositMarkup(payload({ so_tien_coc: null, so_tien_da_hoan: null }));
  assert.match(markup, /Phải cọc theo hồ sơ<\/dt><dd>Chưa có dữ liệu/);
  assert.match(markup, /Tổng đã hoàn theo sổ<\/dt><dd>Chưa có dữ liệu/);
  assert.throws(() => depositMarkup({}), /Phản hồi tiền cọc không hợp lệ/);
});

test("KT-04 stored refund and settlement numbers render separately without recomputing totals", () => {
  const dto = payload({ so_tien_da_hoan: "2400000.00", so_tien_da_khau_tru: "100000.00" });
  dto.settlement = { ngay_quyet_toan: "2026-10-15", tien_coc_ban_dau: "2000000.00", tien_phong_tra_truoc_duoc_hoan: "500000.00", tong_khoan_khau_tru: "100000.00", so_tien_coc_duoc_hoan: "9876543.21", gia_tri_quyet_toan_rong: "-123.45", so_tien_no_sau_thanh_ly: null };
  dto.deductions = [{ loai_khau_tru: "KHAC", ly_do: "Bồi thường", so_tien: "100000.00", ghi_chu: "Theo biên bản" }];
  dto.refunds = [{ ngay_hoan: "2026-10-16", so_tien: "100000.00" }];
  const markup = depositMarkup(dto);
  assert.match(markup, /Tổng đã hoàn theo sổ<\/dt><dd>2\.400\.000 đ/);
  assert.match(markup, /Tiền phòng trả trước được hoàn<\/dt><dd>500\.000 đ/);
  assert.match(markup, /Số được hoàn theo quyết toán \(có thể gồm tiền phòng trả trước\)<\/dt><dd>9\.876\.543,21 đ/);
  assert.match(markup, /Giá trị quyết toán ròng<\/dt><dd>-123,45 đ/);
  assert.match(markup, /16\/10\/2026/);
  assert.match(markup, /Các khoản trong quyết toán/);
});

test("KT-04 legacy totals never fabricate refund dates or events and warnings come from server codes", () => {
  const dto = payload({ so_tien_da_hoan: "250000.00" });
  dto.dataWarnings = ["REFUND_DETAILS_UNAVAILABLE", "LEGACY_SETTLEMENT"];
  const markup = depositMarkup(dto);
  assert.match(markup, /250\.000 đ/);
  assert.match(markup, /Chưa có chi tiết từng lần hoàn/);
  assert.match(markup, /Hồ sơ quyết toán cũ/);
  assert.doesNotMatch(markup, /<li>.*250\.000 đ<\/li>/);
});

test("KT-04 escapes deduction names, notes, unknown statuses and warnings", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const dto = payload({ trang_thai: attack });
  dto.deductions = [{ loai_khau_tru: attack, ly_do: attack, ghi_chu: attack, so_tien: null }];
  dto.dataWarnings = [attack];
  const markup = depositMarkup(dto);
  assert.doesNotMatch(markup, /<img|<script/); assert.match(markup, /&lt;img/);
  assert.doesNotMatch(markup, /data-submit|data-confirm|<input|<form/);
});

test("KT-04 section loads the requested contract only, shows loading and retries safe network errors", async () => {
  const node = slot(); const paths = []; let resolve;
  const api = { get: async (path) => { paths.push(path); if (paths.length === 1) throw new Error("<script>offline</script>"); return new Promise((r) => { resolve = r; }); } };
  await loadDepositSection(node, api, "contract A");
  assert.equal(node.error.textContent, "<script>offline</script>"); assert.match(node.innerHTML, /data-deposit-retry/);
  const retry = node.retry(); assert.match(node.innerHTML, /Đang tải tiền cọc/);
  resolve({ data: payload() }); await retry;
  assert.deepEqual(paths, ["/v1/me/contracts/contract%20A/deposit", "/v1/me/contracts/contract%20A/deposit"]);
  assert.match(node.innerHTML, /2\.000\.000 đ/);
});

test("KT-04 closed modal ignores delayed results and protected 401 follows the existing session handler", async () => {
  const node = slot(); let finish;
  const pending = loadDepositSection(node, { get: () => new Promise((r) => { finish = r; }) }, "old-contract");
  node.isConnected = false; node.innerHTML = "closed";
  finish({ data: payload() }); await pending; assert.equal(node.innerHTML, "closed");
  node.isConnected = true;
  await loadDepositSection(node, { get: async () => { throw Object.assign(new Error("expired"), { status: 401 }); } }, "current-contract");
  assert.equal(node.retry, null); assert.doesNotMatch(node.innerHTML, /expired|data-deposit-retry/);
});

test("KT-04 tenant contract modal embeds deposits per selection and retains owner deposit entry point", () => {
  const tenant = readFileSync(new URL("../src/modules/tenant/rental-info.tab.js", import.meta.url), "utf8");
  const owner = readFileSync(new URL("../src/modules/residents-contracts/contracts.tab.js", import.meta.url), "utf8");
  assert.match(tenant, /<h4>Tiền cọc<\/h4>/);
  assert.match(tenant, /loadDepositSection\(overlay.querySelector\("\[data-contract-deposit\]"\), context.api, contractId\)/);
  assert.match(tenant, /isk19:session-expired/); assert.match(tenant, /event.key === "Escape"/);
  assert.match(owner, /\/dat-coc\?ma_hop_dong=/);
  assert.match(owner, /so_tien_da_hoan/); assert.match(owner, /so_tien_da_khau_tru/);
});
