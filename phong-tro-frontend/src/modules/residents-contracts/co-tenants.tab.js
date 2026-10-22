import { shellPage, escapeHtml, date, openFormModal, confirmAction } from "../../shared/components/view.js";
import { requiredText } from "../../core/idempotency.js";
import { loadBuildingScope } from "./building-scope.js";

const nextPeriod = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year").value);
  const month = Number(parts.find((part) => part.type === "month").value);
  return `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
};

export default {
  id: "co-tenants", route: "/residents-contracts/co-tenants", title: "Người ở cùng", tabLabel: "Người ở cùng", group: "residents-contracts", order: 33, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Người ở cùng", "Xét đề xuất và theo dõi cư trú. Rời phòng có hiệu lực từ kỳ nước kế tiếp.");
    const content = context.main.querySelector("[data-content]");
    const actions = context.main.querySelector("[data-actions]");
    try {
      const [memberResult, requestResult, scope] = await Promise.all([context.api.get("/v1/co-tenants"), context.api.get("/v1/requests"), loadBuildingScope(context.api, { contracts: true })]);
      scope.mount(actions, () => this.render(context));
      const members = (memberResult.data || []).filter((row) => scope.matchesContractId(row.ma_hop_dong));
      const pending = (requestResult.data || []).filter((row) => row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG" && row.trang_thai === "CHO_XU_LY" && scope.matchesRoom(row.ma_phong));
      content.innerHTML = `<section class="panel"><h3>Đề xuất chờ xử lý</h3><p>Mở chi tiết để đối chiếu đầy đủ giấy tờ, phòng và sức chứa trước khi duyệt.</p><div class="table-wrap"><table><thead><tr><th>Nội dung</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>${pending.map((row, index) => `<tr><td>${escapeHtml(row.noi_dung)}</td><td>${escapeHtml(date(row.ngay_gui))}</td><td><button data-approve="${index}">Xem và duyệt</button> <button data-reject="${index}">Từ chối</button></td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><h3>Người ở cùng đã duyệt</h3><div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Điện thoại</th><th>Giấy tờ</th><th>Ngày sinh</th><th>Giới tính</th><th>Thường trú</th><th>Quan hệ</th><th>Ngày vào</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${members.map((row, index) => `<tr><td>${escapeHtml(row.ho_ten)}</td><td>${escapeHtml(row.so_dien_thoai)}</td><td>${escapeHtml(row.cccd_giay_to)}</td><td>${escapeHtml(date(row.ngay_sinh))}</td><td>${escapeHtml(row.gioi_tinh)}</td><td>${escapeHtml(row.dia_chi_thuong_tru)}</td><td>${escapeHtml(row.quan_he)}</td><td>${escapeHtml(date(row.ngay_vao))}</td><td>${escapeHtml(row.trang_thai_cu_tru)}</td><td>${row.trang_thai_cu_tru === "DANG_O" ? `<button data-leave="${index}">Rời phòng</button>` : "—"}</td></tr>`).join("")}</tbody></table></div></section><p data-message role="status"></p>`;
      const message = content.querySelector("[data-message]");
      content.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-approve],[data-reject],[data-leave]"); if (!button) return;
        if (button.dataset.leave != null) {
          const row = members[Number(button.dataset.leave)];
          return openFormModal({ title: "Đánh dấu rời phòng", submitLabel: "Xác nhận rời", fields: [{ name: "leaveDate", label: "Ngày hiệu lực (kỳ kế tiếp)", type: "date", required: true }], initial: { leaveDate: nextPeriod() }, submit: async (raw) => {
            if (raw.leaveDate < nextPeriod()) throw new Error("Ngày rời phải từ kỳ nước kế tiếp.");
            if (!await confirmAction(`Người ở cùng rời phòng từ ${raw.leaveDate}; tiền nước thay đổi từ kỳ ${raw.leaveDate.slice(0, 7)}. Tiếp tục?`)) return false;
            await context.api.patch(`/v1/co-tenants/${encodeURIComponent(row.ma_thanh_vien_phong)}`, { status: "DA_ROI", leaveDate: raw.leaveDate }); await this.render(context);
          } });
        }
        const row = pending[Number(button.dataset.approve ?? button.dataset.reject)];
        if (button.dataset.approve != null) {
          button.disabled = true; message.textContent = "";
          try {
            const detail = (await context.api.get(`/v1/co-tenant-proposals/${encodeURIComponent(row.ma_yeu_cau)}`)).data;
            const required = ["name", "phone", "identityNumber", "birthDate", "gender", "permanentAddress", "relationship", "startDate"];
            const missing = required.filter((field) => !String(detail[field] ?? "").trim());
            const fields = [["Họ tên", detail.name], ["Điện thoại", detail.phone], ["CCCD/giấy tờ", detail.identityNumber], ["Ngày sinh", detail.birthDate], ["Giới tính", detail.gender], ["Thường trú", detail.permanentAddress], ["Quan hệ", detail.relationship], ["Bắt đầu ở", detail.startDate], ["Hợp đồng", detail.contract?.id], ["Phòng", detail.room?.code], ["Đang ở / sức chứa", `${detail.room?.currentOccupants ?? "—"} / ${detail.room?.capacity ?? "—"}`], ["Trạng thái", detail.status], ["Lý do từ chối", detail.rejectionReason]];
            const overlay = document.createElement("div"); overlay.className = "modal-overlay";
            overlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true"><h3>Đối chiếu đề xuất người ở cùng</h3><dl>${fields.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>${missing.length ? `<p role="alert">Thiếu thông tin định danh: ${escapeHtml(missing.join(", "))}</p>` : ""}<button type="button" data-close>Đóng</button> <button type="button" data-confirm-approve ${missing.length ? "disabled" : ""}>Xác nhận duyệt</button><p data-detail-error role="status"></p></div>`;
            overlay.querySelector("[data-close]").addEventListener("click", () => overlay.remove());
            overlay.querySelector("[data-confirm-approve]").addEventListener("click", async (event) => {
              const approveButton = event.currentTarget;
              if (!await confirmAction("Đã đối chiếu giấy tờ và sức chứa; xác nhận duyệt người ở cùng?")) return;
              approveButton.disabled = true;
              try { await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "DA_PHE_DUYET" }); overlay.remove(); await this.render(context); }
              catch (error) { overlay.querySelector("[data-detail-error]").textContent = error.code === "CO_TENANT_IDENTITY_INCOMPLETE" ? `Không thể duyệt: ${error.message}` : error.message; approveButton.disabled = false; }
            });
            document.body.appendChild(overlay);
          } catch (error) { message.textContent = error.message; } finally { button.disabled = false; }
          return;
        }
        openFormModal({ title: "Từ chối đề xuất", fields: [{ name: "reason", label: "Lý do từ chối", type: "textarea", required: true }], submit: async (raw) => {
          await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "TU_CHOI", reason: requiredText(raw.reason, "Lý do từ chối") }); await this.render(context);
        } });
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
