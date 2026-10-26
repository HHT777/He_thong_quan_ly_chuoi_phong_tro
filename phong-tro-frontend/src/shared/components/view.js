import { icons } from "./icons.js";
import { showToast } from "./toast.js";
import { statusLabel } from "./status-labels.mjs";

export function confirmAction(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = '<div class="modal-dialog" role="dialog" aria-modal="true"><h3>Xác nhận thao tác</h3><p data-confirm-message></p><button type="button" data-cancel>Hủy</button> <button type="button" class="btn btn--danger" data-accept>Tiếp tục</button></div>';
    overlay.querySelector("[data-confirm-message]").textContent = message;
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector("[data-cancel]").addEventListener("click", () => finish(false));
    overlay.querySelector("[data-accept]").addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) finish(false); });
    document.body.appendChild(overlay);
  });
}

export const escapeHtml = (value) =>
  String(value ?? "—").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

export const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
export const date = (value) => (value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—");
export const datePadded = (value) => (value ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—");

// Format status values into SaaS badges
export function formatStatusBadge(status) {
  if (!status) return "—";
  const str = String(status).trim().toUpperCase();

  const label = statusLabel(str);

  if (["DANG_THUE", "DA_THANH_TOAN", "HIEU_LUC", "DANG_HIEU_LUC", "DA_XU_LY", "HOAT_DONG"].includes(str)) {
    return `<span class="badge badge--rented">${label}</span>`;
  }
  if (["TRONG", "CHO_THANH_TOAN", "CHO_TIEP_NHAN", "SAP_HET_HAN"].includes(str)) {
    return `<span class="badge badge--vacant">${label}</span>`;
  }
  if (["DANG_XU_LY_TRA_PHONG", "QUA_HAN", "DA_HUY", "DA_THANH_LY", "TAM_DUNG"].includes(str)) {
    return `<span class="badge badge--checkout">${label}</span>`;
  }
  return `<span class="badge badge--neutral">${label}</span>`;
}

// Truncate long strings/facilities (e.g. "Điều hòa, Tủ lạnh, Máy giặt")
export function formatTruncatedList(value) {
  if (!value) return "—";
  const str = String(value);
  const items = str.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (items.length <= 2) {
    return escapeHtml(str);
  }
  const firstTwo = items.slice(0, 2).map((item) => `<span class="tag-badge">${escapeHtml(item)}</span>`).join(" ");
  const restCount = items.length - 2;
  return `<div class="tag-truncated">${firstTwo} <span class="tag-more" title="${escapeHtml(str)}">+${restCount}</span></div>`;
}

export function shellPage(title, description = "") {
  return `
    <section class="module-page">
      <div class="module-page__heading">
        ${description ? `<p class="module-page__subtitle">${escapeHtml(description)}</p>` : "<div></div>"}
        <div class="module-page__actions" data-actions></div>
      </div>
      <div class="module-page__content" data-content>
        <div class="skeleton-card" style="padding: 24px; display: grid; gap: 14px;">
          <div class="skeleton" style="height: 32px; width: 35%;"></div>
          <div class="skeleton" style="height: 180px; width: 100%;"></div>
        </div>
      </div>
    </section>
  `;
}

function fieldControl(field, value = "") {
  if (field.type === "checkbox") {
    return `<input class="form-control" name="${field.name}" type="checkbox" value="true" ${value === true || value === "true" ? "checked" : ""} ${field.required ? "required" : ""}>`;
  }
  if (field.options) {
    return `<select class="form-control" name="${field.name}" ${field.required ? "required" : ""}>
      ${field.options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
    </select>`;
  }
  if (field.type === "textarea") {
    return `<textarea class="form-control" name="${field.name}" ${field.required ? "required" : ""}>${escapeHtml(value)}</textarea>`;
  }
  return `<input class="form-control" name="${field.name}" type="${field.type || "text"}" value="${escapeHtml(value)}" ${field.required ? "required" : ""} ${field.readOnly ? "readonly aria-readonly=\"true\"" : ""}>`;
}

export function openFormModal({ title, fields = [], initial = {}, submitLabel = "Lưu", submit }) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <span class="modal-icon">${icons.plus(20)}</span>
          <h3 class="modal-title">${escapeHtml(title)}</h3>
        </div>
        <button class="modal-close-btn" aria-label="Đóng" data-modal-close>
          ${icons.x(20)}
        </button>
      </div>
      <div class="modal-body">
        <form class="panel form-grid" data-create-form style="box-shadow:none;border:none;padding:0;margin:0;max-width:100%;">
          ${fields
            .map(
              (field) => `
            <label class="modal-field">
              <span>${escapeHtml(field.label)}</span>
              ${fieldControl(field, initial[field.name] ?? field.value ?? "")}
            </label>
          `
            )
            .join("")}
          <div class="form-grid__actions modal-footer" style="margin-top:20px;">
            <button type="button" class="btn btn--secondary" data-modal-close>Hủy</button>
            <button type="submit" class="btn btn--primary">${escapeHtml(submitLabel)}</button>
            <span data-create-message style="color:var(--red-primary);font-size:13px;"></span>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => {
    if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-modal-close]")) close();
  });

  const form = overlay.querySelector("[data-create-form]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = form.querySelector("[data-create-message]");
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    message.textContent = "Đang lưu...";
    try {
      const raw = Object.fromEntries(new FormData(form));
      for (const field of fields) if (field.readOnly) delete raw[field.name];
      const result = await submit(raw);
      if (result === false) return;
      showToast("Đã lưu thành công!", "success");
      close();
    } catch (err) {
      message.textContent = err.message;
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.body.appendChild(overlay);
}

// Modal helper for create forms
function openCreateModal(config, onCreated, buildingScope) {
  return openFormModal({
    title: config.create.label || "Thêm mới",
    fields: typeof config.create.fields === "function" ? config.create.fields(buildingScope) : config.create.fields,
    initial: typeof config.create.initial === "function" ? config.create.initial() : config.create.initial || {},
    submitLabel: config.create.label || "Thêm mới",
    submit: (raw) => onCreated(config.create.map ? config.create.map(raw) : raw),
  });
}

export function renderTable(container, columns, rows, rowActions = []) {
  if (!rows || !rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">${icons.search(24)}</div>
        <h4 class="empty-state__title">Không tìm thấy dữ liệu</h4>
        <p class="empty-state__desc">Chưa có bản ghi nào hoặc không khớp với bộ lọc hiện tại.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${columns
              .map((column) => {
                const isNumeric = /giá|tiền|số|lượng|diện tích/i.test(column.label || column.key || "");
                return `<th class="${isNumeric ? "table-align-right" : ""}">${escapeHtml(column.label)}</th>`;
              })
              .join("")}
            ${rowActions.length ? "<th>Thao tác</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
            <tr>
              ${columns
                .map((column) => {
                  const isNumeric = /giá|tiền|số|lượng|diện tích/i.test(column.label || column.key || "");
                  const rawVal = column.format ? column.format(row) : row[column.key];

                  // Format status
                  if (column.key === "trang_thai") {
                    return `<td>${formatStatusBadge(rawVal)}</td>`;
                  }
                  // Check if it's already an HTML badge
                  if (typeof rawVal === "string" && rawVal.includes("<span class=")) {
                    return `<td>${rawVal}</td>`;
                  }
                  // Truncate comma-separated lists (e.g. amenities)
                  if (typeof rawVal === "string" && rawVal.length > 30 && rawVal.includes(",")) {
                    return `<td>${formatTruncatedList(rawVal)}</td>`;
                  }

                  return `<td class="${isNumeric ? "table-align-right tabular-nums" : ""}">${escapeHtml(rawVal)}</td>`;
                })
                .join("")}
              ${rowActions.length ? `<td><div class="table-actions">${rowActions.filter((action) => !action.visible || action.visible(row)).map((action) => `<button class="btn ${action.className || "btn--secondary"}" data-row-action="${escapeHtml(action.id)}" data-row-index="${rows.indexOf(row)}">${escapeHtml(action.label)}</button>`).join(" ") || "—"}</div></td>` : ""}
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// Render Card Grid View for Rooms
function renderCardGrid(container, rows) {
  if (!rows || !rows.length) {
    container.innerHTML = `
      <div class="empty-state" style="border:none;">
        <div class="empty-state__icon">${icons.search(24)}</div>
        <h4 class="empty-state__title">Không tìm thấy phòng</h4>
        <p class="empty-state__desc">Không có phòng nào khớp với tiêu chí tìm kiếm.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="card-grid-container">
      ${rows
        .map(
          (room, index) => `
        <article class="grid-card-item" role="button" tabindex="0" data-room-index="${escapeHtml(index)}" aria-label="Xem chi tiết phòng ${escapeHtml(room.so_phong || room.ma_phong)}">
          <div class="grid-card-header">
            <div>
              <h4 class="grid-card-title">Phòng ${escapeHtml(room.so_phong || room.ma_phong || "—")}</h4>
              <div class="grid-card-building">${escapeHtml(room.canTro?.ten_can || "Căn trọ")}</div>
            </div>
            <div>${formatStatusBadge(room.trang_thai)}</div>
          </div>
          <div class="grid-card-price">${money(room.gia_thue)}<span style="font-size:12px;font-weight:normal;color:var(--text-muted);">/tháng</span></div>
          <div class="grid-card-meta">
            <span>Tối đa: <strong>${escapeHtml(room.so_nguoi_toi_da || 1)} người</strong></span>
            <span>Diện tích: <strong>${escapeHtml(room.dien_tich || "—")} m²</strong></span>
          </div>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

// Pagination Controls Builder
function renderPagination(container, totalItems, currentPage, pageSize, onPageChange, onPageSizeChange) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIdx = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const pages = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination__info">
        Hiển thị <strong>${startIdx}–${endIdx}</strong> / tổng <strong>${totalItems}</strong> dòng
        <select class="mgmt-filter-select" id="pageSizeSelect" style="margin-left: 10px; padding: 4px 8px;">
          <option value="10" ${pageSize === 10 ? "selected" : ""}>10 dòng/trang</option>
          <option value="20" ${pageSize === 20 ? "selected" : ""}>20 dòng/trang</option>
          <option value="50" ${pageSize === 50 ? "selected" : ""}>50 dòng/trang</option>
        </select>
      </div>

      <div class="pagination__controls">
        <button class="pagination__btn" id="prevPageBtn" ${currentPage <= 1 ? "disabled" : ""} title="Trang trước">
          ${icons.chevronLeft(16)}
        </button>

        ${pages
          .map((p) =>
            p === "..."
              ? `<span style="padding: 0 4px; color: var(--text-muted);">…</span>`
              : `<button class="pagination__btn ${p === currentPage ? "is-active" : ""}" data-page="${p}">${p}</button>`
          )
          .join("")}

        <button class="pagination__btn" id="nextPageBtn" ${currentPage >= totalPages ? "disabled" : ""} title="Trang sau">
          ${icons.chevronRight(16)}
        </button>
      </div>
    </div>
  `;

  container.querySelector("#pageSizeSelect")?.addEventListener("change", (e) => {
    onPageSizeChange(Number(e.target.value));
  });

  container.querySelector("#prevPageBtn")?.addEventListener("click", () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  });

  container.querySelector("#nextPageBtn")?.addEventListener("click", () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  });

  container.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      onPageChange(Number(btn.dataset.page));
    });
  });
}

export async function renderList(context, config) {
  context.main.innerHTML = shellPage(config.title, config.description);
  const content = context.main.querySelector("[data-content]");
  const actions = context.main.querySelector("[data-actions]");

  if (config.action) {
    actions.innerHTML = `<button class="btn btn--secondary" data-action>${escapeHtml(config.action.label)}</button>`;
  }

  try {
    const response = await context.api.get(config.endpoint);
    const buildingScope = config.buildingScope ? await config.buildingScope(context.api, config.buildingScopeOptions) : null;
    buildingScope?.mount(actions, () => renderList(context, config));
    let data = config.transform ? config.transform(response.data, buildingScope) : response.data;
    if (config.loadAllPages && response.pagination?.hasNext) {
      data = [...(data || [])];
      for (let page = 2; ; page += 1) {
        const separator = config.endpoint.includes("?") ? "&" : "?";
        const next = await context.api.get(`${config.endpoint}${separator}page=${page}`);
        data.push(...(next.data || []));
        if (!next.pagination?.hasNext) break;
      }
    }
    const allRows = Array.isArray(data) ? data : [];
    if (config.sortRows) allRows.sort(config.sortRows);

    // Check if this is the "Phòng" module
    const isRoomsModule = config.endpoint.includes("/phong") || config.title === "Phòng";

    // Setup initial state
    const routeFilters = new URLSearchParams(window.location.hash.split("?")[1] || "");
    let searchQuery = routeFilters.get("search") || "";
    let statusFilter = routeFilters.get("status") || "ALL";
    let buildingFilter = "ALL";
    let viewMode = "table"; // 'table' or 'grid'
    let currentPage = 1;
    let pageSize = 10;

    // Build unique buildings list for rooms filter
    const uniqueBuildings = Array.from(
      new Set(allRows.map((r) => r.canTro?.ten_can).filter(Boolean))
    );

    // Function to compute room stats strip
    const renderStatStrip = () => {
      if (!isRoomsModule) return "";
      const total = allRows.length;
      const rented = allRows.filter((r) => r.trang_thai === "DANG_THUE").length;
      const vacant = allRows.filter((r) => r.trang_thai === "TRONG").length;
      const occ = total > 0 ? Math.round((rented / total) * 100) : 0;

      return `
        <div class="mgmt-stat-strip">
          <div class="mgmt-stat-pill">
            <div class="mgmt-stat-info">
              <span class="mgmt-stat-label">Tổng số phòng</span>
              <span class="mgmt-stat-val">${total}</span>
            </div>
            <div class="mgmt-stat-icon-wrap" style="background:var(--blue-surface);color:var(--blue-primary);">${icons.building(20)}</div>
          </div>
          <div class="mgmt-stat-pill">
            <div class="mgmt-stat-info">
              <span class="mgmt-stat-label">Đang cho thuê</span>
              <span class="mgmt-stat-val">${rented}</span>
            </div>
            <div class="mgmt-stat-icon-wrap" style="background:var(--green-surface);color:var(--green-primary);">${icons.door(20)}</div>
          </div>
          <div class="mgmt-stat-pill">
            <div class="mgmt-stat-info">
              <span class="mgmt-stat-label">Phòng còn trống</span>
              <span class="mgmt-stat-val">${vacant}</span>
            </div>
            <div class="mgmt-stat-icon-wrap" style="background:var(--amber-surface);color:var(--amber-primary);">${icons.door(20)}</div>
          </div>
          <div class="mgmt-stat-pill">
            <div class="mgmt-stat-info">
              <span class="mgmt-stat-label">Tỷ lệ lấp đầy</span>
              <span class="mgmt-stat-val">${occ}%</span>
            </div>
            <div class="mgmt-stat-icon-wrap" style="background:var(--purple-surface);color:var(--purple-primary);">${icons.trendingUp(20)}</div>
          </div>
        </div>
      `;
    };

    // Filter rows logic
    const getFilteredRows = () => {
      return allRows.filter((row) => {
        if (buildingScope && !config.buildingMatch(row, buildingScope)) return false;
        // Status filter
        if (statusFilter !== "ALL" && row.trang_thai !== statusFilter) {
          return false;
        }
        // Building filter
        if (buildingFilter !== "ALL" && row.canTro?.ten_can !== buildingFilter) {
          return false;
        }
        // Search query
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const match = Object.values(row).some((val) => {
            if (typeof val === "object" && val !== null) {
              return Object.values(val).some((sub) => String(sub).toLowerCase().includes(q));
            }
            return String(val || "").toLowerCase().includes(q);
          });
          if (!match) return false;
        }
        return true;
      });
    };

    // Main render function inside content
    const updateView = () => {
      const filtered = getFilteredRows();
      const startIndex = (currentPage - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      content.innerHTML = `
        ${renderStatStrip()}

        <div class="panel" style="overflow:hidden;">
          <!-- UNIFIED TOOLBAR -->
          <div class="mgmt-toolbar">
            <div class="mgmt-toolbar-left">
              <!-- Search Input -->
              <div class="mgmt-search-wrap">
                <div class="input-wrap">
                  <span class="input-icon">${icons.search(16)}</span>
                  <input type="text" class="input-search" placeholder="Tìm kiếm nhanh..." id="mgmtSearchInput" value="${escapeHtml(searchQuery)}">
                </div>
              </div>

              <!-- Status Filter Select -->
              <select class="mgmt-filter-select" id="mgmtStatusFilter">
                <option value="ALL">Tất cả trạng thái</option>
                ${(config.statusOptions || [{ value: "DANG_THUE", label: "Đang thuê" }, { value: "TRONG", label: "Trống" }, { value: "DANG_XU_LY_TRA_PHONG", label: "Đang xử lý trả" }]).map((option) => `<option value="${escapeHtml(option.value)}" ${statusFilter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>

              ${
                isRoomsModule && uniqueBuildings.length > 0
                  ? `
                <select class="mgmt-filter-select" id="mgmtBuildingFilter">
                  <option value="ALL">Tất cả căn trọ</option>
                  ${uniqueBuildings.map((b) => `<option value="${escapeHtml(b)}" ${buildingFilter === b ? "selected" : ""}>${escapeHtml(b)}</option>`).join("")}
                </select>
              `
                  : ""
              }
            </div>

            <div class="mgmt-toolbar-right">
              ${
                isRoomsModule
                  ? `
                <!-- View Mode Toggle -->
                <div class="view-mode-toggle">
                  <button class="view-mode-btn ${viewMode === "table" ? "is-active" : ""}" id="btnViewTable" title="Xem dạng bảng">
                    ${icons.dashboard(15)} Bảng
                  </button>
                  <button class="view-mode-btn ${viewMode === "grid" ? "is-active" : ""}" id="btnViewGrid" title="Xem dạng thẻ">
                    ${icons.building(15)} Thẻ
                  </button>
                </div>
              `
                  : ""
              }

              ${
                (config.toolbarActions || []).map((action) => `<button type="button" class="btn btn--secondary" data-toolbar-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>`).join("")
              }

              ${
                config.create
                  ? `
                <button class="btn btn--primary" id="btnOpenCreate">
                  ${icons.plus(16)} ${escapeHtml(config.create.label || "Thêm mới")}
                </button>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Active Filter Chips Bar -->
          ${
            searchQuery || statusFilter !== "ALL" || buildingFilter !== "ALL"
              ? `
            <div class="mgmt-filter-chips">
              <span>Đang lọc theo:</span>
              ${searchQuery ? `<span class="filter-chip">Từ khóa: "${escapeHtml(searchQuery)}" <span class="filter-chip-remove" id="clearSearchChip">✕</span></span>` : ""}
              ${statusFilter !== "ALL" ? `<span class="filter-chip">Trạng thái: ${escapeHtml(statusFilter)} <span class="filter-chip-remove" id="clearStatusChip">✕</span></span>` : ""}
              ${buildingFilter !== "ALL" ? `<span class="filter-chip">Căn: ${escapeHtml(buildingFilter)} <span class="filter-chip-remove" id="clearBuildingChip">✕</span></span>` : ""}
              <span class="filter-chip-clear" id="clearAllFiltersBtn">Xóa lọc</span>
            </div>
          `
              : ""
          }

          <!-- View Display (Table or Grid) -->
          <div id="mgmtViewContainer"></div>

          <!-- Pagination -->
          <div id="mgmtPaginationContainer"></div>
        </div>
      `;

      // Render Table or Grid into container
      const viewContainer = content.querySelector("#mgmtViewContainer");
      if (viewMode === "grid" && isRoomsModule) {
        renderCardGrid(viewContainer, paginated);
      } else {
        renderTable(viewContainer, config.columns, paginated, config.rowActions || []);
      }

      content.querySelectorAll("[data-toolbar-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = (config.toolbarActions || []).find((item) => item.id === button.dataset.toolbarAction);
          if (action) await action.run(context, () => renderList(context, config));
        });
      });

      viewContainer.querySelectorAll("[data-row-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const action = (config.rowActions || []).find((item) => item.id === button.dataset.rowAction);
          const row = paginated[Number(button.dataset.rowIndex)];
          if (!action || !row) return;
          if (action.openDetail) { await config.openDetail(context, row); return; }
          const execute = async (raw = {}) => {
            button.disabled = true;
            try {
              const values = action.map ? action.map(raw, row) : raw;
              await action.run(context, row, values);
              showToast(action.successMessage || "Thao tác thành công!", "success");
              await renderList(context, config);
            } catch (error) {
              showToast(error.message, "error");
              button.disabled = false;
            }
          };
          if (action.fields?.length) {
            openFormModal({
              title: action.title || action.label,
              fields: action.fields,
              initial: action.initial ? action.initial(row) : {},
              submitLabel: action.submitLabel || action.label,
              submit: execute,
            });
          } else if (!action.confirm || window.confirm(action.confirm(row))) {
            await execute();
          }
        });
      });

      viewContainer.querySelectorAll("[data-room-index]").forEach((card) => {
        const open = () => {
          const row = paginated[Number(card.dataset.roomIndex)];
          if (row && config.openDetail) config.openDetail(context, row);
        };
        card.addEventListener("click", open);
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
        });
      });

      // Render Pagination
      const paginationContainer = content.querySelector("#mgmtPaginationContainer");
      renderPagination(
        paginationContainer,
        filtered.length,
        currentPage,
        pageSize,
        (newPage) => {
          currentPage = newPage;
          updateView();
        },
        (newPageSize) => {
          pageSize = newPageSize;
          currentPage = 1;
          updateView();
        }
      );

      // Bind Toolbar Events
      const searchInput = content.querySelector("#mgmtSearchInput");
      searchInput?.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim();
        currentPage = 1;
        updateView();
      });

      content.querySelector("#mgmtStatusFilter")?.addEventListener("change", (e) => {
        statusFilter = e.target.value;
        currentPage = 1;
        updateView();
      });

      content.querySelector("#mgmtBuildingFilter")?.addEventListener("change", (e) => {
        buildingFilter = e.target.value;
        currentPage = 1;
        updateView();
      });

      content.querySelector("#btnViewTable")?.addEventListener("click", () => {
        viewMode = "table";
        updateView();
      });

      content.querySelector("#btnViewGrid")?.addEventListener("click", () => {
        viewMode = "grid";
        updateView();
      });

      // Filter Chips Events
      content.querySelector("#clearSearchChip")?.addEventListener("click", () => {
        searchQuery = "";
        currentPage = 1;
        updateView();
      });

      content.querySelector("#clearStatusChip")?.addEventListener("click", () => {
        statusFilter = "ALL";
        currentPage = 1;
        updateView();
      });

      content.querySelector("#clearBuildingChip")?.addEventListener("click", () => {
        buildingFilter = "ALL";
        currentPage = 1;
        updateView();
      });

      content.querySelector("#clearAllFiltersBtn")?.addEventListener("click", () => {
        searchQuery = "";
        statusFilter = "ALL";
        buildingFilter = "ALL";
        currentPage = 1;
        updateView();
      });

      // Create button opens sleek Modal Dialog
      content.querySelector("#btnOpenCreate")?.addEventListener("click", () => {
        openCreateModal(config, async (body) => {
          const headers = typeof config.create.headers === "function" ? config.create.headers(body) : config.create.headers;
          await context.api.post(config.create.endpoint || config.endpoint, body, headers);
          config.create.onCreated?.(body);
          await renderList(context, config);
        }, buildingScope);
      });
    };

    updateView();

    if (config.action) {
      actions.querySelector("[data-action]")?.addEventListener("click", () => config.action.run(context, allRows));
    }
  } catch (error) {
    content.innerHTML = `
      <div class="empty-state empty-state--error">
        <div class="empty-state__icon" style="color:var(--red-primary);">${icons.alertCircle(24)}</div>
        <h4 class="empty-state__title">Lỗi khi tải dữ liệu</h4>
        <p class="empty-state__desc">${escapeHtml(error.message)}</p>
        <button class="btn btn--secondary" type="button" data-list-retry>Thử lại</button>
      </div>
    `;
    content.querySelector("[data-list-retry]")?.addEventListener("click", () => renderList(context, config));
  }
}

export function renderFormPage(context, config) {
  context.main.innerHTML = `
    ${shellPage(config.title, config.description)}
    <form class="panel form-grid" data-form>
      ${config.fields
        .map(
          (field) => `
        <label>
          ${escapeHtml(field.label)}
          ${field.options
            ? `<select name="${field.name}" ${field.required ? "required" : ""}>
                ${field.options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === field.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
              </select>`
            : `<input name="${field.name}" type="${field.type || "text"}" ${field.required ? "required" : ""} ${field.value !== undefined ? `value="${escapeHtml(field.value)}"` : ""}>`}
        </label>
      `
        )
        .join("")}
      <div class="form-grid__actions">
        <button class="btn btn--primary">${escapeHtml(config.submitLabel || "Lưu")}</button>
        <span data-form-message></span>
      </div>
    </form>
  `;
  context.main.querySelector("[data-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = context.main.querySelector("[data-form-message]");
    try {
      await config.submit(Object.fromEntries(new FormData(event.currentTarget)));
      message.textContent = "Đã lưu thành công.";
      showToast("Đã lưu dữ liệu thành công.", "success");
      event.currentTarget.reset();
    } catch (error) {
      message.textContent = error.message;
      showToast(error.message, "error");
    }
  });
}
