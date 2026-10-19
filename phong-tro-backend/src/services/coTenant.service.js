const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  HopDong,
  PhongTro,
  ThanhVienPhong,
  YeuCau,
  DeXuatBanCungPhong,
} = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { assertLandlordOwnsRoom } = require("./propertyAccess.service");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });

function validateProposal(payload) {
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const identity = String(payload.identityNumber || payload.cccd || "").trim(); const birthDate = payload.birthDate || payload.ngaySinh; const gender = String(payload.gender || payload.gioiTinh || "").trim(); const address = String(payload.permanentAddress || payload.diaChiThuongTru || "").trim(); const relationship = String(payload.relationship || payload.quanHe || "").trim(); const startDate = payload.startDate || payload.ngayVao;
  if (!name || !phone || !identity || !birthDate || !gender || !address || !relationship || !startDate) throw fail(422, "Thiếu thông tin tùy thân bắt buộc của người ở cùng", "INVALID_CO_TENANT_PROPOSAL");
  return { name, phone, identity, birthDate, gender, address, relationship, startDate };
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

async function propose(tenantId, payload, actorId) {
  const { name, phone, identity, birthDate, gender, address, relationship, startDate } = validateProposal(payload);
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
      cccd_giay_to: identity, ngay_sinh: birthDate, gioi_tinh: gender, dia_chi_thuong_tru: address, quan_he: relationship, ngay_bat_dau_o: startDate,
    }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "CO_TENANT_PROPOSED", entityType: "DeXuatBanCungPhong", entityId: request.ma_yeu_cau, after: { roomId: room.ma_phong, name, phone, startDate } });
    return { request, proposal };
  });
}

async function approve(request, transaction, actorId) {
  const proposal = await DeXuatBanCungPhong.findByPk(request.ma_yeu_cau, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!proposal) throw fail(422, "Yêu cầu thiếu chi tiết đề xuất bạn cùng phòng", "CO_TENANT_DETAIL_NOT_FOUND");
  const required = ["ho_ten_nguoi_de_xuat", "so_dien_thoai_nguoi_de_xuat", "cccd_giay_to", "ngay_sinh", "gioi_tinh", "dia_chi_thuong_tru", "quan_he", "ngay_bat_dau_o"];
  const missing = required.filter((key) => !String(proposal[key] ?? "").trim());
  if (missing.length) throw fail(400, `Thiếu thông tin định danh: ${missing.join(", ")}`, "CO_TENANT_IDENTITY_INCOMPLETE");
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

  const member = await ThanhVienPhong.create({
    ho_ten: proposal.ho_ten_nguoi_de_xuat,
    so_dien_thoai: proposal.so_dien_thoai_nguoi_de_xuat,
    ngay_vao: proposal.ngay_bat_dau_o,
    trang_thai_cu_tru: "DANG_O",
    ma_phong: proposal.ma_phong,
    ma_hop_dong: contract.ma_hop_dong,
    cccd_giay_to: proposal.cccd_giay_to, ngay_sinh: proposal.ngay_sinh, gioi_tinh: proposal.gioi_tinh, dia_chi_thuong_tru: proposal.dia_chi_thuong_tru, quan_he: proposal.quan_he,
  }, { transaction });
  await writeAuditLog({ transaction, actorId, action: "CO_TENANT_ADMITTED", entityType: "ThanhVienPhong", entityId: member.ma_thanh_vien_phong, after: { roomId: member.ma_phong, contractId: member.ma_hop_dong } });
  return member;
}

async function getProposal(id, user) {
  const request = await YeuCau.findByPk(id);
  const proposal = request?.loai_yeu_cau === "DE_XUAT_BAN_CUNG_PHONG" && await DeXuatBanCungPhong.findByPk(id);
  if (!proposal) throw fail(404, "Không tìm thấy đề xuất người ở cùng", "CO_TENANT_PROPOSAL_NOT_FOUND");
  if (user?.vai_tro === "CHU_TRO") await assertLandlordOwnsRoom(user, proposal.ma_phong);
  else if (user?.vai_tro !== "KHACH_THUE" || request.ma_khach_thue !== user.ma_khach_thue) throw fail(403, "Bạn không được xem đề xuất này", "FORBIDDEN");
  const contract = await HopDong.findOne({ where: { ma_khach_thue: request.ma_khach_thue, ma_phong: proposal.ma_phong }, order: [["ngay_bat_dau", "DESC"]], attributes: ["ma_hop_dong", "ma_phong", "trang_thai"] });
  const room = await PhongTro.findByPk(proposal.ma_phong, { attributes: ["ma_phong", "so_phong", "so_nguoi_toi_da"] });
  const currentOccupants = await ThanhVienPhong.count({ where: { ma_phong: proposal.ma_phong, trang_thai_cu_tru: "DANG_O" } });
  return {
    requestId: id, status: request.trang_thai, rejectionReason: proposal.ly_do_tu_choi || request.ly_do_xu_ly || null,
    name: proposal.ho_ten_nguoi_de_xuat, phone: proposal.so_dien_thoai_nguoi_de_xuat,
    identityNumber: proposal.cccd_giay_to, birthDate: proposal.ngay_sinh, gender: proposal.gioi_tinh,
    permanentAddress: proposal.dia_chi_thuong_tru, relationship: proposal.quan_he, startDate: proposal.ngay_bat_dau_o,
    contract: contract && { id: contract.ma_hop_dong, status: contract.trang_thai },
    room: room && { id: room.ma_phong, code: room.so_phong, currentOccupants, capacity: room.so_nguoi_toi_da },
  };
}

module.exports = { propose, approve, validateProposal, getProposal };
