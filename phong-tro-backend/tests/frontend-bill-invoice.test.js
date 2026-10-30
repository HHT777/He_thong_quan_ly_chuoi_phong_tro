const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

const frontend = (file) => pathToFileURL(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/finance", file)).href;

test("bill invoice shows stored charges and contract rates without inventing missing data", async () => {
  const { renderBillInvoice } = await import(frontend("billInvoice.js"));
  const html = renderBillInvoice({ thang: 10, nam: 2026, da_gui: false, tong_phai_tra: 263226, tong_da_thanh_toan: 0, so_tien_con_no: 263226,
    hopDong: { gia_thue: 2666667, don_gia_dien: 8700, don_gia_nuoc: 80000, phi_dich_vu: 0, phongTro: { so_phong: "109" }, khachThue: { ho_ten: "<script>" } },
    chiTiets: [{ loai_khoan: "TIEN_PHONG", so_tien: 258065, dien_giai: "Giá hợp đồng 2.666.667 đ/tháng; 3/31 ngày" }, { loai_khoan: "TIEN_NUOC", so_tien: 5161, dien_giai: "2 người × 80.000 đ/người" }],
  }, "Nháp", "");
  for (const text of ["Tiền phòng theo hợp đồng", "Đơn giá điện", "Đơn giá nước", "Phí dịch vụ theo hợp đồng", "Tiền phòng tháng này", "Tổng tiền nước", "263.226 đ", "Còn phải thanh toán"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("Chỉ số cũ"));
  assert.ok(!html.includes("Tổng phiếu này còn số lẻ"));
});

test("old draft rounding uses the existing audited adjustment API and leaves sent bills alone", async () => {
  const { roundOldDraftBills, roundingAdjustment } = await import(frontend("billRounding.js"));
  assert.equal(roundingAdjustment(263226.29), -0.29);
  assert.equal(roundingAdjustment(263226.8), 0.2);
  const posted = [];
  const api = {
    get: async (url) => {
      if (url.includes("page=1")) return { data: [{ ma_thanh_toan: "draft-1", da_gui: false, tong_phai_tra: 263226.29 }, { ma_thanh_toan: "sent-1", da_gui: true, tong_phai_tra: 123.45 }], pagination: { hasNext: true } };
      if (url.includes("page=2")) return { data: [{ ma_thanh_toan: "draft-2", da_gui: false, tong_phai_tra: 100 }], pagination: { hasNext: false } };
      return { data: { ma_thanh_toan: "draft-1", da_gui: false, tong_phai_tra: 263226.29 } };
    },
    post: async (url, body) => { posted.push({ url, body }); return { data: {} }; },
  };
  const result = await roundOldDraftBills(api, async () => true);
  assert.deepEqual(result, { rounded: 1, failed: 0, found: 1 });
  assert.deepEqual(posted, [{ url: "/v1/bills/draft-1/adjustments", body: { delta: -0.29, reason: "Làm tròn tổng phiếu thu đến đồng" } }]);
});

test("tenant bill list opens the same invoice view", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/tenant/tenant-finance.tab.js"), "utf8");
  assert.match(source, /rowActions: \[\{ id: "invoice", label: "Xem hóa đơn", openDetail: true \}\]/);
  assert.match(source, /renderBillInvoice\(row, billStatus\(row\)/);
});
