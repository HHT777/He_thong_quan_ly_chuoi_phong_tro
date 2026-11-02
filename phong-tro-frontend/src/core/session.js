import { api, TOKEN_KEY, clearStoredSession } from "./api.js";

const USER_KEY = "trohub_user";
export const user = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } };
export const isAuthenticated = () => Boolean(localStorage.getItem(TOKEN_KEY) && user());
export const isTenant = () => user()?.vai_tro === "KHACH_THUE";

function storeSession(token, currentUser) {
  if (typeof token !== "string" || !token || !currentUser) throw new Error("Phản hồi phiên đăng nhập không hợp lệ");
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
}

export async function login(credentials) {
  const result = await api.post("/auth/login", credentials);
  storeSession(result.data.token, result.data.user);
  return result.data.user;
}

export async function requestPasswordReset(phone) {
  const result = await api.request("/auth/password-reset-requests", {
    method: "POST",
    body: JSON.stringify({ so_dien_thoai: phone }),
    publicRequest: true,
  });
  return result.data;
}

export async function changePassword(currentPassword, newPassword) {
  const result = await api.patch("/v1/account/password", { currentPassword, newPassword });
  if (result.data?.changed !== true) throw new Error("Không thể xác nhận đổi mật khẩu");
  if (isTenant()) storeSession(result.data.token, result.data.user);
  return isTenant() ? result.data.user : user();
}

export async function validateSession() {
  if (!isAuthenticated()) return null;
  const result = await api.get("/auth/profile");
  const profile = result.data;
  if (!profile || !["CHU_TRO", "KHACH_THUE"].includes(profile.vai_tro)) {
    clearStoredSession();
    return null;
  }
  const currentUser = { ...profile, ma_khach_thue: profile.khachThue?.ma_khach_thue ?? null };
  if (profile.vai_tro === "KHACH_THUE") localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  return profile.vai_tro === "KHACH_THUE" ? currentUser : user();
}

export function logout() {
  clearStoredSession();
}
