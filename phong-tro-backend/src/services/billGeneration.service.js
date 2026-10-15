const { Op } = require("sequelize");
const { HopDong, ChiSoDien, ThanhVienPhong } = require("../models");
const billService = require("./khoanPhaiThu.service");
const meterReadingService = require("./meterReading.service");

const SERVICE_FEE_DECISION = Object.freeze({
  code: "SERVICE_FEE_SCHEMA_MISSING",
  message: "data1.md chưa có nguồn cấu hình phí dịch vụ; hóa đơn tự động chưa thu khoản này.",
});

function calculateWater(unitPrice, occupantCount) {
  const price = Number(unitPrice);
  const count = Number(occupantCount);
  if (!Number.isFinite(price) || price < 0) {
    throw { status: 422, code: "INVALID_WATER_UNIT_PRICE", message: "Đơn giá nước trên hợp đồng không hợp lệ" };
  }
  if (!Number.isInteger(count) || count < 1) {
    throw { status: 422, code: "MISSING_BILLABLE_OCCUPANTS", message: "Không có người đang ở để tính tiền nước" };
  }
  return price * count;
}

async function generate(period, actorId) {
  const { nam, thang } = meterReadingService.parsePeriod(period);
  const contracts = await HopDong.findAll({
    where: { trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] } },
  });
  const created = [];
  const skipped = [];
  for (const contract of contracts) {
    try {
      const meter = await ChiSoDien.findOne({
        where: { ma_phong: contract.ma_phong, nam, thang, loai_chi_so: "DINH_KY", da_xoa: false, trang_thai_xac_nhan: "DA_XAC_NHAN" },
      });
      if (!meter) {
        skipped.push({ roomId: contract.ma_phong, reason: "MISSING_CONFIRMED_METER" });
        continue;
      }
      const [previous, occupantCount] = await Promise.all([
        meterReadingService.previousReading(contract.ma_phong, period, undefined, meter.ngay_ghi_nhan),
        ThanhVienPhong.count({
          where: { ma_hop_dong: contract.ma_hop_dong, trang_thai_cu_tru: "DANG_O" },
        }),
      ]);
      const electricity = (Number(meter.chi_so_moi) - previous) * Number(meter.don_gia_ap_dung);
      if (!Number.isFinite(electricity) || electricity < 0) {
        throw { status: 422, code: "INVALID_ELECTRICITY_AMOUNT", message: "Sản lượng điện của kỳ không hợp lệ" };
      }
      const water = calculateWater(contract.don_gia_nuoc, occupantCount);
      const rent = Number(contract.gia_thue);
      created.push(await billService.createKhoanPhaiThu({
        ma_hop_dong: contract.ma_hop_dong,
        ky: period,
        tien_phong: rent,
        tien_dien: electricity,
        tien_nuoc: water,
        phi_dich_vu: 0,
        phi_phat_sinh: 0,
        khoan_giam_tru: 0,
        tong_phai_thanh_toan: rent + electricity + water,
      }, actorId));
    } catch (error) {
      skipped.push({
        roomId: contract.ma_phong,
        reason: error.code || error.message || "BILL_GENERATION_FAILED",
      });
    }
  }
  return { created, skipped, decisionsRequired: [SERVICE_FEE_DECISION] };
}

module.exports = { SERVICE_FEE_DECISION, calculateWater, generate };
