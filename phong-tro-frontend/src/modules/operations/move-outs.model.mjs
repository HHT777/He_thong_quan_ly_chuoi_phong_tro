export function actionableMoveOutRequests(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    row.trang_thai === "DA_PHE_DUYET" && row.ma_hop_dong && row.trang_thai_hop_dong !== "DA_THANH_LY");
}
