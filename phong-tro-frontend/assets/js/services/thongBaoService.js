export const thongBaoService = {
  getAll: () => window.ApiClient.get("/v1/notifications"),
};
