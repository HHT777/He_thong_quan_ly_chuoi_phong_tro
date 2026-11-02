const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  HopDong,
  KhachThue,
  CanTro,
  PhongTro,
  ThanhVienPhong,
  YeuCau,
  DeXuatBanCungPhong,
} = require("../models");
const { writeAuditLog } = require("./auditLog.service");
const { assertLandlordOwnsRoom } = require("./propertyAccess.service");
const { assertOwned, notFoundError, getLandlordAccountForRoom } = require("./ownership.service");
const notification = require("./notification.service");
const { businessDate } = require("../utils/businessDate.util");
const { maskDocument } = require("../utils/privacy.util");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const normalize = (value) => typeof value === "string" ? value.normalize("NFKC").replace(/[\s.\-_/()+]/g, "").toUpperCase() : "";
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateProposal(payload) {
  const allowed = ["type", "contractId", "name", "phone", "identityNumber", "cccd", "birthDate", "ngaySinh", "gender", "gioiTinh", "permanentAddress", "diaChiThuongTru", "relationship", "quanHe", "startDate", "ngayVao", "note", "content"];
  if (!payload || Object.keys(payload).some((key) => !allowed.includes(key))) throw fail(400, "Tham số đề xuất không hợp lệ", "INVALID_CO_TENANT_PAYLOAD");
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const phone = normalize(payload.phone);
  const identity = normalize(payload.identityNumber ?? payload.cccd);
  const birthDate = payload.birthDate ?? payload.ngaySinh;
  const gender = payload.gender ?? payload.gioiTinh;
  const address = typeof (payload.permanentAddress ?? payload.diaChiThuongTru) === "string" ? (payload.permanentAddress ?? payload.diaChiThuongTru).trim() : "";
  const relationship = typeof (payload.relationship ?? payload.quanHe) === "string" ? (payload.relationship ?? payload.quanHe).trim() : "";
  const startDate = payload.startDate ?? payload.ngayVao;
  if (!name || !phone || !identity || !birthDate || !gender || !address || !relationship || !startDate) throw fail(422, "Thiếu thông tin tùy thân bắt buộc của người ở cùng", "INVALID_CO_TENANT_PROPOSAL");
  if (name.length > 100 || !/^\d{9,15}$/.test(phone) || !/^[A-Z0-9]{3,50}$/.test(identity) || address.length > 255 || relationship.length > 80 || !["NAM", "NU", "KHAC"].includes(gender)) throw fail(400, "Thông tin hồ sơ không đúng định dạng hoặc độ dài", "INVALID_CO_TENANT_FIELDS");
  const today = businessDate();
  if (!validDate(birthDate) || birthDate > today || !validDate(startDate) || startDate < today || birthDate > startDate) throw fail(400, "Ngày sinh hoặc ngày vào không hợp lệ", "INVALID_CO_TENANT_DATE");
  for (const key of ["note", "content"]) if (payload[key] != null && (typeof payload[key] !== "string" || payload[key].length > 1000)) throw fail(400, "Ghi chú tối đa 1000 ký tự", "INVALID_CO_TENANT_NOTE");
  if (payload.contractId != null && (typeof payload.contractId !== "string" || !payload.contractId.trim())) throw notFoundError();
  return { name, phone, identity, birthDate, gender, address, relationship, startDate };
}

async function roomMembers(roomId, transaction) {
  return ThanhVienPhong.findAll({
    where: { ma_phong: roomId, trang_thai_cu_tru: "DANG_O" },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function assertCapacityAndUniqueness(room, phone, transaction, contract, identity) {
  const members = await roomMembers(room.ma_phong, transaction);
  const principal = await KhachThue.findByPk(contract.ma_khach_thue, { transaction });
  const principalPhone = principal?.so_dien_thoai;
  const principalAlreadyListed = members.some((member) => member.so_dien_thoai === principalPhone);
  if (members.length + (principalAlreadyListed ? 0 : 1) >= Number(room.so_nguoi_toi_da)) {
    throw fail(409, "Phòng đã đủ người", "ROOM_CAPACITY_REACHED");
  }
  if (normalize(phone) === normalize(principalPhone) || (identity && normalize(identity) === normalize(principal?.cccd_giay_to)) || members.some((member) => normalize(member.so_dien_thoai) === normalize(phone) || (identity && normalize(member.cccd_giay_to) === normalize(identity)))) {
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
        ...(payload.contractId ? { ma_hop_dong: payload.contractId } : {}),
      },
      order: [["ngay_bat_dau", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!contract) throw notFoundError();
    const room = await PhongTro.findByPk(contract.ma_phong, { transaction, lock: transaction.LOCK.UPDATE });
    await assertCapacityAndUniqueness(room, phone, transaction, contract, identity);

    const roomProposals = await DeXuatBanCungPhong.findAll({ where: { ma_phong: room.ma_phong }, transaction, lock: transaction.LOCK.UPDATE });
    if (roomProposals.length) {
      const waiting = await YeuCau.findAll({ where: { ma_yeu_cau: { [Op.in]: roomProposals.map((proposal) => proposal.ma_yeu_cau) }, loai_yeu_cau: "DE_XUAT_BAN_CUNG_PHONG", trang_thai: "CHO_XU_LY" }, attributes: ["ma_yeu_cau"], transaction, lock: transaction.LOCK.UPDATE });
      const waitingIds = new Set(waiting.map((request) => request.ma_yeu_cau));
      if (roomProposals.some((proposal) => waitingIds.has(proposal.ma_yeu_cau) && (normalize(proposal.so_dien_thoai_nguoi_de_xuat) === phone || normalize(proposal.cccd_giay_to) === identity))) throw fail(409, "Đề xuất này đang chờ xử lý", "CO_TENANT_PROPOSAL_PENDING");
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
    const ownerAccount = await getLandlordAccountForRoom(room.ma_phong, transaction);
    if (ownerAccount) await notification.createIdempotent({ ma_tai_khoan: ownerAccount, loai_thong_bao: "YEU_CAU", noi_dung: "Có đề xuất người ở cùng mới chờ xử lý.", thoi_diem_tao: new Date(), khoa_su_kien: `YEU_CAU_MOI:${request.ma_yeu_cau}` }, { transaction });
    await writeAuditLog({ transaction, actorId, action: "CO_TENANT_PROPOSED", entityType: "DeXuatBanCungPhong", entityId: request.ma_yeu_cau, after: { roomId: room.ma_phong, contractId: contract.ma_hop_dong } });
    return { request, proposal };
  });
}

async function addByLandlord(user, payload) {
  const details = validateProposal(payload);
  if (!payload.roomId) throw fail(400, "Chọn phòng trước khi thêm người ở cùng", "ROOM_REQUIRED");
  return sequelize.transaction(async (transaction) => {
    await assertLandlordOwnsRoom(user, payload.roomId, transaction);
    const room = await PhongTro.findByPk(payload.roomId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!room) throw fail(404, "Không tìm thấy phòng", "RESOURCE_NOT_FOUND");
    const contract = await HopDong.findOne({ where: { ma_phong: payload.roomId, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } }, transaction, lock: transaction.LOCK.UPDATE });
    if (!contract) throw fail(409, "Hãy lập hợp đồng trước", "ACTIVE_CONTRACT_NOT_FOUND");
    await assertCapacityAndUniqueness(room, details.phone, transaction, contract, details.identity);
    const member = await ThanhVienPhong.create({ ma_phong: room.ma_phong, ma_hop_dong: contract.ma_hop_dong, ho_ten: details.name, so_dien_thoai: details.phone, cccd_giay_to: details.identity, ngay_sinh: details.birthDate, gioi_tinh: details.gender, dia_chi_thuong_tru: details.address, quan_he: details.relationship, ngay_vao: details.startDate, trang_thai_cu_tru: "DANG_O" }, { transaction });
    await writeAuditLog({ transaction, actorId: user.ma_tai_khoan, action: "CO_TENANT_ADMITTED", entityType: "ThanhVienPhong", entityId: member.ma_thanh_vien_phong, after: { roomId: room.ma_phong, contractId: contract.ma_hop_dong } });
    return member;
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
  await assertCapacityAndUniqueness(room, proposal.so_dien_thoai_nguoi_de_xuat, transaction, contract, proposal.cccd_giay_to);

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
  else if (user?.vai_tro !== "KHACH_THUE" || request.ma_khach_thue !== user.ma_khach_thue) throw notFoundError();
  const contract = await HopDong.findOne({ where: { ma_khach_thue: request.ma_khach_thue, ma_phong: proposal.ma_phong }, order: [["ngay_bat_dau", "DESC"]], attributes: ["ma_hop_dong", "ma_phong", "trang_thai"] });
  const room = await PhongTro.findByPk(proposal.ma_phong, { attributes: ["ma_phong", "so_phong", "so_nguoi_toi_da"] });
  const currentOccupants = await ThanhVienPhong.count({ where: { ma_phong: proposal.ma_phong, trang_thai_cu_tru: "DANG_O" } });
  const result = {
    requestId: id, status: request.trang_thai, rejectionReason: proposal.ly_do_tu_choi || request.ly_do_xu_ly || null,
    name: proposal.ho_ten_nguoi_de_xuat, phone: proposal.so_dien_thoai_nguoi_de_xuat,
    identityNumber: proposal.cccd_giay_to, birthDate: proposal.ngay_sinh, gender: proposal.gioi_tinh,
    permanentAddress: proposal.dia_chi_thuong_tru, relationship: proposal.quan_he, startDate: proposal.ngay_bat_dau_o,
    contract: contract && { id: contract.ma_hop_dong, status: contract.trang_thai },
    room: room && { id: room.ma_phong, code: room.so_phong, currentOccupants, capacity: room.so_nguoi_toi_da },
  };
  if (user.vai_tro === "CHU_TRO") return result;
  const { birthDate, permanentAddress, ...tenantView } = result;
  return { ...tenantView, identityNumber: maskDocument(result.identityNumber) };
}

async function context(user) {
  const today = businessDate();
  const contracts = await HopDong.findAll({ where: { ma_khach_thue: user.ma_khach_thue, trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] }, ngay_bat_dau: { [Op.lte]: today }, ngay_ket_thuc: { [Op.gte]: today } }, order: [["ngay_bat_dau", "DESC"]] });
  const rooms = await PhongTro.findAll({ where: { ma_phong: { [Op.in]: contracts.map((c) => c.ma_phong) } } });
  const buildings = await CanTro.findAll({ where: { ma_can: { [Op.in]: rooms.map((r) => r.ma_can) } } });
  const roomMembers = await ThanhVienPhong.findAll({ where: { ma_phong: { [Op.in]: rooms.map((r) => r.ma_phong) }, trang_thai_cu_tru: "DANG_O" }, order: [["ngay_vao", "DESC"]] });
  const contractViews = [];
  const principalPhones = new Map();
  const principalPhonesByRoom = new Map();
  for (const contract of contracts) {
    const room = rooms.find((r) => r.ma_phong === contract.ma_phong);
    if (!room) continue;
    const building = buildings.find((b) => b.ma_can === room.ma_can);
    const membersInRoom = roomMembers.filter((member) => member.ma_phong === room.ma_phong);
    const principal = await KhachThue.findByPk(contract.ma_khach_thue, { attributes: ["so_dien_thoai"] });
    const currentOccupants = membersInRoom.length + (membersInRoom.some((member) => member.so_dien_thoai === principal?.so_dien_thoai) ? 0 : 1);
    principalPhones.set(contract.ma_hop_dong, principal?.so_dien_thoai);
    principalPhonesByRoom.set(room.ma_phong, principal?.so_dien_thoai);
    const availablePlaces = Math.max(0, Number(room.so_nguoi_toi_da) - currentOccupants);
    contractViews.push({ contractId: contract.ma_hop_dong, roomId: room.ma_phong, roomName: room.so_phong, buildingName: building?.ten_can || null, capacity: room.so_nguoi_toi_da, currentOccupants, availablePlaces, eligible: availablePlaces > 0 && room.trang_thai === "DANG_THUE", reasonCode: availablePlaces ? null : "ROOM_CAPACITY_REACHED" });
  }
  const requests = await YeuCau.findAll({ where: { ma_khach_thue: user.ma_khach_thue, loai_yeu_cau: "DE_XUAT_BAN_CUNG_PHONG" }, order: [["ngay_gui", "DESC"]] });
  const details = await DeXuatBanCungPhong.findAll({ where: { ma_yeu_cau: { [Op.in]: requests.map((r) => r.ma_yeu_cau) } } });
  const proposals = requests.flatMap((request) => {
    const detail = details.find((d) => d.ma_yeu_cau === request.ma_yeu_cau);
    return detail ? [{ requestId: request.ma_yeu_cau, roomId: detail.ma_phong, name: detail.ho_ten_nguoi_de_xuat, identityNumber: maskDocument(detail.cccd_giay_to), startDate: detail.ngay_bat_dau_o, status: request.trang_thai, rejectionReason: detail.ly_do_tu_choi || request.ly_do_xu_ly || null }] : [];
  });
  const members = await ThanhVienPhong.findAll({ where: { ma_hop_dong: { [Op.in]: contracts.map((c) => c.ma_hop_dong) } }, order: [["ngay_vao", "DESC"]] });
  return {
    today, contracts: contractViews, proposals,
    members: members.map((r) => ({ ...memberView(r), contractId: r.ma_hop_dong, isPrincipal: Boolean(principalPhones.get(r.ma_hop_dong) && r.so_dien_thoai === principalPhones.get(r.ma_hop_dong)) })),
    roomMembers: roomMembers.map((r) => ({ ...memberView(r), roomId: r.ma_phong, relationship: r.quan_he, isPrincipal: Boolean(principalPhonesByRoom.get(r.ma_phong) && r.so_dien_thoai === principalPhonesByRoom.get(r.ma_phong)) })),
  };
}

function memberView(row, full = false) {
  return {
    ho_ten: row.ho_ten,
    cccd_giay_to: full ? row.cccd_giay_to : maskDocument(row.cccd_giay_to),
    so_dien_thoai: full ? row.so_dien_thoai : maskDocument(row.so_dien_thoai),
    ngay_vao: row.ngay_vao,
    ngay_roi: row.ngay_roi,
    trang_thai_cu_tru: row.trang_thai_cu_tru,
    ...(full ? { ngay_sinh: row.ngay_sinh, dia_chi_thuong_tru: row.dia_chi_thuong_tru } : {}),
  };
}

async function getMember(id, user) {
  await assertOwned(user, "coTenant", id);
  const member = await ThanhVienPhong.findByPk(id);
  if (!member) throw notFoundError();
  return user.vai_tro === "KHACH_THUE"
    ? memberView(member)
    : member;
}

module.exports = { propose, approve, validateProposal, getProposal, addByLandlord, context, getMember, memberView };
