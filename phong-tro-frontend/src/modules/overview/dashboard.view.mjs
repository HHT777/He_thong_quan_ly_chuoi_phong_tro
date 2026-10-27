import { escapeHtml } from "../../shared/components/view.js";
import { dashboardError, INCIDENT_LABELS, readIncidents, readSummary, ROOM_LABELS, ROOM_STATES } from "./dashboard.metrics.mjs";
import { billSegments, cashflowScale, donutSegments, donutStrokes, formatBusinessDate, formatVnd, readInsights, TASK_DETAILS } from "./dashboard.insights.mjs";

const number = (value) => new Intl.NumberFormat("vi-VN").format(value);
const percent = (part, total) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(total ? part * 100 / total : 0);
const chartDetail = (panel, value) => `data-chart-panel="${panel}" data-chart-detail="${escapeHtml(value)}" tabindex="0" aria-label="${escapeHtml(value)}"`;
const hoverReadout = (panel) => `<p class="ui2-hover-readout" data-hover-readout="${panel}" aria-live="polite"></p>`;
const taskRoutes = {
  OVERDUE_BILLS: "/finance/debts",
  EXPIRED_RESERVATIONS: "/residents-contracts/reservations",
  NEW_INCIDENTS: "/operations/incidents?status=CHO_TIEP_NHAN",
  PENDING_REQUESTS: "/residents-contracts/requests",
  PENDING_METER_READINGS: "/operations/meter-readings",
  EXPIRING_CONTRACTS: "/residents-contracts/contracts",
  VACANT_ROOMS: "/properties/rooms?status=TRONG",
};
const currentPeriod = () => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year").value}-${parts.find((part) => part.type === "month").value}`;
};
const panel = (id, title, subtitle = "", extra = "") => `<section class="ui1-card ${extra}" data-panel="${id}"><header><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</header><div class="ui1-card__body" data-body="${id}" aria-live="polite"><p class="ui1-loading">Đang tải...</p></div></section>`;
const kpi = (id, title, note) => `<section class="ui1-kpi" data-panel="${id}"><h2>${title}</h2><div data-body="${id}" aria-live="polite"><p class="ui1-loading">Đang tải...</p></div><p class="ui1-kpi__note">${note}</p></section>`;

function roomMarkup(summary) {
  const { total, byStatus } = summary.rooms;
  if (!total) return `<p class="ui1-note">Chưa có phòng trong danh mục.</p>`;
  const circumference = 2 * Math.PI * 62;
  const segments = donutSegments(byStatus, total, ROOM_STATES);
  const roomDetail = (state) => `${ROOM_LABELS[state]}: ${number(byStatus[state])} phòng (${percent(byStatus[state], total)}%)`;
  const rings = donutStrokes(segments, circumference).map(({ state, dashLength, gapLength, offset }) => `<circle class="ui1-ring__${state.toLowerCase()}" cx="80" cy="80" r="62" pathLength="${circumference}" fill="none" stroke-width="16" stroke-linecap="butt" stroke-dasharray="${dashLength} ${gapLength}" stroke-dashoffset="${-offset}" ${chartDetail("rooms", roomDetail(state))} />`).join("");
  const rows = ROOM_STATES.map((state) => `<li ${chartDetail("rooms", roomDetail(state))}><i class="ui1-dot ui1-dot--${state.toLowerCase()}" aria-hidden="true"></i><span>${ROOM_LABELS[state]}</span><strong>${number(byStatus[state])}</strong></li>`).join("");
  return `<div class="ui1-room-layout"><div class="ui1-ring"><svg role="img" aria-label="Tình trạng ${total} phòng" viewBox="0 0 160 160"><circle cx="80" cy="80" r="62" fill="none" stroke="var(--ui1-track)" stroke-width="16" />${rings}</svg><span><strong>${number(total)}</strong> phòng</span></div><ul class="ui1-legend">${rows}</ul></div>${hoverReadout("rooms")}<table class="ui2-sr-only"><caption>Tình trạng phòng</caption><tbody>${ROOM_STATES.map((state) => `<tr><th>${ROOM_LABELS[state]}</th><td>${byStatus[state]}</td></tr>`).join("")}</tbody></table>`;
}

function billMarkup(bills) {
  if (!bills.total) return `<p class="ui1-note">Chưa có phiếu định kỳ trong kỳ này.</p>`;
  const labels = { paid: "Đã thu", outstanding: "Còn nợ", overdue: "Quá hạn" };
  const segments = billSegments(bills);
  const billDetail = (key) => `${labels[key]}: ${number(bills[key])}/${number(bills.total)} phiếu định kỳ (${percent(bills[key], bills.total)}%)`;
  return `<div class="ui1-bar" role="img" aria-label="${bills.total} phiếu định kỳ: đã thu ${bills.paid}, còn nợ ${bills.outstanding}, quá hạn ${bills.overdue}">${segments.map(({ key, count, width }) => `<span class="ui1-bar__${{ paid: "daThu", outstanding: "conNo", overdue: "quaHan" }[key]}" style="width:${width}%" ${chartDetail("bills", billDetail(key))}>${number(count)}</span>`).join("")}</div><ul class="ui1-legend ui1-legend--horizontal">${Object.entries(labels).map(([key, label]) => `<li ${chartDetail("bills", billDetail(key))}><i class="ui1-dot ui1-dot--${{ paid: "daThu", outstanding: "conNo", overdue: "quaHan" }[key]}" aria-hidden="true"></i><span>${label}</span><strong>${number(bills[key])}</strong></li>`).join("")}</ul>${hoverReadout("bills")}<table class="ui2-sr-only"><caption>Phiếu định kỳ trong kỳ</caption><tbody>${Object.entries(labels).map(([key, label]) => `<tr><th>${label}</th><td>${bills[key]}</td></tr>`).join("")}</tbody></table>`;
}

function cashflowMarkup(rows) {
  const scale = cashflowScale(rows);
  const zero = scale.y(0);
  const labels = rows.map((row) => `T${Number(row.month.slice(5))}`);
  const monthDetail = (row) => `Tháng ${row.month.slice(5)}/${row.month.slice(0, 4)}: Thu ${formatVnd(row.totalRevenue)}; Chi ${formatVnd(row.totalExpenses)}; Lợi nhuận ${formatVnd(row.profit)}`;
  const points = rows.map((row, index) => `${70 + index * 112},${scale.y(row.profit)}`).join(" ");
  const bars = rows.map((row, index) => {
    const x = 42 + index * 112;
    return [[row.totalRevenue, x, "revenue"], [row.totalExpenses, x + 27, "expense"]].map(([value, left, kind]) => {
      const y = scale.y(value);
      return `<rect class="ui2-chart__${kind}" x="${left}" y="${Math.min(zero, y)}" width="25" height="${Math.abs(zero - y)}" />`;
    }).join("");
  }).join("");
  const table = `<table class="ui2-sr-only"><caption>Thu chi sáu tháng</caption><thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Lợi nhuận</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.month)}</th><td>${row.totalRevenue}</td><td>${row.totalExpenses}</td><td>${row.profit}</td></tr>`).join("")}</tbody></table>`;
  const unassigned = rows.some((row) => row.unassignedExpenses?.total > 0)
    ? `<p class="ui1-note">Có chi phí toàn chuỗi chưa phân căn; khoản này được báo cáo riêng, không tính vào tổng chi của từng Chủ trọ khi có nhiều Chủ trọ.</p>` : "";
  return `<div class="ui2-chart-legend"><span><i class="ui1-dot ui1-dot--daThu"></i>Thu</span><span><i class="ui1-dot ui2-dot--expense"></i>Chi</span><span><i class="ui1-dot ui2-dot--profit"></i>Lợi nhuận</span></div><svg class="ui2-chart" viewBox="0 0 720 260" role="img" aria-label="Thu, chi và lợi nhuận trong sáu tháng; số chính xác nằm trong bảng đi kèm"><line class="ui2-chart__grid" x1="20" x2="700" y1="20" y2="20" /><line class="ui2-chart__grid" x1="20" x2="700" y1="65" y2="65" /><line class="ui2-chart__zero" x1="20" x2="700" y1="${zero}" y2="${zero}" /><line class="ui2-chart__grid" x1="20" x2="700" y1="155" y2="155" /><line class="ui2-chart__grid" x1="20" x2="700" y1="200" y2="200" />${bars}<polyline class="ui2-chart__profit" points="${points}" />${rows.map((row, index) => `<circle class="ui2-chart__point" cx="${70 + index * 112}" cy="${scale.y(row.profit)}" r="4" />`).join("")}${rows.map((row, index) => `<rect class="ui2-chart__hover-column" x="${20 + index * 112}" y="10" width="100" height="210" ${chartDetail("cashflow", monthDetail(row))} />`).join("")}${labels.map((label, index) => `<text x="${70 + index * 112}" y="232" text-anchor="middle">${label}</text>`).join("")}</svg>${hoverReadout("cashflow")}${table}${unassigned}${rows.every((row) => row.totalRevenue === 0 && row.totalExpenses === 0) ? `<p class="ui1-note">Chưa có thu hoặc chi trong sáu tháng này.</p>` : ""}`;
}

function occupancyMarkup(rows) {
  if (!rows.length) return `<p class="ui1-note">Chưa có căn trọ để so sánh.</p>`;
  const group = (selected) => rows.filter((row) => row.inComparison === selected).map((row) => `<li ${chartDetail("buildingOccupancy", `${row.buildingName}: ${number(row.rented)}/${number(row.total)} phòng đang thuê (${number(row.pct)}%)${row.inComparison ? "" : "; ngừng hoạt động, không tham gia so sánh"}`)}><span>${escapeHtml(row.buildingName)}</span><span class="ui2-occupancy-track" role="img" aria-label="${number(row.rented)} trên ${number(row.total)} phòng đang thuê"><i style="width:${row.pct}%"></i></span><strong>${number(row.pct)}%</strong><small>${number(row.rented)}/${number(row.total)} phòng</small></li>`).join("");
  const active = group(true); const inactive = group(false);
  return `${active ? `<ul class="ui2-occupancy-list">${active}</ul>` : `<p class="ui1-note">Không có căn đang hoạt động để so sánh.</p>`}${inactive ? `<h3 class="ui2-subheading">Ngừng hoạt động, không tham gia so sánh</h3><ul class="ui2-occupancy-list">${inactive}</ul>` : ""}${hoverReadout("buildingOccupancy")}<table class="ui2-sr-only"><caption>Lấp đầy theo căn</caption><thead><tr><th>Căn</th><th>Đang thuê</th><th>Tổng phòng</th><th>Tỷ lệ</th></tr></thead><tbody>${rows.map((row) => `<tr><th>${escapeHtml(row.buildingName)}</th><td>${row.rented}</td><td>${row.total}</td><td>${row.pct}%</td></tr>`).join("")}</tbody></table>`;
}

function forecastMarkup(forecast) {
  const max = Math.max(1, forecast.d90);
  return `<ul class="ui2-forecast">${[["d30", "30"], ["d60", "60"], ["d90", "90"]].map(([key, days]) => `<li ${chartDetail("contracts", `Trong ${days} ngày: ${number(forecast[key])} hợp đồng; dự báo cộng dồn`)}><span>Trong ${days} ngày</span><span class="ui2-forecast-track" role="img" aria-label="${number(forecast[key])} hợp đồng trong ${days} ngày"><i style="width:${forecast[key] * 100 / max}%"></i></span><strong>${number(forecast[key])}</strong></li>`).join("")}</ul>${hoverReadout("contracts")}<p class="ui1-note">Dự báo cộng dồn; gồm hợp đồng đang hiệu lực và sắp hết hạn.</p><table class="ui2-sr-only"><caption>Dự báo hợp đồng</caption><tbody><tr><th>30 ngày</th><td>${forecast.d30}</td></tr><tr><th>60 ngày</th><td>${forecast.d60}</td></tr><tr><th>90 ngày</th><td>${forecast.d90}</td></tr></tbody></table>`;
}

function incidentsMarkup(incidents) {
  const states = ["CHO_TIEP_NHAN", "DANG_XU_LY", "DA_XU_LY", "KHAC"];
  return `<div class="ui1-incident-layout"><div><p class="ui1-note">Tình trạng xử lý ${number(incidents.total)} sự cố</p><ul class="ui1-status-list">${states.map((status) => `<li ${chartDetail("incidents", `${INCIDENT_LABELS[status]}: ${number(incidents.byStatus[status])}/${number(incidents.total)} sự cố (${percent(incidents.byStatus[status], incidents.total)}%)`)}><a href="#/operations/incidents${status === "KHAC" ? "" : `?status=${encodeURIComponent(status)}`}" class="ui2-incident-link">${INCIDENT_LABELS[status]}</a><span class="ui1-status-track" role="img" aria-label="${number(incidents.byStatus[status])} sự cố ${INCIDENT_LABELS[status]}"><i class="ui1-status-fill ui1-status-fill--${status.toLowerCase()}" style="width:${incidents.total ? incidents.byStatus[status] / incidents.total * 100 : 0}%"></i></span><strong>${number(incidents.byStatus[status])}</strong></li>`).join("")}</ul><table class="ui2-sr-only"><caption>Tình trạng sự cố</caption><tbody>${states.map((status) => `<tr><th>${INCIDENT_LABELS[status]}</th><td>${incidents.byStatus[status]}</td></tr>`).join("")}</tbody></table></div><div><h3>Sự cố gần đây</h3>${incidents.recent.length ? `<ul class="ui1-recent">${incidents.recent.map((row) => `<li ${chartDetail("incidents", `${row.text}${row.room ? ` · Phòng ${row.room}` : ""} · ${INCIDENT_LABELS[row.status]} · ${formatBusinessDate(row.date)}`)}><a class="ui2-incident-link" href="#/operations/incidents?search=${encodeURIComponent(row.text)}"><strong>${escapeHtml(row.text)}</strong><span>${row.room ? `Phòng ${escapeHtml(row.room)} · ` : ""}${INCIDENT_LABELS[row.status]} · ${formatBusinessDate(row.date)}</span></a></li>`).join("")}</ul>` : `<p class="ui1-note">Chưa có sự cố.</p>`}</div></div>${hoverReadout("incidents")}`;
}

function tasksMarkup(tasks, warningDays) {
  if (!tasks.length) return `<p class="ui1-note">Không có việc cần xử lý.</p>`;
  const rows = tasks.map((task, index) => `<li ${index >= 5 ? "data-task-extra hidden" : ""}><a class="ui2-task-link" href="#${taskRoutes[task.type]}"><span class="ui2-task-icon" aria-hidden="true">!</span><span><strong>${TASK_DETAILS[task.type][0]}</strong><small>${TASK_DETAILS[task.type][1]}${task.type === "EXPIRING_CONTRACTS" ? ` · ngưỡng ${warningDays} ngày` : ""}</small></span><b>${number(task.count)}</b></a></li>`).join("");
  return `<ul class="ui2-task-list">${rows}</ul>${tasks.length > 5 ? `<button class="ui2-show-more" type="button" data-tasks-toggle aria-expanded="false">Xem thêm ${number(tasks.length - 5)} mục</button>` : ""}`;
}

const sourcePanels = {
  summary: ["totalRooms", "rentedRooms", "occupancy", "rooms"],
  insights: ["revenue", "overdue", "cashflow", "buildingOccupancy", "bills", "contracts", "tasks"],
  incidents: ["incidents"],
};
const chartPanels = new Set(["rooms", "cashflow", "buildingOccupancy", "bills", "contracts", "incidents"]);

export default {
  id: "dashboard", route: "/overview/dashboard", title: "Tổng quan", tabLabel: "Tổng quan",
  group: "overview", order: 10, roles: ["CHU_TRO"],

  async render(context) {
    this.listeners?.abort();
    this.listeners = new AbortController();
    const period = currentPeriod();
    context.main.innerHTML = `<div class="ui1-dashboard ui2-dashboard"><div class="ui1-toolbar"><span>Kỳ ${escapeHtml(period)}</span></div><div class="ui1-kpis">${kpi("totalRooms", "Tổng số phòng", "Tổng danh mục đang quản lý")}${kpi("rentedRooms", "Đang thuê", "Phòng ở trạng thái đang thuê")}${kpi("occupancy", "Tỷ lệ lấp đầy", "Trên tổng số phòng")}${kpi("revenue", "Doanh thu thực nhận", "Trong kỳ này; đã trừ giảm trừ")}${kpi("overdue", "Công nợ quá hạn", "Phiếu định kỳ cần kiểm tra")}</div><div class="ui2-row ui2-row--chart">${panel("cashflow", "Thu - chi theo tháng", "Doanh thu, chi phí và lợi nhuận 6 tháng gần nhất")}${panel("rooms", "Tình trạng phòng", "Tổng quan các trạng thái phòng")}</div><div class="ui2-row ui2-row--three">${panel("buildingOccupancy", "Lấp đầy theo căn", "Tỷ lệ phòng đã cho thuê theo từng căn")}${panel("bills", "Phiếu thu kỳ này", "Chỉ phiếu định kỳ; ba nhóm không giao nhau")}${panel("contracts", "Hợp đồng sắp hết hạn", "Dự báo trong 30, 60 và 90 ngày")}</div><div class="ui2-row ui2-row--last">${panel("incidents", "Sự cố", "Theo trạng thái và ba sự cố mới nhất")}${panel("tasks", "Việc cần xử lý", "Đầu mục cần theo dõi và hoàn thành")}</div></div>`;
    const set = (id, html) => { const element = context.main.querySelector(`[data-body="${id}"]`); if (element) element.innerHTML = html; };
    const errorMarkup = (source, error) => `<div class="ui1-error" role="alert"><p>${escapeHtml(dashboardError(error))}</p><button type="button" data-retry="${source}">Thử lại</button></div>`;
    const renderCards = (source, definitions) => {
      for (const [id, render] of Object.entries(definitions)) {
        try { set(id, render()); } catch (error) { set(id, errorMarkup(source, error)); }
      }
    };
    const load = async (source) => {
      sourcePanels[source].forEach((id) => set(id, `<p class="ui1-loading">Đang tải...</p>`));
      try {
        if (source === "summary") {
          const summary = readSummary(await context.api.get(`/v1/dashboard/summary?period=${period}`));
          renderCards(source, { totalRooms: () => `<strong class="ui1-kpi__value">${number(summary.rooms.total)}</strong>`,
            rentedRooms: () => `<strong class="ui1-kpi__value">${number(summary.rooms.byStatus.DANG_THUE)}</strong>`,
            occupancy: () => `<strong class="ui1-kpi__value">${number(summary.occupancyPercent)}%</strong>`, rooms: () => roomMarkup(summary) });
        }
        if (source === "insights") {
          const insights = readInsights(await context.api.get(`/v1/dashboard/insights?period=${period}`));
          const change = insights.revenueChangePct;
          renderCards(source, { revenue: () => `<strong class="ui1-kpi__value ui1-kpi__value--money">${formatVnd(insights.cashflow6m[5].totalRevenue)}</strong><span class="ui2-trend">${change === null ? "Chưa có kỳ trước để so sánh" : `${change > 0 ? "+" : ""}${number(change)}% so với tháng trước`}</span>`,
            overdue: () => `<strong class="ui1-kpi__value ${insights.billBuckets.overdue > 0 ? "ui1-kpi__value--danger" : ""}">${number(insights.billBuckets.overdue)} <small>phiếu</small></strong>`,
            cashflow: () => cashflowMarkup(insights.cashflow6m), buildingOccupancy: () => occupancyMarkup(insights.occupancyByBuilding),
            bills: () => billMarkup(insights.billBuckets), contracts: () => forecastMarkup(insights.contractForecast),
            tasks: () => tasksMarkup(insights.tasks, insights.contractWarningDays) });
        }
        if (source === "incidents") {
          const incidents = readIncidents(await context.api.get("/v1/incidents"));
          renderCards(source, { incidents: () => incidentsMarkup(incidents) });
        }
      } catch (error) {
        sourcePanels[source].forEach((id) => set(id, errorMarkup(source, error)));
      }
    };
    context.main.addEventListener("click", (event) => {
      const retry = event.target.closest("[data-retry]");
      if (retry && Object.hasOwn(sourcePanels, retry.dataset.retry)) { load(retry.dataset.retry); return; }
      const toggle = event.target.closest("[data-tasks-toggle]");
      if (toggle) {
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        context.main.querySelectorAll("[data-task-extra]").forEach((item) => { item.hidden = !expanded; });
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.textContent = expanded ? "Thu gọn" : "Xem thêm";
      }
    }, { signal: this.listeners.signal });
    const detailTarget = (event) => {
      const target = event.target.closest?.("[data-chart-detail]");
      return target && chartPanels.has(target.dataset.chartPanel) ? target : null;
    };
    const showDetail = (event) => {
      const target = detailTarget(event);
      if (!target) return;
      const readout = context.main.querySelector(`[data-hover-readout="${target.dataset.chartPanel}"]`);
      if (readout) {
        readout.textContent = target.dataset.chartDetail;
      }
    };
    const clearDetail = (event) => {
      const target = detailTarget(event);
      if (!target || target.contains?.(event.relatedTarget)) return;
      const readout = context.main.querySelector(`[data-hover-readout="${target.dataset.chartPanel}"]`);
      if (readout?.textContent === target.dataset.chartDetail) {
        readout.textContent = "";
      }
    };
    context.main.addEventListener("mouseover", showDetail, { signal: this.listeners.signal });
    context.main.addEventListener("focusin", showDetail, { signal: this.listeners.signal });
    context.main.addEventListener("mouseout", clearDetail, { signal: this.listeners.signal });
    context.main.addEventListener("focusout", clearDetail, { signal: this.listeners.signal });
    await Promise.all(Object.keys(sourcePanels).map(load));
  },
};
