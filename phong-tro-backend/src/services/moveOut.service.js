const { Op } = require("sequelize");
const sequelize = require("../config/database");
const {
  TaiKhoan,
  KhachThue,
  HopDong,
  PhongTro,
  ChiSoDien,
  ThanhToan,
  TienCoc,
  ThanhVienPhong,
  YeuCau,
  YeuCauTraPhong,
  BienBanTraPhong,
  KhoanKhauTru,
  ThongBao,
} = require("../models");

const fail = (status, message, code) => Object.assign(new Error(message), { status, code });
const today = () => new Date().toISOString().slice(0, 10);

function validateChecklist(payload) {
  if (payload.assetsChecked !== true) {
    throw fail(422, "Chưa xác nhận kiểm tra tài sản", "ASSETS_NOT_CHECKED");
  }
  if (payload.debtReviewed !== true) {
    throw fail(422, "Chưa xác nhận đối chiếu công nợ", "DEBT_NOT_REVIEWED");
  }
  if (!String(payload.roomCondition || "").trim()) {
    throw fail(422, "Thiếu kết quả kiểm tra tình trạng phòng", "ROOM_CONDITION_REQUIRED");
  }
  const deduction = Number(payload.deduction || 0);
  if (!Number.isFinite(deduction) || deduction < 0) {
    throw fail(422, "Tổng khấu trừ không hợp lệ", "INVALID_DEDUCTION");
  }
  return deduction;
}

async function settle(contractId, payload, actorId) {
  const requestedDeduction = validateChecklist(payload);

  return sequelize.transaction(async (transaction) => {
    const contract = await HopDong.findByPk(contractId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!contract || contract.trang_thai === "DA_THANH_LY") {
      throw fail(409, "Hợp đồng không còn hiệu lực", "CONTRACT_NOT_ACTIVE");
    }

    const existingReport = await BienBanTraPhong.findOne({
      where: { ma_hop_dong: contract.ma_hop_dong },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existingReport) throw fail(409, "Hợp đồng đã có biên bản trả phòng", "MOVE_OUT_ALREADY_SETTLED");

    const room = await PhongTro.findByPk(contract.ma_phong, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!room || room.trang_thai !== "DANG_XU_LY_TRA_PHONG") {
      throw fail(409, "Phòng chưa ở trạng thái xử lý trả phòng", "ROOM_NOT_READY_FOR_MOVE_OUT");
    }

    if (payload.moveOutRequestId) {
      const detail = await YeuCauTraPhong.findByPk(payload.moveOutRequestId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const request = await YeuCau.findByPk(payload.moveOutRequestId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!detail || detail.ma_hop_dong !== contract.ma_hop_dong || request?.trang_thai !== "DA_PHE_DUYET") {
        throw fail(422, "Yêu cầu trả phòng chưa được duyệt hoặc không thuộc hợp đồng", "INVALID_MOVE_OUT_REQUEST");
      }
    }

    const finalReading = await ChiSoDien.findOne({
      where: { ma_phong: contract.ma_phong, trang_thai_xac_nhan: "DA_XAC_NHAN" },
      order: [["nam", "DESC"], ["thang", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!finalReading) throw fail(422, "Chưa có chỉ số điện đã xác nhận để chốt", "FINAL_METER_READING_REQUIRED");

    const deposit = await TienCoc.findOne({
      where: { ma_hop_dong: contract.ma_hop_dong },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!deposit || deposit.trang_thai === "CHUA_NHAN") {
      throw fail(422, "Hồ sơ cọc chưa được ghi nhận đã nhận", "DEPOSIT_NOT_RECEIVED");
    }

    const debts = await ThanhToan.findAll({
      where: { ma_hop_dong: contract.ma_hop_dong, so_tien_con_no: { [Op.gt]: 0 } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const outstandingDebt = debts.reduce((sum, row) => sum + Number(row.so_tien_con_no), 0);
    if (requestedDeduction < outstandingDebt) {
      throw fail(422, "Tổng khấu trừ chưa bao gồm toàn bộ công nợ", "DEDUCTION_BELOW_OUTSTANDING_DEBT");
    }

    const depositAmount = Number(deposit.so_tien_coc);
    const appliedDeduction = Math.min(depositAmount, requestedDeduction);
    const refund = Math.max(0, depositAmount - appliedDeduction);
    const report = await BienBanTraPhong.create({
      ngay_kiem_tra: payload.inspectionDate || today(),
      tinh_trang_phong: String(payload.roomCondition).trim(),
      ghi_chu: payload.reason || null,
      tong_khoan_khau_tru: requestedDeduction,
      so_tien_coc_duoc_hoan: refund,
      ma_hop_dong: contract.ma_hop_dong,
      ma_yeu_cau_tra_phong: payload.moveOutRequestId || null,
      nguoi_lap_id: actorId,
    }, { transaction });

    if (outstandingDebt > 0) {
      await KhoanKhauTru.create({
        loai_khau_tru: "CONG_NO",
        ly_do: "Khấu trừ công nợ còn lại khi trả phòng",
        so_tien: outstandingDebt,
        ma_bien_ban_tra_phong: report.ma_bien_ban,
      }, { transaction });
    }
    const otherDeduction = requestedDeduction - outstandingDebt;
    if (otherDeduction > 0) {
      await KhoanKhauTru.create({
        loai_khau_tru: payload.deductionType || "KHAC",
        ly_do: payload.reason || "Khấu trừ khi trả phòng",
        so_tien: otherDeduction,
        ma_bien_ban_tra_phong: report.ma_bien_ban,
      }, { transaction });
    }

    await deposit.update({
      so_tien_da_hoan: refund,
      so_tien_da_khau_tru: appliedDeduction,
      trang_thai: appliedDeduction >= depositAmount
        ? "DA_KHAU_TRU_TOAN_BO"
        : appliedDeduction > 0 ? "DA_KHAU_TRU_MOT_PHAN" : "DA_HOAN",
    }, { transaction });

    const moveOutDate = payload.inspectionDate || today();
    await ThanhVienPhong.update({ trang_thai_cu_tru: "DA_ROI", ngay_roi: moveOutDate }, {
      where: { ma_hop_dong: contract.ma_hop_dong, trang_thai_cu_tru: "DANG_O" },
      transaction,
    });
    await contract.update({ trang_thai: "DA_THANH_LY", ngay_thanh_ly: moveOutDate }, { transaction });
    await room.update({ trang_thai: "TRONG" }, { transaction });

    const tenant = await KhachThue.findByPk(contract.ma_khach_thue, { transaction });
    if (tenant?.ma_tai_khoan) {
      const otherActiveContracts = await HopDong.count({
        where: {
          ma_khach_thue: contract.ma_khach_thue,
          ma_hop_dong: { [Op.ne]: contract.ma_hop_dong },
          trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
        },
        transaction,
      });
      if (otherActiveContracts === 0) {
        await TaiKhoan.update({ trang_thai: "DA_KHOA" }, {
          where: { ma_tai_khoan: tenant.ma_tai_khoan, vai_tro: "KHACH_THUE" },
          transaction,
        });
      }
      await ThongBao.create({
        loai_thong_bao: "THANH_LY_HOP_DONG",
        noi_dung: "Hợp đồng của bạn đã được thanh lý. Vui lòng kiểm tra thông tin hoàn/khấu trừ tiền cọc.",
        thoi_diem_tao: new Date(),
        ma_tai_khoan: tenant.ma_tai_khoan,
      }, { transaction });
    }

    return { report, outstandingDebt, appliedDeduction, refund };
  });
}

module.exports = { settle, validateChecklist };
