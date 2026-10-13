const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { TaiKhoan, KhachThue, HopDong, TienCoc } = require("../models");

const ACTIVE_CONTRACT_STATES = Object.freeze(["DANG_HIEU_LUC", "SAP_HET_HAN"]);
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

function accountDto(account) {
  return {
    ma_tai_khoan: account.ma_tai_khoan,
    ten_dang_nhap: account.ten_dang_nhap,
    vai_tro: account.vai_tro,
    trang_thai: account.trang_thai,
    bat_buoc_doi_mat_khau: account.bat_buoc_doi_mat_khau,
  };
}

function usernameFor(tenant) {
  const username = String(tenant?.so_dien_thoai || "").trim();
  if (!username || username.length > 15) {
    throw fail(422, "INVALID_TENANT_PHONE", "Số điện thoại khách thuê không hợp lệ để làm tên đăng nhập");
  }
  return username;
}

async function requireRentalEligibility(tenantId, transaction) {
  const contract = await HopDong.findOne({
    where: {
      ma_khach_thue: tenantId,
      trang_thai: { [Op.in]: ACTIVE_CONTRACT_STATES },
    },
    order: [["ngay_bat_dau", "DESC"]],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!contract) {
    throw fail(422, "ACTIVE_CONTRACT_REQUIRED", "Khách thuê chưa có hợp đồng hiệu lực");
  }
  const deposit = await TienCoc.findOne({
    where: { ma_hop_dong: contract.ma_hop_dong },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!deposit) {
    throw fail(422, "DEPOSIT_RECORD_REQUIRED", "Hợp đồng chưa có hồ sơ tiền cọc");
  }
  return { contract, deposit };
}

async function createWithinTransaction(tenantId, transaction) {
  const tenant = await KhachThue.findByPk(tenantId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!tenant) throw fail(404, "TENANT_NOT_FOUND", "Khách thuê không tồn tại");
  if (tenant.ma_tai_khoan) throw fail(409, "TENANT_ACCOUNT_EXISTS", "Khách thuê đã có tài khoản");
  await requireRentalEligibility(tenant.ma_khach_thue, transaction);
  const username = usernameFor(tenant);
  if (await TaiKhoan.findOne({ where: { ten_dang_nhap: username }, transaction, lock: transaction.LOCK.UPDATE })) {
    throw fail(409, "ACCOUNT_EXISTS", "Tài khoản đã tồn tại");
  }
  const account = await TaiKhoan.create({
    ten_dang_nhap: username,
    mat_khau: "1",
    vai_tro: "KHACH_THUE",
    trang_thai: "HOAT_DONG",
    bat_buoc_doi_mat_khau: true,
  }, { transaction });
  await tenant.update({ ma_tai_khoan: account.ma_tai_khoan }, { transaction });
  return accountDto(account);
}

async function create(tenantId) {
  return sequelize.transaction((transaction) => createWithinTransaction(tenantId, transaction));
}

module.exports = {
  ACTIVE_CONTRACT_STATES,
  accountDto,
  usernameFor,
  requireRentalEligibility,
  createWithinTransaction,
  create,
};
