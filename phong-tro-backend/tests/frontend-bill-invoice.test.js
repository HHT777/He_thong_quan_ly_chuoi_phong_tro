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

test("bill management does not show the old draft rounding action", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/finance/bills-v2.js"), "utf8");
  assert.doesNotMatch(source, /data-round-old|Làm tròn Nháp cũ/);
});

test("tenant bill list opens the same invoice view", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../phong-tro-frontend/src/modules/tenant/tenant-finance.tab.js"), "utf8");
  assert.match(source, /rowActions: \[\{ id: "invoice", label: "Xem hóa đơn", openDetail: true \}\]/);
  assert.match(source, /renderBillInvoice\(row, billStatus\(row\)/);
});
