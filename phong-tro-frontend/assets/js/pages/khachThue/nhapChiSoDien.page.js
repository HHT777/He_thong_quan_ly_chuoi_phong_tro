document.addEventListener("DOMContentLoaded", async () => {
  const period = new Date().toISOString().slice(0, 7);
  const periodLabel = document.querySelector("#reading-period");
  const previous = document.querySelector("#previous-reading");
  const value = document.querySelector("#reading-value");
  const image = document.querySelector("#meter-image");
  const warning = document.querySelector("#ocr-warning");
  const suggested = document.querySelector("#ocr-suggested");
  const status = document.querySelector("#reading-status");
  let uploadToken = null;

  periodLabel.textContent = period;
  try {
    const context = await ApiClient.get(`/v1/me/meter-reading-context?period=${period}`);
    previous.value = context.data.previousReading.value;
    if (context.data.current?.status === "DA_XAC_NHAN") {
      status.textContent = "Đã xác nhận";
      document.querySelector("#submit-reading").disabled = true;
    }
  } catch (error) {
    warning.value = error.message;
  }

  document.querySelector("#preview-reading").addEventListener("click", async () => {
    if (!image.files[0]) {
      warning.value = "Vui lòng chọn ảnh công tơ.";
      return;
    }
    const form = new FormData();
    form.append("file", image.files[0]);
    form.append("period", period);
    try {
      const result = await ApiClient.postForm("/v1/me/meter-reading-ocr-previews", form);
      uploadToken = result.data.uploadToken;
      suggested.textContent = result.data.suggestedReading ?? "Nhập tay";
      warning.value = result.data.warnings.map((item) => item.message).join("\n");
      if (result.data.suggestedReading != null) value.value = result.data.suggestedReading;
      status.textContent = result.data.ocrStatus;
    } catch (error) {
      warning.value = error.message;
    }
  });

  document.querySelector("#submit-reading").addEventListener("click", async () => {
    try {
      if (!value.value) throw new Error("Vui lòng nhập chỉ số điện.");
      const result = await ApiClient.post("/v1/me/meter-readings", {
        period,
        readingValue: Number(value.value),
        uploadToken,
      }, { "Idempotency-Key": crypto.randomUUID() });
      status.textContent = result.data.status;
      alert("Đã gửi chỉ số chờ Chủ trọ xác nhận.");
    } catch (error) {
      warning.value = error.message;
    }
  });
});
