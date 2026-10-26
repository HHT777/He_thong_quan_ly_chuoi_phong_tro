import { shellPage, escapeHtml, confirmAction } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { createRequestKeyStore } from "../../core/idempotency.js";
import { broadcastRecipients, broadcastPayload } from "./broadcast.model.mjs";
import "./broadcast.css";

const requestKeys = createRequestKeyStore();
const requestScope = "notifications:broadcast";

export default {
  id: "broadcast", route: "/notifications/broadcast", title: "Gửi thông báo",
  tabLabel: "Gửi thông báo", group: "notifications", order: 61, roles: ["CHU_TRO"],
  render(context) {
    context.main.innerHTML = shellPage("Gửi thông báo", "Soạn thông báo trong ứng dụng cho khách thuê có tài khoản đang hoạt động.");
    const content = context.main.querySelector("[data-content]");
    content.innerHTML = `
      <form class="broadcast-layout" data-broadcast-form>
        <section class="broadcast-card" aria-labelledby="broadcast-compose-title">
          <h2 id="broadcast-compose-title">Nội dung thông báo</h2>
          <label class="broadcast-field">Tiêu đề
            <input class="form-control" name="subject" maxlength="200" autocomplete="off" required placeholder="Ví dụ: Lịch bảo trì điện" />
          </label>
          <label class="broadcast-field">Nội dung
            <textarea class="form-control" name="content" rows="7" required placeholder="Nhập nội dung gửi đến khách thuê"></textarea>
          </label>
          <p class="broadcast-hint" data-character-count>0 / 1.000 ký tự</p>
          <h3>Xem trước thông báo</h3>
          <div class="broadcast-preview" data-preview aria-live="polite">Nội dung sẽ hiện ở đây.</div>
        </section>
        <section class="broadcast-card" aria-labelledby="broadcast-recipients-title">
          <div class="broadcast-card__heading"><h2 id="broadcast-recipients-title">Người nhận</h2><button type="button" class="btn btn--secondary" data-reload>↻ Tải lại</button></div>
          <p class="broadcast-hint">Chỉ khách thuê có tài khoản đang hoạt động mới nhận được thông báo.</p>
          <label class="broadcast-field">Phạm vi gửi
            <select class="form-control" data-scope><option value="all">Tất cả khách đủ điều kiện</option><option value="selected">Chọn từng khách</option></select>
          </label>
          <div data-select-controls hidden>
            <label class="broadcast-field">Tìm người nhận
              <input class="form-control" data-search type="search" placeholder="Tên, số điện thoại, căn hoặc phòng" />
            </label>
            <div class="broadcast-quick-actions"><button type="button" data-select-visible>Chọn kết quả đang hiển thị</button><button type="button" data-clear-selection>Bỏ chọn tất cả</button></div>
          </div>
          <p class="broadcast-count" data-recipient-count role="status">Đang tải người nhận...</p>
          <div class="broadcast-recipient-list" data-recipient-list></div>
        </section>
        <div class="broadcast-footer">
          <p data-message role="status" aria-live="polite"></p>
          <button type="submit" class="btn btn--primary" data-send disabled>Gửi thông báo</button>
        </div>
      </form>`;

    const form = content.querySelector("[data-broadcast-form]");
    const subject = form.elements.subject;
    const messageBody = form.elements.content;
    const scope = form.querySelector("[data-scope]");
    const search = form.querySelector("[data-search]");
    const selectionControls = form.querySelector("[data-select-controls]");
    const recipientList = form.querySelector("[data-recipient-list]");
    const recipientCount = form.querySelector("[data-recipient-count]");
    const send = form.querySelector("[data-send]");
    const message = form.querySelector("[data-message]");
    let recipients = [];
    let selected = new Set();
    let loading = true;
    let busy = false;
    let loadVersion = 0;
    const connected = () => form.isConnected;
    const currentIds = () => scope.value === "all" ? recipients.map((row) => row.id) : [...selected];
    const visibleRecipients = () => {
      const query = search.value.trim().toLocaleLowerCase("vi");
      return recipients.filter((row) => `${row.name} ${row.phone} ${row.room}`.toLocaleLowerCase("vi").includes(query));
    };
    const update = () => {
      const title = subject.value.trim();
      const body = messageBody.value.trim();
      const preview = title || body ? `[${title}] ${body}` : "Nội dung sẽ hiện ở đây.";
      form.querySelector("[data-preview]").textContent = preview;
      const length = title && body ? preview.length : 0;
      const counter = form.querySelector("[data-character-count]");
      counter.textContent = `${length.toLocaleString("vi-VN")} / 1.000 ký tự`;
      counter.classList.toggle("broadcast-hint--error", length > 1000);
      recipientCount.textContent = loading ? "Đang tải người nhận..." : `Đã chọn ${currentIds().length} / ${recipients.length} khách thuê đủ điều kiện`;
      send.disabled = loading || busy || !title || !body || length > 1000 || currentIds().length === 0;
      for (const control of [subject, messageBody, scope, search, ...form.querySelectorAll("[data-reload], [data-select-visible], [data-clear-selection]")]) control.disabled = busy;
      for (const checkbox of recipientList.querySelectorAll('input[type="checkbox"]')) checkbox.disabled = busy || scope.value === "all";
    };
    const renderRecipients = () => {
      selectionControls.hidden = scope.value !== "selected";
      const rows = visibleRecipients();
      recipientList.innerHTML = rows.length ? rows.map((row) => `
        <label class="broadcast-recipient">
          <input type="checkbox" value="${escapeHtml(row.id)}" ${scope.value === "all" || selected.has(row.id) ? "checked" : ""} ${scope.value === "all" || busy ? "disabled" : ""} />
          <span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml([row.phone, row.room].filter(Boolean).join(" · ") || "Chưa có phòng đang thuê")}</small></span>
        </label>`).join("") : `<p class="broadcast-empty">${loading ? "Đang tải danh sách..." : "Không có khách phù hợp."}</p>`;
      update();
    };
    const loadRecipients = async () => {
      if (busy) return;
      const version = ++loadVersion;
      loading = true;
      recipientList.innerHTML = '<p class="broadcast-empty">Đang tải danh sách...</p>';
      update();
      try {
        const response = await context.api.get("/management/khach-thue");
        if (!connected() || version !== loadVersion) return;
        const tenants = response.data;
        if (!Array.isArray(tenants)) throw new Error("Không đọc được danh sách khách thuê.");
        recipients = broadcastRecipients(tenants);
        selected = new Set([...selected].filter((id) => recipients.some((row) => row.id === id)));
        message.textContent = recipients.length ? "" : "Chưa có khách thuê nào có tài khoản đang hoạt động.";
      } catch (error) {
        if (!connected() || version !== loadVersion) return;
        recipients = [];
        selected.clear();
        message.textContent = `Không tải được người nhận: ${error.message}`;
      } finally {
        if (connected() && version === loadVersion) { loading = false; renderRecipients(); }
      }
    };
    subject.addEventListener("input", update);
    messageBody.addEventListener("input", update);
    scope.addEventListener("change", renderRecipients);
    search.addEventListener("input", renderRecipients);
    recipientList.addEventListener("change", (event) => {
      if (event.target.matches('input[type="checkbox"]')) {
        if (event.target.checked) selected.add(event.target.value); else selected.delete(event.target.value);
        update();
      }
    });
    form.querySelector("[data-select-visible]").addEventListener("click", () => { visibleRecipients().forEach((row) => selected.add(row.id)); renderRecipients(); });
    form.querySelector("[data-clear-selection]").addEventListener("click", () => { selected.clear(); renderRecipients(); });
    form.querySelector("[data-reload]").addEventListener("click", loadRecipients);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || loading) return;
      let payload;
      try { payload = broadcastPayload(subject.value, messageBody.value, currentIds()); }
      catch (error) { message.textContent = error.message; return; }
      busy = true;
      update();
      try {
        const accepted = await confirmAction(`Gửi thông báo “${payload.subject}” đến ${payload.recipientIds.length} khách thuê?`);
        if (!accepted || !connected()) return;
        const response = await context.api.post("/v1/notifications/broadcast", { ...payload, maBroadcast: requestKeys.keyFor(requestScope, payload) });
        if (!connected()) return;
        const result = response.data || {};
        const sentCount = Number(result.sent || 0);
        const skippedCount = Number(result.skipped || 0);
        const total = Number(result.recipients || 0);
        if (skippedCount || sentCount !== payload.recipientIds.length || total !== payload.recipientIds.length) {
          message.textContent = `Đã tạo ${sentCount}/${total} thông báo; ${skippedCount} lượt chưa tạo hoặc đã tồn tại. Kiểm tra hộp thư và thử gửi lại nếu cần.`;
          showToast("Một số thông báo chưa được tạo hoặc đã tồn tại.", "info");
        } else {
          requestKeys.complete(requestScope);
          subject.value = "";
          messageBody.value = "";
          message.textContent = `Đã gửi thông báo cho ${sentCount} khách thuê.`;
          showToast(`Đã gửi cho ${sentCount} khách thuê.`, "success");
        }
      } catch (error) {
        if (connected()) { message.textContent = error.message; showToast(error.message, "error"); }
      } finally { busy = false; if (connected()) { renderRecipients(); update(); } }
    });
    renderRecipients();
    loadRecipients();
  },
};
