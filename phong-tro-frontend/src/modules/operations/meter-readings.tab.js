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
      const pendingReadings = new Map();
      content.innerHTML = `<div class="meter-workspace">
        <form class="panel meter-filter" id="meter-filter-form" data-meter-filter><h2>Bộ lọc</h2>
          <label>Căn<select name="buildingId" required><option value="">Chọn căn</option>${buildings.map((building) => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)}</option>`).join("")}</select></label>
          <label>Phòng<select name="roomId" disabled><option value="">Chọn căn trước</option></select></label>
          <label>Kỳ<input name="period" type="month" value="${escapeHtml(currentMonth())}" required></label>
          <button class="btn btn--secondary" type="button" data-replace-open disabled>Thay đồng hồ</button>
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
      <section class="panel meter-history"><table><thead><tr><th>Phòng</th><th>Kỳ</th><th>Loại</th><th>Chỉ số</th><th>Trạng thái</th><th>Ghi nhận</th><th>Thao tác</th></tr></thead><tbody data-history></tbody></table></section>
      <dialog class="meter-edit-dialog" data-meter-dialog aria-labelledby="meter-dialog-title"><form data-meter-edit-form>
        <h2 id="meter-dialog-title" data-dialog-title></h2><p data-dialog-context></p>
        <label data-dialog-value>Chỉ số mới<input name="readingValue" type="number" min="0" step="1" required></label>
        <label>Lý do<input name="reason" maxlength="500" required placeholder="Nhập lý do để lưu lịch sử"></label>
        <p class="meter-message" data-dialog-message role="alert"></p>
        <div class="meter-dialog-actions"><button class="btn btn--secondary" type="button" data-dialog-cancel>Hủy</button><button class="btn btn--primary" type="submit" data-dialog-submit></button></div>
      </form></dialog>
      <dialog class="meter-edit-dialog" data-replacement-dialog aria-labelledby="replacement-dialog-title"><form data-replacement-form>
        <h2 id="replacement-dialog-title">Thay đồng hồ điện</h2><p data-replacement-context></p>
        <label>Ngày thay<input name="replacementDate" type="date" required></label>
        <label data-old-final>Chỉ số cuối đồng hồ cũ<input name="oldFinalReading" type="number" min="0" step="1" required></label>
        <label class="meter-estimate-switch"><input name="unreadable" type="checkbox"> Không đọc được số cuối đồng hồ cũ</label>
        <label data-old-estimate hidden>Sản lượng đoạn cũ ước tính (kWh)<input name="estimatedOldKwh" type="number" min="0" step="1"></label>
        <label>Chỉ số đầu đồng hồ mới<input name="newStartReading" type="number" min="0" step="1" required></label>
        <label>Lý do/ghi chú<input name="reason" maxlength="1000" required></label>
        <label>Ảnh đồng hồ cũ (tùy chọn)<input name="oldImage" type="file" accept="image/jpeg,image/png"></label>
        <label>Ảnh đồng hồ mới (tùy chọn)<input name="newImage" type="file" accept="image/jpeg,image/png"></label>
        <p class="meter-message" data-replacement-message role="alert"></p>
        <div class="meter-dialog-actions"><button class="btn btn--secondary" type="button" data-replacement-cancel>Hủy</button><button class="btn btn--primary" type="submit" data-replacement-submit>Lưu lần thay</button></div>
      </form></dialog>`;
      const filters = content.querySelector("[data-meter-filter]");
      const form = content.querySelector("[data-ocr-form]");
      const message = form.querySelector("[data-message]");
      const history = content.querySelector("[data-history]");
      const dialog = content.querySelector("[data-meter-dialog]");
      const editForm = dialog.querySelector("[data-meter-edit-form]");
      let editMode = null;
      let editId = null;
      const replacementDialog = content.querySelector("[data-replacement-dialog]");
      const replacementForm = replacementDialog.querySelector("[data-replacement-form]");
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
          const replacements = (await context.api.get(`/v1/meter-replacements?buildingId=${encodeURIComponent(buildingId)}&period=${encodeURIComponent(period)}`)).data || [];
          if (request !== historyRequest) return;
          const replacementByRoom = new Map(replacements.map((row) => [String(row.roomId), row]));
          const visible = readings.filter((row) => !roomId || String(row.room?.id) === roomId)
            .sort((a, b) => String(a.room?.code || "").localeCompare(String(b.room?.code || ""), "vi", { numeric: true }));
          pendingReadings.clear();
          visible.filter((row) => row.status === "CHO_XAC_NHAN").forEach((row) => pendingReadings.set(String(row.id), row));
          history.innerHTML = visible.map((row) => {
            const status = String(row.status || "");
            const statusClass = ({ CHO_XAC_NHAN: "cho_xac_nhan", DA_XAC_NHAN: "da_xac_nhan", TU_CHOI: "tu_choi" })[status] || "unknown";
            const replacement = row.readingType === "DINH_KY" ? replacementByRoom.get(String(row.room?.id)) : null;
            const newKwh = replacement ? Number(row.readingValue) - Number(replacement.newStartReading) : null;
            const breakdown = replacement ? `<small class="meter-breakdown">${newKwh < 0 ? "Cần gửi lại chỉ số đồng hồ mới" : `${escapeHtml(replacement.oldKwh)} kWh cũ + ${escapeHtml(newKwh)} kWh mới = ${escapeHtml(Number(replacement.oldKwh) + newKwh)} kWh`}</small>` : "";
            return `<tr><td>${escapeHtml(row.room?.code ? `Phòng ${row.room.code}` : "—")}</td><td>${escapeHtml(row.period)}</td><td>${escapeHtml(typeLabels[row.readingType] || typeLabels.DINH_KY)}${replacement ? '<span class="meter-replaced">Đã thay đồng hồ</span>' : ""}</td><td>${escapeHtml(row.readingValue)}${breakdown}</td><td><span class="meter-status meter-status--${statusClass}">${escapeHtml(statusLabels[status] || "—")}</span></td><td>${escapeHtml(date(row.submittedAt))}</td><td>${status === "CHO_XAC_NHAN" ? `<div class="meter-row-actions"><button class="btn btn--secondary" type="button" data-confirm="${escapeHtml(row.id)}">Xác nhận</button><button class="btn btn--secondary" type="button" data-edit="${escapeHtml(row.id)}">Sửa</button><button class="btn btn--secondary" type="button" data-remove="${escapeHtml(row.id)}">Xóa</button></div>` : "—"}</td></tr>`;
          }).concat(replacements.filter((row) => (!roomId || String(row.roomId) === roomId) && !visible.some((reading) => String(reading.room?.id) === String(row.roomId) && reading.readingType === "DINH_KY"))
            .map((row) => `<tr><td>${escapeHtml(rooms.find((room) => String(room.ma_phong) === String(row.roomId))?.so_phong || "—")}</td><td>${escapeHtml(row.period)}</td><td><span class="meter-replaced">Đã thay đồng hồ</span></td><td>${escapeHtml(row.oldKwh)} kWh cũ; chờ chỉ số mới</td><td>Chờ cuối kỳ</td><td>${escapeHtml(row.replacementDate)}</td><td>—</td></tr>`)).join("") || '<tr><td colspan="7">Chưa có chỉ số trong kỳ này.</td></tr>';
        } catch (error) { if (request === historyRequest) history.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`; }
      };
      filters.elements.buildingId.addEventListener("change", () => {
        const selected = filters.elements.buildingId.value;
        const matching = rooms.filter((room) => String(room.ma_can) === selected)
          .sort((a, b) => String(a.so_phong || "").localeCompare(String(b.so_phong || ""), "vi", { numeric: true }));
        const placeholder = selected ? "Tất cả phòng" : "Chọn căn trước";
        filters.elements.roomId.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${matching.map((room) => `<option value="${escapeHtml(room.ma_phong)}">${escapeHtml(room.so_phong)}</option>`).join("")}`;
        filters.elements.roomId.disabled = !selected || !matching.length;
        content.querySelector("[data-replace-open]").disabled = true;
        form.querySelector("[data-preview]").disabled = true;
        form.querySelector("[type=submit]").disabled = true;
        clearPreview();
        loadHistory();
      });
      filters.elements.roomId.addEventListener("change", () => {
        const selected = Boolean(filters.elements.roomId.value);
        form.querySelector("[data-preview]").disabled = !selected;
        form.querySelector("[type=submit]").disabled = !selected;
        content.querySelector("[data-replace-open]").disabled = !selected;
        clearPreview();
        loadHistory();
      });
      filters.elements.period.addEventListener("change", () => { clearPreview(); loadHistory(); });
      content.querySelector("[data-replace-open]").addEventListener("click", () => {
        replacementForm.reset();
        replacementForm.elements.unreadable.dispatchEvent(new Event("change"));
        replacementForm.elements.replacementDate.value = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        replacementDialog.querySelector("[data-replacement-context]").textContent = `Phòng ${rooms.find((room) => String(room.ma_phong) === filters.elements.roomId.value)?.so_phong || "—"} · kỳ ${filters.elements.period.value}`;
        replacementDialog.querySelector("[data-replacement-message]").textContent = "";
        replacementDialog.showModal();
      });
      replacementDialog.querySelector("[data-replacement-cancel]").addEventListener("click", () => replacementDialog.close());
      replacementForm.elements.unreadable.addEventListener("change", () => {
        const unreadable = replacementForm.elements.unreadable.checked;
        replacementDialog.querySelector("[data-old-final]").hidden = unreadable;
        replacementDialog.querySelector("[data-old-estimate]").hidden = !unreadable;
        replacementForm.elements.oldFinalReading.disabled = unreadable;
        replacementForm.elements.oldFinalReading.required = !unreadable;
        replacementForm.elements.estimatedOldKwh.disabled = !unreadable;
        replacementForm.elements.estimatedOldKwh.required = unreadable;
      });
      replacementForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = replacementDialog.querySelector("[data-replacement-submit]");
        button.disabled = true;
        const notice = replacementDialog.querySelector("[data-replacement-message]");
        notice.textContent = "";
        try {
          const body = new FormData();
          body.set("roomId", filters.elements.roomId.value);
          body.set("period", filters.elements.period.value);
          body.set("replacementDate", replacementForm.elements.replacementDate.value);
          body.set("newStartReading", String(integerVnd(replacementForm.elements.newStartReading.value, "Chỉ số đầu đồng hồ mới")));
          body.set("reason", replacementForm.elements.reason.value.trim());
          const field = replacementForm.elements.unreadable.checked ? "estimatedOldKwh" : "oldFinalReading";
          body.set(field, String(integerVnd(replacementForm.elements[field].value, field === "estimatedOldKwh" ? "Sản lượng ước tính" : "Chỉ số cuối đồng hồ cũ")));
          for (const name of ["oldImage", "newImage"]) { const file = replacementForm.elements[name].files[0]; if (file) { validateImage(file, maxBytes); body.set(name, file); } }
          await context.api.postForm("/v1/meter-replacements", body);
          replacementDialog.close();
          await loadHistory();
        } catch (error) { notice.textContent = error.message; }
        finally { button.disabled = false; }
      });
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
      dialog.querySelector("[data-dialog-cancel]").addEventListener("click", () => dialog.close());
      history.addEventListener("click", (event) => {
        const button = event.target.closest("[data-edit], [data-remove]");
        if (!button) return;
        const id = String(button.dataset.edit || button.dataset.remove);
        const row = pendingReadings.get(id);
        if (!row) return;
        editMode = button.dataset.edit ? "edit" : "remove";
        editId = id;
        editForm.reset();
        editForm.elements.readingValue.value = row.readingValue;
        dialog.querySelector("[data-dialog-title]").textContent = editMode === "edit" ? "Sửa chỉ số chờ xác nhận" : "Xóa chỉ số chờ xác nhận";
        dialog.querySelector("[data-dialog-context]").textContent = `Phòng ${row.room?.code || "—"} · kỳ ${row.period} · chỉ số ${row.readingValue}`;
        dialog.querySelector("[data-dialog-value]").hidden = editMode === "remove";
        editForm.elements.readingValue.disabled = editMode === "remove";
        dialog.querySelector("[data-dialog-submit]").textContent = editMode === "edit" ? "Lưu sửa đổi" : "Xóa chỉ số";
        dialog.querySelector("[data-dialog-message]").textContent = "";
        dialog.showModal();
      });
      editForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = dialog.querySelector("[data-dialog-submit]");
        button.disabled = true;
        dialog.querySelector("[data-dialog-message]").textContent = "";
        try {
          const reason = editForm.elements.reason.value.trim();
          if (!reason) throw new Error("Vui lòng nhập lý do.");
          const endpoint = `/v1/meter-readings/${encodeURIComponent(editId)}`;
          if (editMode === "edit") {
            const readingValue = integerVnd(editForm.elements.readingValue.value, "Chỉ số điện");
            await context.api.patch(endpoint, { readingValue, reason }, { "If-Match": "*" });
          } else {
            await context.api.request(endpoint, { method: "DELETE", body: JSON.stringify({ reason }) });
          }
          dialog.close();
          await loadHistory();
        } catch (error) { dialog.querySelector("[data-dialog-message]").textContent = error.message; }
        finally { button.disabled = false; }
      });
      history.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-confirm]"); if (!button) return; button.disabled = true;
        try {
          await context.api.post(`/v1/meter-readings/${encodeURIComponent(button.dataset.confirm)}/confirmations`, {}, { "Idempotency-Key": crypto.randomUUID(), "If-Match": "*" });
          const badge = button.closest("tr").querySelector(".meter-status");
          badge.className = "meter-status meter-status--da_xac_nhan";
          badge.textContent = statusLabels.DA_XAC_NHAN;
          pendingReadings.delete(String(button.dataset.confirm));
          button.closest(".meter-row-actions").replaceWith("—");
        }
        catch (error) { message.textContent = error.message; button.disabled = false; }
      });
    } catch (error) { content.innerHTML = `<div class="empty-state empty-state--error">${escapeHtml(error.message)}</div>`; }
  },
};
