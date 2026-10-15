document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ApiClient) return;
  try {
    const result = await window.ApiClient.get("/v1/incidents");
    const rows = [...document.querySelectorAll("tbody tr")];
    result.data.slice(0, rows.length).forEach((item, index) => {
      const cells = rows[index].querySelectorAll("td");
      if (cells[0]) cells[0].textContent = item.ma_phong;
      if (cells[1]) cells[1].textContent = item.mo_ta || item.loai_su_co;
      if (cells[2]) cells[2].textContent = item.muc_do_uu_tien;
      if (cells[3]) cells[3].textContent = item.trang_thai;
      if (cells[4]) cells[4].textContent = new Date(item.ngay_gui).toLocaleDateString("vi-VN");
    });
  } catch (error) { console.error(error); }
});
