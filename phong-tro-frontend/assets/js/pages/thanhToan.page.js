document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ApiClient) return;
  try {
    const result = await window.ApiClient.get("/khoan-phai-thu/payment/list?page=1&limit=20");
    const rows = [...document.querySelectorAll("tbody tr")];
    (result.data || []).slice(0, rows.length).forEach((item, index) => {
      const cells = rows[index].querySelectorAll("td");
      if (cells[2]) cells[2].textContent = `${Number(item.so_tien).toLocaleString("vi-VN")} đ`;
      if (cells[3]) cells[3].textContent = new Date(item.thoi_diem_ghi_nhan).toLocaleString("vi-VN");
      if (cells[4]) cells[4].textContent = item.trang_thai_xac_nhan;
    });
  } catch (error) { console.error(error); }
});
