document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelector("#tenantIssueForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = document.querySelector("#issueMessage");
      try {
        const context = await window.ApiClient.get(
          `/v1/me/meter-reading-context?period=${new Date().toISOString().slice(0, 7)}`,
        );
        await window.ApiClient.post("/v1/incidents", {
          roomId: context.data.room.id.replace("room_", ""),
          title: "Sự cố do khách thuê báo",
          description: event.currentTarget.elements.noi_dung.value,
        });
        event.currentTarget.reset();
        message.textContent = "Đã gửi sự cố thành công.";
      } catch (error) {
        message.textContent = error.message;
      }
    });
});
