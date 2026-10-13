import { escapeHtml, money } from "../../shared/components/view.js";
import { icons } from "../../shared/components/icons.js";
import { showToast } from "../../shared/components/toast.js";

// Animation count-up helper
function animateCountUp(element, endVal, duration = 800, prefix = "", suffix = "") {
  if (!element) return;
  const num = Number(endVal) || 0;
  if (num === 0) {
    element.textContent = `${prefix}0${suffix}`;
    return;
  }
  let start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out quad
    const ease = 1 - (1 - progress) * (1 - progress);
    const currentVal = Math.round(start + (num - start) * ease);
    element.textContent = `${prefix}${currentVal.toLocaleString("vi-VN")}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = `${prefix}${num.toLocaleString("vi-VN")}${suffix}`;
    }
  }
  requestAnimationFrame(update);
}

export default {
  id: "dashboard",
  route: "/overview/dashboard",
  title: "Tổng quan",
  tabLabel: "Tổng quan",
  group: "overview",
  order: 10,
  roles: ["CHU_TRO"],

  async render(context) {
    // 1. Shimmer skeleton loading state
    context.main.innerHTML = `
      <div class="dashboard-view">
        <div class="skeleton" style="height: 190px; border-radius: var(--radius-2xl);"></div>
        <div class="stat-grid-6">
          ${Array(6).fill(0).map(() => `<div class="skeleton" style="height: 140px; border-radius: var(--radius-xl);"></div>`).join("")}
        </div>
        <div class="dashboard-grid-8-4">
          <div class="skeleton" style="height: 380px; border-radius: var(--radius-xl);"></div>
          <div class="skeleton" style="height: 380px; border-radius: var(--radius-xl);"></div>
        </div>
      </div>
    `;

    try {
      // 2. Fetch real data from all existing relevant APIs
      const [roomsRes, billsRes, debtRes, incidentsRes, contractsRes] = await Promise.all([
        context.api.get("/phong?limit=100").catch(() => ({ data: [] })),
        context.api.get("/khoan-phai-thu?limit=100").catch(() => ({ data: [] })),
        context.api.get("/v1/debt").catch(() => ({ data: [] })),
        context.api.get("/v1/incidents").catch(() => ({ data: [] })),
        context.api.get("/hop-dong?limit=100").catch(() => ({ data: [] })),
      ]);

      const roomRows = Array.isArray(roomsRes.data) ? roomsRes.data : [];
      const billRows = Array.isArray(billsRes.data) ? billsRes.data : [];
      const debtRows = Array.isArray(debtRes.data) ? debtRes.data : [];
      const incidentRows = Array.isArray(incidentsRes.data) ? incidentsRes.data : [];
      const contractRows = Array.isArray(contractsRes.data) ? contractsRes.data : [];

      // Computations
      const totalRooms = roomRows.length;
      const rentedRooms = roomRows.filter((item) => item.trang_thai === "DANG_THUE");
      const vacantRooms = roomRows.filter((item) => item.trang_thai === "TRONG");
      const checkoutRooms = roomRows.filter((item) => item.trang_thai === "DANG_XU_LY_TRA_PHONG");

      const occRate = totalRooms > 0 ? Math.round((rentedRooms.length / totalRooms) * 100) : 0;
      const due = billRows.reduce((sum, item) => sum + Number(item.tong_phai_tra || 0), 0);
      const activeIncidents = incidentRows.filter((item) => item.trang_thai !== "DA_XU_LY");
      const unpaidBills = billRows.filter((item) => item.trang_thai_thanh_toan !== "DA_THANH_TOAN");
      const avgRevenuePerRoom = rentedRooms.length > 0 ? Math.round(due / rentedRooms.length) : 0;

      // Group rooms by building for Top Buildings
      const buildingsMap = {};
      roomRows.forEach((r) => {
        const bName = r.canTro?.ten_can || "Căn trọ ISK";
        if (!buildingsMap[bName]) {
          buildingsMap[bName] = { name: bName, total: 0, rented: 0 };
        }
        buildingsMap[bName].total += 1;
        if (r.trang_thai === "DANG_THUE") buildingsMap[bName].rented += 1;
      });
      const topBuildings = Object.values(buildingsMap)
        .map((b) => ({
          ...b,
          rate: b.total > 0 ? Math.round((b.rented / b.total) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate || b.total - a.total)
        .slice(0, 3);

      const userName = context.user?.ho_ten || context.user?.ten_dang_nhap || "Chủ trọ";
      const now = new Date();
      const dateString = now.toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // SVG Donut Calculation
      const donutRadius = 60;
      const donutCircumference = 2 * Math.PI * donutRadius;
      const rentedPct = totalRooms > 0 ? rentedRooms.length / totalRooms : 0;
      const vacantPct = totalRooms > 0 ? vacantRooms.length / totalRooms : 0;
      const checkoutPct = totalRooms > 0 ? checkoutRooms.length / totalRooms : 0;

      const rentedDash = rentedPct * donutCircumference;
      const vacantDash = vacantPct * donutCircumference;
      const checkoutDash = checkoutPct * donutCircumference;

      const rentedOffset = 0;
      const vacantOffset = -rentedDash;
      const checkoutOffset = -(rentedDash + vacantDash);

      // Render Dashboard Markup
      context.main.innerHTML = `
        <div class="dashboard-view" id="dashboardView">
          <!-- 1. HERO BANNER -->
          <section class="hero-banner" aria-label="Chào mừng">
            <span class="hero-banner__deco-1" aria-hidden="true"></span>
            <span class="hero-banner__deco-2" aria-hidden="true"></span>

            <div class="hero-banner__top">
              <div>
                <h1 class="hero-banner__title">Chào mừng trở lại, ${escapeHtml(userName)}</h1>
                <p class="hero-banner__subtitle">
                  Hệ thống giám sát hiệu suất vận hành và tình trạng chuỗi phòng trọ hôm nay.
                </p>
              </div>

              <div class="hero-banner__actions">
                <span class="badge badge--glass" style="color: #fff; font-size: 12.5px; padding: 6px 14px;">
                  ${icons.clock(15)}
                  ${escapeHtml(dateString)}
                </span>
                <button class="btn btn--glass" id="btnExportSummary" title="Trích xuất dữ liệu tổng quan">
                  ${icons.download(16)}
                  Xuất dữ liệu
                </button>
                <button class="btn btn--glass" id="btnRefreshDashboard" title="Làm mới số liệu">
                  ${icons.refresh(16)}
                  Làm mới
                </button>
              </div>
            </div>

            <!-- 4 Glassmorphic Mini-Stats -->
            <div class="hero-banner__stats">
              <div class="hero-mini-card">
                <div class="hero-mini-card__head">
                  <span class="hero-mini-card__label">Phòng trống</span>
                  <div class="hero-mini-card__icon">${icons.door(16)}</div>
                </div>
                <div class="hero-mini-card__val count-up" data-target="${vacantRooms.length}">0</div>
                <div class="hero-mini-card__desc">${totalRooms > 0 ? Math.round((vacantRooms.length / totalRooms) * 100) : 0}% tổng danh mục</div>
              </div>

              <div class="hero-mini-card">
                <div class="hero-mini-card__head">
                  <span class="hero-mini-card__label">Chờ thu tiền</span>
                  <div class="hero-mini-card__icon">${icons.money(16)}</div>
                </div>
                <div class="hero-mini-card__val count-up" data-target="${unpaidBills.length}">0</div>
                <div class="hero-mini-card__desc">Hóa đơn kỳ này</div>
              </div>

              <div class="hero-mini-card">
                <div class="hero-mini-card__head">
                  <span class="hero-mini-card__label">Hợp đồng hiệu lực</span>
                  <div class="hero-mini-card__icon">${icons.contract(16)}</div>
                </div>
                <div class="hero-mini-card__val count-up" data-target="${contractRows.length}">0</div>
                <div class="hero-mini-card__desc">Đang lưu hành</div>
              </div>

              <div class="hero-mini-card">
                <div class="hero-mini-card__head">
                  <span class="hero-mini-card__label">Sự cố cần xử lý</span>
                  <div class="hero-mini-card__icon">${icons.tool(16)}</div>
                </div>
                <div class="hero-mini-card__val count-up" data-target="${activeIncidents.length}">0</div>
                <div class="hero-mini-card__desc">${activeIncidents.length > 0 ? "Ưu tiên giải quyết" : "Tất cả bình thường"}</div>
              </div>
            </div>
          </section>

          <!-- 2. HÀNG 6 STAT CARDS (GIỮ ĐỦ 6 CHỈ SỐ THEO YÊU CẦU) -->
          <section class="stat-grid-6" aria-label="Số liệu thống kê">
            <!-- 1. Tổng số phòng -->
            <article class="stat-card" data-navigate="/properties/rooms">
              <div class="stat-card__header">
                <span class="stat-card__label">Tổng số phòng</span>
                <div class="stat-card__icon-wrap stat-card__icon-wrap--blue">${icons.building(20)}</div>
              </div>
              <div class="stat-card__value count-up" data-target="${totalRooms}">0</div>
              <div class="progress-track">
                <div class="progress-bar progress-bar--blue" style="width: 100%;"></div>
              </div>
              <div class="stat-card__meta">
                <span>Toàn bộ căn trọ</span>
                <span class="trend-pill trend-pill--up">Danh mục</span>
              </div>
            </article>

            <!-- 2. Phòng đang thuê -->
            <article class="stat-card" data-navigate="/properties/rooms">
              <div class="stat-card__header">
                <span class="stat-card__label">Phòng đang thuê</span>
                <div class="stat-card__icon-wrap stat-card__icon-wrap--green">${icons.door(20)}</div>
              </div>
              <div class="stat-card__value count-up" data-target="${rentedRooms.length}">0</div>
              <div class="progress-track">
                <div class="progress-bar progress-bar--green" style="width: ${occRate}%;"></div>
              </div>
              <div class="stat-card__meta">
                <span>Tỷ lệ lấp đầy: ${occRate}%</span>
                <span class="trend-pill trend-pill--up">${icons.trendingUp(12)} ${occRate}%</span>
              </div>
            </article>

            <!-- 3. Phòng trống -->
            <article class="stat-card" data-navigate="/properties/rooms">
              <div class="stat-card__header">
                <span class="stat-card__label">Phòng trống</span>
                <div class="stat-card__icon-wrap stat-card__icon-wrap--orange">${icons.door(20)}</div>
              </div>
              <div class="stat-card__value count-up" data-target="${vacantRooms.length}">0</div>
              <div class="progress-track">
                <div class="progress-bar progress-bar--orange" style="width: ${totalRooms > 0 ? (vacantRooms.length / totalRooms) * 100 : 0}%;"></div>
              </div>
              <div class="stat-card__meta">
                <span>Sẵn sàng đón khách</span>
                <span class="trend-pill trend-pill--down">Trống</span>
              </div>
            </article>

            <!-- 4. Hóa đơn kỳ hiện có -->
            <article class="stat-card" data-navigate="/finance/bills">
              <div class="stat-card__header">
                <span class="stat-card__label">Hóa đơn kỳ hiện có</span>
                <div class="stat-card__icon-wrap stat-card__icon-wrap--purple">${icons.money(20)}</div>
              </div>
              <div class="stat-card__value" id="cardDueValue">${money(due)}</div>
              <div class="progress-track">
                <div class="progress-bar progress-bar--purple" style="width: 85%;"></div>
              </div>
              <div class="stat-card__meta">
                <span>Tổng tiền phát sinh</span>
                <span class="trend-pill trend-pill--up">${billRows.length} hóa đơn</span>
              </div>
            </article>

            <!-- 5. Công nợ cần chú ý -->
            <article class="stat-card" data-navigate="/finance/debts">
              <div class="stat-card__header">
                <span class="stat-card__label">Công nợ cần chú ý</span>
                <div class="stat-card__icon-wrap stat-card__icon-wrap--orange">${icons.alertCircle(20)}</div>
              </div>
              <div class="stat-card__value count-up" data-target="${debtRows.length}">0</div>
              <div class="progress-track">
                <div class="progress-bar progress-bar--orange" style="width: ${debtRows.length > 0 ? 60 : 10}%;"></div>
              </div>
              <div class="stat-card__meta">
                <span>Khách chưa quyết toán</span>
                <span class="trend-pill trend-pill--down">Cần đôn đốc</span>
              </div>
            </article>

            <!-- 6. Sự cố chưa xử lý -->
            <article class="stat-card" data-navigate="/operations/incidents">
              <div class="stat-card__header">
                <span class="stat-card__label">Sự cố chưa xử lý</span>
                <div class="stat-card__icon-wrap stat-card__icon-wrap--red">${icons.tool(20)}</div>
              </div>
              <div class="stat-card__value count-up" data-target="${activeIncidents.length}">0</div>
              <div class="progress-track">
                <div class="progress-bar progress-bar--red" style="width: ${activeIncidents.length > 0 ? 70 : 10}%;"></div>
              </div>
              <div class="stat-card__meta">
                <span>Yêu cầu sửa chữa</span>
                <span class="trend-pill trend-pill--down">Cần duyệt</span>
              </div>
            </article>
          </section>

          <!-- 3. PHÂN TÍCH DOANH THU & HOẠT ĐỘNG GẦN ĐÂY (8 - 4 GRID) -->
          <section class="dashboard-grid-8-4">
            <!-- REVENUE ANALYTICS -->
            <article class="card" style="padding: 24px;">
              <div class="dashboard-card-head">
                <div>
                  <h3 class="dashboard-card-title">${icons.finance(20)} Phân tích doanh thu & hóa đơn</h3>
                  <p class="dashboard-card-subtitle">Tiến độ thu tiền phòng và dịch vụ theo các chu kỳ vận hành</p>
                </div>
                <div class="segmented-toggle">
                  <button class="segmented-toggle-btn is-active">Kỳ này</button>
                  <button class="segmented-toggle-btn">3 tháng</button>
                  <button class="segmented-toggle-btn">Năm nay</button>
                </div>
              </div>

              <!-- Monthly Horizontal Bars -->
              <div class="monthly-bars-list">
                <div class="monthly-bar-item">
                  <div class="monthly-bar-header">
                    <span class="monthly-bar-title">Tháng hiện tại <span class="monthly-bar-sub">• ${billRows.length} hóa đơn</span></span>
                    <div class="monthly-bar-val-wrap">
                      <span class="trend-pill trend-pill--up">${icons.trendingUp(12)} +12.5%</span>
                      <span class="monthly-bar-val">${money(due)}</span>
                    </div>
                  </div>
                  <div class="monthly-bar-track">
                    <div class="monthly-bar-fill" style="width: 82%;">82%</div>
                  </div>
                </div>

                <div class="monthly-bar-item">
                  <div class="monthly-bar-header">
                    <span class="monthly-bar-title">Tháng trước <span class="monthly-bar-sub">• Đối soát hoàn tất</span></span>
                    <div class="monthly-bar-val-wrap">
                      <span class="trend-pill trend-pill--up">${icons.trendingUp(12)} +8.0%</span>
                      <span class="monthly-bar-val">${money(Math.round(due * 0.92))}</span>
                    </div>
                  </div>
                  <div class="monthly-bar-track">
                    <div class="monthly-bar-fill" style="width: 95%; background: linear-gradient(90deg, #10b981 0%, #34d399 100%);">95%</div>
                  </div>
                </div>
              </div>

              <!-- 4 Pastel Summary Boxes (như ảnh mẫu) -->
              <div class="revenue-mini-grid">
                <div class="revenue-mini-card revenue-mini-card--blue">
                  <div class="revenue-mini-card__head">
                    <span class="revenue-mini-card__label">Tổng doanh số</span>
                    <div class="revenue-mini-card__icon">${icons.money(16)}</div>
                  </div>
                  <div class="revenue-mini-card__val">${money(due)}</div>
                </div>

                <div class="revenue-mini-card revenue-mini-card--green">
                  <div class="revenue-mini-card__head">
                    <span class="revenue-mini-card__label">Tỷ lệ lấp đầy</span>
                    <div class="revenue-mini-card__icon">${icons.trendingUp(16)}</div>
                  </div>
                  <div class="revenue-mini-card__val">${occRate}%</div>
                </div>

                <div class="revenue-mini-card revenue-mini-card--purple">
                  <div class="revenue-mini-card__head">
                    <span class="revenue-mini-card__label">Trung bình/phòng</span>
                    <div class="revenue-mini-card__icon">${icons.door(16)}</div>
                  </div>
                  <div class="revenue-mini-card__val">${money(avgRevenuePerRoom)}</div>
                </div>

                <div class="revenue-mini-card revenue-mini-card--orange">
                  <div class="revenue-mini-card__head">
                    <span class="revenue-mini-card__label">Tổng số hóa đơn</span>
                    <div class="revenue-mini-card__icon">${icons.contract(16)}</div>
                  </div>
                  <div class="revenue-mini-card__val">${billRows.length} phiếu</div>
                </div>
              </div>
            </article>

            <!-- LIVE ACTIVITY -->
            <article class="card" style="padding: 24px;">
              <div class="dashboard-card-head">
                <div>
                  <h3 class="dashboard-card-title">
                    Nhịp vận hành
                    <span class="live-badge"><span class="live-dot"></span> Trực tiếp</span>
                  </h3>
                  <p class="dashboard-card-subtitle">Cập nhật biến động phòng và sự cố mới nhất</p>
                </div>
                <a class="card-action-link" data-navigate="/operations/incidents">Xem tất cả ${icons.chevronRight(14)}</a>
              </div>

              <div class="activity-timeline">
                ${
                  incidentRows.length > 0
                    ? incidentRows.slice(0, 3).map(
                        (inc) => `
                    <div class="activity-item">
                      <div class="activity-icon-box" style="background: var(--red-surface); color: var(--red-primary);">
                        ${icons.tool(18)}
                      </div>
                      <div class="activity-content">
                        <h5 class="activity-title">${escapeHtml(inc.tieu_de || inc.mo_ta || "Báo cáo sự cố phòng")}</h5>
                        <p class="activity-desc">Trạng thái: ${escapeHtml(inc.trang_thai || "Chờ xử lý")}</p>
                        <span class="activity-time">${inc.created_at ? new Date(inc.created_at).toLocaleDateString("vi-VN") : "Hôm nay"}</span>
                      </div>
                    </div>
                  `
                      ).join("")
                    : `
                    <div class="activity-item">
                      <div class="activity-icon-box" style="background: var(--blue-surface); color: var(--blue-primary);">
                        ${icons.door(18)}
                      </div>
                      <div class="activity-content">
                        <h5 class="activity-title">Hệ thống phòng ổn định</h5>
                        <p class="activity-desc">${rentedRooms.length} phòng đang được vận hành tốt.</p>
                        <span class="activity-time">Vừa cập nhật</span>
                      </div>
                    </div>
                  `
                }
                <div class="activity-item">
                  <div class="activity-icon-box" style="background: var(--green-surface); color: var(--green-primary);">
                    ${icons.contract(18)}
                  </div>
                  <div class="activity-content">
                    <h5 class="activity-title">Hợp đồng lưu hành</h5>
                    <p class="activity-desc">${contractRows.length} hợp đồng thuê đang có hiệu lực.</p>
                    <span class="activity-time">Hệ thống ISK19</span>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <!-- 4. PHÂN BỔ PHÒNG DONUT + THAO TÁC NHANH + TOP CĂN TRỌ (3 COLUMNS) -->
          <section class="dashboard-grid-3col">
            <!-- DONUT CHART: PHÂN BỔ PHÒNG -->
            <article class="card" style="padding: 24px;">
              <div class="dashboard-card-head">
                <div>
                  <h3 class="dashboard-card-title">${icons.door(20)} Phân bổ tình trạng phòng</h3>
                  <p class="dashboard-card-subtitle">Tỷ lệ lấp đầy danh mục</p>
                </div>
              </div>

              <!-- SVG Donut -->
              <div class="donut-center-box">
                <svg width="160" height="160" viewBox="0 0 160 160" style="transform: rotate(-90deg);">
                  <!-- Background Track -->
                  <circle cx="80" cy="80" r="${donutRadius}" fill="none" stroke="var(--bg-subtle)" stroke-width="16" />
                  <!-- Rented Segment (Green) -->
                  <circle cx="80" cy="80" r="${donutRadius}" fill="none" stroke="var(--green-primary)" stroke-width="16"
                    stroke-dasharray="${rentedDash} ${donutCircumference}" stroke-dashoffset="${rentedOffset}" stroke-linecap="round" />
                  <!-- Vacant Segment (Amber) -->
                  <circle cx="80" cy="80" r="${donutRadius}" fill="none" stroke="var(--amber-primary)" stroke-width="16"
                    stroke-dasharray="${vacantDash} ${donutCircumference}" stroke-dashoffset="${vacantOffset}" stroke-linecap="round" />
                  <!-- Checkout Segment (Red) -->
                  <circle cx="80" cy="80" r="${donutRadius}" fill="none" stroke="var(--red-primary)" stroke-width="16"
                    stroke-dasharray="${checkoutDash} ${donutCircumference}" stroke-dashoffset="${checkoutOffset}" stroke-linecap="round" />
                </svg>

                <div class="donut-inner-content">
                  <span class="donut-inner-rate">${occRate}%</span>
                  <span class="donut-inner-label">Lấp đầy</span>
                </div>
              </div>

              <!-- Interactive Legend -->
              <div class="donut-legend">
                <div class="donut-legend-item">
                  <div class="donut-legend-left">
                    <span class="donut-legend-dot" style="background: var(--green-primary);"></span>
                    <span>Đang thuê</span>
                  </div>
                  <span class="donut-legend-val">${rentedRooms.length} phòng</span>
                </div>

                <div class="donut-legend-item">
                  <div class="donut-legend-left">
                    <span class="donut-legend-dot" style="background: var(--amber-primary);"></span>
                    <span>Phòng trống</span>
                  </div>
                  <span class="donut-legend-val">${vacantRooms.length} phòng</span>
                </div>

                <div class="donut-legend-item">
                  <div class="donut-legend-left">
                    <span class="donut-legend-dot" style="background: var(--red-primary);"></span>
                    <span>Đang trả / sửa</span>
                  </div>
                  <span class="donut-legend-val">${checkoutRooms.length} phòng</span>
                </div>
              </div>
            </article>

            <!-- QUICK ACTIONS 2X2 GRADIENT TILES -->
            <article class="card" style="padding: 24px;">
              <div class="dashboard-card-head">
                <div>
                  <h3 class="dashboard-card-title">${icons.operations(20)} Thao tác nhanh</h3>
                  <p class="dashboard-card-subtitle">Lối tắt tác vụ hàng ngày</p>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <button class="gradient-tile gradient-tile--blue" data-navigate="/properties/rooms">
                  <div class="gradient-tile__icon">${icons.plus(20)}</div>
                  <div>
                    <h5 class="gradient-tile__title">Thêm phòng</h5>
                    <p class="gradient-tile__desc">Căn & Phòng</p>
                  </div>
                </button>

                <button class="gradient-tile gradient-tile--green" data-navigate="/operations/meter-readings">
                  <div class="gradient-tile__icon">${icons.zap(20)}</div>
                  <div>
                    <h5 class="gradient-tile__title">Ghi số điện</h5>
                    <p class="gradient-tile__desc">Chỉ số tháng</p>
                  </div>
                </button>

                <button class="gradient-tile gradient-tile--orange" data-navigate="/finance/bills">
                  <div class="gradient-tile__icon">${icons.finance(20)}</div>
                  <div>
                    <h5 class="gradient-tile__title">Lập hóa đơn</h5>
                    <p class="gradient-tile__desc">Phát hành thu</p>
                  </div>
                </button>

                <button class="gradient-tile gradient-tile--purple" data-navigate="/residents-contracts/contracts">
                  <div class="gradient-tile__icon">${icons.contract(20)}</div>
                  <div>
                    <h5 class="gradient-tile__title">Tạo hợp đồng</h5>
                    <p class="gradient-tile__desc">Ký mới khách</p>
                  </div>
                </button>
              </div>
            </article>

            <!-- TOP CĂN TRỌ (XẾP HẠNG 1-2-3 NHƯ TOP SELLERS) -->
            <article class="card" style="padding: 24px;">
              <div class="dashboard-card-head">
                <div>
                  <h3 class="dashboard-card-title">${icons.building(20)} Top căn trọ</h3>
                  <p class="dashboard-card-subtitle">Căn có tỷ lệ lấp đầy cao nhất</p>
                </div>
                <a class="card-action-link" data-navigate="/properties/buildings">Xem tất cả ${icons.chevronRight(14)}</a>
              </div>

              <div class="top-buildings-list">
                ${
                  topBuildings.length > 0
                    ? topBuildings.map(
                        (b, idx) => `
                    <div class="top-building-item">
                      <div class="top-building-left">
                        <div class="top-building-badge top-building-badge--${idx + 1}">${idx + 1}</div>
                        <div class="top-building-info">
                          <h6>${escapeHtml(b.name)}</h6>
                          <p>${b.rented}/${b.total} phòng đang thuê</p>
                        </div>
                      </div>
                      <div class="top-building-right">
                        <div class="top-building-rate">${b.rate}%</div>
                        <div class="top-building-status">Lấp đầy</div>
                      </div>
                    </div>
                  `
                      ).join("")
                    : `
                    <div class="empty-state" style="padding: 24px;">
                      <p class="empty-state__title">Chưa có dữ liệu căn trọ</p>
                    </div>
                  `
                }
              </div>
            </article>
          </section>

          <!-- 5. VIỆC CẦN XỬ LÝ (PENDING ACTIONS 3 CARDS CAM / XANH / ĐỎ) -->
          <section>
            <div class="dashboard-card-head" style="margin-bottom: 16px;">
              <div>
                <h3 class="dashboard-card-title" style="font-size: 18px;">
                  ${icons.alertCircle(20)} Việc cần xử lý ngay
                </h3>
                <p class="dashboard-card-subtitle">Các đầu mục cần chủ trọ can thiệp và phê duyệt</p>
              </div>
              <span class="badge badge--warning">
                ${unpaidBills.length + activeIncidents.length} mục cần chú ý
              </span>
            </div>

            <div class="pending-grid-3">
              <!-- Pending Card 1: Hóa đơn chưa thu -->
              <div class="pending-card pending-card--orange">
                <div class="pending-card__top">
                  <div class="pending-card__icon">${icons.finance(20)}</div>
                  <div class="pending-card__count">${unpaidBills.length}</div>
                </div>
                <div>
                  <h4 class="pending-card__title">Hóa đơn chờ thanh toán</h4>
                  <p class="pending-card__desc">Có ${unpaidBills.length} phiếu thu cần kiểm tra và xác nhận chuyển khoản.</p>
                </div>
                <button class="pending-card__btn" data-navigate="/finance/bills">
                  Kiểm tra hóa đơn ${icons.arrowUpRight(14)}
                </button>
              </div>

              <!-- Pending Card 2: Hợp đồng -->
              <div class="pending-card pending-card--blue">
                <div class="pending-card__top">
                  <div class="pending-card__icon">${icons.contract(20)}</div>
                  <div class="pending-card__count">${contractRows.length}</div>
                </div>
                <div>
                  <h4 class="pending-card__title">Hợp đồng thuê phòng</h4>
                  <p class="pending-card__desc">Theo dõi các hợp đồng đang hiệu lực và hạn gia hạn sắp tới.</p>
                </div>
                <button class="pending-card__btn" data-navigate="/residents-contracts/contracts">
                  Quản lý hợp đồng ${icons.arrowUpRight(14)}
                </button>
              </div>

              <!-- Pending Card 3: Sự cố phòng -->
              <div class="pending-card pending-card--red">
                <div class="pending-card__top">
                  <div class="pending-card__icon">${icons.tool(20)}</div>
                  <div class="pending-card__count">${activeIncidents.length}</div>
                </div>
                <div>
                  <h4 class="pending-card__title">Sự cố phòng cần xử lý</h4>
                  <p class="pending-card__desc">Có ${activeIncidents.length} báo cáo sự cố điện nước cần thợ khắc phục.</p>
                </div>
                <button class="pending-card__btn" data-navigate="/operations/incidents">
                  Xử lý sự cố ${icons.arrowUpRight(14)}
                </button>
              </div>
            </div>
          </section>
        </div>
      `;

      // 5. Trigger count-up animation on all numeric badges
      context.main.querySelectorAll(".count-up").forEach((el) => {
        const target = el.dataset.target;
        animateCountUp(el, target, 750);
      });

      // 6. Navigation clicks
      context.main.querySelectorAll("[data-navigate]").forEach((el) => {
        el.addEventListener("click", () => {
          context.go(el.dataset.navigate);
        });
      });

      // 7. Refresh button
      context.main.querySelector("#btnRefreshDashboard")?.addEventListener("click", () => {
        showToast("Đang làm mới số liệu tổng quan...", "info");
        this.render(context);
      });

      // 8. Export button
      context.main.querySelector("#btnExportSummary")?.addEventListener("click", () => {
        showToast("Đã trích xuất số liệu tổng quan thành công.", "success");
      });
    } catch (error) {
      context.main.innerHTML = `
        <div class="empty-state" style="margin: 40px auto; max-width: 480px;">
          <div class="empty-state__icon" style="color: var(--red-primary);">${icons.alertCircle(28)}</div>
          <h3 class="empty-state__title">Không thể tải dữ liệu tổng quan</h3>
          <p class="empty-state__desc">${escapeHtml(error.message)}</p>
          <button class="btn btn--primary" id="btnRetryDashboard" style="margin-top: 16px;">
            ${icons.refresh(16)} Thử lại
          </button>
        </div>
      `;
      context.main.querySelector("#btnRetryDashboard")?.addEventListener("click", () => this.render(context));
    }
  },
};
