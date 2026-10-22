import { shellPage, escapeHtml, date, openFormModal, confirmAction } from "../../shared/components/view.js";
import { requiredText } from "../../core/idempotency.js";
import { loadBuildingScope } from "./building-scope.js";

export default {
  id: "requests", route: "/residents-contracts/requests", title: "Yêu cầu cư dân", tabLabel: "Yêu cầu", group: "residents-contracts", order: 34, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Yêu cầu cư dân", "Duyệt gia hạn, trả phòng và đề xuất người ở cùng sau khi đối chiếu thông tin.");
    const content = context.main.querySelector("[data-content]");
    const actions = context.main.querySelector("[data-actions]");
    try {
      const [result, scope] = await Promise.all([context.api.get("/v1/requests"), loadBuildingScope(context.api)]);
      scope.mount(actions, () => this.render(context));
      const data = (result.data || []).filter((row) => scope.matchesRoom(row.ma_phong));
      content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Loại</th><th>Nội dung</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${data.map((item, index) => `<tr><td>${escapeHtml(item.loai_yeu_cau)}</td><td>${escapeHtml(item.noi_dung)}</td><td>${escapeHtml(date(item.ngay_gui))}</td><td>${escapeHtml(item.trang_thai)}</td><td>${item.trang_thai === "CHO_XU_LY" ? `${item.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG" ? "Cần đối chiếu hồ sơ định danh trước khi duyệt" : `<button data-approve="${index}">Duyệt</button>`} <button data-reject="${index}">Từ chối</button>` : item.loai_yeu_cau === "TRA_PHONG" && item.trang_thai === "DA_PHE_DUYET" ? `<button data-revoke="${index}">Rút duyệt</button>` : "—"}</td></tr>`).join("")}</tbody></table></div><p data-message role="status"></p>`;
      if (data.some((item) => item.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG" && item.trang_thai === "CHO_XU_LY")) content.insertAdjacentHTML("afterbegin", '<p><a href="#/residents-contracts/co-tenants">Mở màn hình người ở cùng để xem định danh và duyệt đề xuất</a></p>');
      const message = content.querySelector("[data-message]");
      content.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-approve],[data-reject],[data-revoke]"); if (!button) return;
        const row = data[Number(button.dataset.approve ?? button.dataset.reject ?? button.dataset.revoke)];
        if (button.dataset.approve != null) {
          if (!await confirmAction(`Duyệt yêu cầu ${row.loai_yeu_cau}?`)) return;
          button.disabled = true;
          try { await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "DA_PHE_DUYET" }); await this.render(context); }
          catch (error) { message.textContent = error.message; button.disabled = false; }
          return;
        }
        const revoke = button.dataset.revoke != null;
        openFormModal({ title: revoke ? "Rút duyệt trả phòng" : "Từ chối yêu cầu", fields: [{ name: "reason", label: "Lý do", type: "textarea", required: true }], submit: async (raw) => {
          const reason = requiredText(raw.reason, "Lý do");
          if (!await confirmAction(revoke ? "Rút duyệt sẽ hoàn trạng thái yêu cầu và phòng. Tiếp tục?" : "Từ chối yêu cầu này?")) return false;
          if (revoke) await context.api.post(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}/revoke`, { reason });
          else await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "TU_CHOI", reason });
          await this.render(context);
        } });
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
