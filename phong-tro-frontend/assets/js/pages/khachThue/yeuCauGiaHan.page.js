document.addEventListener("DOMContentLoaded", async () => {
  const buttons = [...document.querySelectorAll(".btn--primary")];
  const submit = buttons[buttons.length - 1];
  if (!submit || !window.ApiClient) return;
  let activeContract = null;
  submit.addEventListener("click", async () => {
    const content = document.querySelector("textarea")?.value || window.prompt("Lý do gia hạn");
    if (!content) return;
    try {
      const months = Number(document.querySelector("#renewal-months")?.value || 6);
      if (!activeContract?.ngay_ket_thuc) throw new Error("Không tìm thấy hợp đồng đang thuê.");
      const requestedEndDate = new Date(`${activeContract.ngay_ket_thuc}T00:00:00`);
      requestedEndDate.setMonth(requestedEndDate.getMonth() + months);
      await window.ApiClient.post("/v1/requests", {
        type: "GIA_HAN",
        content,
        requestedEndDate: requestedEndDate.toISOString().slice(0, 10),
      });
      window.alert("Đã gửi yêu cầu gia hạn.");
    } catch (error) { window.alert(error.message); }
  });
  const load = async () => { try {
    const [result, contractResult] = await Promise.all([
      window.ApiClient.get("/v1/requests"),
      window.ApiClient.get("/hop-dong?limit=20"),
    ]);
    activeContract = (contractResult.data || []).find((item) =>
      ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai),
    );
    const currentInput = document.querySelector(".form-grid input");
    if (currentInput && activeContract?.ngay_ket_thuc) {
      currentInput.value = new Date(`${activeContract.ngay_ket_thuc}T00:00:00`).toLocaleDateString("vi-VN");
      currentInput.readOnly = true;
    }
    const status = document.querySelector(".status-badge");
    const latest = (result.data || []).find((item) => item.loai_yeu_cau === "GIA_HAN");
    if (status && latest) status.textContent = latest.trang_thai;
    document.querySelector("[data-api-load-error]")?.remove();
  } catch (error) {
    document.querySelector("[data-api-load-error]")?.remove();
    const state = document.createElement("div"); state.dataset.apiLoadError = "";
    state.textContent = `Không tải được yêu cầu gia hạn: ${error.message} `;
    const retry = document.createElement("button"); retry.textContent = "Thử lại";
    retry.addEventListener("click", load); document.body.prepend(state); state.append(retry);
  } };
  load();
});
