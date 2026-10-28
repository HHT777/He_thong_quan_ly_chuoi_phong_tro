import { shellPage, escapeHtml, date } from "../../shared/components/view.js";
import { showToast } from "../../shared/components/toast.js";
import { go } from "../../core/router.js";
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
    labels.set(id, { ...contract, label: parts.length ? parts.join(" · ") : "Hợp đồng thuê phòng" });
  }
  return labels;
}

function notificationTarget(row, contracts, role) {
  const raw = String(row.noi_dung || "");
  if (["HOP_DONG", "THANH_LY_HOP_DONG"].includes(row.loai_thong_bao)) {
    if (role === "KHACH_THUE") return "/tenant/rental-info";
    const match = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) {
      const contract = contracts.get(match[0]);
      const status = contract?.trang_thai || "ALL";
      return `/residents-contracts/contracts?contract=${encodeURIComponent(match[0])}&status=${encodeURIComponent(status)}`;
    }
    return "/residents-contracts/contracts";
  }
  if (["PHIEU_THU", "CONG_NO", "THANH_TOAN"].includes(row.loai_thong_bao)) return "/finance/bills";
  if (["SU_CO", "KET_QUA_SU_CO"].includes(row.loai_thong_bao)) return "/operations/incidents";
  if (row.loai_thong_bao === "GIU_PHONG_QUA_HAN") return "/residents-contracts/reservations";
  if (row.loai_thong_bao === "CHUYEN_PHONG") return "/residents-contracts/contracts";
  if (row.loai_thong_bao === "KET_QUA_YEU_CAU") return "/residents-contracts/requests";
  return null;
}

function readableContent(row, contracts) {
  let content = String(row.noi_dung || "");
  for (const [id, contract] of contracts) content = content.replaceAll(id, contract.label);
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
          <label class="inbox-filter"><span>Trạng thái</span><select data-filter aria-label="Trạng thái"><option value="ALL">Tất cả</option><option value="UNREAD">Chưa đọc</option><option value="READ">Đã đọc</option></select></label>
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
        <article class="inbox-item ${row.da_doc ? "" : "inbox-item--unread"}" aria-label="${row.da_doc ? "Đã đọc" : "Chưa đọc"}" ${notificationTarget(row, contracts, context.user?.vai_tro) ? `role="link" tabindex="0" data-open-notification="${escapeHtml(row.ma_thong_bao)}"` : ""}>
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
      list.querySelectorAll("[data-open-notification]").forEach((item) => {
        const open = async () => {
          const row = notifications.find((entry) => String(entry.ma_thong_bao) === item.dataset.openNotification);
          if (!row) return;
          const target = notificationTarget(row, contracts, context.user?.vai_tro);
          if (!target) return;
          if (!row.da_doc) {
            try {
              await context.api.patch(`/v1/notifications/${encodeURIComponent(row.ma_thong_bao)}/read`, {});
              row.da_doc = true;
            } catch (error) {
              showToast(error.message, "error");
              return;
            }
          }
          go(target);
        };
        item.addEventListener("click", (event) => {
          if (event.target.closest("button")) return;
          open();
        });
        item.addEventListener("keydown", (event) => {
          if (event.target !== item || !["Enter", " "].includes(event.key)) return;
          event.preventDefault();
          open();
        });
      });
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
