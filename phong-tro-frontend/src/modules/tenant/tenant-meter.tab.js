import "../operations/meter-readings.css";
import "./tenant-meter.css";
import { shellPage } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { validateImage, contextMarkup, captureMarkup, loadErrorMarkup, previewMarkup, openImagePreview, unavailable } from "./tenant-meter.model.mjs";

export default {
  id: "tenant-meter", route: "/tenant/meter", title: "Gửi chỉ số điện", tabLabel: "Chỉ số điện", group: "tenant-operations", order: 30, roles: ["KHACH_THUE"],
  async render(context) {
    context.main.innerHTML = shellPage("Gửi chỉ số điện", "");
    context.main.querySelector(".module-page").classList.add("tenant-meter-page");
    const root = context.main.querySelector("[data-content]");
    root.innerHTML = `<div class="tenant-meter" style="max-width:1100px;min-width:0;margin-inline:auto;display:grid;gap:16px">
      <div class="mgmt-toolbar"><button type="button" class="btn btn--secondary" data-reload>${icons.refresh()} Cập nhật trạng thái</button></div>
      <div data-workspace style="display:grid;gap:16px;min-width:0"></div></div>`;
    const workspace = root.querySelector("[data-workspace]"), reload = root.querySelector("[data-reload]");
    let state; let preview; let busy = false; let version = 0; let imageUrl; let disposed = false; let closePreview;
    const alive = () => !disposed && root.isConnected;
    const revoke = () => { closePreview?.(); closePreview = null; if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = null; };
    const dispose = () => {
      disposed = true; version += 1; revoke();
      window.removeEventListener("hashchange", dispose); window.removeEventListener("isk19:session-expired", dispose);
    };
    window.addEventListener("hashchange", dispose, { once: true });
    window.addEventListener("isk19:session-expired", dispose, { once: true });
    const refreshState = (loading) => {
      reload.disabled = loading; reload.setAttribute("aria-busy", String(loading));
      reload.innerHTML = `${icons.refresh()} ${loading ? "Đang cập nhật..." : "Cập nhật trạng thái"}`;
    };
    const load = async () => {
      if (busy || !alive()) return;
      busy = true; const current = ++version; revoke(); refreshState(true);
      workspace.innerHTML = '<section class="panel meter-capture" role="status" aria-live="polite"><h2>Đang tải thông tin kỳ gửi...</h2></section>';
      try {
        const result = await context.api.get("/v1/me/meter-reading-context");
        if (!alive() || current !== version) return;
        state = result.data; preview = null;
        workspace.innerHTML = `<section class="panel meter-capture" data-context aria-labelledby="tenant-meter-context-title">${contextMarkup(state)}</section>${captureMarkup(state)}`;
        if (state.submissionWindowOpen && state.current?.status !== "DA_XAC_NHAN") bind();
      } catch (error) {
        if (error.status === 401 || !alive()) return;
        workspace.innerHTML = loadErrorMarkup(error);
        workspace.querySelector("[data-retry]").onclick = load;
      } finally { busy = false; if (alive()) refreshState(false); }
    };
    reload.onclick = load;
    function bind() {
      const input = workspace.querySelector("[data-image]"), choose = workspace.querySelector("[data-choose]"), recognize = workspace.querySelector("[data-preview]"), submit = workspace.querySelector("[data-submit]"), message = workspace.querySelector("[data-message]");
      const result = workspace.querySelector("[data-preview-result]"), photo = workspace.querySelector("[data-photo]"), empty = workspace.querySelector("[data-photo-empty]"), filename = workspace.querySelector("[data-file-name]");
      const enlarge = workspace.querySelector("[data-enlarge]");
      enlarge.onclick = () => { if (imageUrl) { closePreview?.(); closePreview = openImagePreview(imageUrl, enlarge); } };
      const clearPhoto = () => { revoke(); enlarge.disabled = true; enlarge.hidden = true; photo.removeAttribute("src"); photo.hidden = true; photo.style.display = "none"; empty.hidden = false; empty.style.display = ""; };
      const lock = (value, action) => {
        busy = value; if (!alive()) return;
        input.disabled = value; choose.disabled = value; recognize.disabled = value || !imageUrl; submit.disabled = value || !preview?.canSubmit; reload.disabled = value;
        recognize.textContent = value && action === "preview" ? "Đang nhận dạng..." : "Nhận dạng ảnh";
        submit.textContent = value && action === "submit" ? "Đang gửi..." : "Gửi chỉ số từ ảnh";
        recognize.setAttribute("aria-busy", String(value && action === "preview")); submit.setAttribute("aria-busy", String(value && action === "submit"));
      };
      choose.onclick = () => { if (!busy) input.click(); };
      input.onchange = () => {
        version += 1; preview = null; submit.disabled = true; clearPhoto(); result.textContent = "Chưa nhận dạng ảnh."; message.textContent = ""; recognize.disabled = true;
        const file = input.files[0]; filename.textContent = file?.name || "Chưa chọn ảnh"; filename.title = file?.name || "";
        try {
          validateImage(file, state.imagePolicy); imageUrl = URL.createObjectURL(file); photo.src = imageUrl; photo.hidden = false; photo.style.display = "block"; empty.hidden = true; empty.style.display = "none";
          enlarge.disabled = false; enlarge.hidden = false;
          recognize.disabled = false; message.textContent = "Đã chọn ảnh. Kiểm tra ảnh xem trước rồi bấm Nhận dạng ảnh.";
        } catch (error) { message.textContent = error.message; }
      };
      recognize.onclick = async () => {
        if (busy) return;
        try { validateImage(input.files[0], state.imagePolicy); } catch (error) { message.textContent = error.message; return; }
        preview = null; lock(true, "preview"); result.textContent = "Đang nhận dạng ảnh, vui lòng chờ..."; message.textContent = ""; const current = version;
        try {
          const form = new FormData(); form.append("file", input.files[0]); form.append("period", state.period);
          const response = await context.api.postForm("/v1/me/meter-reading-ocr-previews", form);
          if (!alive() || current !== version) return;
          preview = response.data; result.innerHTML = previewMarkup(preview);
          message.textContent = preview.ocrStatus === "RECOGNIZED" ? "" : unavailable;
        } catch (error) {
          if (error.status !== 401 && alive()) { result.textContent = "Nhận dạng ảnh chưa thành công."; message.textContent = error.message || unavailable; }
        } finally { lock(false); }
      };
      submit.onclick = async () => {
        if (busy || !preview?.canSubmit) return;
        lock(true, "submit"); message.textContent = "Đang gửi chỉ số...";
        try {
          const response = await context.api.post("/v1/me/meter-readings", { period: state.period, uploadToken: preview.uploadToken }, { "Idempotency-Key": crypto.randomUUID() });
          if (!alive()) return;
          state = { ...state, current: response.data };
          workspace.querySelector("[data-context]").innerHTML = contextMarkup(state);
          message.textContent = "Đã gửi chỉ số, đang chờ Chủ trọ xác nhận. Bạn có thể chọn ảnh khác để thay thế.";
          preview = null; input.value = ""; clearPhoto(); filename.textContent = "Chưa chọn ảnh"; filename.title = ""; result.textContent = "Đã gửi ảnh để Chủ trọ kiểm tra. Chọn ảnh khác nếu cần thay thế.";
        } catch (error) { if (error.status !== 401 && alive()) message.textContent = error.message; }
        finally { lock(false); }
      };
    }
    await load();
  },
};
