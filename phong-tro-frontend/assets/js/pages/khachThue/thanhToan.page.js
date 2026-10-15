document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await window.ApiClient.get(
      "/khoan-phai-thu/payment/list?limit=100",
    );
    const rows = document.querySelector("[data-payment-rows]");
    const items = response.data || [];
    rows.innerHTML =
      items
        .map(
          (item) =>
            `<tr><td>${item.ma_giao_dich}</td><td>${new Date(item.thoi_diem_ghi_nhan).toLocaleDateString("vi-VN")}</td><td>${FormatUtil.currency(item.so_tien)}</td><td>${item.trang_thai_xac_nhan}</td></tr>`,
        )
        .join("") ||
      '<tr><td colspan="4">Chưa có lịch sử thanh toán.</td></tr>';
  } catch (error) {
    document.querySelector("[data-payment-rows]").innerHTML =
      `<tr><td colspan="4">${error.message}</td></tr>`;
  }
});
