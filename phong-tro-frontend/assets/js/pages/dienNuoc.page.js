document.addEventListener("DOMContentLoaded", async () => {
  const tbody = document.querySelector(".data-table tbody");
  if (!tbody || !window.ApiClient) return;
  try {
    const result = await ApiClient.get("/v1/meter-readings?status=CHO_XAC_NHAN&page=1&pageSize=50");
    tbody.replaceChildren();
    for (const reading of result.data) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${reading.room.code}</td>
        <td>${reading.previousReading ?? "—"}</td>
        <td>${reading.readingValue ?? "—"}</td>
        <td>${reading.consumptionKwh ?? "Chờ xác nhận"}</td>
        <td>${reading.status}</td>
        <td><button class="btn btn--ghost confirm-reading" data-id="${reading.id}" data-version="${reading.version}">Xác nhận</button></td>`;
      row.querySelector(".confirm-reading").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        try {
          await ApiClient.post(
            `/v1/meter-readings/${button.dataset.id}/confirmations`,
            { note: null },
            {
              "Idempotency-Key": crypto.randomUUID(),
              "If-Match": `"${button.dataset.version}"`,
            },
          );
          button.disabled = true;
          button.textContent = "Đã xác nhận";
        } catch (error) {
          alert(error.message);
        }
      });
      tbody.appendChild(row);
    }
  } catch (error) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="6">${error.message}</td>`;
    tbody.replaceChildren(row);
  }
});
