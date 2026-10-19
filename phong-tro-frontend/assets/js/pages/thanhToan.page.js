document.addEventListener("DOMContentLoaded", () => {
  if (!window.ApiClient) return;
  const load = async () => {
  try {
    const result = await window.ApiClient.get("/khoan-phai-thu/payment/list?page=1&limit=20");
    const rows = [...document.querySelectorAll("tbody tr")];
    (result.data || []).slice(0, rows.length).forEach((item, index) => {
      const cells = rows[index].querySelectorAll("td");
      if (cells[2]) cells[2].textContent = `${Number(item.so_tien).toLocaleString("vi-VN")} đ`;
      if (cells[3]) cells[3].textContent = new Date(item.thoi_diem_ghi_nhan).toLocaleString("vi-VN");
      if (cells[4]) cells[4].textContent = item.trang_thai_xac_nhan;
    });
    document.querySelector("[data-api-load-error]")?.remove();
  } catch (error) {
    document.querySelector("[data-api-load-error]")?.remove();
    const state = document.createElement("div"); state.dataset.apiLoadError = "";
    state.textContent = `Không tải được thanh toán: ${error.message} `;
    const retry = document.createElement("button"); retry.textContent = "Thử lại";
    retry.addEventListener("click", load); state.append(retry); document.body.prepend(state);
  }
  };
  load();
});
