import { icons } from "../../shared/components/icons.js";
import { formMarkup, historyMarkup, needsException, moveOutPayload } from "./tenant-move-out.model.mjs";

export function createMoveOutPanel(panel, api, active, onChanged = () => {}) {
  panel.innerHTML = `<div class="renewal-toolbar"><button class="btn btn--secondary" type="button" data-move-refresh>${icons.refresh()} Cập nhật trạng thái</button></div><p class="renewal-notice" data-move-message role="status" aria-live="polite"></p><div data-move-form-slot></div><section class="renewal-history"><h2>Kết quả yêu cầu trả phòng</h2><div data-move-history></div></section>`;
  const slot = panel.querySelector("[data-move-form-slot]"), history = panel.querySelector("[data-move-history]"), message = panel.querySelector("[data-move-message]"), refresh = panel.querySelector("[data-move-refresh]");
  let data = { contracts: [] }, loading = false, busy = false, loaded = false;
  const draft = { contractId: "", expectedMoveOutDate: "", content: "", earlyReturnReason: "" };
  const selected = () => data.contracts.find((c) => c.contractId === draft.contractId);
  const updateBusy = () => {
    refresh.disabled = loading || busy; refresh.setAttribute("aria-busy", String(loading || busy));
    refresh.innerHTML = `${icons.refresh()} ${loading ? "Đang cập nhật..." : "Cập nhật trạng thái"}`;
    const fields = slot.querySelector("[data-move-fields]"); if (fields) fields.disabled = loading || busy || !selected()?.eligible;
    const select = slot.querySelector('[name="contractId"]'); if (select) select.disabled = loading || busy;
    const button = slot.querySelector("[data-move-submit]"); if (button) { button.disabled = loading || busy || !selected()?.eligible; button.textContent = busy ? "Đang gửi..." : "Gửi yêu cầu trả phòng"; }
  };
  const draw = () => {
    if (!data.contracts.some((c) => c.contractId === draft.contractId)) draft.contractId = data.contracts[0]?.contractId || "";
    slot.innerHTML = formMarkup(data.contracts, draft, data);
    if (!data.contracts.length) return;
    const form = slot.querySelector("[data-move-out]"), selector = slot.querySelector('[name="contractId"]');
    const input = form.querySelector('[name="expectedMoveOutDate"]'), content = form.querySelector('[name="content"]'), reason = form.querySelector('[name="earlyReturnReason"]');
    if (selector) selector.onchange = () => { draft.contractId = selector.value; draft.expectedMoveOutDate = ""; draw(); slot.querySelector('[name="contractId"]')?.focus(); };
    input.oninput = () => { draft.expectedMoveOutDate = input.value; const early = needsException(input.value, data); form.querySelector("[data-early-fields]").hidden = !early; reason.required = early; };
    content.oninput = () => { draft.content = content.value; }; reason.oninput = () => { draft.earlyReturnReason = reason.value; };
    form.onsubmit = async (event) => {
      event.preventDefault(); if (loading || busy || !active() || !selected()?.eligible) return;
      draft.expectedMoveOutDate = input.value; draft.content = content.value; draft.earlyReturnReason = reason.value;
      busy = true; updateBusy(); message.textContent = "Đang gửi yêu cầu trả phòng...";
      try {
        await api.post("/v1/requests", moveOutPayload(draft, data));
        if (!active()) return;
        draft.content = ""; draft.earlyReturnReason = ""; message.textContent = "Đã gửi yêu cầu trả phòng, vui lòng chờ Chủ trọ quyết định.";
        onChanged(); busy = false; loaded = false; await load();
      } catch (error) { if (active() && error.status !== 401) message.textContent = error.message; }
      finally { busy = false; if (active()) updateBusy(); }
    };
    updateBusy();
  };
  async function load() {
    if (loading || busy || !active()) return;
    loading = true; updateBusy(); history.setAttribute("aria-busy", "true");
    slot.innerHTML = '<section class="panel renewal-card" role="status">Đang tải điều kiện trả phòng...</section>';
    try {
      const [current, requests] = await Promise.all([api.get("/v1/me/move-out-context"), api.get("/v1/requests")]);
      if (!active()) return;
      data = { ...current.data, contracts: current.data?.contracts || [] }; loaded = true; draw(); history.innerHTML = historyMarkup(requests.data || []);
    } catch (error) {
      if (!active() || error.status === 401) return;
      slot.innerHTML = '<section class="panel renewal-card" role="alert"><h2>Không thể cập nhật yêu cầu trả phòng</h2><p data-error></p><button class="btn btn--secondary" type="button" data-retry>Thử lại</button></section>';
      slot.querySelector("[data-error]").textContent = error.message; slot.querySelector("[data-retry]").onclick = load;
    } finally { loading = false; if (active()) { history.setAttribute("aria-busy", "false"); updateBusy(); } }
  }
  refresh.onclick = load;
  return { show: () => loaded ? Promise.resolve() : load(), invalidate: () => { loaded = false; } };
}
