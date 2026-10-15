(function () {
  const config = window.API_CONFIG || { BASE_URL: "/api" };
  const TOKEN_KEY = "trohub_token";
  const USER_KEY = "trohub_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function appRoot() {
    const pathname = window.location.pathname;
    const pagesIndex = pathname.indexOf("/pages/");
    if (pagesIndex >= 0) return pathname.slice(0, pagesIndex + 1);
    return pathname.slice(0, pathname.lastIndexOf("/") + 1);
  }

  function pagePath(relativePath) {
    return `${appRoot()}pages/${String(relativePath || "").replace(/^\/+/, "")}`;
  }

  async function request(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const response = await fetch(`${config.BASE_URL}${normalizedPath}`, {
      ...options,
      headers,
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok || body.success === false) {
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
      const error = new Error(
        body.error?.message || body.message || `Request failed (${response.status})`,
      );
      error.code = body.error?.code;
      error.status = response.status;
      error.details = body.error?.details || body.details;
      throw error;
    }

    return body;
  }

  window.ApiClient = {
    TOKEN_KEY,
    USER_KEY,
    request,
    appRoot,
    pagePath,
    getToken,
    getUser: () => {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
      } catch {
        return null;
      }
    },
    isAuthenticated: () => Boolean(getToken()),
    homePath: () => {
      return pagePath(
        window.ApiClient.getUser()?.vai_tro === "KHACH_THUE"
          ? "khach-thue/thong-tin-thue.html"
          : "dashboard.html",
      );
    },
    redirectHome: () => {
      window.location.href = window.ApiClient.homePath();
    },
    login: async (credentials) => {
      const body = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      localStorage.setItem(TOKEN_KEY, body.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(body.data.user));
      return body.data;
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    get: (path) => request(path),
    post: (path, data, headers = {}) =>
      request(path, { method: "POST", body: JSON.stringify(data), headers }),
    postForm: (path, formData) =>
      request(path, { method: "POST", body: formData }),
    put: (path, data) =>
      request(path, { method: "PUT", body: JSON.stringify(data) }),
    patch: (path, data, headers = {}) =>
      request(path, { method: "PATCH", body: JSON.stringify(data), headers }),
    del: (path) => request(path, { method: "DELETE" }),
  };
})();
