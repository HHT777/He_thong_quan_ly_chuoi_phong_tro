import { shellPage, escapeHtml, date, openFormModal, confirmAction } from "../../shared/components/view.js";
import { requiredText } from "../../core/idempotency.js";
import { loadBuildingScope } from "./building-scope.js";
import "./requests.css";

const REQUEST_LABELS = {
  GIA_HAN: "Gia hạn hợp đồng",
  TRA_PHONG: "Trả phòng",
  DE_XUAT_BAN_CUNG_PHONG: "Thêm người ở cùng",
};

const STATUS_LABELS = {
  CHO_XU_LY: "Chờ xử lý",
  DA_PHE_DUYET: "Đã duyệt",
  TU_CHOI: "Đã từ chối",
};

function showRequestDetails(request, scope) {
  const room = scope.roomById.get(String(request.ma_phong));
  const buildingName = room
    ? (room.canTro?.ten_can || scope.buildingById.get(String(room.ma_can))?.name || "—")
    : "—";
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay request-detail-overlay";
  overlay.innerHTML = `<section class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="request-detail-title">
    <header class="modal-header"><div class="modal-title-wrap"><h3 class="modal-title" id="request-detail-title">Chi tiết yêu cầu</h3></div><button class="modal-close-btn" type="button" aria-label="Đóng" data-close>×</button></header>
    <div class="modal-body"><dl class="request-detail-grid">
      <div><dt>Loại yêu cầu</dt><dd>${escapeHtml(REQUEST_LABELS[request.loai_yeu_cau] || request.loai_yeu_cau)}</dd></div>
      <div><dt>Ngày gửi</dt><dd>${escapeHtml(date(request.ngay_gui))}</dd></div>
      <div><dt>Phòng</dt><dd>${escapeHtml(room ? `Phòng ${room.so_phong || "—"}` : "—")}</dd></div>
      <div><dt>Căn</dt><dd>${escapeHtml(buildingName)}</dd></div>
      <div><dt>Trạng thái</dt><dd>${escapeHtml(STATUS_LABELS[request.trang_thai] || request.trang_thai)}</dd></div>
      <div class="request-detail-grid__wide"><dt>Nội dung</dt><dd>${escapeHtml(request.noi_dung || "—")}</dd></div>
      ${request.ly_do_xu_ly ? `<div class="request-detail-grid__wide"><dt>Ghi chú xử lý</dt><dd>${escapeHtml(request.ly_do_xu_ly)}</dd></div>` : ""}
    </dl></div>
    <footer class="request-detail-footer"><button type="button" class="btn btn--secondary" data-close>Đóng</button></footer>
  </section>`;
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  const close = () => {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  };
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay);
}

export default {
  id: "requests", route: "/residents-contracts/requests", title: "Yêu cầu cư dân", tabLabel: "Yêu cầu", group: "residents-contracts", order: 34, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Yêu cầu cư dân", "");
    const content = context.main.querySelector("[data-content]");
    const actions = context.main.querySelector("[data-actions]");
    try {
      const [result, scope] = await Promise.all([context.api.get("/v1/requests"), loadBuildingScope(context.api)]);
      scope.mount(actions, () => this.render(context));
      const data = (result.data || []).filter((row) => scope.matchesRoom(row.ma_phong));
      const actionMenu = (item, index) => {
        const pending = item.trang_thai === "CHO_XU_LY";
        const isCoTenant = item.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG";
        const canRevoke = item.loai_yeu_cau === "TRA_PHONG" && item.trang_thai === "DA_PHE_DUYET";
        return `<div class="request-action-menu">
          <button type="button" class="row-action-menu__trigger" data-menu-toggle aria-label="Thao tác yêu cầu" aria-expanded="false">⋯</button>
          <div class="row-action-menu__items">
            <button type="button" class="row-action-menu__item" data-detail="${index}">Chi tiết</button>
            ${pending ? `<button type="button" class="row-action-menu__item" data-approve="${index}">Duyệt</button><button type="button" class="row-action-menu__item" data-reject="${index}">Từ chối</button>` : ""}
            ${canRevoke ? `<button type="button" class="row-action-menu__item" data-revoke="${index}">Rút duyệt</button>` : ""}
          </div>
        </div>`;
      };
      content.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Loại</th><th>Nội dung</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${data.map((item, index) => `<tr><td>${escapeHtml(REQUEST_LABELS[item.loai_yeu_cau] || item.loai_yeu_cau)}</td><td>${escapeHtml(item.noi_dung)}</td><td>${escapeHtml(date(item.ngay_gui))}</td><td>${escapeHtml(STATUS_LABELS[item.trang_thai] || item.trang_thai)}</td><td>${actionMenu(item, index)}</td></tr>`).join("")}</tbody></table></div><p data-message role="status"></p>`;
      const message = content.querySelector("[data-message]");
      content.addEventListener("click", async (event) => {
        const toggle = event.target.closest("[data-menu-toggle]");
        if (toggle) {
          const expanded = toggle.getAttribute("aria-expanded") === "true";
          content.querySelectorAll("[data-menu-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
          toggle.setAttribute("aria-expanded", String(!expanded));
          return;
        }
        const button = event.target.closest("[data-detail],[data-approve],[data-reject],[data-revoke]");
        if (!button) return;
        const index = Number(button.dataset.detail ?? button.dataset.approve ?? button.dataset.reject ?? button.dataset.revoke);
        const row = data[index];
        if (!row) return;
        if (button.dataset.detail != null) {
          showRequestDetails(row, scope);
          return;
        }
        if (button.dataset.approve != null) {
          if (row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG") {
            window.location.hash = `#/residents-contracts/residents?coTenantRequestId=${encodeURIComponent(row.ma_yeu_cau)}`;
            return;
          }
          if (!await confirmAction(`Duyệt yêu cầu ${REQUEST_LABELS[row.loai_yeu_cau] || row.loai_yeu_cau}?`)) return;
          button.disabled = true;
          try { await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "DA_PHE_DUYET" }); await this.render(context); }
          catch (error) { message.textContent = error.message; button.disabled = false; }
          return;
        }
        const revoke = button.dataset.revoke != null;
        openFormModal({
          title: revoke ? "Rút duyệt trả phòng" : "Từ chối yêu cầu",
          fields: [{ name: "reason", label: revoke ? "Lý do rút duyệt" : "Lý do từ chối", type: "textarea", required: true }],
          onOpen: ({ overlay }) => overlay.classList.add("request-reason-overlay"),
          submit: async (raw) => {
            const reason = requiredText(raw.reason, revoke ? "Lý do rút duyệt" : "Lý do từ chối");
            if (!await confirmAction(revoke ? "Rút duyệt sẽ hoàn trạng thái yêu cầu và phòng. Tiếp tục?" : "Từ chối yêu cầu này?")) return false;
            if (revoke) await context.api.post(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}/revoke`, { reason });
            else await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "TU_CHOI", reason });
            await this.render(context);
          },
        });
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
