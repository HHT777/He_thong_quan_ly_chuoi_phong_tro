import { shellPage, escapeHtml, date } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import "./inbox.css";

const TYPE_LABELS = {
  HOP_DONG: "Hợp đồng",
  PHIEU_THU: "Phiếu thu",
  CONG_NO: "Công nợ",
  THANH_TOAN: "Thanh toán",
  THONG_BAO_CHU_TRO: "Thông báo",
  SU_CO: "Sự cố",
  KET_QUA_SU_CO: "Sự cố",
  GIU_PHONG_QUA_HAN: "Giữ phòng",
  CHUYEN_PHONG: "Chuyển phòng",
  THANH_LY_HOP_DONG: "Trả phòng",
  KET_QUA_YEU_CAU: "Yêu cầu",
};

async function getAll(api, path) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await api.get(`${path}${separator}limit=100&page=${page}`);
    rows.push(...(Array.isArray(response.data) ? response.data : []));
    if (!response.pagination?.hasNext) return rows;
  }
}

function contractLabels(contracts = []) {
  const labels = new Map();
  for (const contract of contracts) {
    const id = String(contract.ma_hop_dong || "");
    if (!id) continue;
    const parts = [
      contract.khachThue?.ho_ten,
      contract.phongTro?.canTro?.ten_can,
      contract.phongTro?.so_phong ? `Phòng ${contract.phongTro.so_phong}` : null,
    ].filter(Boolean);
    labels.set(id, parts.length ? parts.join(" · ") : "Hợp đồng thuê phòng");
  }
  return labels;
}

function readableContent(row, contracts) {
  let content = String(row.noi_dung || "");
  for (const [id, label] of contracts) content = content.replaceAll(id, label);
  return content.replace(/\s+/g, " ").trim();
}

export default {
  id: "inbox", route: "/notifications/inbox", title: "Thông báo", tabLabel: "Hộp thư",
  group: "notifications", order: 60, roles: ["CHU_TRO", "KHACH_THUE"],
  async render(context) {
    context.main.innerHTML = shellPage("Thông báo", "");
    const content = context.main.querySelector("[data-content]");
    content.innerHTML = `
      <section class="inbox-panel" aria-label="Hộp thư thông báo">
        <div class="inbox-toolbar">
          <label class="inbox-search"><span class="sr-only">Tìm thông báo</span><input type="search" data-search placeholder="Tìm thông báo..." /></label>
          <label class="inbox-filter"><span class="sr-only">Lọc trạng thái</span><select data-filter><option value="ALL">Tất cả</option><option value="UNREAD">Chưa đọc</option><option value="READ">Đã đọc</option></select></label>
          <span class="inbox-count" data-count role="status"></span>
        </div>
        <p class="inbox-message" data-message role="status" aria-live="polite">Đang tải thông báo...</p>
        <div class="inbox-list" data-list></div>
      </section>`;
    const list = content.querySelector("[data-list]");
    const message = content.querySelector("[data-message]");
    const count = content.querySelector("[data-count]");
    const search = content.querySelector("[data-search]");
    const filter = content.querySelector("[data-filter]");
    let notifications = [];
    let contracts = new Map();
    let busyId = null;
    const connected = () => content.isConnected;

    const renderRows = () => {
      const query = search.value.trim().toLocaleLowerCase("vi");
      const filtered = notifications.filter((row) => {
        if (filter.value === "UNREAD" && row.da_doc) return false;
        if (filter.value === "READ" && !row.da_doc) return false;
        const contentText = readableContent(row, contracts);
        const haystack = `${contentText} ${TYPE_LABELS[row.loai_thong_bao] || "Thông báo"}`.toLocaleLowerCase("vi");
        return haystack.includes(query);
      });
      const unread = notifications.filter((row) => !row.da_doc).length;
      count.textContent = `${notifications.length} thông báo · ${unread} chưa đọc`;
      message.textContent = "";
      list.innerHTML = filtered.length ? filtered.map((row) => `
        <article class="inbox-item ${row.da_doc ? "" : "inbox-item--unread"}" aria-label="${row.da_doc ? "Đã đọc" : "Chưa đọc"}">
          <span class="inbox-item__marker" aria-hidden="true"></span>
          <div class="inbox-item__body">
            <div class="inbox-item__meta"><span class="inbox-item__type">${escapeHtml(TYPE_LABELS[row.loai_thong_bao] || "Thông báo")}</span><time>${escapeHtml(date(row.thoi_diem_tao))}</time></div>
            <p>${escapeHtml(readableContent(row, contracts))}</p>
          </div>
          ${row.da_doc ? '<span class="inbox-item__read">Đã đọc</span>' : `<button type="button" class="btn btn--secondary inbox-item__button" data-mark-read="${escapeHtml(row.ma_thong_bao)}" ${busyId === String(row.ma_thong_bao) ? "disabled" : ""}>Đánh dấu đã đọc</button>`}
        </article>`).join("") : `<div class="inbox-empty"><strong>${notifications.length ? "Không có thông báo phù hợp" : "Hộp thư đang trống"}</strong><span>${notifications.length ? "Thử thay đổi nội dung tìm kiếm hoặc bộ lọc." : "Thông báo mới sẽ xuất hiện tại đây."}</span></div>`;
      list.querySelectorAll("[data-mark-read]").forEach((button) => button.addEventListener("click", async () => {
        const id = button.dataset.markRead;
        if (busyId) return;
        busyId = id;
        renderRows();
        try {
          await context.api.patch(`/v1/notifications/${encodeURIComponent(id)}/read`, {});
          const row = notifications.find((item) => String(item.ma_thong_bao) === id);
          if (row) row.da_doc = true;
          showToast("Đã đánh dấu thông báo đã đọc.", "success");
        } catch (error) {
          if (connected()) showToast(error.message, "error");
        } finally {
          busyId = null;
          if (connected()) renderRows();
        }
      }));
    };

    search.addEventListener("input", renderRows);
    filter.addEventListener("change", renderRows);
    try {
      const [notificationRows, contractRows] = await Promise.all([
        getAll(context.api, "/v1/notifications"),
        context.user?.vai_tro === "CHU_TRO" ? getAll(context.api, "/hop-dong") : Promise.resolve([]),
      ]);
      if (!connected()) return;
      notifications = notificationRows;
      contracts = contractLabels(contractRows);
      renderRows();
    } catch (error) {
      if (!connected()) return;
      message.textContent = `Không tải được thông báo: ${error.message}`;
      list.innerHTML = "";
    }
  },
};
