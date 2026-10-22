import { shellPage, escapeHtml, date, money, confirmAction } from "../../shared/components/view.js";
import { openFormModal } from "../../shared/components/view.js";
import { integerVnd, requiredText } from "../../core/idempotency.js";
import { loadBuildingScope } from "./building-scope.js";

export default {
  id: "reservations", route: "/residents-contracts/reservations", title: "Giữ phòng", tabLabel: "Giữ phòng", group: "residents-contracts", order: 30, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Giữ phòng", "Quá hạn không tự giải phóng phòng; Chủ trọ cần xử lý.");
    const content = context.main.querySelector("[data-content]");
    const actions = context.main.querySelector("[data-actions]");
    try {
      const [holdResult, scope] = await Promise.all([context.api.get("/v1/reservations"), loadBuildingScope(context.api)]);
      const holds = (holdResult.data || []).filter((row) => scope.matchesRoom(row.ma_phong));
      const vacant = scope.rooms.filter((room) => scope.matchesRoom(room.ma_phong) && room.trang_thai === "TRONG");
      actions.innerHTML = '<button type="button" class="btn btn--primary" data-create-hold>Giữ phòng mới</button>';
      scope.mount(actions, () => this.render(context));
      actions.querySelector("[data-create-hold]").disabled = !vacant.length;
      actions.querySelector("[data-create-hold]").addEventListener("click", () => openFormModal({
        title: "Giữ phòng trống", submitLabel: "Tạo giữ phòng",
        fields: [
          { name: "roomId", label: "Phòng trống", options: [{ value: "", label: "Chọn phòng" }, ...vacant.map((room) => ({ value: room.ma_phong, label: `${room.canTro?.ten_can || "Căn trọ"} · ${room.so_phong}` }))], required: true },
          { name: "holderName", label: "Tên người giữ", required: true }, { name: "phone", label: "Số điện thoại", required: true },
          { name: "amount", label: "Tiền giữ", type: "number", required: true }, { name: "receivedOn", label: "Ngày nhận", type: "date", required: true },
          { name: "expiresOn", label: "Hạn giữ", type: "date", required: true }, { name: "terms", label: "Điều kiện", type: "textarea", required: true },
        ],
        submit: async (raw) => { await context.api.post("/v1/reservations", { ...raw, amount: integerVnd(raw.amount, "Tiền giữ"), terms: requiredText(raw.terms, "Điều kiện") }); await this.render(context); },
      }));
      content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Phòng</th><th>Người giữ</th><th>Tiền giữ</th><th>Hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${holds.map((row, index) => `<tr><td>${escapeHtml(row.phongTro?.so_phong || row.ma_phong)}</td><td>${escapeHtml(row.ho_ten_nguoi_giu)}</td><td>${escapeHtml(money(row.so_tien_giu))}</td><td>${escapeHtml(date(row.han_giu))}</td><td>${escapeHtml(row.trang_thai)} ${row.quaHan ? '<span class="badge badge--checkout">Quá hạn — phòng vẫn đang giữ, cần Chủ trọ xử lý</span>' : ""}</td><td>${row.trang_thai === "DANG_GIU" ? `<button data-history="${index}">Lịch sử gia hạn</button> <button data-extend="${index}">Gia hạn</button> <button data-cancel="${index}">Hủy</button> <button data-convert="${index}">Lập hợp đồng</button>` : "—"}</td></tr>`).join("")}</tbody></table></div><p data-message role="status"></p>`;
      const message = content.querySelector("[data-message]");
      content.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-history],[data-extend],[data-cancel],[data-convert]"); if (!button) return;
        const row = holds[Number(button.dataset.history ?? button.dataset.extend ?? button.dataset.cancel ?? button.dataset.convert)];
        if (button.dataset.history != null) {
          button.disabled = true;
          try {
            const history = (await context.api.get(`/v1/reservations/${encodeURIComponent(row.ma_dat_giu)}/extension-history`)).data || [];
            const overlay = document.createElement("div"); overlay.className = "modal-overlay";
            overlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true"><h3>Lịch sử gia hạn giữ phòng</h3>${history.map((item) => `<p>${escapeHtml(date(item.extendedAt))}: ${escapeHtml(date(item.oldExpiry))} → ${escapeHtml(date(item.newExpiry))}; người thực hiện ${escapeHtml(item.actorId)}.</p>`).join("") || "Chưa gia hạn."}<button type="button" data-close>Đóng</button></div>`;
            overlay.querySelector("[data-close]").addEventListener("click", () => overlay.remove()); document.body.appendChild(overlay);
          } catch (error) { message.textContent = error.message; } finally { button.disabled = false; }
          return;
        }
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
            const refundAmount = integerVnd(raw.refundAmount, "Tiền hoàn");
            const quoteUrl = `/v1/reservations/${encodeURIComponent(row.ma_dat_giu)}/cancellation-quote?refundAmount=${encodeURIComponent(refundAmount)}`;
            const quote = (await context.api.get(quoteUrl)).data;
            if (!await confirmAction(`Hủy sẽ giải phóng phòng. Hoàn ${money(quote.refundAmount)}, không hoàn ${money(quote.nonRefundAmount)}. Căn cứ: ${quote.basis}. Tiếp tục?`)) return false;
            button.disabled = true;
            try { const result = await context.api.post(`/v1/reservations/${encodeURIComponent(row.ma_dat_giu)}/cancel`, { refundAmount, expectedRefundAmount: quote.refundAmount, reason: requiredText(raw.reason, "Lý do hủy") }); message.textContent = `Đã hủy; tiền hoàn theo server: ${money(result.data.so_tien_hoan)}.`; await this.render(context); }
            catch (error) { if (error.code !== "RESERVATION_REFUND_QUOTE_CHANGED") throw error; const refreshed = (await context.api.get(quoteUrl)).data; throw new Error(`Báo giá đã thay đổi: hoàn ${money(refreshed.refundAmount)}, không hoàn ${money(refreshed.nonRefundAmount)}. Hãy xác nhận lại.`); }
            finally { button.disabled = false; }
          },
        });
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
