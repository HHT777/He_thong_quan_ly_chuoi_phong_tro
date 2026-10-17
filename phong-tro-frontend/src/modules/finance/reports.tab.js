import { shellPage, escapeHtml, money, date } from "../../shared/components/view.js";

const meta = { id: "reports", route: "/finance/reports", title: "Báo cáo", tabLabel: "Báo cáo", group: "finance", order: 45, roles: ["CHU_TRO"] };
const currentDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

function summaryMarkup(data) {
  const cards = [
    ["Doanh thu thực nhận", data.totalRevenue ?? data.totalCollected ?? 0, "Đã trừ giảm trừ"],
    ["Doanh thu gộp", data.grossRevenue ?? 0, "Trước giảm trừ"],
    ["Giảm trừ", data.discounts ?? 0, "Đã phân bổ theo lần thu"],
    ["Khấu trừ cọc", data.depositDeductions ?? 0, "Ghi nhận khi quyết toán"],
    ["Chi phí", data.totalExpenses ?? 0, "Chi phí hiệu lực trong kỳ"],
    ["Lợi nhuận", data.profit ?? 0, "Server: thực nhận trừ chi phí"],
  ];
  return `<div class="stat-grid-6">${cards.map(([label, value, note]) => `<article class="stat-card"><span class="stat-card__label">${escapeHtml(label)}</span><div class="stat-card__value">${money(value)}</div><p>${escapeHtml(note)}</p></article>`).join("")}</div>`;
}

function typeTable(rows) {
  if (!rows?.length) return `<div class="empty-state"><p class="empty-state__desc">Không có doanh thu theo loại trong kỳ.</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Loại doanh thu</th><th>Số tiền thực nhận</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.type)}</td><td>${money(row.amount)}</td></tr>`).join("")}</tbody></table></div>`;
}

function buildingTable(rows, buildingNames, emptyMessage) {
  if (!rows.length) return `<div class="empty-state"><p class="empty-state__desc">${escapeHtml(emptyMessage)}</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Căn</th><th>Thực nhận</th><th>Gộp</th><th>Giảm trừ</th><th>Khấu trừ cọc</th><th>Chi phí</th><th>Lợi nhuận</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td>${escapeHtml(buildingNames.get(row.buildingId) || row.buildingId || "Toàn chuỗi")}</td><td>${money(row.revenue)}</td><td>${money(row.grossRevenue)}</td><td>${money(row.discounts)}</td><td>${money(row.depositDeductions)}</td><td>${money(row.expenses)}</td><td>${money(row.profit)}</td>
  </tr>`).join("")}</tbody></table></div>`;
}

function detailTable(rows, buildingNames) {
  if (!rows?.length) return `<div class="empty-state"><p class="empty-state__desc">Không có chi tiết thu/chi trong kỳ.</p></div>`;
  const sourceLabel = { THU_TIEN: "Thu tiền", KHAU_TRU_COC: "Khấu trừ cọc", CHI_PHI: "Chi phí" };
  return `<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Nguồn</th><th>Căn</th><th>Phòng</th><th>Thực nhận/chi</th><th>Số gộp</th><th>Giảm trừ</th><th>Nguồn snapshot</th></tr></thead><tbody>${rows.map((row) => `<tr>
    <td>${escapeHtml(date(row.date))}</td><td>${escapeHtml(sourceLabel[row.source] || row.source)}</td><td>${escapeHtml(buildingNames.get(row.buildingId) || row.buildingId || "Toàn chuỗi")}</td><td>${escapeHtml(row.roomId || "—")}</td>
    <td>${money(row.amount)}</td><td>${row.source === "THU_TIEN" || row.source === "KHAU_TRU_COC" ? money(row.grossAmount) : "—"}</td><td>${row.source === "THU_TIEN" ? money(row.discountAllocated) : "—"}</td>
    <td>${row.source === "THU_TIEN" ? (row.snapshotSource === "SUY_DIEN" ? '<span class="badge badge--vacant">Ước tính (dữ liệu cũ)</span>' : escapeHtml(row.snapshotSource || "GHI_NHAN")) : "—"}</td>
  </tr>`).join("")}</tbody></table></div>`;
}

function reportMarkup(data, buildingNames) {
  const rows = Array.isArray(data.byBuilding) ? data.byBuilding : [];
  const compared = rows.filter((row) => row.buildingId && row.inComparison === true);
  const inactive = rows.filter((row) => row.buildingId && row.inComparison === false);
  const chainWide = rows.filter((row) => !row.buildingId);
  return `<section class="module-stack">
    <aside class="panel"><strong>Chú giải:</strong> Doanh thu thực nhận = đã trừ giảm trừ. Các tổng tiền dưới đây do server trả về; trình duyệt không tự cộng/trừ.</aside>
    ${summaryMarkup(data)}
    <section class="panel"><h3>Doanh thu theo loại</h3>${typeTable(data.revenueByType)}</section>
    <section class="panel"><h3>So sánh các căn đang hoạt động</h3>${buildingTable(compared, buildingNames, "Không có căn hoạt động phát sinh trong kỳ.")}</section>
    <section class="panel"><h3>Căn không tham gia so sánh</h3><p>Ngừng hoạt động, không tham gia so sánh.</p>${buildingTable(inactive, buildingNames, "Không có căn ngừng hoạt động phát sinh trong kỳ.")}</section>
    ${chainWide.length ? `<section class="panel"><h3>Phát sinh toàn chuỗi/không gắn căn</h3>${buildingTable(chainWide, buildingNames, "")}</section>` : ""}
    <section class="panel"><h3>Chi tiết thu/chi</h3>${detailTable(data.receiptDetails, buildingNames)}</section>
  </section>`;
}

function filterQuery(form) {
  const raw = Object.fromEntries(new FormData(form));
  const query = new URLSearchParams();
  if (raw.buildingId) query.set("buildingId", raw.buildingId);
  if (raw.mode === "range") {
    if (!raw.from || !raw.to || raw.from > raw.to) throw new Error("Cần chọn khoảng ngày hợp lệ, có đủ ngày bắt đầu và kết thúc.");
    query.set("from", raw.from);
    query.set("to", raw.to);
  } else {
    if (!["month", "quarter", "year"].includes(raw.mode)) throw new Error("Loại kỳ báo cáo không hợp lệ.");
    if (raw.mode === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month || "")) throw new Error("Tháng báo cáo không hợp lệ.");
    if (raw.mode === "quarter" && (!/^\d{4}$/.test(raw.quarterYear || "") || !/^[1-4]$/.test(raw.quarter || ""))) throw new Error("Quý báo cáo không hợp lệ.");
    if (raw.mode === "year" && !/^\d{4}$/.test(raw.year || "")) throw new Error("Năm báo cáo không hợp lệ.");
    query.set("periodType", raw.mode);
    if (raw.mode === "month") query.set("periodValue", raw.month);
    if (raw.mode === "quarter") query.set("periodValue", `${raw.quarterYear}-${raw.quarter}`);
    if (raw.mode === "year") query.set("periodValue", raw.year);
  }
  return query;
}

async function render(context) {
  context.main.innerHTML = shellPage("Báo cáo tài chính", "Doanh thu, chi phí và lợi nhuận theo kỳ và căn trọ.");
  const content = context.main.querySelector("[data-content]");
  const now = currentDate();
  const year = now.slice(0, 4);
  const month = now.slice(0, 7);
  let buildingNames = new Map();
  content.innerHTML = `<div class="panel">Đang tải bộ lọc báo cáo...</div>`;

  try {
    const buildingResponse = await context.api.get("/management/can-tro");
    const buildings = Array.isArray(buildingResponse.data) ? buildingResponse.data : [];
    buildingNames = new Map(buildings.map((row) => [row.ma_can, row.ten_can]));
    content.innerHTML = `<form class="panel form-grid" data-report-filter>
      <label>Loại kỳ<select name="mode"><option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm</option><option value="range">Khoảng ngày</option></select></label>
      <label data-filter-mode="month">Tháng<input name="month" type="month" value="${month}" required></label>
      <label data-filter-mode="quarter">Năm quý<input name="quarterYear" type="number" min="2000" max="2100" step="1" value="${year}"></label>
      <label data-filter-mode="quarter">Quý<select name="quarter"><option value="1">Quý 1</option><option value="2">Quý 2</option><option value="3">Quý 3</option><option value="4">Quý 4</option></select></label>
      <label data-filter-mode="year">Năm<input name="year" type="number" min="2000" max="2100" step="1" value="${year}"></label>
      <label data-filter-mode="range">Từ ngày<input name="from" type="date"></label><label data-filter-mode="range">Đến ngày<input name="to" type="date"></label>
      <label>Căn<select name="buildingId"><option value="">Toàn chuỗi</option>${buildings.map((row) => `<option value="${escapeHtml(row.ma_can)}">${escapeHtml(row.ten_can)}</option>`).join("")}</select></label>
      <button class="btn btn--primary">Xem báo cáo</button><span data-filter-message></span>
    </form><div data-report-result><div class="panel">Đang tải báo cáo...</div></div>`;
    const form = content.querySelector("[data-report-filter]");
    const result = content.querySelector("[data-report-result]");
    const message = form.querySelector("[data-filter-message]");

    const syncFields = () => {
      const mode = form.elements.mode.value;
      form.querySelectorAll("[data-filter-mode]").forEach((label) => {
        const enabled = label.dataset.filterMode === mode;
        label.hidden = !enabled;
        label.querySelectorAll("input,select").forEach((field) => { field.disabled = !enabled; });
      });
    };
    const load = async () => {
      const submit = form.querySelector("button");
      submit.disabled = true;
      message.textContent = "";
      result.innerHTML = `<div class="panel">Đang tải báo cáo...</div>`;
      try {
        const query = filterQuery(form);
        const response = await context.api.get(`/v1/reports/cashflow?${query.toString()}`);
        result.innerHTML = reportMarkup(response.data || {}, buildingNames);
      } catch (error) {
        const friendly = error.status === 400 ? `Bộ lọc không hợp lệ: ${error.message}` : error.message;
        message.textContent = friendly;
        result.innerHTML = `<div class="empty-state empty-state--error"><h4 class="empty-state__title">Không tải được báo cáo</h4><p class="empty-state__desc">${escapeHtml(friendly)}</p></div>`;
      } finally {
        submit.disabled = false;
      }
    };
    form.elements.mode.addEventListener("change", syncFields);
    form.addEventListener("submit", (event) => { event.preventDefault(); load(); });
    syncFields();
    await load();
  } catch (error) {
    content.innerHTML = `<div class="empty-state empty-state--error"><h4 class="empty-state__title">Không tải được danh sách căn</h4><p class="empty-state__desc">${escapeHtml(error.message)}</p></div>`;
  }
}

export default { ...meta, render };
