export const roundingAdjustment = (amount) => Math.round((Math.round(Number(amount)) - Number(amount)) * 100) / 100;

export async function roundOldDraftBills(api, confirm) {
  const drafts = [];
  for (let page = 1; ; page += 1) {
    const response = await api.get(`/khoan-phai-thu?issuance=DRAFT&page=${page}&limit=100`);
    drafts.push(...(response.data || []));
    if (!response.pagination?.hasNext) break;
  }
  const candidates = drafts.filter((bill) => !bill.da_gui && roundingAdjustment(bill.tong_phai_tra) !== 0);
  if (!candidates.length) return { rounded: 0, failed: 0, found: 0 };
  if (!await confirm(`Làm tròn tổng tiền của ${candidates.length} phiếu Nháp cũ đến đồng? Mỗi phiếu sẽ có một dòng điều chỉnh phần lẻ.`)) return { rounded: 0, failed: 0, found: candidates.length, cancelled: true };
  let rounded = 0; let failed = 0;
  for (const candidate of candidates) {
    try {
      const response = await api.get(`/khoan-phai-thu/${encodeURIComponent(candidate.ma_thanh_toan)}`);
      const bill = response.data;
      const delta = !bill.da_gui && roundingAdjustment(bill.tong_phai_tra);
      if (!delta) continue;
      await api.post(`/v1/bills/${encodeURIComponent(candidate.ma_thanh_toan)}/adjustments`, { delta, reason: "Làm tròn tổng phiếu thu đến đồng" });
      rounded += 1;
    } catch { failed += 1; }
  }
  return { rounded, failed, found: candidates.length };
}
