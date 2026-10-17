import { shellPage, escapeHtml, date, openFormModal, confirmAction } from "../../shared/components/view.js";
import { requiredText } from "../../core/idempotency.js";

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
    try {
      const [memberResult, requestResult] = await Promise.all([context.api.get("/v1/co-tenants"), context.api.get("/v1/requests")]);
      const members = memberResult.data || [];
      const pending = (requestResult.data || []).filter((row) => row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG" && row.trang_thai === "CHO_XU_LY");
      content.innerHTML = `<section class="panel"><h3>Đề xuất chờ xử lý</h3><p>API hiện chỉ trả nội dung yêu cầu, chưa trả chi tiết định danh của đề xuất. Không phê duyệt khi chưa đối chiếu giấy tờ ở hồ sơ gốc.</p><div class="table-wrap"><table><thead><tr><th>Nội dung</th><th>Ngày gửi</th><th>Thao tác</th></tr></thead><tbody>${pending.map((row, index) => `<tr><td>${escapeHtml(row.noi_dung)}</td><td>${escapeHtml(date(row.ngay_gui))}</td><td><button data-approve="${index}">Duyệt</button> <button data-reject="${index}">Từ chối</button></td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><h3>Người ở cùng đã duyệt</h3><div class="table-wrap"><table><thead><tr><th>Họ tên</th><th>Điện thoại</th><th>Giấy tờ</th><th>Ngày sinh</th><th>Giới tính</th><th>Thường trú</th><th>Quan hệ</th><th>Ngày vào</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${members.map((row, index) => `<tr><td>${escapeHtml(row.ho_ten)}</td><td>${escapeHtml(row.so_dien_thoai)}</td><td>${escapeHtml(row.cccd_giay_to)}</td><td>${escapeHtml(date(row.ngay_sinh))}</td><td>${escapeHtml(row.gioi_tinh)}</td><td>${escapeHtml(row.dia_chi_thuong_tru)}</td><td>${escapeHtml(row.quan_he)}</td><td>${escapeHtml(date(row.ngay_vao))}</td><td>${escapeHtml(row.trang_thai_cu_tru)}</td><td>${row.trang_thai_cu_tru === "DANG_O" ? `<button data-leave="${index}">Rời phòng</button>` : "—"}</td></tr>`).join("")}</tbody></table></div></section><p data-message role="status"></p>`;
      const message = content.querySelector("[data-message]");
      content.addEventListener("click", (event) => {
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
          message.textContent = "Chưa thể duyệt trên màn hình: API không trả đủ thông tin định danh để đối chiếu. Hãy xử lý tại hồ sơ có giấy tờ.";
          return;
        }
        openFormModal({ title: "Từ chối đề xuất", fields: [{ name: "reason", label: "Lý do từ chối", type: "textarea", required: true }], submit: async (raw) => {
          await context.api.patch(`/v1/requests/${encodeURIComponent(row.ma_yeu_cau)}`, { status: "TU_CHOI", reason: requiredText(raw.reason, "Lý do từ chối") }); await this.render(context);
        } });
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
