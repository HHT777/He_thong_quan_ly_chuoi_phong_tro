import { shellPage } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { fields, newDraft, proposalPayload, formMarkup, historyMarkup } from "./tenant-co-tenants.model.mjs";
import "../residents-contracts/contracts.css";
import "./tenant-requests.css";

export default {
  id: "tenant-co-tenants", route: "/tenant/co-tenants", title: "Người ở cùng", tabLabel: "Người ở cùng", group: "tenant-requests", order: 41, roles: ["KHACH_THUE"],
  async render(context) {
    context.main.innerHTML = shellPage("Người ở cùng", "");
    const root = context.main.querySelector("[data-content]");
    root.innerHTML = `<div class="tenant-requests"><div class="renewal-toolbar"><button type="button" class="btn btn--secondary" data-refresh>${icons.refresh()} Cập nhật trạng thái</button></div><p class="renewal-notice" data-message role="status" aria-live="polite"></p><div data-form></div><div data-history></div></div>`;
    const slot = root.querySelector("[data-form]"), history = root.querySelector("[data-history]"), refresh = root.querySelector("[data-refresh]"), message = root.querySelector("[data-message]");
    let data = { contracts: [] }, draft = newDraft(), review = false, busy = false, loading = false, disposed = false;
    const active = () => !disposed && root.isConnected;
    const dispose = () => { disposed = true; window.removeEventListener("hashchange", dispose); window.removeEventListener("isk19:session-expired", dispose); };
    window.addEventListener("hashchange", dispose, { once: true }); window.addEventListener("isk19:session-expired", dispose, { once: true });
    const selected = () => data.contracts.find((c) => c.contractId === draft.contractId);
    const updateBusy = () => {
      refresh.disabled = loading || busy; refresh.setAttribute("aria-busy", String(loading || busy));
      refresh.innerHTML = `${icons.refresh()} ${loading ? "Đang cập nhật..." : "Cập nhật trạng thái"}`;
      for (const button of slot.querySelectorAll("button")) button.disabled = busy || loading || !selected()?.eligible;
      const fs = slot.querySelector("fieldset"); if (fs) fs.disabled = busy || loading || !selected()?.eligible;
    };
    const draw = () => {
      if (!data.contracts.some((c) => c.contractId === draft.contractId)) draft.contractId = data.contracts[0]?.contractId || "";
      slot.innerHTML = formMarkup(data, draft, review); updateBusy();
      if (!data.contracts.length) return;
      if (review) {
        slot.querySelector("[data-edit]").onclick = () => { if (!busy) { review = false; draw(); slot.querySelector('[name="name"]')?.focus(); } };
        slot.querySelector("[data-confirm]").onclick = async () => {
          if (busy || loading || !selected()?.eligible) return;
          busy = true; updateBusy(); message.textContent = "Đang gửi đề xuất...";
          try {
            await context.api.post("/v1/co-tenants", proposalPayload(draft));
            if (!active()) return;
            draft = { ...newDraft(), contractId: draft.contractId }; review = false; message.textContent = "Đề xuất đã được lưu, vui lòng chờ Chủ trọ xử lý.";
            busy = false; await load();
          } catch (error) { if (active() && error.status !== 401) message.textContent = error.message; }
          finally { busy = false; if (active()) updateBusy(); }
        };
        return;
      }
      const form = slot.querySelector("[data-proposal]"), selector = slot.querySelector('[name="contractId"]');
      if (selector) selector.onchange = () => { draft.contractId = selector.value; draw(); slot.querySelector('[name="contractId"]')?.focus(); };
      for (const [key] of [...fields, ["note"]]) { const control = form.querySelector(`[name="${key}"]`); control.oninput = () => { draft[key] = control.value; }; }
      form.onsubmit = (event) => {
        event.preventDefault(); if (busy || loading || !selected()?.eligible) return;
        for (const [key] of [...fields, ["note"]]) draft[key] = form.querySelector(`[name="${key}"]`).value;
        try { proposalPayload(draft); review = true; message.textContent = "Chưa gửi. Vui lòng kiểm tra và bấm xác nhận."; draw(); slot.querySelector("[data-confirm]").focus(); }
        catch (error) { message.textContent = error.message; }
      };
    };
    async function load() {
      if (loading || busy || !active()) return;
      loading = true; updateBusy(); slot.innerHTML = '<section class="panel renewal-card" role="status">Đang tải phòng và sức chứa...</section>';
      try { const result = await context.api.get("/v1/me/co-tenant-context"); if (!active()) return; data = result.data; draw(); history.innerHTML = historyMarkup(data); }
      catch (error) { if (active() && error.status !== 401) { slot.innerHTML = '<section class="panel renewal-card" role="alert"><h2>Không tải được người ở cùng</h2><p data-error></p><button type="button" class="btn btn--secondary" data-retry>Thử lại</button></section>'; slot.querySelector("[data-error]").textContent = error.message; slot.querySelector("[data-retry]").onclick = load; } }
      finally { loading = false; if (active()) updateBusy(); }
    }
    refresh.onclick = load; await load();
  },
};
