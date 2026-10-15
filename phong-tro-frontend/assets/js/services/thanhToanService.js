export const thanhToanService = {
  getAll: () => window.ApiClient.get("/khoan-phai-thu/payment/list?limit=100"),
};
