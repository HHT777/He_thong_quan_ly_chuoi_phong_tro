export const hopDongService = {
  getAll: () => window.ApiClient.get("/hop-dong?limit=100"),
};
