/**
 * sidebar.js — điều khiển sidebar sau khi được include vào trang
 * Gọi initSidebar() sau khi sự kiện 'partials:ready' xảy ra.
 */
function initSidebar() {
  const sidebar = document.querySelector("[data-sidebar]");
  const backdrop = document.querySelector("[data-sidebar-backdrop]");
  const openBtn = document.querySelector("[data-sidebar-open]");
  const closeBtn = document.querySelector("[data-sidebar-close]");
  if (!sidebar) return;

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("trohub_user") || "null");
    } catch {
      return null;
    }
  })();
  const isTenant = user?.vai_tro === "KHACH_THUE";
  const ownerItems = [
    ["dashboard", "dashboard.html", "Tổng quan", "TQ"],
    ["tai-san", "can-tro.html", "Căn trọ", "CT"],
    ["phong", "phong.html", "Phòng", "P"],
    ["cu-dan", "khach-thue.html", "Cư dân", "CD"],
    ["hop-dong", "hop-dong.html", "Hợp đồng", "HĐ"],
    ["coc", "coc.html", "Tiền cọc", "C"],
    ["dien-nuoc", "dien-nuoc.html", "Chỉ số điện", "Đ"],
    ["tien-phong", "tien-phong.html", "Hóa đơn tiền phòng", "HĐ"],
    ["thanh-toan", "thanh-toan.html", "Thanh toán", "TT"],
    ["cong-no", "cong-no.html", "Công nợ", "CN"],
    ["thu-chi", "thu-chi.html", "Thu chi", "TC"],
    ["su-co", "su-co.html", "Sự cố", "SC"],
    ["tra-phong", "tra-phong.html", "Trả phòng", "TP"],
    ["thong-bao", "thong-bao.html", "Thông báo", "TB"],
    ["bao-cao", "bao-cao.html", "Báo cáo", "BC"],
  ];
  const tenantItems = [
    [
      "thong-tin-thue",
      "khach-thue/thong-tin-thue.html",
      "Thông tin thuê",
      "TT",
    ],
    ["tien-phai-tra", "khach-thue/tien-phai-tra.html", "Tiền phải trả", "T"],
    [
      "thanh-toan-thue",
      "khach-thue/thanh-toan.html",
      "Theo dõi thanh toán",
      "TT",
    ],
    ["hop-dong-thue", "khach-thue/hop-dong.html", "Hợp đồng", "HĐ"],
    [
      "nhap-chi-so-dien",
      "khach-thue/nhap-chi-so-dien.html",
      "Nhập chỉ số điện",
      "Đ",
    ],
    [
      "yeu-cau-gia-han",
      "khach-thue/yeu-cau-gia-han.html",
      "Yêu cầu gia hạn",
      "GH",
    ],
    [
      "yeu-cau-tra-phong",
      "khach-thue/yeu-cau-tra-phong.html",
      "Yêu cầu trả phòng",
      "TP",
    ],
    ["thong-bao-thue", "khach-thue/thong-bao.html", "Thông báo", "TB"],
    ["su-co-thue", "khach-thue/su-co.html", "Gửi sự cố", "SC"],
  ];
  const adminPages = new Set([
    "dashboard",
    "tai-san",
    "cu-dan",
    "hop-dong",
    "thu-chi",
    "phong",
    "coc",
    "cong-no",
    "dien-nuoc",
    "thanh-toan",
    "bao-cao",
    "thong-bao",
    "su-co",
    "tra-phong",
    "tien-phong",
  ]);
  const currentPage = document.body.getAttribute("data-active-page");

  const navs = sidebar.querySelectorAll(".sidebar__nav");
  const primaryNav = navs[0];
  if (primaryNav) {
    primaryNav.innerHTML = (isTenant ? tenantItems : ownerItems)
      .map(
        ([page, path, label, icon]) =>
          `<a href="${window.ApiClient?.pagePath?.(path) || path}" class="nav-item" data-page="${page}"><span class="nav-item__icon" aria-hidden="true">${icon}</span><span>${label}</span></a>`,
      )
      .join("");
  }
  if (isTenant && navs[1]) {
    navs[1].hidden = true;
    const settingsLabel = navs[1].previousElementSibling;
    if (settingsLabel?.classList.contains("sidebar__group-label")) {
      settingsLabel.hidden = true;
    }
  }

  const normalizePageUrl = (href) => {
    if (!href) return href;
    if (
      /^https?:\/\//i.test(href) ||
      /^mailto:/i.test(href) ||
      href.startsWith("#")
    ) {
      return href;
    }

    const marker = "/pages/";
    const markerIndex = href.toLowerCase().indexOf(marker);
    const relativePath = markerIndex >= 0
      ? href.slice(markerIndex + marker.length)
      : href.trim().replace(/^\.?\/+/, "").replace(/^(?:pages\/)+/i, "");
    return window.ApiClient?.pagePath?.(relativePath) || `/pages/${relativePath}`;
  };

  const normalizeCurrentPath = (value) => {
    if (!value) return value;
    return value.replace(/\/+(pages\/)+/gi, "/pages/");
  };

  const open = () => {
    sidebar.classList.add("is-open");
    if (backdrop) backdrop.classList.add("is-visible");
  };
  const close = () => {
    sidebar.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-visible");
  };

  openBtn && openBtn.addEventListener("click", open);
  closeBtn && closeBtn.addEventListener("click", close);
  backdrop && backdrop.addEventListener("click", close);

  sidebar.querySelectorAll(".nav-item").forEach((item) => {
    if (item.dataset.navBound === "true") return;
    item.dataset.navBound = "true";

    const href = item.getAttribute("href");
    if (href) item.setAttribute("href", normalizePageUrl(href));

    item.addEventListener("click", (event) => {
      const target = item.getAttribute("href");
      if (
        !target ||
        /^https?:\/\//i.test(target) ||
        /^mailto:/i.test(target) ||
        target.startsWith("#")
      )
        return;
      close();

      const normalized = target;
      const currentPath = normalizeCurrentPath(window.location.pathname);
      if (normalized !== currentPath) {
        event.preventDefault();
        window.location.href = normalized;
      }
    });
  });

  const activePage = document.body.getAttribute("data-active-page");
  if (activePage) {
    sidebar.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle(
        "is-active",
        item.getAttribute("data-page") === activePage,
      );
    });
  }
}
