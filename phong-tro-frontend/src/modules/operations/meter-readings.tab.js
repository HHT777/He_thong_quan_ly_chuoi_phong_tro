import { shellPage, escapeHtml, date } from "../../shared/components/view.js";
import { integerVnd } from "../../core/idempotency.js";
import "./meter-readings.css";

const typeLabels = { DINH_KY: "Định kỳ", DAU_HOP_DONG: "Đầu hợp đồng", CHOT_TRA_PHONG: "Chốt trả phòng", CHUYEN_PHONG: "Chuyển phòng" };
const statusLabels = { CHO_XAC_NHAN: "Chờ xác nhận", DA_XAC_NHAN: "Đã xác nhận", TU_CHOI: "Từ chối" };
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
    context.main.innerHTML = shellPage("Chỉ số điện", "");
    const content = context.main.querySelector("[data-content]");
    try {
      const [rooms, configResult] = await Promise.all([loadRooms(context.api), context.api.get("/v1/system-config")]);
      const buildings = [...new Map(rooms.filter((room) => room.ma_can).map((room) => [String(room.ma_can), { id: String(room.ma_can), name: room.canTro?.ten_can || String(room.ma_can) }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));
      const maxBytes = Number((configResult.data || []).find((item) => item.khoa === "maxFileSizeBytes")?.gia_tri || 10485760);
      let token = null;
      let previewRequest = 0;
      let historyRequest = 0;
      let imageUrl = null;
      content.innerHTML = `<div class="meter-workspace">
        <form class="panel meter-filter" id="meter-filter-form" data-meter-filter><h2>Bộ lọc</h2>
          <label>Căn<select name="buildingId" required><option value="">Chọn căn</option>${buildings.map((building) => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)}</option>`).join("")}</select></label>
          <label>Phòng<select name="roomId" disabled><option value="">Chọn căn trước</option></select></label>
          <label>Kỳ<input name="period" type="month" value="${escapeHtml(currentMonth())}" required></label>
        </form>
        <section class="panel meter-capture"><div class="meter-capture__heading"><h2>Ghi chỉ số</h2><p>Tải ảnh công tơ, kiểm tra rồi lưu.</p></div>
          <form data-ocr-form class="meter-capture__body">
            <div class="meter-capture__controls">
              <label class="meter-upload">Ảnh công tơ<input name="file" type="file" accept="image/jpeg,image/png"><span>JPEG hoặc PNG · Tối đa ${escapeHtml(Math.floor(maxBytes / 1048576))} MB</span></label>
              <button class="btn btn--secondary" type="button" data-preview disabled>Đọc chỉ số</button>
              <label>Chỉ số xác nhận<input name="readingValue" type="number" min="0" step="1" placeholder="Nhập chỉ số" required></label>
              <p class="meter-message" data-preview-result aria-live="polite"></p>
              <button class="btn btn--primary" type="submit" disabled>Lưu chỉ số</button><p class="meter-message" data-message role="status"></p>
            </div>
            <div class="meter-image" data-image-panel><div class="meter-image__empty">Chưa có ảnh công tơ</div></div>
          </form>
        </section>
      </div>
      <section class="panel meter-history"><table><thead><tr><th>Phòng</th><th>Kỳ</th><th>Loại</th><th>Chỉ số</th><th>Trạng thái</th><th>Ghi nhận</th><th>Thao tác</th></tr></thead><tbody data-history></tbody></table></section>`;
      const filters = content.querySelector("[data-meter-filter]");
      const form = content.querySelector("[data-ocr-form]");
      const message = form.querySelector("[data-message]");
      const history = content.querySelector("[data-history]");
      const imagePanel = content.querySelector("[data-image-panel]");
      const updateImage = (file) => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        imageUrl = file ? URL.createObjectURL(file) : null;
        imagePanel.innerHTML = imageUrl
          ? `<img src="${escapeHtml(imageUrl)}" alt="Ảnh công tơ đã chọn"><strong>Ảnh đã chọn</strong><span>${escapeHtml(file.name)}</span>`
          : '<div class="meter-image__empty">Chưa có ảnh công tơ</div>';
      };
      const clearPreview = () => {
        previewRequest += 1;
        token = null;
        form.elements.readingValue.value = "";
        form.querySelector("[data-preview-result]").textContent = "";
        message.textContent = "";
      };
      filters.addEventListener("submit", (event) => event.preventDefault());
      const loadHistory = async () => {
        const request = ++historyRequest;
        const roomId = filters.elements.roomId.value;
        const period = filters.elements.period.value;
        const buildingId = filters.elements.buildingId.value;
        if (!buildingId || !period) { history.innerHTML = '<tr><td colspan="7">Chọn căn để xem chỉ số.</td></tr>'; return; }
        history.innerHTML = '<tr><td colspan="7">Đang tải…</td></tr>';
        try {
          const readings = [];
          for (let page = 1; ; page += 1) {
            const result = await context.api.get(`/v1/meter-readings?buildingId=${encodeURIComponent(buildingId)}&period=${encodeURIComponent(period)}&pageSize=100&page=${page}`);
            readings.push(...(result.data || []));
            if (page >= (result.meta?.totalPages || 1)) break;
          }
          if (request !== historyRequest) return;
          const visible = readings.filter((row) => !roomId || String(row.room?.id) === roomId)
            .sort((a, b) => String(a.room?.code || "").localeCompare(String(b.room?.code || ""), "vi", { numeric: true }));
          history.innerHTML = visible.map((row) => {
            const status = String(row.status || "");
            const statusClass = ({ CHO_XAC_NHAN: "cho_xac_nhan", DA_XAC_NHAN: "da_xac_nhan", TU_CHOI: "tu_choi" })[status] || "unknown";
            return `<tr><td>${escapeHtml(row.room?.code ? `Phòng ${row.room.code}` : "—")}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(typeLabels[row.readingType] || typeLabels.DINH_KY)}</td><td>${escapeHtml(row.readingValue)}</td><td><span class="meter-status meter-status--${statusClass}">${escapeHtml(statusLabels[status] || "—")}</span></td><td>${escapeHtml(date(row.submittedAt))}</td><td>${status === "CHO_XAC_NHAN" ? `<button class="btn btn--secondary" type="button" data-confirm="${escapeHtml(row.id)}">Xác nhận</button>` : "—"}</td></tr>`;
          }).join("") || '<tr><td colspan="7">Chưa có chỉ số trong kỳ này.</td></tr>';
        } catch (error) { if (request === historyRequest) history.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`; }
      };
      filters.elements.buildingId.addEventListener("change", () => {
        const selected = filters.elements.buildingId.value;
        const matching = rooms.filter((room) => String(room.ma_can) === selected)
          .sort((a, b) => String(a.so_phong || "").localeCompare(String(b.so_phong || ""), "vi", { numeric: true }));
        const placeholder = selected ? "Tất cả phòng" : "Chọn căn trước";
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
      filters.elements.period.addEventListener("change", () => { clearPreview(); loadHistory(); });
      form.elements.file.addEventListener("change", () => { clearPreview(); updateImage(form.elements.file.files[0]); });
      loadHistory();
      form.querySelector("[data-preview]").addEventListener("click", async (event) => {
        const button = event.currentTarget; button.disabled = true; message.textContent = "";
        const request = ++previewRequest;
        try {
          const file = form.elements.file.files[0]; validateImage(file, maxBytes);
          const period = filters.elements.period.value;
          if (!filters.elements.buildingId.value || !filters.elements.roomId.value || !period) throw new Error("Chọn căn, phòng và kỳ.");
          const body = new FormData(); body.set("file", file); body.set("roomId", filters.elements.roomId.value); body.set("period", period);
          const preview = (await context.api.postForm("/v1/meter-readings/ocr-previews", body)).data;
          if (request !== previewRequest) return;
          token = preview.uploadToken;
          if (preview.suggestedReading != null) form.elements.readingValue.value = preview.suggestedReading;
          else form.elements.readingValue.value = "";
          const warning = preview.warnings?.[0];
          const fallback = warning?.code === "OCR_UNAVAILABLE" ? "Không kết nối được OCR. Bạn có thể nhập chỉ số thủ công."
            : warning?.code === "OCR_TIMEOUT" ? "OCR hết thời gian. Thử lại hoặc nhập chỉ số thủ công."
              : "Không đọc được ảnh. Thử ảnh rõ hơn hoặc nhập chỉ số thủ công.";
          form.querySelector("[data-preview-result]").textContent = preview.ocrStatus === "MANUAL_REQUIRED" ? `${fallback} Chỉ số trước: ${preview.previousReading}.` : `OCR gợi ý ${preview.suggestedReading}; chỉ số trước ${preview.previousReading}.`;
        } catch (error) { if (request === previewRequest) { token = null; form.querySelector("[data-preview-result]").textContent = ""; message.textContent = error.message; } } finally { button.disabled = !filters.elements.roomId.value; }
      });
      form.addEventListener("submit", async (event) => {
        event.preventDefault(); const button = form.querySelector("[type=submit]"); button.disabled = true; message.textContent = "";
        try {
          if (!token) throw new Error("Hãy tải ảnh và xem OCR trước khi lưu.");
          const period = filters.elements.period.value;
          if (!period || !filters.elements.roomId.value) throw new Error("Chọn căn, phòng và kỳ.");
          const readingValue = integerVnd(form.elements.readingValue.value, "Chỉ số điện");
          await context.api.post("/v1/meter-readings/ocr-submit", { period, readingValue, uploadToken: token }, { "Idempotency-Key": crypto.randomUUID() });
          token = null; await loadHistory(); message.textContent = `Đã lưu kỳ ${period}.`;
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
