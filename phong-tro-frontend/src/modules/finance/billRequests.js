export async function fetchBillPage(api, listUrl, summaryUrl) {
  const [billResponse, summaryResult] = await Promise.all([
    api.get(listUrl),
    api.get(summaryUrl).then((value) => ({ value }), (error) => ({ error })),
  ]);
  return { billResponse, summaryResult };
}
