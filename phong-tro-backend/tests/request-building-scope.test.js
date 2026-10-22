const test = require("node:test");
const assert = require("node:assert/strict");
const { attachRequestRooms } = require("../src/utils/requestBuildingScope");

test("FR-035 requests keep their own room when one tenant has contracts in different buildings", () => {
  const requests = ["renew-old", "move-new", "co-new", "unlinked"].map((id) => ({ ma_yeu_cau: id, ma_khach_thue: "same-tenant", toJSON() { return { ma_yeu_cau: this.ma_yeu_cau, ma_khach_thue: this.ma_khach_thue }; } }));
  const result = attachRequestRooms(
    requests,
    [{ ma_yeu_cau: "renew-old", ma_hop_dong: "old-contract" }],
    [{ ma_yeu_cau: "move-new", ma_hop_dong: "new-contract" }],
    [{ ma_yeu_cau: "co-new", ma_phong: "new-room" }],
    [{ ma_hop_dong: "old-contract", ma_phong: "old-room" }, { ma_hop_dong: "new-contract", ma_phong: "new-room" }],
  );
  assert.deepEqual(result.map((row) => row.ma_phong), ["old-room", "new-room", "new-room", null]);
});
