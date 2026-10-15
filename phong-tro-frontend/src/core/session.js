import { api, TOKEN_KEY } from "./api.js";

const USER_KEY = "trohub_user";
export const user = () => { try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; } };
export const isAuthenticated = () => Boolean(localStorage.getItem(TOKEN_KEY) && user());
export const isTenant = () => user()?.vai_tro === "KHACH_THUE";

export async function login(credentials) {
  const result = await api.post("/auth/login", credentials);
  localStorage.setItem(TOKEN_KEY, result.data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.data.user));
  return result.data.user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
