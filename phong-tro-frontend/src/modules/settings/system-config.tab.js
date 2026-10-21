import { shellPage, escapeHtml, confirmAction } from "../../shared/components/view.js";
import { validateSetting, groupSettings } from "./system-config.model.mjs";

const date = (value) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa sửa";
const caution = (row) => row.affectsMoney
  ? "Có thể ảnh hưởng lịch nhắc và các kỳ sau; phiếu đã lập không tính lại."
  : row.affectsCron ? "Có thể ảnh hưởng lịch tác vụ tự động; không áp lại tác vụ đã chạy." : "";

function input(row) {
  if (row.type === "timezone") return `<select data-input>${row.domain.options.map((option) => `<option value="${escapeHtml(option)}" ${row.value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>`;
  return `<input data-input type="number" step="1" min="${escapeHtml(row.domain.min)}" max="${escapeHtml(row.domain.max)}" value="${escapeHtml(row.value)}">`;
}

function markup(rows) {
  return [...groupSettings(rows)].map(([group, items]) => `<section class="panel system-config-group"><h2>${escapeHtml(group)}</h2>${items.map((row) => `<div class="system-config-row" data-setting="${escapeHtml(row.key)}"><div><h3>${escapeHtml(row.key)}</h3><p>${escapeHtml(row.description)}</p><small>Kiểu: ${escapeHtml(row.type)} · Mặc định: ${escapeHtml(row.defaultValue)} · Miền: ${escapeHtml(row.type === "timezone" ? row.domain.options.join(", ") : `${row.domain.min}–${row.domain.max}`)}</small><br><small>Người sửa: ${escapeHtml(row.updatedBy?.username || "Chưa có")} · ${escapeHtml(date(row.updatedAt))}</small>${caution(row) ? `<p class="system-config-warning">${escapeHtml(caution(row))}</p>` : ""}</div><div>${input(row)}<button type="button" data-save>Lưu</button><button type="button" data-reset>Khôi phục mặc định</button><p data-message role="status"></p></div></div>`).join("")}</section>`).join("");
}

export default {
  id: "system-config", route: "/settings/system-config", title: "Cấu hình hệ thống", group: "settings", hiddenFromNav: true, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Cấu hình hệ thống", "Thay đổi có hiệu lực cho tác vụ sau khi lưu; phiếu đã lập không tính lại.");
    const content = context.main.querySelector("[data-content]");
    const load = async () => {
      content.innerHTML = "<p>Đang tải cấu hình...</p>";
      try {
        const rows = (await context.api.get("/v1/system-config")).data;
        if (!Array.isArray(rows)) throw new Error("Không nhận được danh sách cấu hình.");
        content.innerHTML = markup(rows);
        content.onclick = async (event) => {
          const button = event.target.closest("[data-save], [data-reset]");
          if (!button) return;
          const element = button.closest("[data-setting]");
          const row = rows.find((item) => item.key === element.dataset.setting);
          if (!row) return;
          const message = element.querySelector("[data-message]");
          message.textContent = "";
          const reset = button.hasAttribute("data-reset");
          if (reset && !await confirmAction(`Khôi phục ${row.key} về mặc định ${row.defaultValue}?`)) return;
          button.disabled = true;
          try {
            const key = encodeURIComponent(row.key);
            const value = reset ? undefined : validateSetting(row, element.querySelector("[data-input]").value);
            if (reset) await context.api.post(`/v1/system-config/${key}/reset`, {});
            else await context.api.put(`/v1/system-config/${key}`, { value });
            await load();
          } catch (error) {
            message.textContent = error.code === "INVALID_SYSTEM_CONFIG" ? `Giá trị ${row.key} không hợp lệ. ${error.message}` : error.message;
            button.disabled = false;
          }
        };
      } catch (error) {
        content.innerHTML = `<div class="empty-state empty-state--error" role="alert"><p>Không tải được cấu hình. ${escapeHtml(error.message)}</p><button type="button" data-retry>Thử lại</button></div>`;
        content.querySelector("[data-retry]").addEventListener("click", load);
      }
    };
    await load();
  },
};
