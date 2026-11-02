import { shellPage } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { contractMarkup, formMarkup, historyMarkup, moveOutMarkup, renewalPayload, submitGate } from "./tenant-renewal.model.mjs";
import { createMoveOutPanel } from "./tenant-move-out.panel.mjs";
import "../residents-contracts/contracts.css";
import "./tenant-requests.css";

export default {
  id: "tenant-requests", route: "/tenant/requests", title: "Yêu cầu", tabLabel: "Gia hạn / trả phòng", group: "tenant-requests", order: 40, roles: ["KHACH_THUE"],
  async render(context) {
    context.main.innerHTML = shellPage("Yêu cầu", "");
    const root = context.main.querySelector("[data-content]");
    root.innerHTML = `<div class="tenant-requests"><div class="module-tabs" role="tablist" aria-label="Loại yêu cầu"><button type="button" class="module-tab is-active" role="tab" id="request-renewal-tab" aria-controls="request-renewal-panel" aria-selected="true" tabindex="0" data-tab="renewal">Gia hạn</button><button type="button" class="module-tab" role="tab" id="request-move-out-tab" aria-controls="request-move-out-panel" aria-selected="false" tabindex="-1" data-tab="move-out">Trả phòng</button></div><section id="request-renewal-panel" role="tabpanel" aria-labelledby="request-renewal-tab"><div class="renewal-toolbar"><button class="btn btn--secondary" type="button" data-refresh>${icons.refresh()} Cập nhật trạng thái</button></div><p class="renewal-notice" role="status" aria-live="polite" data-message></p><div data-form></div><section class="renewal-history" aria-labelledby="renewal-history-title"><h2 id="renewal-history-title">Kết quả yêu cầu gia hạn</h2><div data-history></div></section></section><section id="request-move-out-panel" role="tabpanel" aria-labelledby="request-move-out-tab" hidden>${moveOutMarkup()}</section></div>`;
    const slot = root.querySelector("[data-form]"), history = root.querySelector("[data-history]"), message = root.querySelector("[data-message]"), refresh = root.querySelector("[data-refresh]");
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const panels = [root.querySelector("#request-renewal-panel"), root.querySelector("#request-move-out-panel")];
    let contracts = [], draft = { contractId: "", packageMonths: "", content: "" }, loading = false, busy = false, disposed = false, activeTab = 0, needsRefresh = false;
    const gate = submitGate(), active = () => !disposed && root.isConnected;
    let movePanel;
    const selected = () => contracts.find((c) => c.contractId === draft.contractId);
    const dispose = () => { disposed = true; window.removeEventListener("hashchange", dispose); window.removeEventListener("isk19:session-expired", dispose); };
    window.addEventListener("hashchange", dispose, { once: true }); window.addEventListener("isk19:session-expired", dispose, { once: true });
    const showTab = (index, focus = false) => {
      activeTab = index;
      tabs.forEach((tab, i) => { tab.setAttribute("aria-selected", String(i === index)); tab.tabIndex = i === index ? 0 : -1; tab.classList.toggle("is-active", i === index); panels[i].hidden = i !== index; });
      if (focus) tabs[index].focus();
      if (index === 1) {
        movePanel ||= createMoveOutPanel(panels[1], context.api, active, () => { needsRefresh = true; });
        return movePanel.show();
      }
      if (index === 0 && needsRefresh && !busy && !loading) void load();
    };
    tabs.forEach((tab, i) => {
      tab.onclick = () => showTab(i);
      tab.onkeydown = (event) => {
        const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (i + 1) % tabs.length : event.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : null;
        if (index == null) return;
        event.preventDefault(); showTab(index, true);
      };
    });
    const updateBusy = () => {
      refresh.disabled = loading || busy;
      refresh.setAttribute("aria-busy", String(loading || busy));
      refresh.innerHTML = `${icons.refresh()} ${loading ? "Đang cập nhật..." : "Cập nhật trạng thái"}`;
      const fieldset = slot.querySelector("[data-fields]"); if (fieldset) fieldset.disabled = busy;
      const button = slot.querySelector("[data-submit]"); if (button) { button.disabled = busy || loading || !selected()?.eligible; button.textContent = busy ? "Đang gửi..." : "Gửi yêu cầu gia hạn"; }
    };
    const draw = (restoreFocus = false) => {
      if (!contracts.some((c) => c.contractId === draft.contractId)) { draft.contractId = contracts[0]?.contractId || ""; draft.packageMonths = ""; }
      slot.innerHTML = formMarkup(contracts, draft);
      const form = slot.querySelector("[data-renewal]"); if (!form) return;
      const contractSelect = form.querySelector('[name="contractId"]'), packageSelect = form.querySelector('[name="packageMonths"]'), input = form.querySelector('[name="content"]');
      if (contractSelect) contractSelect.onchange = () => { draft.content = input.value; draft.contractId = contractSelect.value; draft.packageMonths = ""; draw(true); };
      if (restoreFocus) contractSelect?.focus();
      packageSelect.onchange = () => { draft.packageMonths = packageSelect.value; form.querySelector("[data-info]").innerHTML = contractMarkup(selected(), draft.packageMonths); };
      input.oninput = () => { draft.content = input.value; };
      form.onsubmit = (event) => {
        event.preventDefault();
        if (busy || loading || activeTab !== 0 || !selected()?.eligible) return;
        return gate(async () => {
          draft.content = input.value; draft.packageMonths = packageSelect.value;
          busy = true; updateBusy(); message.textContent = "Đang gửi yêu cầu...";
          try {
            await context.api.post("/v1/requests", renewalPayload(draft.contractId, draft.packageMonths, draft.content));
            if (!active()) return;
            draft.content = ""; needsRefresh = true; message.textContent = "Đã gửi yêu cầu gia hạn, vui lòng chờ Chủ trọ xử lý.";
            movePanel?.invalidate();
            busy = false;
            // Defer renewal refresh until its own tab is visible.
            if (activeTab === 0) await load();
          } catch (error) { if (active() && error.status !== 401) message.textContent = error.message; }
          finally { busy = false; if (active()) updateBusy(); }
        });
      };
      updateBusy();
    };
    const load = async () => {
      if (loading || busy || activeTab !== 0 || !active()) return;
      loading = true; updateBusy();
      slot.innerHTML = '<section class="panel renewal-card" role="status" aria-live="polite">Đang tải hợp đồng và gói gia hạn...</section>';
      history.setAttribute("aria-busy", "true");
      try {
        const [current, requests] = await Promise.all([context.api.get("/v1/me/renewal-context"), context.api.get("/v1/requests")]);
        if (!active()) return;
        contracts = current.data.contracts; needsRefresh = false; draw(); history.innerHTML = historyMarkup(requests.data);
      } catch (error) {
        if (!active() || error.status === 401) return;
        slot.innerHTML = '<section class="panel renewal-card" role="alert"><h2>Không thể cập nhật yêu cầu</h2><p data-error></p><button type="button" class="btn btn--secondary" data-retry>Thử lại</button></section>';
        slot.querySelector("[data-error]").textContent = error.message; slot.querySelector("[data-retry]").onclick = load;
      } finally { loading = false; if (active()) { history.setAttribute("aria-busy", "false"); updateBusy(); } }
    };
    refresh.onclick = load;
    await load();
  },
};
