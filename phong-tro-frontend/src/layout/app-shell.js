import { groupTabs, allowedTabs } from "../core/module-registry.js";
import { go } from "../core/router.js";
import { logout } from "../core/session.js";
import { escapeHtml } from "../shared/components/view.js";
import { icons } from "../shared/components/icons.js";
import { api } from "../core/api.js";
import { hasUnreadNotifications } from "./shell-data.mjs";
import { openProfileModal, openSettingsModal, openSupportModal } from "./modals.js";

const GROUP_LABELS = {
  overview: "Tổng quan",
  properties: "Căn & Phòng", // Đã đổi từ Bất động sản theo PA 1A
  "residents-contracts": "Cư dân & Hợp đồng",
  finance: "Tài chính",
  operations: "Vận hành",
  "meter-readings": "Chỉ số điện",
  incidents: "Sự cố",
  "move-outs": "Trả phòng",
  settings: "Cài đặt",
  notifications: "Thông báo",
  "tenant-info": "Thông tin thuê",
  "tenant-finance": "Tài chính",
  "tenant-operations": "Điện & vận hành",
  "tenant-requests": "Yêu cầu",
  "tenant-notifications": "Thông báo",
};

const GROUP_ICONS = {
  overview: icons.dashboard,
  properties: icons.building,
  "residents-contracts": icons.users,
  finance: icons.money,
  operations: icons.tool,
  "meter-readings": icons.zap,
  incidents: icons.tool,
  "move-outs": icons.door,
  settings: icons.settings,
  notifications: icons.bell,
  "tenant-info": icons.door,
  "tenant-finance": icons.money,
  "tenant-operations": icons.zap,
  "tenant-requests": icons.tool,
  "tenant-notifications": icons.bell,
};

const CREATE_SHORTCUTS = [
  { id: "buildings", label: "Thêm căn trọ" },
  { id: "rooms", label: "Thêm phòng" },
  { id: "contracts", label: "Tạo hợp đồng" },
  { id: "incidents", label: "Tạo sự cố" },
];

export function mountShell(root, currentUser) {
  const groups = groupTabs(currentUser);
  const userName = currentUser?.ho_ten || currentUser?.ten_dang_nhap || "Tài khoản";
  const userEmail = currentUser?.email || "";
  const roleName = currentUser?.vai_tro === "KHACH_THUE" ? "Khách thuê" : "Chủ trọ";
  const userInitial = userName.charAt(0).toUpperCase();

  const isCollapsed = localStorage.getItem("isk19_sidebar_collapsed") === "true";
  const available = allowedTabs(currentUser);
  const createShortcuts = currentUser?.vai_tro === "CHU_TRO"
    ? CREATE_SHORTCUTS.map((item) => ({ ...item, tab: available.find((tab) => tab.id === item.id) })).filter((item) => item.tab)
    : [];

  root.innerHTML = `
    <div class="app-shell ${isCollapsed ? "is-sidebar-collapsed" : ""}" id="appShell">
      <!-- SIDEBAR -->
      <aside class="sidebar" id="appSidebar" aria-label="Sidebar Navigation">
        <!-- Brand & Collapse -->
        <div class="sidebar__top">
          <a class="brand-wrap" href="#/overview/dashboard">
            <div class="brand-logo-mark">19</div>
            <div class="brand-text-wrap">
              <span class="brand-title">ISK19</span>
              <span class="brand-subtitle">Quản lý nhà trọ</span>
            </div>
          </a>
          <button class="sidebar-collapse-btn" id="sidebarCollapseBtn" title="Thu gọn / Mở rộng menu" aria-label="Thu gọn sidebar">
            ${isCollapsed ? icons.panelLeftOpen(16) : icons.panelLeftClose(16)}
          </button>
        </div>

        <!-- Navigation Links -->
        <nav aria-label="Danh mục chức năng">
          ${Object.entries(groups)
            .map(([group, tabs]) => {
              const iconFn = GROUP_ICONS[group] || icons.dashboard;
              const label = GROUP_LABELS[group] || group;
              return `
                <button class="nav-group" data-route="${tabs[0].route}" data-nav-group="${group}" title="${escapeHtml(label)}">
                  <span class="nav-group__icon">${iconFn(18)}</span>
                  <span class="nav-group__text">${escapeHtml(label)}</span>
                </button>
              `;
            })
            .join("")}
        </nav>

        <!-- Sidebar Fixed Bottom -->
        <div class="sidebar__bottom">
          <button class="sidebar-action-btn" id="sidebarSettingsBtn" title="Cài đặt hệ thống">
            <span>${icons.settings(18)}</span>
            <span>Cài đặt</span>
          </button>
          <button class="sidebar-action-btn" id="sidebarSupportBtn" title="Trung tâm trợ giúp">
            <span>${icons.help(18)}</span>
            <span>Hỗ trợ</span>
          </button>

          <!-- User Card in Sidebar -->
          <div class="sidebar-user-card" id="sidebarUserCard" title="${escapeHtml(userName)} (${escapeHtml(roleName)})">
            <div class="sidebar-user-avatar">
              ${escapeHtml(userInitial)}
            </div>
            <div class="sidebar-user-meta">
              <span class="sidebar-user-name">${escapeHtml(userName)}</span>
              <span class="sidebar-user-sub">${escapeHtml(userEmail)}</span>
            </div>
          </div>
          <button class="logout" data-logout style="display:none;" aria-hidden="true">Đăng xuất</button>
        </div>
      </aside>

      <!-- MAIN APP BODY -->
      <div class="app-shell__body">
        <!-- HEADER / NAVBAR -->
        <header class="navbar" role="banner">
          <!-- Left: Title & Breadcrumb -->
          <div class="navbar__left">
            <button class="mobile-nav-toggle" id="mobileNavToggle" aria-label="Mở menu">
              ${icons.menu(22)}
            </button>
            <div>
              <div class="navbar-breadcrumb" data-group>TỔNG QUAN</div>
              <h2 class="navbar-heading-title" data-title>Tổng quan</h2>
            </div>
          </div>

          <!-- Right: Search, Notifications, Avatar Dropdown -->
          <div class="navbar__right">
            <!-- Search Input -->
            <div class="navbar-search-box">
              <div class="input-wrap">
                <span class="input-icon">${icons.search(16)}</span>
                <input type="text" class="input-search" placeholder="Tìm kiếm nhanh..." id="globalSearchInput" aria-label="Tìm kiếm">
                <span class="input-shortcut">Ctrl K</span>
              </div>
            </div>

            <!-- Notification Bell -->
            <button class="navbar-icon-btn" id="headerNotificationBtn" title="Thông báo hệ thống" aria-label="Thông báo">
              ${icons.bell(18)}
              <span class="navbar-notification-dot" id="unreadNotificationDot" hidden></span>
            </button>

            <!-- User Avatar & Dropdown -->
            <div class="navbar-user-dropdown-wrap">
              <button class="navbar-user-btn" id="userMenuBtn" aria-haspopup="true" aria-expanded="false" aria-label="Menu tài khoản">
                <div class="navbar-user-avatar">
                  ${escapeHtml(userInitial)}
                </div>
                <span class="navbar-user-name">${escapeHtml(userName)}</span>
                <span class="navbar-user-caret">${icons.chevronDown(14)}</span>
              </button>

              <!-- Dropdown Menu -->
              <div class="dropdown-menu" id="userDropdownMenu" role="menu">
                <div class="user-dropdown-header">
                  <div class="user-dropdown-header__avatar">
                    ${escapeHtml(userInitial)}
                  </div>
                  <div class="user-dropdown-header__info">
                    <span class="user-dropdown-header__name">${escapeHtml(userName)}</span>
                    <span class="user-dropdown-header__role">${escapeHtml(roleName)}${userEmail ? ` · ${escapeHtml(userEmail)}` : ""}</span>
                  </div>
                </div>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" id="menuItemProfile" role="menuitem">
                  ${icons.user(16)}
                  <span>Thông tin cá nhân</span>
                </button>
                <button class="dropdown-item" id="menuItemSettings" role="menuitem">
                  ${icons.settings(16)}
                  <span>Cài đặt hệ thống</span>
                </button>
                <button class="dropdown-item" id="menuItemSupport" role="menuitem">
                  ${icons.help(16)}
                  <span>Trung tâm hỗ trợ</span>
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item dropdown-item--danger" id="menuItemLogout" role="menuitem">
                  ${icons.logout(16)}
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
            ${createShortcuts.length >= 2 ? `<div class="navbar-create-wrap">
              <button class="navbar-create-btn" id="createMenuBtn" type="button" aria-expanded="false" aria-controls="createMenu">${icons.plus(17)}<span>Tạo mới</span></button>
              <div class="navbar-create-menu" id="createMenu" hidden>
                ${createShortcuts.map((item) => `<button type="button" class="navbar-create-item" data-create-route="${escapeHtml(item.tab.route)}">${escapeHtml(item.label)}</button>`).join("")}
              </div>
            </div>` : ""}
          </div>
        </header>

        <!-- Dynamic Module Tabs (Segmented pills) -->
        <div class="module-tabs" data-tabs></div>

        <!-- Dynamic Module Workspace -->
        <main id="module-root" role="main"></main>
      </div>
    </div>
  `;

  // Setup Sidebar Toggle
  const appShell = root.querySelector("#appShell");
  const collapseBtn = root.querySelector("#sidebarCollapseBtn");
  collapseBtn.addEventListener("click", () => {
    const isNowCollapsed = appShell.classList.toggle("is-sidebar-collapsed");
    localStorage.setItem("isk19_sidebar_collapsed", String(isNowCollapsed));
    collapseBtn.innerHTML = isNowCollapsed ? icons.panelLeftOpen(16) : icons.panelLeftClose(16);
  });

  // Mobile drawer toggle
  const mobileToggle = root.querySelector("#mobileNavToggle");
  const appSidebar = root.querySelector("#appSidebar");
  mobileToggle?.addEventListener("click", () => {
    appSidebar.classList.toggle("is-mobile-open");
  });

  // Navigation Links click
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      appSidebar.classList.remove("is-mobile-open");
      go(button.dataset.route);
    });
  });

  // Logout actions
  const doLogout = () => {
    logout();
    window.location.hash = "";
    window.location.reload();
  };
  root.querySelectorAll("[data-logout]").forEach((btn) => btn.addEventListener("click", doLogout));
  root.querySelector("#menuItemLogout")?.addEventListener("click", doLogout);

  // Settings & Support in sidebar
  root.querySelector("#sidebarSettingsBtn")?.addEventListener("click", () => currentUser?.vai_tro === "CHU_TRO" ? go("/settings/system-config") : openSettingsModal());
  root.querySelector("#sidebarSupportBtn")?.addEventListener("click", openSupportModal);
  root.querySelector("#sidebarUserCard")?.addEventListener("click", () => openProfileModal(currentUser));

  // User Dropdown logic
  const userBtn = root.querySelector("#userMenuBtn");
  const dropdownMenu = root.querySelector("#userDropdownMenu");

  const toggleDropdown = (open) => {
    const isOpen = open !== undefined ? open : !dropdownMenu.classList.contains("is-open");
    dropdownMenu.classList.toggle("is-open", isOpen);
    userBtn.setAttribute("aria-expanded", String(isOpen));
  };

  userBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  // Close dropdown on outside click or Esc
  document.addEventListener("click", (e) => {
    if (!userBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      toggleDropdown(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dropdownMenu.classList.contains("is-open")) {
      toggleDropdown(false);
      userBtn.focus();
    }
    // Ctrl+K shortcut for search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      root.querySelector("#globalSearchInput")?.focus();
    }
  });

  // Forward quick search to the search field of the open screen.
  const globalSearch = root.querySelector("#globalSearchInput");
  globalSearch?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    const workspace = root.querySelector("#module-root");
    const localSearch = workspace?.querySelector(
      '#mgmtSearchInput, input[name="search"], input[data-search], input[type="search"]'
    );
    if (!localSearch || localSearch === globalSearch) return;
    event.preventDefault();
    localSearch.value = globalSearch.value;
    localSearch.dispatchEvent(new Event("input", { bubbles: true }));
    const applyButton = localSearch.closest("form")?.querySelector('button[type="submit"]');
    if (applyButton) applyButton.click();
    else localSearch.focus();
  });

  // Dropdown items
  root.querySelector("#menuItemProfile")?.addEventListener("click", () => {
    toggleDropdown(false);
    openProfileModal(currentUser);
  });
  root.querySelector("#menuItemSettings")?.addEventListener("click", () => {
    toggleDropdown(false);
    if (currentUser?.vai_tro === "CHU_TRO") go("/settings/system-config");
    else openSettingsModal();
  });
  root.querySelector("#menuItemSupport")?.addEventListener("click", () => {
    toggleDropdown(false);
    openSupportModal();
  });

  // Notification button navigates to notifications if available
  root.querySelector("#headerNotificationBtn")?.addEventListener("click", () => {
    const notifRoute = currentUser?.vai_tro === "KHACH_THUE" ? "/tenant/notifications" : "/notifications/inbox";
    go(notifRoute);
  });

  const refreshNotificationDot = async () => {
    try {
      const result = await api.get("/v1/notifications");
      const unread = hasUnreadNotifications(result.data);
      const dot = root.querySelector("#unreadNotificationDot");
      if (dot) dot.hidden = !unread;
    } catch (_) {
      const dot = root.querySelector("#unreadNotificationDot");
      if (dot) dot.hidden = true;
    }
  };
  refreshNotificationDot();
  window.addEventListener("focus", refreshNotificationDot);

  const createButton = root.querySelector("#createMenuBtn");
  const createMenu = root.querySelector("#createMenu");
  createButton?.addEventListener("click", () => {
    createMenu.hidden = !createMenu.hidden;
    createButton.setAttribute("aria-expanded", String(!createMenu.hidden));
  });
  createMenu?.querySelectorAll("[data-create-route]").forEach((button) => button.addEventListener("click", () => {
    createMenu.hidden = true;
    createButton.setAttribute("aria-expanded", "false");
    go(button.dataset.createRoute);
  }));
  document.addEventListener("click", (event) => {
    if (createMenu && !event.target.closest(".navbar-create-wrap")) {
      createMenu.hidden = true;
      createButton.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && createMenu && !createMenu.hidden) {
      createMenu.hidden = true;
      createButton.setAttribute("aria-expanded", "false");
      createButton.focus();
    }
  });

  return root.querySelector("#module-root");
}

export function setShellActive(root, tab) {
  const currentGroupLabel = GROUP_LABELS[tab.group] || "ISK19";
  const tabsInGroup = allowedTabs(window.__ISK19_USER__).filter((item) => item.group === tab.group && !item.hiddenFromNav);

  // Update Header Title & Breadcrumb
  const titleEl = root.querySelector("[data-title]");
  const groupEl = root.querySelector("[data-group]");
  if (titleEl) titleEl.textContent = tab.title;
  if (groupEl) groupEl.textContent = currentGroupLabel;

  // Render tabs only when group has more than 1 tab
  const tabsContainer = root.querySelector("[data-tabs]");
  if (tabsContainer) {
    if (tabsInGroup.length > 1) {
      tabsContainer.style.display = "flex";
      tabsContainer.innerHTML = tabsInGroup
        .map(
          (item) => `
          <button class="module-tab ${item.route === tab.route ? "is-active" : ""}" data-route="${item.route}">
            ${escapeHtml(item.tabLabel || item.title)}
          </button>
        `
        )
        .join("");

      tabsContainer.querySelectorAll("[data-route]").forEach((button) => {
        button.addEventListener("click", () => go(button.dataset.route));
      });
    } else {
      tabsContainer.style.display = "none";
      tabsContainer.innerHTML = "";
    }
  }

  // Active state in sidebar navigation
  root.querySelectorAll(".nav-group").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navGroup === tab.group);
  });
  root.querySelector("#sidebarSettingsBtn")?.classList.toggle("is-active", tab.group === "settings");
}
