const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  HopDong,
  PhongTro,
  ThanhVienPhong,
  YeuCau,
  DeXuatBanCungPhong,
} = require("../models");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const today = () => new Date().toISOString().slice(0, 10);

function validateProposal(payload) {
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  if (!name || !phone) throw fail(422, "Thiếu họ tên hoặc số điện thoại người được đề xuất", "INVALID_CO_TENANT_PROPOSAL");
  return { name, phone };
}

async function roomMembers(roomId, transaction) {
  return ThanhVienPhong.findAll({
    where: { ma_phong: roomId, trang_thai_cu_tru: "DANG_O" },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function assertCapacityAndUniqueness(room, phone, transaction) {
  const members = await roomMembers(room.ma_phong, transaction);
  if (members.length >= Number(room.so_nguoi_toi_da)) {
    throw fail(409, "Phòng đã đủ người", "ROOM_CAPACITY_REACHED");
  }
  if (members.some((member) => member.so_dien_thoai === phone)) {
    throw fail(409, "Người được đề xuất đang ở trong phòng", "CO_TENANT_ALREADY_RESIDENT");
  }
}

async function propose(tenantId, payload) {
  const { name, phone } = validateProposal(payload);
  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findOne({
      where: {
        ma_khach_thue: tenantId,
        trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
      },
      order: [["ngay_bat_dau", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!contract) throw fail(404, "Không có hợp đồng hiệu lực", "ACTIVE_CONTRACT_NOT_FOUND");
    const room = await PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    await assertCapacityAndUniqueness(room, phone, transaction);

    const pendingRequests = await YeuCau.findAll({
      where: {
        ma_khach_thue: tenantId,
        loai_yeu_cau: "DE_XUAT_BAN_CUNG_PHONG",
        trang_thai: "CHO_XU_LY",
      },
      attributes: ["ma_yeu_cau"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (pendingRequests.length) {
      const duplicate = await DeXuatBanCungPhong.findOne({
        where: {
          ma_yeu_cau: { [Op.in]: pendingRequests.map((request) => request.ma_yeu_cau) },
          ma_phong: room.ma_phong,
          so_dien_thoai_nguoi_de_xuat: phone,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (duplicate) throw fail(409, "Đề xuất này đang chờ xử lý", "CO_TENANT_PROPOSAL_PENDING");
    }

    const request = await YeuCau.create({
      loai_yeu_cau: "DE_XUAT_BAN_CUNG_PHONG",
      noi_dung: payload.content || `Đề xuất ${name} ở cùng phòng`,
      trang_thai: "CHO_XU_LY",
      ma_khach_thue: tenantId,
    }, { transaction });
    const proposal = await DeXuatBanCungPhong.create({
      ma_yeu_cau: request.ma_yeu_cau,
      ma_phong: room.ma_phong,
      ho_ten_nguoi_de_xuat: name,
      so_dien_thoai_nguoi_de_xuat: phone,
      noi_dung_bo_sung: payload.note || null,
    }, { transaction });
    return { request, proposal };
  });
}

async function approve(request, transaction) {
  const proposal = await DeXuatBanCungPhong.findByPk(request.ma_yeu_cau, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!proposal) throw fail(422, "Yêu cầu thiếu chi tiết đề xuất bạn cùng phòng", "CO_TENANT_DETAIL_NOT_FOUND");
  const contract = await HopDong.findOne({
    where: {
      ma_khach_thue: request.ma_khach_thue,
      ma_phong: proposal.ma_phong,
      trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
    },
    order: [["ngay_bat_dau", "DESC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!contract) throw fail(409, "Hợp đồng thuê phòng không còn hiệu lực", "ACTIVE_CONTRACT_NOT_FOUND");
  const room = await PhongTro.findByPk(proposal.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
  await assertCapacityAndUniqueness(room, proposal.so_dien_thoai_nguoi_de_xuat, transaction);

  return ThanhVienPhong.create({
    ho_ten: proposal.ho_ten_nguoi_de_xuat,
    so_dien_thoai: proposal.so_dien_thoai_nguoi_de_xuat,
    ngay_vao: today(),
    trang_thai_cu_tru: "DANG_O",
    ma_phong: proposal.ma_phong,
    ma_hop_dong: contract.ma_hop_dong,
  }, { transaction });
}

module.exports = { propose, approve, validateProposal };
