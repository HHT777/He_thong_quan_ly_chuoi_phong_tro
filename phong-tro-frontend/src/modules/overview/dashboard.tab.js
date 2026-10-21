import { escapeHtml } from "../../shared/components/view.js";
import { dashboardError, INCIDENT_LABELS, readCashflow, readExpiring, readIncidents, readSummary, ROOM_LABELS, ROOM_STATES } from "./dashboard.metrics.mjs";

const number = (value) => new Intl.NumberFormat("vi-VN").format(value);
const vnd = (value) => `${number(value)} đ`;
const currentPeriod = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
};
const dateVN = (value) => /^\d{4}-\d{2}-\d{2}/.test(value) ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "—";

const panel = (id, title, subtitle = "") => `<section class="ui1-card" data-panel="${id}"><header><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</header><div class="ui1-card__body" data-body="${id}" aria-live="polite"><p class="ui1-loading">Đang tải...</p></div></section>`;
const kpi = (id, title, note) => `<section class="ui1-kpi" data-panel="${id}"><h2>${title}</h2><div data-body="${id}" aria-live="polite"><p class="ui1-loading">Đang tải...</p></div><p class="ui1-kpi__note">${note}</p></section>`;

function ring(summary) {
  const { total, byStatus } = summary.rooms;
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = ROOM_STATES.map((status) => {
    const length = total ? byStatus[status] / total * circumference : 0;
    const segment = `<circle class="ui1-ring__${status.toLowerCase()}" cx="80" cy="80" r="${radius}" fill="none" stroke-width="16" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" />`;
    offset += length;
    return segment;
  }).join("");
  return `<div class="ui1-room-layout"><div class="ui1-ring"><svg role="img" aria-label="Tình trạng ${total} phòng" viewBox="0 0 160 160"><circle cx="80" cy="80" r="${radius}" fill="none" stroke="var(--ui1-track)" stroke-width="16" />${segments}</svg><span><strong>${number(total)}</strong> phòng</span></div><ul class="ui1-legend">${ROOM_STATES.map((status) => `<li><i class="ui1-dot ui1-dot--${status.toLowerCase()}" aria-hidden="true"></i><span>${ROOM_LABELS[status]}</span><strong>${number(byStatus[status])}</strong></li>`).join("")}</ul></div>`;
}

function billBar(bills) {
  const pieces = [["daThu", "Đã thu"], ["conNo", "Còn nợ"], ["quaHan", "Quá hạn"]];
  return `<div class="ui1-bar" role="img" aria-label="${bills.total} phiếu định kỳ: đã thu ${bills.daThu}, còn nợ ${bills.conNo}, quá hạn ${bills.quaHan}">${pieces.map(([key]) => bills[key] ? `<span class="ui1-bar__${key}" style="flex:${bills[key]}">${number(bills[key])}</span>` : "").join("")}</div><ul class="ui1-legend ui1-legend--horizontal">${pieces.map(([key, label]) => `<li><i class="ui1-dot ui1-dot--${key}" aria-hidden="true"></i><span>${label}</span><strong>${number(bills[key])}</strong></li>`).join("")}</ul><p class="ui1-note">${number(bills.total)} phiếu định kỳ trong kỳ; ba nhóm không trùng nhau.</p>`;
}

function summaryMarkup(summary) {
  return {
    totalRooms: `<strong class="ui1-kpi__value">${number(summary.rooms.total)}</strong>`,
    rentedRooms: `<strong class="ui1-kpi__value">${number(summary.rooms.byStatus.DANG_THUE)}</strong>`,
    occupancy: `<strong class="ui1-kpi__value">${number(summary.occupancyPercent)}%</strong>`,
    overdue: `<strong class="ui1-kpi__value ui1-kpi__value--danger">${number(summary.bills.quaHan)} <small>phiếu</small></strong>`,
    rooms: ring(summary),
    bills: billBar(summary.bills),
  };
}

function incidentsMarkup(incidents) {
  const states = ["CHO_TIEP_NHAN", "DANG_XU_LY", "DA_XU_LY", "KHAC"];
  return `<div class="ui1-incident-layout"><div><p class="ui1-note">${number(incidents.total)} sự cố</p><ul class="ui1-status-list">${states.map((status) => `<li><span>${INCIDENT_LABELS[status]}</span><span class="ui1-status-track"><i class="ui1-status-fill ui1-status-fill--${status.toLowerCase()}" style="width:${incidents.total ? incidents.byStatus[status] / incidents.total * 100 : 0}%"></i></span><strong>${number(incidents.byStatus[status])}</strong></li>`).join("")}</ul></div><div><h3>Sự cố gần đây</h3>${incidents.recent.length ? `<ul class="ui1-recent">${incidents.recent.map((row) => `<li><strong>${escapeHtml(row.text)}</strong><span>${row.room ? `Phòng ${escapeHtml(row.room)} · ` : ""}${INCIDENT_LABELS[row.status]} · ${dateVN(row.date)}</span></li>`).join("")}</ul>` : `<p class="ui1-note">Chưa có sự cố.</p>`}</div></div>`;
}

const sourcePanels = {
  summary: ["totalRooms", "rentedRooms", "occupancy", "overdue", "rooms", "bills"],
  cashflow: ["revenue"],
  expiring: ["contracts"],
  incidents: ["incidents"],
};

export default {
  id: "dashboard", route: "/overview/dashboard", title: "Tổng quan", tabLabel: "Tổng quan",
  group: "overview", order: 10, roles: ["CHU_TRO"],

  async render(context) {
    this.listeners?.abort();
    this.listeners = new AbortController();
    const period = currentPeriod();
    context.main.innerHTML = `<div class="ui1-dashboard"><div class="ui1-toolbar"><span>Kỳ ${escapeHtml(period)}</span><div class="ui1-quick"><button type="button" class="ui1-quick__button" data-quick-toggle aria-expanded="false">+ Tạo mới</button><div class="ui1-quick__menu" data-quick-menu hidden><button type="button" data-quick-route="/properties/rooms">Phòng</button><button type="button" data-quick-route="/operations/meter-readings">Chỉ số điện</button><button type="button" data-quick-route="/finance/bills">Phiếu thu</button><button type="button" data-quick-route="/residents-contracts/contracts">Hợp đồng</button></div></div></div><div class="ui1-kpis">${kpi("totalRooms", "Tổng số phòng", "Tổng danh mục đang quản lý")}${kpi("rentedRooms", "Đang thuê", "Phòng ở trạng thái đang thuê")}${kpi("occupancy", "Tỷ lệ lấp đầy", "Trên tổng số phòng")}${kpi("revenue", "Doanh thu thực nhận", "Trong kỳ này; đã trừ giảm trừ")}${kpi("overdue", "Công nợ quá hạn", "Phiếu định kỳ cần kiểm tra")}</div><div class="ui1-grid">${panel("rooms", "Tình trạng phòng", "Đủ mọi trạng thái phòng, kể cả đã giữ và khác")}${panel("bills", "Phiếu thu kỳ này", "Tình trạng phiếu định kỳ trong kỳ")}${panel("contracts", "Hợp đồng sắp hết hạn", "Kết thúc trong 30 ngày")}${panel("incidents", "Sự cố", "Theo trạng thái và ba sự cố gần nhất")}</div></div>`;

    const set = (id, html) => { const element = context.main.querySelector(`[data-body="${id}"]`); if (element) element.innerHTML = html; };
    const load = async (source) => {
      sourcePanels[source].forEach((id) => set(id, `<p class="ui1-loading">Đang tải...</p>`));
      try {
        let values;
        if (source === "summary") values = summaryMarkup(readSummary(await context.api.get(`/v1/dashboard/summary?period=${period}`)));
        if (source === "cashflow") values = { revenue: `<strong class="ui1-kpi__value ui1-kpi__value--money">${vnd(readCashflow(await context.api.get(`/v1/reports/cashflow?periodType=month&periodValue=${period}`)).totalRevenue)}</strong>` };
        if (source === "expiring") {
          const rows = readExpiring(await context.api.get("/hop-dong/expiring"));
          values = { contracts: `<p class="ui1-note">${number(rows.length)} hợp đồng trong 30 ngày</p>${rows.length ? `<ul class="ui1-recent">${rows.slice(0, 5).map((row) => `<li><strong>Phòng ${escapeHtml(row.room)}</strong><span>Đến hạn ${dateVN(row.endDate)}</span></li>`).join("")}</ul>` : `<p class="ui1-note">Không có hợp đồng sắp hết hạn.</p>`}` };
        }
        if (source === "incidents") values = { incidents: incidentsMarkup(readIncidents(await context.api.get("/v1/incidents"))) };
        for (const [id, html] of Object.entries(values)) set(id, html);
      } catch (error) {
        const message = dashboardError(error);
        sourcePanels[source].forEach((id) => set(id, `<div class="ui1-error" role="alert"><p>${escapeHtml(message)}</p><button type="button" data-retry="${source}">Thử lại</button></div>`));
      }
    };
    context.main.addEventListener("click", (event) => {
      const retry = event.target.closest("[data-retry]");
      if (retry) { load(retry.dataset.retry); return; }
      const toggle = event.target.closest("[data-quick-toggle]");
      if (toggle) { const menu = context.main.querySelector("[data-quick-menu]"); menu.hidden = !menu.hidden; toggle.setAttribute("aria-expanded", String(!menu.hidden)); return; }
      const route = event.target.closest("[data-quick-route]")?.dataset.quickRoute;
      if (route) context.go(route);
    }, { signal: this.listeners.signal });
    await Promise.all(Object.keys(sourcePanels).map(load));
  },
};
