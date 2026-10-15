const {
  HopDong,
  KhachThue,
  PhongTro,
  TienCoc,
  ChiSoDien,
  ThongBao,
  TaiKhoan,
} = require("../models");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const lifecycle = require("./contractLifecycle.service");

class HopDongService {
  async createHopDong(data, actorId) {
    return sequelize.transaction(async (transaction) => {
    // Verify customer exists
    const khachThue = await KhachThue.findByPk(data.ma_khach_thue, { transaction });
    if (!khachThue) {
      throw {
        status: 404,
        message: "Khách thuê không tồn tại",
      };
    }

    // Verify room exists
    const phong = await PhongTro.findByPk(data.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    if (!phong) {
      throw {
        status: 404,
        message: "Phòng trọ không tồn tại",
      };
    }

    // Check if there's a valid active contract on this room
    const existingContract = await HopDong.findOne({
      where: {
        ma_phong: data.ma_phong,
        trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existingContract) {
      throw {
        status: 400,
        message: "Phòng này đã có hợp đồng còn hiệu lực",
      };
    }

    // Create contract
    const { tien_coc: tienCoc, ngay_nhan_coc: ngayNhanCoc, chi_so_dien_ban_dau: initialElectricityReading, ...contractData } = data;
    const hopDong = await HopDong.create({ ...contractData, trang_thai: "DANG_HIEU_LUC" }, { transaction });
    const start = new Date(`${hopDong.ngay_bat_dau}T00:00:00Z`);
    await ChiSoDien.create({
      ma_phong: hopDong.ma_phong,
      nam: start.getUTCFullYear(),
      thang: start.getUTCMonth() + 1,
      loai_chi_so: "DAU_HOP_DONG",
      khoa_nghiep_vu: hopDong.ma_hop_dong,
      chi_so_moi: initialElectricityReading,
      don_gia_ap_dung: hopDong.don_gia_dien,
      trang_thai_xac_nhan: "DA_XAC_NHAN",
      ngay_ghi_nhan: start,
      nguoi_ghi_nhan_id: actorId,
      nguoi_xac_nhan_id: actorId,
      ngay_xac_nhan: new Date(),
      da_xoa: false,
    }, { transaction });
    await TienCoc.create({
      ma_hop_dong: hopDong.ma_hop_dong,
      so_tien_coc: tienCoc,
      ngay_nhan_coc: ngayNhanCoc || null,
      trang_thai: ngayNhanCoc ? "DA_NHAN" : "CHUA_NHAN",
      so_tien_da_hoan: 0,
      so_tien_da_khau_tru: 0,
    }, { transaction });

    // Update room status to DA_GIU
    await phong.update({ trang_thai: "DANG_THUE" }, { transaction });

    // Send notification to customer
    const taiKhoanKhach = khachThue.ma_tai_khoan
      ? await TaiKhoan.findByPk(khachThue.ma_tai_khoan, { transaction })
      : null;

    if (taiKhoanKhach) {
      await ThongBao.create({
        ma_tai_khoan: taiKhoanKhach.ma_tai_khoan,
        loai_thong_bao: "HOP_DONG",
        noi_dung: "Hợp đồng thuê phòng của bạn đã được tạo",
        thoi_diem_tao: new Date(),
      }, { transaction });
    }

    await lifecycle.recordChange({
      contract: hopDong, before: null, after: hopDong, reason: "Tạo hợp đồng điện tử",
      actorId, transaction, action: "CREATED",
    });

    return hopDong;
    });
  }

  async getHopDongList(filters, pagination) {
    const where = {};

    if (filters.ma_khach_thue) {
      where.ma_khach_thue = filters.ma_khach_thue;
    }

    if (filters.ma_phong) {
      where.ma_phong = filters.ma_phong;
    }

    if (filters.trang_thai) {
      where.trang_thai = filters.trang_thai;
    }

    const { count, rows } = await HopDong.findAndCountAll({
      where,
      include: [
        {
          model: KhachThue,
          as: "khachThue",
          attributes: ["ho_ten", "so_dien_thoai"],
        },
        {
          model: PhongTro,
          as: "phongTro",
          attributes: ["ma_phong", "gia_thue"],
        },
      ],
      limit: pagination.limit,
      offset: pagination.offset,
      order: [["ngay_bat_dau", "DESC"]],
    });

    return { total: count, data: rows };
  }

  async getHopDongById(maHopDong) {
    const hopDong = await HopDong.findByPk(maHopDong, {
      include: [
        {
          model: KhachThue,
          as: "khachThue",
        },
        {
          model: PhongTro,
          as: "phongTro",
        },
      ],
    });

    if (!hopDong) {
      throw {
        status: 404,
        message: "Hợp đồng không tồn tại",
      };
    }

    return hopDong;
  }

  async updateHopDong(maHopDong, data, actorId) {
    const { reason, ...patch } = data;
    return sequelize.transaction(async (transaction) => {
      const hopDong = await HopDong.findByPk(maHopDong, { transaction, lock: transaction.LOCK.UPDATE });
      if (!hopDong) throw { status: 404, message: "Hợp đồng không tồn tại" };
      const before = hopDong.get({ plain: true });
      await hopDong.update(patch, { transaction });
      await lifecycle.recordChange({ contract: hopDong, before, after: hopDong, reason, actorId, transaction, action: patch.trang_thai === "DA_THANH_LY" ? "LIQUIDATED" : "UPDATED" });
      return hopDong;
    });
  }

  async getHistory(maHopDong, requester) {
    const hopDong = await HopDong.findByPk(maHopDong);
    if (!hopDong) throw { status: 404, message: "Hợp đồng không tồn tại" };
    if (requester.vai_tro === "KHACH_THUE" && hopDong.ma_khach_thue !== requester.ma_khach_thue) throw { status: 403, message: "Bạn chỉ được xem lịch sử hợp đồng của mình" };
    return lifecycle.getHistory(maHopDong);
  }

  async renewHopDong(maHopDong, ngayBatDauMoi, ngayKetThucMoi, giaThueMoi) {
    /**
     * BR-02: Cảnh báo hết hạn hợp đồng
     * BR-09: Nên hỗ trợ gia hạn hợp đồng
     */
    const hopDong = await this.getHopDongById(maHopDong);

    await hopDong.update({
      ngay_bat_dau: ngayBatDauMoi,
      ngay_ket_thuc: ngayKetThucMoi,
      gia_thue: giaThueMoi || hopDong.gia_thue,
    });

    return hopDong;
  }

  async getExpiringContracts(daysBeforeExpiry = 30) {
    /**
     * BR-02: Cảnh báo ít nhất 1 tháng trước khi hết hạn
     */
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

    return await HopDong.findAll({
      where: {
        trang_thai: "DANG_HIEU_LUC",
        ngay_ket_thuc: {
          [Op.between]: [now, expiryDate],
        },
      },
      include: [
        {
          model: KhachThue,
          as: "khachThue",
        },
        {
          model: PhongTro,
          as: "phongTro",
        },
      ],
    });
  }

  async getContractByRoom(maPhong) {
    return await HopDong.findOne({
      where: {
        ma_phong: maPhong,
        trang_thai: "DANG_HIEU_LUC",
      },
    });
  }

  async settleContract(maHopDong) {
    const hopDong = await this.getHopDongById(maHopDong);

    await hopDong.update({
      trang_thai: "DA_THANH_LY",
      ngay_thanh_ly: new Date(),
    });

    // Update room status to TRONG
    await PhongTro.update(
      { trang_thai: "TRONG" },
      { where: { ma_phong: hopDong.ma_phong } },
    );

    return hopDong;
  }
}

module.exports = new HopDongService();
