import { shellPage, escapeHtml, date, money, confirmAction } from "../../shared/components/view.js";
import { openFormModal } from "../../shared/components/view.js";
import { integerVnd, requiredText } from "../../core/idempotency.js";

export default {
  id: "reservations", route: "/residents-contracts/reservations", title: "Giữ phòng", tabLabel: "Giữ phòng", group: "residents-contracts", order: 30, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Giữ phòng", "Quá hạn không tự giải phóng phòng; Chủ trọ cần xử lý.");
    const content = context.main.querySelector("[data-content]");
    const actions = context.main.querySelector("[data-actions]");
    try {
      const [holdResult, roomResult] = await Promise.all([context.api.get("/v1/reservations"), context.api.get("/phong?limit=100")]);
      const holds = holdResult.data || [];
      const vacant = (roomResult.data || []).filter((room) => room.trang_thai === "TRONG");
      actions.innerHTML = '<button type="button" class="btn btn--primary" data-create-hold>Giữ phòng mới</button>';
      actions.querySelector("[data-create-hold]").addEventListener("click", () => openFormModal({
        title: "Giữ phòng trống", submitLabel: "Tạo giữ phòng",
        fields: [
          { name: "roomId", label: "Phòng trống", options: vacant.map((room) => ({ value: room.ma_phong, label: room.so_phong })), required: true },
          { name: "holderName", label: "Tên người giữ", required: true }, { name: "phone", label: "Số điện thoại", required: true },
          { name: "amount", label: "Tiền giữ", type: "number", required: true }, { name: "receivedOn", label: "Ngày nhận", type: "date", required: true },
          { name: "expiresOn", label: "Hạn giữ", type: "date", required: true }, { name: "terms", label: "Điều kiện", type: "textarea", required: true },
        ],
        submit: async (raw) => { await context.api.post("/v1/reservations", { ...raw, amount: integerVnd(raw.amount, "Tiền giữ"), terms: requiredText(raw.terms, "Điều kiện") }); await this.render(context); },
      }));
      content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Phòng</th><th>Người giữ</th><th>Tiền giữ</th><th>Hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${holds.map((row, index) => `<tr><td>${escapeHtml(row.phongTro?.so_phong || row.ma_phong)}</td><td>${escapeHtml(row.ho_ten_nguoi_giu)}</td><td>${escapeHtml(money(row.so_tien_giu))}</td><td>${escapeHtml(date(row.han_giu))}</td><td>${escapeHtml(row.trang_thai)} ${row.quaHan ? '<span class="badge badge--checkout">Quá hạn — phòng vẫn đang giữ, cần Chủ trọ xử lý</span>' : ""}</td><td>${row.trang_thai === "DANG_GIU" ? `<button data-extend="${index}">Gia hạn</button> <button data-cancel="${index}">Hủy</button> <button data-convert="${index}">Lập hợp đồng</button>` : "—"}</td></tr>`).join("")}</tbody></table></div><p data-message role="status"></p>`;
      const message = content.querySelector("[data-message]");
      content.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-extend],[data-cancel],[data-convert]"); if (!button) return;
        const row = holds[Number(button.dataset.extend ?? button.dataset.cancel ?? button.dataset.convert)];
        if (button.dataset.convert != null) {
          sessionStorage.setItem("qlpt:contract-reservation", JSON.stringify({ roomId: row.ma_phong, reservationId: row.ma_dat_giu }));
          location.hash = "#/residents-contracts/contracts"; return;
        }
        if (button.dataset.extend != null) return openFormModal({
          title: "Gia hạn giữ phòng", fields: [{ name: "expiresOn", label: "Hạn mới", type: "date", required: true }, { name: "reason", label: "Lý do", type: "textarea", required: true }],
          submit: async (raw) => { await context.api.patch(`/v1/reservations/${encodeURIComponent(row.ma_dat_giu)}/extend`, { expiresOn: raw.expiresOn, reason: requiredText(raw.reason, "Lý do") }); await this.render(context); },
        });
        openFormModal({
          title: "Hủy giữ phòng và ghi nhận hoàn tiền", submitLabel: "Xác nhận hủy",
          fields: [{ name: "refundAmount", label: `Tiền hoàn (tiền đã giữ: ${money(row.so_tien_giu)})`, type: "number", value: row.so_tien_giu, required: true }, { name: "reason", label: "Lý do hủy", type: "textarea", required: true }],
          submit: async (raw) => {
            if (!await confirmAction("Hủy giữ phòng sẽ giải phóng phòng và ghi nhận phần tiền không hoàn là doanh thu. Tiếp tục?")) return false;
            const refundAmount = integerVnd(raw.refundAmount, "Tiền hoàn");
            button.disabled = true;
            try { const result = await context.api.post(`/v1/reservations/${encodeURIComponent(row.ma_dat_giu)}/cancel`, { refundAmount, reason: requiredText(raw.reason, "Lý do hủy") }); message.textContent = `Đã hủy; tiền hoàn theo server: ${money(result.data.so_tien_hoan)}.`; await this.render(context); }
            finally { button.disabled = false; }
          },
        });
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
