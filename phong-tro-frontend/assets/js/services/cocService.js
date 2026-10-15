export const cocService = {
  getAll: () => window.ApiClient.get("/dat-coc?limit=100"),
};
