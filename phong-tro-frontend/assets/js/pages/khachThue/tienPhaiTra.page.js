function billStatusLabel(status) {
  return (
    {
      CHUA_THANH_TOAN: ["Chưa thanh toán", "status-badge--warning"],
      THANH_TOAN_MOT_PHAN: ["Thanh toán một phần", "status-badge--info"],
      DA_THANH_TOAN: ["Đã thanh toán", "status-badge--success"],
      QUA_HAN: ["Quá hạn", "status-badge--danger"],
    }[status] || [status || "—", "status-badge--info"]
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await window.ApiClient.get(
      "/khoan-phai-thu?limit=100",
    );
    const bills = response.data || [];
    const total = bills.reduce(
      (sum, bill) => sum + Number(bill.tong_phai_tra || 0),
      0,
    );
    const paid = bills.reduce(
      (sum, bill) => sum + Number(bill.tong_da_thanh_toan || 0),
      0,
    );
    const due = total - paid;
    document.querySelector("[data-bill-total]").textContent =
      FormatUtil.currency(total);
    document.querySelector("[data-bill-paid]").textContent =
      FormatUtil.currency(paid);
    document.querySelector("[data-bill-due]").textContent =
      FormatUtil.currency(due);
    document.querySelector("[data-bill-due-date]").textContent = bills[0]
      ? `10/${String(bills[0].thang).padStart(2, "0")}/${bills[0].nam}`
      : "—";
    document.querySelector("[data-bill-rows]").innerHTML =
      bills
        .map((bill) => {
          const [label, tone] = billStatusLabel(bill.trang_thai);
          const room = bill.hopDong?.phongTro?.ma_phong || bill.hopDong?.ma_phong || "—";
          return `<tr><td>Hóa đơn phòng ${room}</td><td>${String(bill.thang).padStart(2, "0")}/${bill.nam}</td><td>${FormatUtil.currency(bill.tong_phai_tra)}</td><td><span class="status-badge ${tone}">${label}</span></td></tr>`;
        })
        .join("") || '<tr><td colspan="4">Chưa có khoản phải thu.</td></tr>';
  } catch (error) {
    document.querySelector("[data-bill-rows]").innerHTML =
      `<tr><td colspan="4">${error.message}</td></tr>`;
  }
});
document.addEventListener("DOMContentLoaded", () => {
  console.log("TienPhaiTra page loaded");
});
