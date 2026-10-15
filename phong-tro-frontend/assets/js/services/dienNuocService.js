export const dienNuocService = {
  getAll: () => window.ApiClient.get("/v1/meter-readings?pageSize=100"),
};
