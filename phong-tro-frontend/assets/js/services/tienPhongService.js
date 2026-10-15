export const tienPhongService = {
  getAll: () => window.ApiClient.get("/khoan-phai-thu?limit=100"),
};
