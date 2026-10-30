import { shellPage, escapeHtml, confirmAction } from "../../shared/components/view.js";
import { validateDisplaySetting, groupSettings } from "./system-config.model.mjs";
import "./system-config.css";

const labels = {
  timezone: "Múi giờ của hệ thống",
  maxFileSizeBytes: "Dung lượng ảnh chỉ số điện tối đa",
  contractWarningDays: "Báo trước khi hợp đồng hết hạn",
  dueReminderDay: "Ngày nhắc thanh toán",
  overdueDay: "Ngày bắt đầu báo quá hạn",
  debtCloseDay: "Ngày chốt công nợ",
  billingCronLookbackMonths: "Số tháng công nợ cần rà soát",
  contractJobHour: "Giờ cập nhật trạng thái hợp đồng",
  reservationJobHour: "Giờ nhắc giữ phòng quá hạn",
  moveOutJobHour: "Giờ cập nhật phòng đã trả",
  debtLifecycleHour: "Giờ chạy tác vụ công nợ",
  namedLockTimeoutSeconds: "Thời gian chờ khi tác vụ đang chạy",
};
const units = {
  maxFileSizeBytes: "MB", contractWarningDays: "ngày", dueReminderDay: "ngày trong tháng",
  overdueDay: "ngày trong tháng", debtCloseDay: "ngày trong tháng",
  billingCronLookbackMonths: "tháng", contractJobHour: "giờ Việt Nam",
  reservationJobHour: "giờ Việt Nam", moveOutJobHour: "giờ Việt Nam",
  debtLifecycleHour: "giờ Việt Nam", namedLockTimeoutSeconds: "giây",
};
const descriptions = {
  timezone: "Thời gian dùng để xác định ngày và giờ cho các tác vụ tự động.",
  maxFileSizeBytes: "Ảnh chụp chỉ số điện lớn hơn mức này sẽ không tải lên được.",
  contractWarningDays: "Hiện cảnh báo khi hợp đồng còn từng này ngày trước hạn.",
  dueReminderDay: "Gửi nhắc thanh toán vào ngày này hằng tháng.",
  overdueDay: "Từ ngày này, khoản chưa trả được hiển thị là quá hạn.",
  debtCloseDay: "Sau ngày này, hệ thống ghi nhận số tiền còn nợ của kỳ.",
  billingCronLookbackMonths: "Tác vụ công nợ kiểm tra lại các kỳ cũ trong khoảng này.",
  contractJobHour: "Giờ hệ thống cập nhật hợp đồng sắp hết hoặc hết hạn.",
  reservationJobHour: "Giờ hệ thống nhắc các lượt giữ phòng quá hạn.",
  moveOutJobHour: "Giờ hệ thống cập nhật phòng theo ngày trả đã duyệt.",
  debtLifecycleHour: "Giờ hệ thống chạy nhắc hạn, quá hạn và chốt công nợ.",
  namedLockTimeoutSeconds: "Thời gian tối đa chờ để tránh chạy trùng tác vụ.",
};
const displayValue = (row, value) => row.key === "maxFileSizeBytes" ? Number(value) / 1048576 : value;
const formatValue = (row, value) => `${displayValue(row, value)}${units[row.key] ? ` ${units[row.key]}` : ""}`;

const date = (value) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa sửa";
const caution = (row) => row.affectsMoney
  ? "Có thể ảnh hưởng lịch nhắc và các kỳ sau; phiếu đã lập không tính lại."
  : row.affectsCron ? "Có thể ảnh hưởng lịch tác vụ tự động; không áp lại tác vụ đã chạy." : "";

function input(row) {
  if (row.type === "timezone") return `<select class="form-control" id="setting-${escapeHtml(row.key)}" data-input>${row.domain.options.map((option) => `<option value="${escapeHtml(option)}" ${row.value === option ? "selected" : ""}>${escapeHtml(option === "Asia/Ho_Chi_Minh" ? "Giờ Việt Nam (khuyến nghị)" : "Giờ Việt Nam (tên cũ)")}</option>`).join("")}</select>`;
  const isSize = row.key === "maxFileSizeBytes";
  return `<input class="form-control" id="setting-${escapeHtml(row.key)}" data-input type="number" step="${isSize ? "any" : "1"}" min="${escapeHtml(isSize ? row.domain.min / 1048576 : row.domain.min)}" max="${escapeHtml(isSize ? row.domain.max / 1048576 : row.domain.max)}" value="${escapeHtml(displayValue(row, row.value))}">`;
}

function markup(rows) {
  const groups = [...groupSettings(rows.filter((row) => row.group !== "Phiếu thu"))];
  const schedule = rows.find((row) => row.key === "billScheduleEnabled");
  const scheduleCard = schedule ? `<section class="panel system-config-group system-config-schedule"><div><h2>Lập phiếu thu tự động</h2><p>Để đổi lịch, vào trang Phiếu thu và chọn “Thiết lập tự động”.</p><p class="system-config-schedule__state">Trạng thái hiện tại: <strong>${schedule.value ? "Đang bật" : "Đang tắt"}</strong></p></div><a class="btn btn--secondary" href="#/finance/bills">Đến trang Phiếu thu →</a></section>` : "";
  return `<div class="system-config-intro"><strong>Cài đặt cách hệ thống nhắc việc và xử lý dữ liệu.</strong><p>Mỗi mục được lưu riêng. Thay đổi chỉ áp dụng cho các tác vụ sau khi lưu; phiếu đã lập không được tính lại.</p></div>${scheduleCard}${groups.map(([group, items]) => `<section class="panel system-config-group"><h2>${escapeHtml(group)}</h2>${items.map((row) => `<div class="system-config-row" data-setting="${escapeHtml(row.key)}"><div class="system-config-row__info"><label for="setting-${escapeHtml(row.key)}">${escapeHtml(labels[row.key] || row.description)}</label><p>${escapeHtml(descriptions[row.key] || row.description)}</p>${caution(row) ? `<p class="system-config-warning">${escapeHtml(caution(row))}</p>` : ""}<details class="system-config-details"><summary>Chi tiết và lịch sử</summary><p>${escapeHtml(row.description)}</p><p>Mặc định: ${escapeHtml(formatValue(row, row.defaultValue))}</p><p>Người sửa: ${escapeHtml(row.updatedBy?.username || "Chưa có")} · ${escapeHtml(date(row.updatedAt))}</p><code>${escapeHtml(row.key)}</code></details></div><div class="system-config-row__controls"><div class="system-config-input"><span id="setting-label-${escapeHtml(row.key)}">${escapeHtml(units[row.key] || "Giá trị")}</span>${input(row)}</div><small>Cho phép: ${escapeHtml(row.type === "timezone" ? "Giờ Việt Nam" : `${formatValue(row, row.domain.min)}–${formatValue(row, row.domain.max)}`)}</small><div class="system-config-row__actions"><button class="btn btn--primary" type="button" data-save>Lưu thay đổi</button><button class="btn btn--secondary" type="button" data-reset>Đặt lại mặc định</button></div><p data-message role="status"></p></div></div>`).join("")}</section>`).join("")}`;
}

export default {
  id: "system-config", route: "/settings/system-config", title: "Cấu hình hệ thống", group: "settings", hiddenFromNav: true, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Cấu hình hệ thống");
    const content = context.main.querySelector("[data-content]");
    const load = async (savedKey, reset) => {
      if (typeof savedKey !== "string") savedKey = undefined;
      content.innerHTML = "<p>Đang tải cấu hình...</p>";
      try {
        const rows = (await context.api.get("/v1/system-config")).data;
        if (!Array.isArray(rows)) throw new Error("Không nhận được danh sách cấu hình.");
        content.innerHTML = markup(rows);
        if (savedKey) content.querySelector(`[data-setting="${savedKey}"] [data-message]`).textContent = reset ? "Đã đặt lại mặc định." : "Đã lưu thay đổi.";
        content.onclick = async (event) => {
          const button = event.target.closest("[data-save], [data-reset]");
          if (!button) return;
          const element = button.closest("[data-setting]");
          const row = rows.find((item) => item.key === element.dataset.setting);
          if (!row) return;
          const message = element.querySelector("[data-message]");
          message.textContent = "";
          const reset = button.hasAttribute("data-reset");
          if (reset && !await confirmAction(`Đặt ${labels[row.key] || row.description} về mặc định ${formatValue(row, row.defaultValue)}?`)) return;
          button.disabled = true;
          try {
            const key = encodeURIComponent(row.key);
            const raw = element.querySelector("[data-input]").value;
            const value = reset ? undefined : validateDisplaySetting(row, raw);
            if (reset) await context.api.post(`/v1/system-config/${key}/reset`, {});
            else await context.api.put(`/v1/system-config/${key}`, { value });
            await load(row.key, reset);
          } catch (error) {
            message.textContent = error.code === "INVALID_SYSTEM_CONFIG" ? `Giá trị không hợp lệ. ${error.message}` : error.message;
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
