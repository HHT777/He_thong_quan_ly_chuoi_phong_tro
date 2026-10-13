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

function assertTenantRole(account) {
  if (account.vai_tro !== "KHACH_THUE") {
    throw fail(403, "TENANT_ACCOUNT_REQUIRED", "Chỉ được thao tác tài khoản khách thuê");
  }
  return account;
}

async function requireTenantAccount(accountId, transaction) {
  const account = await TaiKhoan.findByPk(accountId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!account) throw fail(404, "ACCOUNT_NOT_FOUND", "Tài khoản không tồn tại");
  assertTenantRole(account);
  const tenant = await KhachThue.findOne({
    where: { ma_tai_khoan: account.ma_tai_khoan },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!tenant) throw fail(409, "TENANT_PROFILE_REQUIRED", "Tài khoản khách thuê chưa liên kết hồ sơ khách thuê");
  return { account, tenant };
}

async function updateStatus(accountId, status) {
  if (!["HOAT_DONG", "DA_KHOA"].includes(status)) {
    throw fail(422, "INVALID_ACCOUNT_STATUS", "Trạng thái tài khoản không hợp lệ");
  }
  return sequelize.transaction(async (transaction) => {
    const { account, tenant } = await requireTenantAccount(accountId, transaction);
    if (account.trang_thai === status) {
      throw fail(409, "ACCOUNT_STATUS_UNCHANGED", `Tài khoản đã ở trạng thái ${status}`);
    }
    if (status === "HOAT_DONG") await requireRentalEligibility(tenant.ma_khach_thue, transaction);
    await account.update({ trang_thai: status }, { transaction });
    return accountDto(account);
  });
}

async function resetPassword(tenantId) {
  return sequelize.transaction(async (transaction) => {
    const tenant = await KhachThue.findByPk(tenantId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!tenant?.ma_tai_khoan) throw fail(404, "ACCOUNT_NOT_FOUND", "Tài khoản khách thuê không tồn tại");
    const { account } = await requireTenantAccount(tenant.ma_tai_khoan, transaction);
    await account.update({ mat_khau: "1", bat_buoc_doi_mat_khau: true }, { transaction });
    return { reset: true, account: accountDto(account) };
  });
}

module.exports = {
  ACTIVE_CONTRACT_STATES,
  accountDto,
  usernameFor,
  requireRentalEligibility,
  createWithinTransaction,
  create,
  assertTenantRole,
  requireTenantAccount,
  updateStatus,
  resetPassword,
};
