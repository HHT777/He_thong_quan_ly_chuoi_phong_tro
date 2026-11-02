const { PhongTro, CanTro, ThanhVienPhong, HopDong, KhachThue, TaiSan } = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { writeAuditLog } = require("./auditLog.service");
const { assertOwned, getOwnedBuildingIds } = require("./ownership.service");

class PhongService {
  async createPhong(data, transaction = null) {
    // Check if can exists
    const canTro = await CanTro.findByPk(data.ma_can, { transaction });
    if (!canTro) {
      throw {
        status: 404,
        message: "Căn trọ không tồn tại",
      };
    }

    const phong = await PhongTro.create({
      ma_can: data.ma_can,
      so_phong: data.so_phong,
      dien_tich: data.dien_tich,
      gia_thue: data.gia_thue,
      so_nguoi_toi_da: data.so_nguoi_toi_da,
      trang_thai: data.trang_thai || "TRONG",
      noi_that_mo_ta: data.noi_that_mo_ta || null,
    }, { transaction });

    return phong;
  }

  async getPhongList(filters, pagination, requester) {
    const ownedBuildings = await getOwnedBuildingIds(requester);
    const where = { ma_can: { [Op.in]: ownedBuildings } };

    if (filters.ma_can) {
      await assertOwned(requester, "building", filters.ma_can);
      where.ma_can = filters.ma_can;
    }

    if (filters.trang_thai) {
      where.trang_thai = filters.trang_thai;
    }

    const { count, rows } = await PhongTro.findAndCountAll({
      where,
      include: [
        {
          model: CanTro,
          as: "canTro",
          attributes: ["ten_can", "dia_chi"],
        },
      ],
      limit: pagination.limit,
      offset: pagination.offset,
      order: [["ma_phong", "ASC"]],
    });

    return { total: count, data: rows };
  }

  async getPhongById(maPhong, requester) {
    if (requester) await assertOwned(requester, "room", maPhong);
    const phong = await PhongTro.findByPk(maPhong, {
      include: [
        {
          model: CanTro,
          as: "canTro",
        },
        {
          model: TaiSan,
          as: "taiSans",
          attributes: ["ten_tai_san", "so_luong", "tinh_trang", "ghi_chu"],
          separate: true,
          order: [["ten_tai_san", "ASC"]],
        },
        {
          model: ThanhVienPhong,
          as: "thanhVienPhongs",
          attributes: ["ho_ten", "so_dien_thoai"],
          where: { trang_thai_cu_tru: "DANG_O" },
          required: false,
        },
        {
          model: HopDong,
          as: "hopDongs",
          attributes: ["ma_hop_dong"],
          where: { trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } },
          required: false,
          include: [{ model: KhachThue, as: "khachThue", attributes: ["ho_ten", "so_dien_thoai"] }],
        },
      ],
    });

    if (!phong) {
      throw {
        status: 404,
        message: "Phòng trọ không tồn tại",
      };
    }

    const namedTenants = (phong.hopDongs || []).map((contract) => contract.khachThue).filter(Boolean);
    const currentResidents = [...namedTenants, ...(phong.thanhVienPhongs || [])];
    const uniqueResidents = [...new Map(currentResidents.map((person) => [`${person.ho_ten}|${person.so_dien_thoai}`, {
      ho_ten: person.ho_ten,
      so_dien_thoai: person.so_dien_thoai,
    }])).values()];
    phong.setDataValue("nguoi_dang_o", uniqueResidents);

    return phong;
  }

  async updatePhong(maPhong, data, actorId) {
    return sequelize.transaction(async (transaction) => {
      const phong = await PhongTro.findByPk(maPhong, { transaction, lock: transaction.LOCK.UPDATE });
      if (!phong) throw { status: 404, message: "Phòng trọ không tồn tại" };
      const before = phong.get({ plain: true });
      const priceChanged = data.gia_thue !== undefined && Number(before.gia_thue) !== Number(data.gia_thue);
      await phong.update(data, { transaction });
      if (priceChanged) {
        await writeAuditLog({ transaction, actorId, action: "ROOM_PRICE_UPDATED", entityType: "PhongTro", entityId: phong.ma_phong, before: { price: before.gia_thue }, after: { price: Number(data.gia_thue) } });
      }
      return phong;
    });
  }

  async deletePhong(maPhong) {
    const phong = await this.getPhongById(maPhong);

    // BR-15: Không xóa nếu có lịch sử hợp đồng
    const hopDongCount = await phong.countHopDongs();
    if (hopDongCount > 0) {
      throw {
        status: 400,
        message:
          "Không thể xóa phòng khi có hợp đồng liên quan. Hãy chuyển trạng thái sang ngừng hoạt động",
      };
    }

    await phong.destroy();

    return { message: "Xóa phòng thành công" };
  }

  async getPhongByCanAndStatus(maCan, trangThai) {
    return await PhongTro.findAll({
      where: {
        ma_can: maCan,
        trang_thai: trangThai,
      },
    });
  }

  async updatePhongStatus(maPhong, trangThai) {
    const phong = await this.getPhongById(maPhong);
    await phong.update({ trang_thai: trangThai });
    return phong;
  }
}

module.exports = new PhongService();
