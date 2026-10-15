document.addEventListener("DOMContentLoaded", async () => {
  if (!window.ApiClient) return;
  const submit = [...document.querySelectorAll(".btn--primary")].pop();
  const dateInput = document.querySelector('input[type="date"]');
  const note = document.querySelector("textarea");
  if (submit) submit.addEventListener("click", async () => {
    if (!dateInput?.value || !note?.value.trim()) return window.alert("Cần nhập ngày dự kiến và ghi chú.");
    try {
      await ApiClient.post("/v1/requests", {
        type: "TRA_PHONG",
        date: new Date(dateInput.value).toISOString(),
        content: note.value.trim(),
        earlyReturnReason: document.querySelector("[name=earlyReturnReason]")?.value?.trim() || undefined,
      });
      window.alert("Đã gửi yêu cầu trả phòng.");
    } catch (error) { window.alert(error.message); }
  });
  try {
    const result = await ApiClient.get("/v1/requests");
    const latest = (result.data || []).find((item) => item.loai_yeu_cau === "TRA_PHONG");
    const status = document.querySelector(".status-badge");
    if (latest && status) status.textContent = latest.trang_thai;
  } catch (error) { console.error(error); }
});
