const test = require("node:test");
const assert = require("node:assert/strict");
const { renderContractHtml } = require("../src/services/contractPrint.service");
const { businessDate } = require("../src/utils/businessDate.util");

function fixture() {
  return {
    contract: {
      ngay_bat_dau: "2026-10-01", ngay_ket_thuc: "2027-09-30",
      gia_thue: "2100000.00", don_gia_dien: "3500.00", don_gia_nuoc: "100000.00",
      phi_dich_vu: "75000.00", goi_gia_han_cho_phep: "6/12 tháng",
      dieu_khoan: `<script>alert("x")</script> O'Neil & thuê`,
      tienCoc: { so_tien_coc: "2300000.00" },
      khachThue: { ho_ten: `<script>alert('name')</script>`, so_dien_thoai: "0912345678", cccd_giay_to: "123456789012" },
      phongTro: { so_phong: "A1", gia_thue: "9900000.00", canTro: { ten_can: "Căn A", dia_chi: 'Số 1 "Phố"', chuTro: { ho_ten: "Chủ A" } } },
    },
    meter: { chi_so_moi: "123.00", ngay_ghi_nhan: new Date("2026-10-01T00:00:00Z") },
    printedOn: businessDate(new Date("2026-10-31T19:00:00Z")),
  };
}

test("FR-184 print uses contract prices, deposit, initial meter and Vietnam business date", () => {
  const html = renderContractHtml(fixture());
  for (const amount of ["2.100.000 đ", "2.300.000 đ", "3.500 đ", "100.000 đ", "75.000 đ"]) assert.ok(html.includes(amount), amount);
  assert.doesNotMatch(html, /9\.900\.000/);
  assert.match(html, /6\/12 tháng/);
  assert.match(html, /01\/10\/2026/);
  assert.match(html, /Ngày in: 01\/11\/2026/);
  assert.match(html, /Chữ ký Chủ trọ/);
  assert.match(html, /Chữ ký Khách thuê/);
});

test("FR-184 print escapes free text and shows only four final identity digits", () => {
  const html = renderContractHtml(fixture());
  assert.doesNotMatch(html, /<script>|123456789012|O'Neil/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; O&#39;Neil &amp; thuê/);
  assert.match(html, /•••• 9012/);
  assert.match(html, /Số 1 &quot;Phố&quot;/);
});

test("FR-184 absent optional values remain blank", () => {
  const data = fixture();
  data.contract.phi_dich_vu = null;
  data.contract.goi_gia_han_cho_phep = null;
  data.contract.tienCoc = null;
  data.meter = null;
  const html = renderContractHtml(data);
  assert.match(html, /<dt>Phí dịch vụ<\/dt><dd><\/dd>/);
  assert.match(html, /<dt>Tiền cọc<\/dt><dd><\/dd>/);
  assert.match(html, /<dt>Gói gia hạn<\/dt><dd><\/dd>/);
  assert.match(html, /<dt>Ngày chốt<\/dt><dd><\/dd>/);
});
