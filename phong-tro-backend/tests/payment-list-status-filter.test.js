const test = require("node:test");
const assert = require("node:assert/strict");
const { Op } = require("sequelize");
const service = require("../src/services/thanhToan.service");
const { GiaoDichThanhToan } = require("../src/models");

test("payment list filters status in the database before pagination", async () => {
  const original = GiaoDichThanhToan.findAndCountAll;
  let query;
  GiaoDichThanhToan.findAndCountAll = async (options) => {
    query = options;
    return { count: 2, rows: [] };
  };
  try {
    const result = await service.getThanhToanList({ trang_thai_xac_nhan: "CHO_XAC_NHAN", exclude_zero: "1" }, { limit: 20, offset: 20 });
    assert.equal(query.where.trang_thai_xac_nhan, "CHO_XAC_NHAN");
    assert.equal(query.where.so_tien[Op.gt], 0);
    assert.equal(query.limit, 20);
    assert.equal(query.offset, 20);
    assert.equal(result.total, 2);
    await service.getThanhToanList({}, { limit: 20, offset: 0 });
    assert.equal(query.where.so_tien, undefined);
  } finally {
    GiaoDichThanhToan.findAndCountAll = original;
  }
});
