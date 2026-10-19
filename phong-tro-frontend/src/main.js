import "./shared/styles/design-system.css";
import "./shared/styles/layout.css";
import "./shared/styles/dashboard.css";
import "./shared/styles/management.css";
import "./shared/styles/app.css";
import "./shared/styles/vietnamese.css";
import "./shared/styles/tabs.css";
import { api } from "./core/api.js";
import { isAuthenticated, isTenant, login, user } from "./core/session.js";
import { defaultRoute, go, renderRoute } from "./core/router.js";
import { mountShell, setShellActive } from "./layout/app-shell.js";

const root = document.querySelector("#app");

function loginScreen() {
  root.innerHTML = `<main class="login-shell"><section class="login-intro"><div class="brand">ISK19</div><div><p class="eyebrow">Quản lý chuỗi phòng trọ</p><h1>Mọi căn phòng, rõ ràng trong một nhịp.</h1><p>Quản lý tài sản, hợp đồng, vận hành và tài chính tại một nơi.</p></div></section><section class="login-form-panel"><h2>Chào mừng trở lại</h2><p>Đăng nhập để tiếp tục.</p><form id="login-form" class="login-form"><label>Tên đăng nhập<input name="ten_dang_nhap" autocomplete="username" required></label><label>Mật khẩu<input name="mat_khau" type="password" autocomplete="current-password" required></label><button class="btn btn--primary">Đăng nhập</button><p class="form-error" data-error></p></form></section></main>`;
  root.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const error = root.querySelector("[data-error]"); const button = form.querySelector("button"); button.disabled = true;
    try { const currentUser = await login(Object.fromEntries(new FormData(form))); window.location.hash = `#${defaultRoute(currentUser)}`; boot(); }
    catch (cause) { error.textContent = cause.message; } finally { button.disabled = false; }
  });
}

async function boot() {
  if (!isAuthenticated()) { loginScreen(); return; }
  const currentUser = user(); window.__ISK19_USER__ = currentUser;
  const main = mountShell(root, currentUser);
  const context = { api, user: currentUser, main, root, go, isTenant: isTenant(), setActive: (tab) => setShellActive(root, tab) };
  const refresh = () => renderRoute(context);
  window.onhashchange = refresh;
  if (!window.location.hash) go(defaultRoute(currentUser)); else await refresh();
}

boot();
