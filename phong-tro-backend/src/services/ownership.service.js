const {
  ChuTro, CanTro, PhongTro, HopDong, ThanhToan, GiaoDichThanhToan,
  TienCoc, DatGiuPhong, SuCo, TaiSan, YeuCau, YeuCauGiaHan, YeuCauTraPhong,
  DeXuatBanCungPhong, ThanhVienPhong, ChiSoDien, BienBanTraPhong, KhoanChi,
  KhoanDieuChinh, ViPhamHopDong, KhachThue, TaiKhoan, ThongBao,
} = require("../models");

const knownResources = new Set([
  "building", "room", "contract", "bill", "payment", "deposit", "reservation",
  "incident", "asset", "request", "coTenant", "meterReading", "moveOut",
  "expense", "adjustment", "violation", "tenant", "account", "notification",
]);
const tenantResources = new Set([
  "room", "contract", "bill", "payment", "request", "incident",
  "coTenant", "meterReading", "tenant", "account", "notification",
]);
const unmappedResource = (resourceType) => {
  console.error("[OWNERSHIP] Unmapped resource type", { resourceType });
  return Object.assign(new Error("Cấu hình quyền sở hữu chưa được khai báo"), { status: 500, code: "OWNERSHIP_RESOURCE_UNMAPPED" });
};

const notFoundError = () => Object.assign(
  new Error("Không tìm thấy tài nguyên yêu cầu"),
  { status: 404, code: "RESOURCE_NOT_FOUND" },
);

async function getLandlordProfile(user, transaction) {
  if (user?.vai_tro !== "CHU_TRO") return null;
  const owner = await ChuTro.findOne({
    where: { ma_tai_khoan: user.ma_tai_khoan },
    attributes: ["ma_chu_tro", "ho_ten", "ma_tai_khoan"],
    transaction,
  });
  if (!owner) {
    console.error("[OWNERSHIP] Landlord account missing ChuTro profile", { accountId: user?.ma_tai_khoan });
    throw Object.assign(
      new Error("Hồ sơ Chủ trọ không tồn tại trong hệ thống"),
      { status: 500, code: "LANDLORD_PROFILE_MISSING" },
    );
  }
  return owner;
}

async function getOwnedBuildingIds(user, transaction) {
  if (user?.vai_tro !== "CHU_TRO") return [];
  const owner = await getLandlordProfile(user, transaction);
  const rows = await CanTro.findAll({
    where: { ma_chu_tro: owner.ma_chu_tro },
    attributes: ["ma_can"],
    raw: true,
    transaction,
  });
  return rows.map((r) => r.ma_can);
}

async function getLandlordAccountForRoom(roomId, transaction) {
  const room = await PhongTro.findByPk(roomId, { attributes: ["ma_can"], transaction });
  if (!room) return null;
  const building = await CanTro.findByPk(room.ma_can, { attributes: ["ma_chu_tro"], transaction });
  if (!building) return null;
  const landlord = await ChuTro.findByPk(building.ma_chu_tro, { attributes: ["ma_tai_khoan"], transaction });
  return landlord?.ma_tai_khoan || null;
}

async function resolveBuildingId(resourceType, id, transaction) {
  if (!id) return null;
  switch (resourceType) {
    case "building": {
      const row = await CanTro.findByPk(id, { attributes: ["ma_can", "ma_chu_tro"], transaction });
      return row ? { item: row, buildingId: row.ma_can, landlordId: row.ma_chu_tro } : null;
    }
    case "room": {
      const row = await PhongTro.findByPk(id, { attributes: ["ma_phong", "ma_can", "so_nguoi_toi_da"], transaction });
      return row ? { item: row, buildingId: row.ma_can } : null;
    }
    case "contract": {
      const row = await HopDong.findByPk(id, {
        attributes: ["ma_hop_dong", "ma_phong", "ma_khach_thue"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        transaction,
      });
      return row ? { item: row, buildingId: row.phongTro?.ma_can } : null;
    }
    case "bill": {
      const row = await ThanhToan.findByPk(id, {
        attributes: ["ma_thanh_toan", "ma_hop_dong"],
        include: [{
          model: HopDong,
          as: "hopDong",
          attributes: ["ma_hop_dong", "ma_phong", "ma_khach_thue"],
          include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        }],
        transaction,
      });
      return row ? { item: row, buildingId: row.hopDong?.phongTro?.ma_can } : null;
    }
    case "payment": {
      const row = await GiaoDichThanhToan.findByPk(id, {
        attributes: ["ma_giao_dich", "ma_thanh_toan"],
        include: [{
          model: ThanhToan,
          as: "thanhToan",
          attributes: ["ma_thanh_toan", "ma_hop_dong"],
          include: [{
            model: HopDong,
            as: "hopDong",
            attributes: ["ma_hop_dong", "ma_phong", "ma_khach_thue"],
            include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
          }],
        }],
        transaction,
      });
      return row ? { item: row, buildingId: row.thanhToan?.hopDong?.phongTro?.ma_can } : null;
    }
    case "deposit": {
      const row = await TienCoc.findByPk(id, {
        attributes: ["ma_tien_coc", "ma_hop_dong"],
        include: [{
          model: HopDong,
          as: "hopDong",
          attributes: ["ma_hop_dong", "ma_phong", "ma_khach_thue"],
          include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        }],
        transaction,
      });
      return row ? { item: row, buildingId: row.hopDong?.phongTro?.ma_can } : null;
    }
    case "reservation": {
      const row = await DatGiuPhong.findByPk(id, {
        attributes: ["ma_dat_giu", "ma_phong", "trang_thai"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        transaction,
      });
      return row ? { item: row, buildingId: row.phongTro?.ma_can } : null;
    }
    case "incident": {
      const row = await SuCo.findByPk(id, {
        attributes: ["ma_su_co", "ma_phong", "ma_nguoi_gui", "da_xoa"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        transaction,
      });
      return row ? { item: row, buildingId: row.phongTro?.ma_can } : null;
    }
    case "asset": {
      const row = await TaiSan.findByPk(id, {
        attributes: ["ma_tai_san", "ma_phong"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        transaction,
      });
      return row ? { item: row, buildingId: row.phongTro?.ma_can } : null;
    }
    case "request": {
      const row = await YeuCau.findByPk(id, { attributes: ["ma_yeu_cau", "loai_yeu_cau", "ma_khach_thue", "trang_thai"], transaction });
      if (!row) return null;
      let buildingId = null;
      if (row.loai_yeu_cau === "GIA_HAN") {
        const detail = await YeuCauGiaHan.findOne({
          where: { ma_yeu_cau: id },
          include: [{ model: HopDong, as: "hopDong", include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }] }],
          transaction,
        });
        buildingId = detail?.hopDong?.phongTro?.ma_can || null;
      } else if (row.loai_yeu_cau === "TRA_PHONG") {
        const detail = await YeuCauTraPhong.findOne({
          where: { ma_yeu_cau: id },
          include: [{ model: HopDong, as: "hopDong", include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }] }],
          transaction,
        });
        buildingId = detail?.hopDong?.phongTro?.ma_can || null;
      } else if (row.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG") {
        const detail = await DeXuatBanCungPhong.findOne({
          where: { ma_yeu_cau: id },
          include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
          transaction,
        });
        buildingId = detail?.phongTro?.ma_can || null;
      }
      return { item: row, buildingId };
    }
    case "coTenant": {
      const row = await ThanhVienPhong.findByPk(id, {
        attributes: ["ma_thanh_vien_phong", "ma_phong", "ma_hop_dong"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        transaction,
      });
      return row ? { item: row, buildingId: row.phongTro?.ma_can } : null;
    }
    case "meterReading": {
      const row = await ChiSoDien.findByPk(id, {
        attributes: ["ma_chi_so", "ma_phong"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        transaction,
      });
      return row ? { item: row, buildingId: row.phongTro?.ma_can } : null;
    }
    case "moveOut": {
      const row = await BienBanTraPhong.findByPk(id, {
        attributes: ["ma_bien_ban", "ma_hop_dong"],
        include: [{
          model: HopDong,
          as: "hopDong",
          attributes: ["ma_hop_dong", "ma_phong"],
          include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        }],
        transaction,
      });
      return row ? { item: row, buildingId: row.hopDong?.phongTro?.ma_can } : null;
    }
    case "expense": {
      const row = await KhoanChi.findByPk(id, { attributes: ["ma_khoan_chi", "pham_vi", "ma_can", "ma_su_co"], transaction });
      if (!row) return null;
      let buildingId = row.ma_can;
      if (!buildingId && row.ma_su_co) {
        const suCo = await SuCo.findByPk(row.ma_su_co, { include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }], transaction });
        buildingId = suCo?.phongTro?.ma_can || null;
      }
      return { item: row, buildingId, isChainWide: row.pham_vi === "TOAN_CHUOI" && !row.ma_can };
    }
    case "adjustment": {
      const row = await KhoanDieuChinh.findByPk(id, {
        attributes: ["ma_khoan_dieu_chinh", "ma_hop_dong"],
        include: [{
          model: HopDong,
          as: "hopDong",
          attributes: ["ma_hop_dong", "ma_phong"],
          include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        }],
        transaction,
      });
      return row ? { item: row, buildingId: row.hopDong?.phongTro?.ma_can } : null;
    }
    case "violation": {
      const row = await ViPhamHopDong.findByPk(id, {
        attributes: ["ma_vi_pham", "ma_hop_dong"],
        include: [{
          model: HopDong,
          as: "hopDong",
          attributes: ["ma_hop_dong", "ma_phong"],
          include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        }],
        transaction,
      });
      return row ? { item: row, buildingId: row.hopDong?.phongTro?.ma_can } : null;
    }
    case "tenant": {
      const row = await KhachThue.findByPk(id, { attributes: ["ma_khach_thue", "ma_tai_khoan"], transaction });
      if (!row) return null;
      const contracts = await HopDong.findAll({
        where: { ma_khach_thue: id },
        attributes: ["ma_hop_dong"],
        include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_can"] }],
        raw: true,
        transaction,
      });
      const buildingIds = [...new Set(contracts.map((c) => c["phongTro.ma_can"]).filter(Boolean))];
      return { item: row, buildingIds, hasNoContracts: buildingIds.length === 0 };
    }
    case "account": {
      const account = await TaiKhoan.findByPk(id, { transaction });
      if (!account || account.vai_tro !== "KHACH_THUE") return null;
      const tenant = await KhachThue.findOne({ where: { ma_tai_khoan: id }, transaction });
      if (!tenant) return null;
      return resolveBuildingId("tenant", tenant.ma_khach_thue, transaction);
    }
    case "notification": {
      const row = await ThongBao.findByPk(id, { attributes: ["ma_thong_bao", "ma_tai_khoan"], transaction });
      return row ? { item: row } : null;
    }
    default:
      throw unmappedResource(resourceType);
  }
}

async function assertOwned(user, resourceType, id, options = {}) {
  const transaction = options.transaction;
  if (!knownResources.has(resourceType)) throw unmappedResource(resourceType);
  if (!['CHU_TRO', 'KHACH_THUE'].includes(user?.vai_tro)) {
    throw Object.assign(new Error("Quyền truy cập bị từ chối"), { status: 403, code: "FORBIDDEN" });
  }
  if (user.vai_tro === "KHACH_THUE" && !tenantResources.has(resourceType)) {
    throw Object.assign(new Error("Quyền truy cập bị từ chối"), { status: 403, code: "FORBIDDEN" });
  }
  if (!id) throw notFoundError();

  if (user?.vai_tro === "CHU_TRO") {
    const owner = await getLandlordProfile(user, transaction);
    const resolved = await resolveBuildingId(resourceType, id, transaction);
    if (!resolved) throw notFoundError();

    if (resourceType === "building") {
      if (resolved.landlordId !== owner.ma_chu_tro) throw notFoundError();
      return resolved.item;
    }

    if (resourceType === "notification") {
      if (resolved.item.ma_tai_khoan !== user.ma_tai_khoan) throw notFoundError();
      return resolved.item;
    }

    if (resourceType === "tenant" || resourceType === "account") {
      if (resolved.hasNoContracts) return resolved.item;
      const ownedBuildingIds = await getOwnedBuildingIds(user, transaction);
      const isOwned = resolved.buildingIds.some((bId) => ownedBuildingIds.includes(bId));
      if (!isOwned) throw notFoundError();
      return resolved.item;
    }

    const ownedBuildingIds = await getOwnedBuildingIds(user, transaction);
    if (!resolved.buildingId || !ownedBuildingIds.includes(resolved.buildingId)) {
      throw notFoundError();
    }
    return resolved.item;
  }

  if (user?.vai_tro === "KHACH_THUE") {
    const resolved = await resolveBuildingId(resourceType, id, transaction);
    if (!resolved) throw notFoundError();

    const owned = {
      contract: () => resolved.item.ma_khach_thue === user.ma_khach_thue,
      bill: () => resolved.item.hopDong?.ma_khach_thue === user.ma_khach_thue,
      payment: () => resolved.item.thanhToan?.hopDong?.ma_khach_thue === user.ma_khach_thue,
      request: () => resolved.item.ma_khach_thue === user.ma_khach_thue,
      incident: () => resolved.item.ma_nguoi_gui === user.ma_tai_khoan,
      tenant: () => resolved.item.ma_tai_khoan === user.ma_tai_khoan,
      account: () => resolved.item.ma_tai_khoan === user.ma_tai_khoan,
      notification: () => resolved.item.ma_tai_khoan === user.ma_tai_khoan,
    };
    if (owned[resourceType] && !owned[resourceType]()) throw notFoundError();
    if (resourceType === "room" || resourceType === "meterReading") {
      const roomId = resourceType === "room" ? id : resolved.item.ma_phong;
      const activeContract = await HopDong.findOne({
        where: {
          ma_khach_thue: user.ma_khach_thue,
          ma_phong: roomId,
          trang_thai: ["DANG_HIEU_LUC", "SAP_HET_HAN"],
        },
        attributes: ["ma_hop_dong"],
        transaction,
      });
      if (!activeContract) throw notFoundError();
    }
    if (resourceType === "coTenant") {
      const contract = await HopDong.findByPk(resolved.item.ma_hop_dong, { attributes: ["ma_khach_thue"], transaction });
      if (contract?.ma_khach_thue !== user.ma_khach_thue) throw notFoundError();
    }
    return resolved.item;
  }

  throw Object.assign(new Error("Quyền truy cập bị từ chối"), { status: 403, code: "FORBIDDEN" });
}

module.exports = {
  notFoundError,
  getLandlordProfile,
  getOwnedBuildingIds,
  getLandlordAccountForRoom,
  assertOwned,
};
