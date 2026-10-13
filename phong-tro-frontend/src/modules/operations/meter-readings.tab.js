import { shellPage, escapeHtml, date } from "../../shared/components/view.js";

function readingRow(item) {
  const confirmation = item.status === "CHO_XAC_NHAN"
    ? `<button class="btn btn--primary" data-confirm="${escapeHtml(item.id)}">Xác nhận</button>`
    : "";

  return `<tr>
    <td>${escapeHtml(item.room?.code || item.room?.id)}</td>
    <td>${escapeHtml(item.period)}</td>
    <td>${escapeHtml(item.readingValue)}</td>
    <td>${escapeHtml(item.status)}</td>
    <td>${date(item.submittedAt)}</td>
    <td>${confirmation}</td>
  </tr>`;
}

export default {
  id: "meter-readings",
  route: "/operations/meter-readings",
  title: "Chỉ số điện",
  tabLabel: "Chỉ số điện",
  group: "operations",
  order: 50,
  roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage(
      "Chỉ số điện",
      "Xác nhận chỉ số do khách thuê gửi hoặc ghi nhận thủ công.",
    );
    const content = context.main.querySelector("[data-content]");
    try {
      const { data = [] } = await context.api.get("/v1/meter-readings?pageSize=100");
      content.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>Phòng</th><th>Kỳ</th><th>Chỉ số</th><th>Trạng thái</th><th>Ghi nhận</th><th></th></tr></thead>
        <tbody>${data.map(readingRow).join("")}</tbody>
      </table></div>`;
      content.querySelectorAll("[data-confirm]").forEach((button) => {
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await context.api.post(
              `/v1/meter-readings/${button.dataset.confirm}/confirmations`,
              {},
              { "Idempotency-Key": crypto.randomUUID(), "If-Match": "*" },
            );
            await this.render(context);
          } catch (error) {
            window.alert(error.message);
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`;
    }
  },
};
