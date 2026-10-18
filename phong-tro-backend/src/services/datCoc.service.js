const { TienCoc, HopDong, KhachThue, PhongTro } = require("../models");
const { Op } = require("sequelize");
const { assertOwned, getOwnedBuildingIds } = require("./ownership.service");

class TienCocService {
  async createDatCoc(data, requester) {
    await assertOwned(requester, "contract", data.ma_hop_dong);
    const contract = await HopDong.findByPk(data.ma_hop_dong);
    if (!contract) throw { status: 404, message: "Hợp đồng không tồn tại" };
    if (await TienCoc.findOne({ where: { ma_hop_dong: data.ma_hop_dong } })) throw { status: 409, message: "Hợp đồng đã có hồ sơ tiền cọc" };
    return TienCoc.create({
      ma_hop_dong: data.ma_hop_dong,
      so_tien_coc: data.so_tien_coc,
      ngay_nhan_coc: data.ngay_nhan_coc || null,
      trang_thai: data.ngay_nhan_coc ? "DA_NHAN" : "CHUA_NHAN",
      so_tien_da_hoan: 0,
      so_tien_da_khau_tru: 0,
    });
  }
  async getDatCocList(filters, pagination, requester) {
    const where = {};
    if (filters.trang_thai) where.trang_thai = filters.trang_thai;
    if (filters.ma_hop_dong) where.ma_hop_dong = filters.ma_hop_dong;
    const ownedBuildings = await getOwnedBuildingIds(requester);
    const { count, rows } = await TienCoc.findAndCountAll({
      where, limit: pagination.limit, offset: pagination.offset,
      include: [{ model: HopDong, as: "hopDong", required: true, include: [{ model: KhachThue, as: "khachThue" }, { model: PhongTro, as: "phongTro", required: true, where: { ma_can: { [Op.in]: ownedBuildings } } }] }],
      order: [["ma_tien_coc", "ASC"]],
    });
    return { count, total: count, data: rows };
  }
  async getDatCocById(id, requester) {
    await assertOwned(requester, "deposit", id);
    const row = await TienCoc.findByPk(id, { include: [{ model: HopDong, as: "hopDong" }] });
    if (!row) throw { status: 404, message: "Hồ sơ tiền cọc không tồn tại" };
    return row;
  }
  async updateDatCoc(id, data, requester) {
    const row = await this.getDatCocById(id, requester);
    const refunded = Number(data.so_tien_da_hoan ?? row.so_tien_da_hoan);
    const deducted = Number(data.so_tien_da_khau_tru ?? row.so_tien_da_khau_tru);
    if (refunded + deducted > Number(row.so_tien_coc)) throw { status: 422, message: "Tổng hoàn và khấu trừ vượt tiền cọc" };
    await row.update(data);
    return row;
  }
  async confirmDeposit(id, requester) {
    const row = await this.getDatCocById(id, requester);
    await row.update({ trang_thai: "DA_NHAN", ngay_nhan_coc: row.ngay_nhan_coc || new Date() });
    return row;
  }
  async cancelDeposit(id, requester) {
    const row = await this.getDatCocById(id, requester);
    if (row.trang_thai === "CHUA_NHAN") throw { status: 409, message: "Chưa nhận cọc nên không có khoản để hoàn" };
    await row.update({ trang_thai: "DA_HOAN", so_tien_da_hoan: Number(row.so_tien_coc) - Number(row.so_tien_da_khau_tru) });
    return row;
  }
}
module.exports = new TienCocService();
