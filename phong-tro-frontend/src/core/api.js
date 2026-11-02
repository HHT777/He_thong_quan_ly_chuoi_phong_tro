const API_ROOT = window.__API_BASE_URL__ || "/api";
const TOKEN_KEY = "trohub_token";
const USER_KEY = "trohub_user";

function token() { return localStorage.getItem(TOKEN_KEY); }
function storedTenant() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null")?.vai_tro === "KHACH_THUE"; } catch { return false; }
}
export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function handleUnauthorized(response, path, requestToken) {
  if (response.status !== 401 || path === "/auth/login" || !requestToken || token() !== requestToken) return;
  if (!storedTenant()) return;
  clearStoredSession();
  window.dispatchEvent(new Event("isk19:session-expired"));
}

async function request(path, options = {}) {
  const { publicRequest = false, ...fetchOptions } = options;
  const formData = fetchOptions.body instanceof FormData;
  const headers = { ...(formData ? {} : { "Content-Type": "application/json" }), ...(fetchOptions.headers || {}) };
  const requestToken = token();
  const requestWasTenant = storedTenant();
  if (requestToken && !publicRequest) headers.Authorization = `Bearer ${requestToken}`;
  const response = await fetch(`${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`, { ...fetchOptions, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    handleUnauthorized(response, path, requestToken);
    const code = payload.error?.code || payload.code;
    const friendly = {
      ADJUSTMENT_EXCEEDS_OUTSTANDING: "Mức giảm vượt số tiền còn nợ của phiếu.",
      DEPOSIT_OFFSET_CANNOT_CANCEL: "Khoản khấu trừ cọc không được phép hủy.",
      IDEMPOTENCY_CONFLICT: "Yêu cầu đã được gửi với nội dung khác.",
      INVALID_INCIDENT_CATEGORY: "Loại sự cố không hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng chọn lại loại sự cố.",
    };
    const message = response.status === 404 && code === "RESOURCE_NOT_FOUND"
      ? "Không tìm thấy hoặc bạn không có quyền với đối tượng này"
      : friendly[code] || payload.error?.message || payload.message || `Yêu cầu thất bại (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.details = payload.error?.details || payload.details;
    if (response.status === 401 && (!requestWasTenant || token() === requestToken)) localStorage.removeItem(TOKEN_KEY);
    throw error;
  }
  return payload;
}

async function getHtml(path) {
  const headers = {};
  const requestToken = token();
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`;
  const response = await fetch(`${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`, { headers });
  if (!response.ok) {
    handleUnauthorized(response, path, requestToken);
    const payload = await response.json().catch(() => ({}));
    const code = payload.error?.code || payload.code;
    const message = response.status === 404 && code === "RESOURCE_NOT_FOUND"
      ? "Không tìm thấy hoặc bạn không có quyền với đối tượng này"
      : payload.error?.message || payload.message || `Yêu cầu thất bại (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    throw error;
  }
  return response.text();
}

async function getBlob(path) {
  const headers = {};
  const requestToken = token();
  if (requestToken) headers.Authorization = `Bearer ${requestToken}`;
  const response = await fetch(`${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`, { headers });
  if (!response.ok) {
    handleUnauthorized(response, path, requestToken);
    const payload = await response.json().catch(() => ({}));
    const code = payload.error?.code || payload.code;
    const error = new Error(response.status === 404 && code === "RESOURCE_NOT_FOUND"
      ? "Không tìm thấy hoặc bạn không có quyền với đối tượng này"
      : payload.error?.message || payload.message || `Yêu cầu thất bại (${response.status})`);
    error.status = response.status;
    error.code = code;
    throw error;
  }
  return { blob: await response.blob(), disposition: response.headers.get("Content-Disposition") || "" };
}

export const api = {
  request,
  getHtml,
  getBlob,
  get: (path) => request(path),
  post: (path, body, headers) => request(path, { method: "POST", body: JSON.stringify(body), headers }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body, headers) => request(path, { method: "PATCH", body: JSON.stringify(body), headers }),
  del: (path) => request(path, { method: "DELETE" }),
  postForm: (path, body) => request(path, { method: "POST", body }),
};

export { TOKEN_KEY };
