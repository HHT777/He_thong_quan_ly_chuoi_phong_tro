const test = require("node:test");
const assert = require("node:assert/strict");
const { HopDong } = require("../src/models");
const service = require("../src/services/hopDong.service");

test("FR-035 contract list requests the room name for display", async () => {
  const original = HopDong.findAndCountAll;
  let roomAttributes;
  HopDong.findAndCountAll = async (options) => {
    roomAttributes = options.include.find((item) => item.as === "phongTro")?.attributes;
    return { count: 0, rows: [] };
  };
  try {
    await service.getHopDongList({}, { limit: 10, offset: 0 });
    assert.ok(roomAttributes?.includes("so_phong"));
  } finally {
    HopDong.findAndCountAll = original;
  }
});
