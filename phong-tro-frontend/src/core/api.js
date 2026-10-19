const API_ROOT = window.__API_BASE_URL__ || "/api";
const TOKEN_KEY = "trohub_token";

function token() { return localStorage.getItem(TOKEN_KEY); }

async function request(path, options = {}) {
  const formData = options.body instanceof FormData;
  const headers = { ...(formData ? {} : { "Content-Type": "application/json" }), ...(options.headers || {}) };
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const code = payload.error?.code || payload.code;
    const friendly = {
      ADJUSTMENT_EXCEEDS_OUTSTANDING: "Mức giảm vượt số tiền còn nợ của phiếu.",
      DEPOSIT_OFFSET_CANNOT_CANCEL: "Khoản khấu trừ cọc không được phép hủy.",
      IDEMPOTENCY_CONFLICT: "Yêu cầu đã được gửi với nội dung khác.",
    };
    const message = response.status === 404 && code === "RESOURCE_NOT_FOUND"
      ? "Không tìm thấy hoặc bạn không có quyền với đối tượng này"
      : friendly[code] || payload.error?.message || payload.message || `Yêu cầu thất bại (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.details = payload.error?.details || payload.details;
    if (response.status === 401) localStorage.removeItem(TOKEN_KEY);
    throw error;
  }
  return payload;
}

async function getHtml(path) {
  const headers = {};
  if (token()) headers.Authorization = `Bearer ${token()}`;
  const response = await fetch(`${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`, { headers });
  if (!response.ok) {
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

export const api = {
  request,
  getHtml,
  get: (path) => request(path),
  post: (path, body, headers) => request(path, { method: "POST", body: JSON.stringify(body), headers }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body, headers) => request(path, { method: "PATCH", body: JSON.stringify(body), headers }),
  del: (path) => request(path, { method: "DELETE" }),
  postForm: (path, body) => request(path, { method: "POST", body }),
};

export { TOKEN_KEY };
