import { shellPage, escapeHtml, date } from "../../shared/components/view.js";
import { integerVnd } from "../../core/idempotency.js";

const typeLabels = { DINH_KY: "Định kỳ", DAU_HOP_DONG: "Đầu hợp đồng", CHOT_TRA_PHONG: "Chốt trả phòng", CHUYEN_PHONG: "Chuyển phòng" };
const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
function validateImage(file, maxBytes) {
  if (!file) throw new Error("Hãy chọn ảnh công tơ.");
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("Chỉ nhận ảnh JPEG hoặc PNG.");
  if (file.size > maxBytes) throw new Error("Ảnh vượt quá giới hạn dung lượng trong cấu hình.");
}

export default {
  id: "meter-readings", route: "/operations/meter-readings", title: "Chỉ số điện", tabLabel: "Chỉ số điện", group: "operations", order: 50, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Chỉ số điện", "Tải ảnh, kiểm tra OCR và xác nhận chỉ số trước khi lưu.");
    const content = context.main.querySelector("[data-content]");
    try {
      const [readingResult, roomResult, configResult] = await Promise.all([context.api.get("/v1/meter-readings?pageSize=100"), context.api.get("/phong?limit=100"), context.api.get("/v1/system-config")]);
      const readings = readingResult.data || [];
      const rooms = roomResult.data || [];
      const maxBytes = Number((configResult.data || []).find((item) => item.khoa === "maxFileSizeBytes")?.gia_tri || 10485760);
      let token = null;
      content.innerHTML = `<form class="panel form-grid" data-ocr-form>
        <label>Phòng<select name="roomId" required>${rooms.map((room) => `<option value="${escapeHtml(room.ma_phong)}">${escapeHtml(room.so_phong)}</option>`).join("")}</select></label>
        <label>Kỳ<input name="period" type="month" value="${escapeHtml(currentMonth())}" required></label>
        <label>Ảnh công tơ (JPEG/PNG, tối đa ${escapeHtml(Math.floor(maxBytes / 1048576))} MB)<input name="file" type="file" accept="image/jpeg,image/png"></label>
        <button type="button" data-preview>Xem OCR</button><label>Chỉ số xác nhận<input name="readingValue" type="number" min="0" step="1" required></label>
        <button type="submit">Lưu chỉ số</button><p data-preview-result></p><p data-message role="status"></p></form>
        <div class="table-wrap"><table><thead><tr><th>Phòng</th><th>Kỳ</th><th>Loại</th><th>Chỉ số</th><th>Trạng thái</th><th>Ghi nhận</th><th></th></tr></thead><tbody data-history></tbody></table></div>`;
      const form = content.querySelector("[data-ocr-form]");
      const message = form.querySelector("[data-message]");
      const history = content.querySelector("[data-history]");
      const renderHistory = () => {
        history.innerHTML = readings.filter((row) => row.room?.id === form.elements.roomId.value).map((row) => `<tr><td>${escapeHtml(row.room?.code || row.room?.id)}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(typeLabels[row.readingType] || typeLabels.DINH_KY)}</td><td>${escapeHtml(row.readingValue)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(date(row.submittedAt))}</td><td>${row.status === "CHO_XAC_NHAN" ? `<button type="button" data-confirm="${escapeHtml(row.id)}">Xác nhận</button>` : ""}</td></tr>`).join("");
      };
      renderHistory();
      for (const name of ["roomId", "period", "file"]) form.elements[name].addEventListener("change", () => { token = null; renderHistory(); });
      form.querySelector("[data-preview]").addEventListener("click", async (event) => {
        const button = event.currentTarget; button.disabled = true; message.textContent = "";
        try {
          const file = form.elements.file.files[0]; validateImage(file, maxBytes);
          const body = new FormData(); body.set("file", file); body.set("roomId", form.elements.roomId.value); body.set("period", form.elements.period.value);
          const preview = (await context.api.postForm("/v1/meter-readings/ocr-previews", body)).data;
          token = preview.uploadToken;
          if (preview.suggestedReading != null) form.elements.readingValue.value = preview.suggestedReading;
          form.querySelector("[data-preview-result]").textContent = preview.ocrStatus === "MANUAL_REQUIRED" ? "OCR chưa đọc được; hãy nhập chỉ số bằng tay rồi xác nhận." : `OCR gợi ý ${preview.suggestedReading}; chỉ số trước ${preview.previousReading}.`;
        } catch (error) { message.textContent = error.message; } finally { button.disabled = false; }
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault(); const button = form.querySelector("[type=submit]"); button.disabled = true; message.textContent = "";
        try {
          if (!token) throw new Error("Hãy tải ảnh và xem OCR trước khi lưu.");
          const readingValue = integerVnd(form.elements.readingValue.value, "Chỉ số điện");
          const result = await context.api.post("/v1/meter-readings/ocr-submit", { period: form.elements.period.value, readingValue, uploadToken: token }, { "Idempotency-Key": crypto.randomUUID() });
          token = null; readings.unshift(result.data); renderHistory(); message.textContent = "Đã lưu chỉ số điện.";
        } catch (error) {
          if (error.code === "UPLOAD_TOKEN_EXPIRED") { token = null; message.textContent = "Ảnh đã hết hạn. Hãy tải ảnh lại và xem OCR lần nữa."; }
          else if (error.code === "READING_BELOW_PREVIOUS") message.textContent = `${error.message} Chỉ số trước: ${error.details?.previousReading ?? "xem lịch sử phòng"}.`;
          else message.textContent = error.message;
        } finally { button.disabled = false; }
      });
      history.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-confirm]"); if (!button) return; button.disabled = true;
        try { await context.api.post(`/v1/meter-readings/${encodeURIComponent(button.dataset.confirm)}/confirmations`, {}, { "Idempotency-Key": crypto.randomUUID(), "If-Match": "*" }); await this.render(context); }
        catch (error) { message.textContent = error.message; button.disabled = false; }
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
