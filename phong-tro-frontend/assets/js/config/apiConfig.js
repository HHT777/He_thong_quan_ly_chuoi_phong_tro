/**
 * apiConfig.js
 * Shared API configuration for both Vite (4173) and Apache (80).
 *
 *   const res = await fetch(`${API_CONFIG.BASE_URL}/bao-cao/tong-quan`);
 *   const data = await res.json();
 */
const API_CONFIG = {
  // Chỉ Vite (port 4173) có proxy /api. Live Server (thường 5500),
  // Apache và file:// phải gọi trực tiếp backend để tránh HTTP 405.
  BASE_URL:
    window.__API_BASE_URL__ ||
    (["4173"].includes(window.location.port)
      ? "/api"
      : "http://localhost:3001/api"),
};

if (typeof window !== "undefined") {
  window.API_CONFIG = API_CONFIG;
}
