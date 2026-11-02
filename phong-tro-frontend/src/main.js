import "./shared/styles/design-system.css";
import "./shared/styles/layout.css";
import "./shared/styles/dashboard.css";
import "./shared/styles/management.css";
import "./shared/styles/app.css";
import "./shared/styles/vietnamese.css";
import "./shared/styles/tabs.css";
import "./shared/styles/ui2-shell.css";
import { api } from "./core/api.js";
import { isAuthenticated, isTenant, login, requestPasswordReset, user, validateSession } from "./core/session.js";
import { currentRoute, defaultRoute, go, renderRoute, routeAllowed } from "./core/router.js";
import { captureDraft, draftForUser, restoreDraft } from "./core/session-draft.mjs";
import { mountShell, setShellActive } from "./layout/app-shell.js";

const root = document.querySelector("#app");
let pendingTenantDraft = null;
let activeTenant = null;

function loginScreen() {
  root.innerHTML = `<main class="login-shell"><section class="login-intro"><div class="brand">ISK19</div><div><p class="eyebrow">Quản lý chuỗi phòng trọ</p><h1>Mọi căn phòng, rõ ràng trong một nhịp.</h1><p>Quản lý tài sản, hợp đồng, vận hành và tài chính tại một nơi.</p></div></section><section class="login-form-panel"><h2>Chào mừng trở lại</h2><p>Đăng nhập để tiếp tục.</p><form id="login-form" class="login-form"><label>Tên đăng nhập<input name="ten_dang_nhap" autocomplete="username" required></label><label>Mật khẩu<input name="mat_khau" type="password" autocomplete="current-password" required></label><button class="btn btn--primary">Đăng nhập</button><button type="button" class="login-link" data-forgot-password>Quên mật khẩu?</button><p class="form-error" data-error></p></form></section></main>`;
  root.querySelector("[data-forgot-password]").addEventListener("click", forgotPasswordScreen);
  root.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const error = root.querySelector("[data-error]"); const button = form.querySelector("button"); button.disabled = true;
    try {
      const currentUser = await login(Object.fromEntries(new FormData(form)));
      const saved = currentUser.vai_tro === "KHACH_THUE" ? draftForUser(pendingTenantDraft, currentUser.ma_tai_khoan) : null;
      window.location.hash = `#${saved && routeAllowed(saved.route, currentUser) ? saved.route : defaultRoute(currentUser)}`;
      boot();
    }
    catch (cause) { error.textContent = cause.message; } finally { button.disabled = false; }
  });
}

function forgotPasswordScreen() {
  root.innerHTML = `<main class="login-shell login-shell--reset"><section class="login-intro"><div class="brand">ISK19</div><div><p class="eyebrow">Quản lý chuỗi phòng trọ</p><h1>Lấy lại quyền truy cập</h1><p>Gửi yêu cầu để Chủ trọ xem xét đặt lại mật khẩu cho bạn.</p></div></section><section class="login-form-panel"><h2>Quên mật khẩu</h2><p>Nhập số điện thoại đã đăng ký cho tài khoản khách thuê.</p><form id="password-reset-form" class="login-form"><label>Số điện thoại<input name="so_dien_thoai" inputmode="tel" autocomplete="tel" placeholder="0901234567" required></label><button class="btn btn--primary">Gửi yêu cầu</button><button type="button" class="login-link" data-back-login>Quay lại đăng nhập</button><p class="form-error" data-error role="alert"></p></form></section></main>`;
  root.querySelector("[data-back-login]").addEventListener("click", loginScreen);
  root.querySelector("#password-reset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = root.querySelector("[data-error]");
    error.className = "form-error";
    const button = form.querySelector("button");
    const phone = String(new FormData(form).get("so_dien_thoai") || "").trim();
    if (!/^(?:0|\+84)\d{9,10}$/.test(phone)) {
      error.textContent = "Số điện thoại không hợp lệ";
      return;
    }
    button.disabled = true;
    try {
      await requestPasswordReset(phone);
      error.className = "form-success";
      error.textContent = "Đã gửi yêu cầu. Chủ trọ sẽ xét duyệt và thông báo kết quả cho bạn.";
      form.reset();
    } catch (cause) {
      error.className = "form-error";
      error.textContent = cause.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  if (!isAuthenticated()) { loginScreen(); return; }
  let currentUser = user();
  if (currentUser?.vai_tro === "KHACH_THUE") {
    try { currentUser = await validateSession(); }
    catch (error) { if (error.status === 401) return; loginScreen(); root.querySelector("[data-error]").textContent = error.message; return; }
    if (!currentUser) { loginScreen(); return; }
    activeTenant = currentUser;
  }
  window.__ISK19_USER__ = currentUser;
  const main = mountShell(root, currentUser);
  const context = { api, user: currentUser, main, root, go, isTenant: isTenant(), setActive: (tab) => setShellActive(root, tab, currentUser) };
  const refresh = async () => {
    await renderRoute(context);
    if (currentUser.vai_tro === "KHACH_THUE" && draftForUser(pendingTenantDraft, currentUser.ma_tai_khoan) && currentRoute() === pendingTenantDraft.route) {
      restoreDraft(root, pendingTenantDraft);
      pendingTenantDraft = null;
    }
  };
  window.onhashchange = refresh;
  if (!window.location.hash) go(defaultRoute(currentUser)); else await refresh();
}

window.addEventListener("isk19:session-expired", () => {
  if (!activeTenant) return;
  pendingTenantDraft = captureDraft(root, currentRoute(), activeTenant.ma_tai_khoan);
  activeTenant = null;
  window.onhashchange = null;
  loginScreen();
  root.querySelector("[data-error]").textContent = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
});

boot();
