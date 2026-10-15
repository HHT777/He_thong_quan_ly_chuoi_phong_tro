document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ApiClient) return;
  const cards = document.querySelectorAll(".detail-card");
  const accountCard = cards[2];
  try {
    const [profileResponse, buildingsResponse] = await Promise.all([
      window.ApiClient.get("/auth/profile"),
      window.ApiClient.get("/management/can-tro"),
    ]);
    const profile = profileResponse.data || {};
    const headings = accountCard?.querySelectorAll(".section-title");
    if (headings?.[0]) headings[0].textContent = profile.ten_dang_nhap || "Tài khoản";
    const values = accountCard?.querySelectorAll(".metric-item__value");
    if (values?.[0]) values[0].textContent = profile.vai_tro === "CHU_TRO" ? "Chủ trọ" : "Khách thuê";
    if (values?.[1]) values[1].textContent = `Mã tài khoản: ${profile.ma_tai_khoan || "—"}`;
    const buildingCount = cards[0]?.querySelectorAll(".metric-item__value")?.[2];
    if (buildingCount) buildingCount.textContent = `${(buildingsResponse.data || []).length} căn`;
  } catch (error) {
    if (accountCard) accountCard.setAttribute("title", error.message);
  }

  const passwordButton = accountCard?.querySelector("button");
  passwordButton?.addEventListener("click", async () => {
    const currentPassword = window.prompt("Nhập mật khẩu hiện tại:");
    if (!currentPassword) return;
    const newPassword = window.prompt("Nhập mật khẩu mới:");
    if (!newPassword) return;
    try {
      await window.ApiClient.patch("/v1/account/password", { currentPassword, newPassword });
      window.alert("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      window.ApiClient.logout();
      window.location.href = window.ApiClient.pagePath("login.html");
    } catch (error) {
      window.alert(error.message);
    }
  });

  cards[1]?.querySelector("button")?.addEventListener("click", () => {
    window.alert("Database hiện chưa có cấu hình lưu tùy chọn nhắc việc.");
  });
});
