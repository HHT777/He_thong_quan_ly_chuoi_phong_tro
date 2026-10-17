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
      IDEMPOTENCY_CONFLICT: "Yêu cầu gửi lại không khớp dữ liệu ban đầu.",
    };
    const error = new Error(friendly[code] || payload.error?.message || payload.message || `Yêu cầu thất bại (${response.status})`);
    error.status = response.status;
    error.code = code;
    error.details = payload.error?.details || payload.details;
    if (response.status === 401) localStorage.removeItem(TOKEN_KEY);
    throw error;
  }
  return payload;
}

export const api = {
  request,
  get: (path) => request(path),
  post: (path, body, headers) => request(path, { method: "POST", body: JSON.stringify(body), headers }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body, headers) => request(path, { method: "PATCH", body: JSON.stringify(body), headers }),
  del: (path) => request(path, { method: "DELETE" }),
  postForm: (path, body) => request(path, { method: "POST", body }),
};

export { TOKEN_KEY };
