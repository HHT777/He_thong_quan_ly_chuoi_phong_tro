import { shellPage, escapeHtml, date } from "../../shared/components/view.js";
import { integerVnd } from "../../core/idempotency.js";

const typeLabels = { DINH_KY: "Định kỳ", DAU_HOP_DONG: "Đầu hợp đồng", CHOT_TRA_PHONG: "Chốt trả phòng", CHUYEN_PHONG: "Chuyển phòng" };
const currentMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date());
async function loadRooms(api) {
  const rooms = [];
  for (let page = 1; ; page += 1) {
    const result = await api.get(`/phong?limit=100&page=${page}`);
    rooms.push(...(result.data || []));
    if (!result.pagination?.hasNext) return rooms;
  }
}
function validateImage(file, maxBytes) {
  if (!file) throw new Error("Hãy chọn ảnh công tơ.");
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("Chỉ nhận ảnh JPEG hoặc PNG.");
  if (file.size > maxBytes) throw new Error("Ảnh vượt quá giới hạn dung lượng trong cấu hình.");
}

export default {
  id: "meter-readings", route: "/operations/meter-readings", title: "Chỉ số điện", tabLabel: "Chỉ số điện", group: "meter-readings", order: 50, roles: ["CHU_TRO"],
  async render(context) {
    context.main.innerHTML = shellPage("Chỉ số điện", "Tải ảnh, kiểm tra OCR và xác nhận chỉ số trước khi lưu.");
    const content = context.main.querySelector("[data-content]");
    try {
      const [rooms, configResult] = await Promise.all([loadRooms(context.api), context.api.get("/v1/system-config")]);
      const buildings = [...new Map(rooms.filter((room) => room.ma_can).map((room) => [String(room.ma_can), { id: String(room.ma_can), name: room.canTro?.ten_can || String(room.ma_can) }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
      const maxBytes = Number((configResult.data || []).find((item) => item.khoa === "maxFileSizeBytes")?.gia_tri || 10485760);
      const readingPeriod = currentMonth();
      let token = null;
      let previewRequest = 0;
      let historyRequest = 0;
      content.innerHTML = `<form class="panel form-grid" data-meter-filter>
        <label>Căn<select name="buildingId" required><option value="">Chọn căn</option>${buildings.map((building) => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)}</option>`).join("")}</select></label>
        <label>Phòng<select name="roomId" required disabled><option value="">Chọn căn trước</option></select></label>
        <label>Kỳ xem chỉ số<input name="period" type="month" value="${escapeHtml(readingPeriod)}" required></label>
      </form><form class="panel form-grid" data-ocr-form>
        <p class="form-grid__actions">Ghi chỉ số điện kỳ ${escapeHtml(readingPeriod)} cho phòng đã chọn.</p>
        <label>Ảnh công tơ (JPEG/PNG, tối đa ${escapeHtml(Math.floor(maxBytes / 1048576))} MB)<input name="file" type="file" accept="image/jpeg,image/png"></label>
        <button type="button" data-preview disabled>Xem OCR</button><label>Chỉ số xác nhận<input name="readingValue" type="number" min="0" step="1" required></label>
        <button type="submit" disabled>Lưu chỉ số</button><p data-preview-result></p><p data-message role="status"></p></form>
        <div class="table-wrap"><table><thead><tr><th>Phòng</th><th>Kỳ</th><th>Loại</th><th>Chỉ số</th><th>Trạng thái</th><th>Ghi nhận</th><th></th></tr></thead><tbody data-history></tbody></table></div>`;
      const filters = content.querySelector("[data-meter-filter]");
      const form = content.querySelector("[data-ocr-form]");
      const message = form.querySelector("[data-message]");
      const history = content.querySelector("[data-history]");
      const clearPreview = () => {
        previewRequest += 1;
        token = null;
        form.elements.readingValue.value = "";
        form.querySelector("[data-preview-result]").textContent = "";
        message.textContent = "";
      };
      const loadHistory = async () => {
        const request = ++historyRequest;
        const roomId = filters.elements.roomId.value;
        const period = filters.elements.period.value;
        const buildingId = filters.elements.buildingId.value;
        if (!roomId || !period) { history.innerHTML = '<tr><td colspan="7">Chọn căn và phòng để xem chỉ số.</td></tr>'; return; }
        history.innerHTML = '<tr><td colspan="7">Đang tải chỉ số...</td></tr>';
        try {
          const readings = [];
          for (let page = 1; ; page += 1) {
            const result = await context.api.get(`/v1/meter-readings?buildingId=${encodeURIComponent(buildingId)}&period=${encodeURIComponent(period)}&pageSize=100&page=${page}`);
            readings.push(...(result.data || []));
            if (page >= (result.meta?.totalPages || 1)) break;
          }
          if (request !== historyRequest) return;
          const visible = readings.filter((row) => String(row.room?.id) === roomId);
          history.innerHTML = visible.map((row) => `<tr><td>${escapeHtml(row.room?.code || row.room?.id)}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(typeLabels[row.readingType] || typeLabels.DINH_KY)}</td><td>${escapeHtml(row.readingValue)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(date(row.submittedAt))}</td><td>${row.status === "CHO_XAC_NHAN" ? `<button type="button" data-confirm="${escapeHtml(row.id)}">Xác nhận</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="7">Chưa có chỉ số cho phòng trong kỳ đã chọn.</td></tr>';
        } catch (error) { if (request === historyRequest) history.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`; }
      };
      filters.elements.buildingId.addEventListener("change", () => {
        const selected = filters.elements.buildingId.value;
        const matching = rooms.filter((room) => String(room.ma_can) === selected);
        const placeholder = selected ? "Chọn phòng" : "Chọn căn trước";
        filters.elements.roomId.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${matching.map((room) => `<option value="${escapeHtml(room.ma_phong)}">${escapeHtml(room.so_phong)}</option>`).join("")}`;
        filters.elements.roomId.disabled = !selected || !matching.length;
        form.querySelector("[data-preview]").disabled = true;
        form.querySelector("[type=submit]").disabled = true;
        clearPreview();
        loadHistory();
      });
      filters.elements.roomId.addEventListener("change", () => {
        const selected = Boolean(filters.elements.roomId.value);
        form.querySelector("[data-preview]").disabled = !selected;
        form.querySelector("[type=submit]").disabled = !selected;
        clearPreview();
        loadHistory();
      });
      filters.elements.period.addEventListener("change", loadHistory);
      form.elements.file.addEventListener("change", clearPreview);
      loadHistory();
      form.querySelector("[data-preview]").addEventListener("click", async (event) => {
        const button = event.currentTarget; button.disabled = true; message.textContent = "";
        const request = ++previewRequest;
        try {
          const file = form.elements.file.files[0]; validateImage(file, maxBytes);
          if (!filters.elements.buildingId.value || !filters.elements.roomId.value) throw new Error("Hãy chọn căn rồi chọn phòng.");
          const body = new FormData(); body.set("file", file); body.set("roomId", filters.elements.roomId.value); body.set("period", readingPeriod);
          const preview = (await context.api.postForm("/v1/meter-readings/ocr-previews", body)).data;
          if (request !== previewRequest) return;
          token = preview.uploadToken;
          if (preview.suggestedReading != null) form.elements.readingValue.value = preview.suggestedReading;
          else form.elements.readingValue.value = "";
          const warning = preview.warnings?.[0];
          const fallback = warning?.code === "OCR_UNAVAILABLE" ? "Không kết nối được dịch vụ OCR. Hãy kiểm tra dịch vụ OCR rồi thử lại, hoặc nhập chỉ số bằng tay."
            : warning?.code === "OCR_TIMEOUT" ? "OCR xử lý quá lâu. Hãy thử lại hoặc nhập chỉ số bằng tay."
              : "OCR không đọc được chỉ số trên ảnh. Hãy thử ảnh rõ hơn hoặc nhập chỉ số bằng tay.";
          form.querySelector("[data-preview-result]").textContent = preview.ocrStatus === "MANUAL_REQUIRED" ? `${fallback} Chỉ số trước: ${preview.previousReading}.` : `OCR gợi ý ${preview.suggestedReading}; chỉ số trước ${preview.previousReading}.`;
        } catch (error) { if (request === previewRequest) { token = null; form.querySelector("[data-preview-result]").textContent = ""; message.textContent = error.message; } } finally { button.disabled = !filters.elements.roomId.value; }
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault(); const button = form.querySelector("[type=submit]"); button.disabled = true; message.textContent = "";
        try {
          if (!token) throw new Error("Hãy tải ảnh và xem OCR trước khi lưu.");
          const readingValue = integerVnd(form.elements.readingValue.value, "Chỉ số điện");
          await context.api.post("/v1/meter-readings/ocr-submit", { period: readingPeriod, readingValue, uploadToken: token }, { "Idempotency-Key": crypto.randomUUID() });
          token = null; await loadHistory(); message.textContent = `Đã lưu chỉ số điện kỳ ${readingPeriod}.`;
        } catch (error) {
          if (error.code === "UPLOAD_TOKEN_EXPIRED") { token = null; message.textContent = "Ảnh đã hết hạn. Hãy tải ảnh lại và xem OCR lần nữa."; }
          else if (error.code === "READING_BELOW_PREVIOUS") message.textContent = `${error.message} Chỉ số trước: ${error.details?.previousReading ?? "xem lịch sử phòng"}.`;
          else message.textContent = error.message;
        } finally { button.disabled = false; }
      });
      history.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-confirm]"); if (!button) return; button.disabled = true;
        try { await context.api.post(`/v1/meter-readings/${encodeURIComponent(button.dataset.confirm)}/confirmations`, {}, { "Idempotency-Key": crypto.randomUUID(), "If-Match": "*" }); await loadHistory(); }
        catch (error) { message.textContent = error.message; button.disabled = false; }
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
