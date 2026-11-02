function attachRequestRooms(requests, renewals, moveOuts, proposals, contracts) {
  const roomByContract = new Map(contracts.map((row) => [row.ma_hop_dong, row.ma_phong]));
  const roomByRequest = new Map(proposals.map((row) => [row.ma_yeu_cau, row.ma_phong]));
  for (const row of [...renewals, ...moveOuts]) roomByRequest.set(row.ma_yeu_cau, roomByContract.get(row.ma_hop_dong) || null);
  return requests.map((row) => ({ ...row.toJSON(), ma_phong: roomByRequest.get(row.ma_yeu_cau) || null }));
}

module.exports = { attachRequestRooms };
