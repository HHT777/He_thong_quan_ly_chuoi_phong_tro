export const phongService = {
  getAll: () => window.ApiClient.get("/phong?limit=100"),
};
