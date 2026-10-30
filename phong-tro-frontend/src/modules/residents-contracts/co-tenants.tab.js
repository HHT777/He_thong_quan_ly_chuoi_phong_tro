import { escapeHtml, date, openFormModal, confirmAction } from "../../shared/components/view.js";
import { requiredText } from "../../core/idempotency.js";
import { loadBuildingScope } from "./building-scope.js";
import "./co-tenants.css";

const nextPeriod = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year").value);
  const month = Number(parts.find((part) => part.type === "month").value);
  return `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
};

export async function openCoTenantsBox(context, onChanged = () => {}, { requestId = "" } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<section class="modal-dialog co-tenant-box" role="dialog" aria-modal="true" aria-labelledby="co-tenant-box-title">
    <header class="modal-header"><h2 class="modal-title" id="co-tenant-box-title">Người ở cùng</h2><button type="button" class="modal-close-btn" data-close aria-label="Đóng">×</button></header>
    <div class="modal-body co-tenant-box__body"><div data-box-content role="region" aria-live="polite">Đang tải dữ liệu...</div></div>
  </section>`;
  const content = overlay.querySelector("[data-box-content]");
  let members = [];
  let pending = [];
  let scope;
  const close = () => { document.removeEventListener("keydown", onKeydown); overlay.remove(); };
  const onKeydown = (event) => { if (event.key === "Escape") close(); };
  overlay.addEventListener("click", (event) => { if (event.target === overlay || event.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKeydown);
  document.body.appendChild(overlay);

  const reload = async () => {
    content.textContent = "Đang tải dữ liệu...";
    try {
      const [memberResult, requestResult, nextScope] = await Promise.all([
        context.api.get("/v1/co-tenants"),
        context.api.get("/v1/requests"),
        loadBuildingScope(context.api, { contracts: true }),
      ]);
      scope = nextScope;
      members = (memberResult.data || []).filter((row) => scope.matchesContractId(row.ma_hop_dong));
      const proposals = (requestResult.data || []).filter((row) => row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG"
        && scope.matchesRoom(row.ma_phong)
        && (requestId ? String(row.ma_yeu_cau) === String(requestId) : row.trang_thai === "CHO_XU_LY"));
      pending = proposals;
      const locationFor = (roomId) => {
        const room = scope.roomById.get(String(roomId));
        const building = room && scope.buildingById.get(String(room.ma_can));
        return { building: building?.name || "—", room: room?.so_phong || "—" };
      };
      content.innerHTML = `<p>Đối chiếu thông tin và sức chứa trước khi duyệt đề xuất. Khi đánh dấu rời phòng, thời điểm có hiệu lực từ kỳ nước tiếp theo.</p>
        <section class="co-tenant-box__section"><h3>${requestId ? "Yêu cầu được chọn" : "Đề xuất chờ xử lý"} (${pending.length})</h3><p data-message role="status"></p>
          ${pending.length ? `<div class="table-wrap"><table><thead><tr><th>Căn</th><th>Phòng</th><th>Nội dung</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${pending.map((row, index) => { const location = locationFor(row.ma_phong); return `<tr${requestId ? ' class="co-tenant-box__selected-request"' : ""}><td>${escapeHtml(location.building)}</td><td>${escapeHtml(location.room)}</td><td>${escapeHtml(row.noi_dung)}</td><td>${escapeHtml(date(row.ngay_gui))}</td><td>${escapeHtml(row.trang_thai)}</td><td>${row.trang_thai === "CHO_XU_LY" ? `<button class="btn btn--secondary" data-approve="${index}">Xem và duyệt</button> <button class="btn btn--secondary" data-reject="${index}">Từ chối</button>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : `<p>${requestId ? "Không tìm thấy yêu cầu này trong danh sách được quản lý." : "Không có đề xuất đang chờ."}</p>`}
        </section>
        <section class="co-tenant-box__section"><h3>Người ở cùng (${members.length})</h3>
          ${members.length ? `<div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Điện thoại</th><th>Giấy tờ</th><th>Ngày sinh</th><th>Giới tính</th><th>Thường trú</th><th>Quan hệ</th><th>Căn</th><th>Phòng</th><th>Ngày vào</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${members.map((row, index) => { const location = locationFor(row.ma_phong); return `<tr><td>${escapeHtml(row.ho_ten)}</td><td>${escapeHtml(row.so_dien_thoai)}</td><td>${escapeHtml(row.cccd_giay_to)}</td><td>${escapeHtml(date(row.ngay_sinh))}</td><td>${escapeHtml(row.gioi_tinh)}</td><td>${escapeHtml(row.dia_chi_thuong_tru)}</td><td>${escapeHtml(row.quan_he)}</td><td>${escapeHtml(location.building)}</td><td>${escapeHtml(location.room)}</td><td>${escapeHtml(date(row.ngay_vao))}</td><td>${escapeHtml(row.trang_thai_cu_tru)}</td><td>${row.trang_thai_cu_tru === "DANG_O" ? `<button class="btn btn--secondary" data-leave="${index}">Rời phòng</button>` : "—"}</td></tr>`; }).join("")}</tbody></table></div>` : `<p>Chưa có người ở cùng được ghi nhận.</p>`}
        </section>`;
    } catch (error) {
      content.innerHTML = `<p class="empty-state empty-state--error">${escapeHtml(error.message)}</p><button type="button" class="btn btn--secondary" data-reload>Thử lại</button>`;
    }
  };

  content.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-reload],[data-approve],[data-reject],[data-leave]");
    if (!button) return;
    if (button.hasAttribute("data-reload")) { await reload(); return; }
    if (button.dataset.leave != null) {
      const row = members[Number(button.dataset.leave)];
      return openFormModal({ title: "Đánh dấu rời phòng", submitLabel: "Xác nhận rời", fields: [{ name: "leaveDate", label: "Ngày hiệu lực (kỳ kế tiếp)", type: "date", required: true }], initial: { leaveDate: nextPeriod() }, submit: async (raw) => {
        if (raw.leaveDate < nextPeriod()) throw new Error("Ngày rời phải từ kỳ nước kế tiếp.");
        if (!await confirmAction(`Người ở cùng rời phòng từ ${raw.leaveDate}; tiền nước thay đổi từ kỳ ${raw.leaveDate.slice(0, 7)}. Tiếp tục?`)) return false;
        await context.api.patch(`/v1/co-tenants/${encodeURIComponent(row.ma_thanh_vien_phong)}`, { status: "DA_ROI", leaveDate: raw.leaveDate });
        await reload(); await onChanged();
      } });
    }

    const row = pending[Number(button.dataset.approve ?? button.dataset.reject)];
    if (button.dataset.approve != null) {
      button.disabled = true;
      try {
        const detail = (await context.api.get(`/v1/co-tenant-proposals/${encodeURIComponent(row.ma_yeu_cau)}`)).data;
        const required = ["name", "phone", "identityNumber", "birthDate", "gender", "permanentAddress", "relationship", "startDate"];
        const missing = required.filter((field) => !String(detail[field] ?? "").trim());
        const fields = [["Họ tên", detail.name], ["Điện thoại", detail.phone], ["CCCD/giấy tờ", detail.identityNumber], ["Ngày sinh", detail.birthDate], ["Giới tính", detail.gender], ["Thường trú", detail.permanentAddress], ["Quan hệ", detail.relationship], ["Bắt đầu ở", detail.startDate], ["Phòng", detail.room?.code], ["Đang ở / sức chứa", `${detail.room?.currentOccupants ?? "—"} / ${detail.room?.capacity ?? "—"}`], ["Trạng thái", detail.status], ["Lý do từ chối", detail.rejectionReason]];
        const detailOverlay = document.createElement("div"); detailOverlay.className = "modal-overlay";
        detailOverlay.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true"><h3>Đối chiếu đề xuất người ở cùng</h3><dl>${fields.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join("")}</dl>${missing.length ? `<p role="alert">Thiếu thông tin định danh: ${escapeHtml(missing.join(", "))}</p>` : ""}<button type="button" data-close>Đóng</button> <button type="button" data-confirm-approve ${missing.length ? "disabled" : ""}>Xác nhận duyệt</button><p data-detail-error role="status"></p></div>`;
        detailOverlay.addEventListener("click", (clickEvent) => { if (clickEvent.target === detailOverlay || clickEvent.target.closest("[data-close]")) detailOverlay.remove(); });
        detailOverlay.querySelector("[data-confirm-approve]").addEventListener("click", async (approveEvent) => {
          const approveButton = approveEvent.currentTarget;
          if (!await confirmAction("Đã đối chiếu giấy tờ và sức chứa; xác nhận duyệt người ở cùng?")) return;
          approveButton.disabled = true;
          try {
            await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "DA_PHE_DUYET" });
            detailOverlay.remove(); await reload(); await onChanged();
          } catch (error) {
            detailOverlay.querySelector("[data-detail-error]").textContent = error.code === "CO_TENANT_IDENTITY_INCOMPLETE" ? `Không thể duyệt: ${error.message}` : error.message;
            approveButton.disabled = false;
          }
        });
        document.body.appendChild(detailOverlay);
      } catch (error) {
        const message = content.querySelector("[data-message]"); if (message) message.textContent = error.message;
      } finally { button.disabled = false; }
      return;
    }

    openFormModal({ title: "Từ chối đề xuất", fields: [{ name: "reason", label: "Lý do từ chối", type: "textarea", required: true }], submit: async (raw) => {
      await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "TU_CHOI", reason: requiredText(raw.reason, "Lý do từ chối") });
      await reload(); await onChanged();
    } });
  });

  await reload();
  return overlay;
}

export default {
  id: "co-tenants", route: "/residents-contracts/co-tenants", title: "Người ở cùng", tabLabel: "Người ở cùng", group: "residents-contracts", order: 33, roles: ["CHU_TRO"], hiddenFromNav: true,
  render(context) { context.go("/residents-contracts/residents"); },
};
