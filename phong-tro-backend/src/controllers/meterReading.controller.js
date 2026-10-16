const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ChiSoDien, HopDong, LichSuChinhSuaChiSoDien } = require("../models");
const { writeAuditLog } = require("../services/auditLog.service");
const service = require("../services/meterReading.service");

function header(req, name) {
  const value = req.get(name);
  if (!value) throw { status: 400, code: `MISSING_${name.toUpperCase().replace("-", "_")}`, message: `Thiếu header ${name}` };
  return value;
}
function landlord(req) { if (req.user.vai_tro !== "CHU_TRO") throw { status: 403, code: "FORBIDDEN", message: "Chỉ Chủ trọ được thực hiện thao tác này" }; }
function readingValue(req) {
  const value = Number(req.body.readingValue);
  if (!Number.isInteger(value) || value < 0) throw { status: 422, code: "INVALID_READING", message: "readingValue phải là số nguyên không âm" };
  return value;
}
async function canRead(req, row) {
  if (req.user.vai_tro === "CHU_TRO") return;
  const contract = await HopDong.findOne({ where: { ma_phong: row.ma_phong, ma_khach_thue: req.user.ma_khach_thue } });
  if (!contract) throw { status: 404, code: "READING_NOT_FOUND", message: "Không tìm thấy chỉ số điện" };
}

class MeterReadingController {
  async context(req, res, next) { try { res.apiSuccess(await service.getContext(req.user.ma_khach_thue, req.query.period || new Date().toISOString().slice(0, 7))); } catch (e) { next(e); } }
  async preview(req, res, next) { try { if (!req.file) return res.apiError(400, "FILE_REQUIRED", "Vui lòng tải ảnh công tơ."); res.apiSuccess(await service.createPreview(req.user.vai_tro === "KHACH_THUE" ? req.user.ma_khach_thue : null, req.body.period, req.file, req.body.roomId, req.user.ma_tai_khoan)); } catch (e) { next(e); } }
  async submit(req, res, next) {
    try {
      header(req, "Idempotency-Key");
      res.apiSuccess(await service.submit(req.user.ma_khach_thue, { period: req.body.period, readingValue: req.body.readingValue, uploadToken: req.body.uploadToken }, req.user.ma_tai_khoan), null, 201);
    } catch (e) { next(e); }
  }
  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page || 1)); const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
      const where = { da_xoa: false }; if (req.query.period) Object.assign(where, service.parsePeriod(req.query.period)); if (req.query.status) where.trang_thai_xac_nhan = req.query.status;
      const include = service.include.map((item) => item.as === "phongTro" && req.query.buildingId ? { ...item, required: true, where: { ma_can: req.query.buildingId } } : item);
      if (req.user.vai_tro === "KHACH_THUE") {
        const rooms = await HopDong.findAll({ where: { ma_khach_thue: req.user.ma_khach_thue }, attributes: ["ma_phong"], raw: true });
        where.ma_phong = { [Op.in]: rooms.map((item) => item.ma_phong) };
      }
      const { count, rows } = await ChiSoDien.findAndCountAll({ where, include, order: [["nam", "DESC"], ["thang", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize });
      res.apiSuccess(rows.map(service.toDto), { page, pageSize, totalItems: count, totalPages: Math.ceil(count / pageSize) });
    } catch (e) { next(e); }
  }
  async detail(req, res, next) { try { const row = await service.findReading(req.params.readingId); await canRead(req, row); res.apiSuccess(service.toDto(row)); } catch (e) { next(e); } }
  async update(req, res, next) {
    try {
      landlord(req); header(req, "If-Match"); const reason = String(req.body.reason || "").trim(); if (!reason) return res.apiError(422, "REASON_REQUIRED", "Lý do chỉnh sửa là bắt buộc.");
      const row = await service.findReading(req.params.readingId); if (row.trang_thai_xac_nhan !== "CHO_XAC_NHAN") return res.apiError(409, "READING_ALREADY_CONFIRMED", "Chỉ được sửa bản chờ xác nhận.");
      const value = readingValue(req); const previous = await service.previousReading(row.ma_phong, `${row.nam}-${String(row.thang).padStart(2, "0")}`); if (value < previous) return res.apiError(422, "READING_BELOW_PREVIOUS", "Chỉ số không được nhỏ hơn kỳ trước.");
      const result = await sequelize.transaction(async (transaction) => {
        const locked = await ChiSoDien.findByPk(row.ma_chi_so, { transaction, lock: transaction.LOCK.UPDATE });
        await LichSuChinhSuaChiSoDien.create({ ma_chi_so: locked.ma_chi_so, chi_so_cu: locked.chi_so_moi, chi_so_moi: value, ly_do: reason, nguoi_sua_id: req.user.ma_tai_khoan }, { transaction });
        await locked.update({ chi_so_moi: value }, { transaction });
        await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "METER_READING_UPDATED", entityType: "ChiSoDien", entityId: locked.ma_chi_so, before: { value: locked.chi_so_moi }, after: { value }, reason });
        return locked;
      }); res.apiSuccess(service.toDto(await service.findReading(result.ma_chi_so)));
    } catch (e) { next(e); }
  }
  async confirm(req, res, next) {
    try {
      landlord(req); header(req, "Idempotency-Key"); header(req, "If-Match");
      const result = await sequelize.transaction(async (transaction) => {
        const row = await ChiSoDien.findByPk(String(req.params.readingId).replace(/^mr_/, ""), { transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw { status: 404, code: "READING_NOT_FOUND", message: "Không tìm thấy chỉ số điện" };
        if (row.trang_thai_xac_nhan === "DA_XAC_NHAN") return row;
        await row.update({ trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_xac_nhan_id: req.user.ma_tai_khoan, ngay_xac_nhan: new Date() }, { transaction }); return row;
      });
      res.apiSuccess(service.toDto(await service.findReading(result.ma_chi_so)));
    } catch (e) { next(e); }
  }
  async correction(req, res) {
    landlord(req);
    return res.apiError(409, "SCHEMA_DOES_NOT_SUPPORT_CORRECTION_FLAG", "Schema data2.md không có cột lưu yêu cầu chụp lại; hãy sửa bản chờ xác nhận hoặc khách gửi lại ảnh.");
  }
  async remove(req, res, next) {
    try {
      landlord(req); const reason = String(req.body.reason || "").trim(); if (!reason) return res.apiError(422, "REASON_REQUIRED", "Lý do xóa là bắt buộc.");
      const row = await sequelize.transaction(async (transaction) => {
        const locked = await ChiSoDien.findByPk(String(req.params.readingId).replace(/^mr_/, ""), { transaction, lock: transaction.LOCK.UPDATE });
        if (!locked || locked.da_xoa) throw { status: 404, code: "READING_NOT_FOUND", message: "Không tìm thấy chỉ số điện" };
        if (locked.trang_thai_xac_nhan === "DA_XAC_NHAN") throw { status: 409, code: "CONFIRMED_READING_CANNOT_BE_DELETED", message: "Không được xóa chỉ số đã xác nhận" };
        await locked.update({ da_xoa: true, ly_do_xoa: reason, ngay_xoa: new Date(), nguoi_xoa_id: req.user.ma_tai_khoan }, { transaction });
        await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "METER_READING_SOFT_DELETED", entityType: "ChiSoDien", entityId: locked.ma_chi_so, reason }); return locked;
      }); res.apiSuccess({ id: row.ma_chi_so, deleted: true });
    } catch (e) { next(e); }
  }
  async manual(req, res, next) {
    try {
      landlord(req); header(req, "Idempotency-Key"); const value = readingValue(req); const contract = await service.tenantContract(req.body.tenantId);
      const parsed = service.parsePeriod(req.body.period); if (await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed } })) return res.apiError(409, "PENDING_READING_EXISTS", "Kỳ này đã có chỉ số.");
      const previous = await service.previousReading(contract.ma_phong, req.body.period); if (value < previous) return res.apiError(422, "READING_BELOW_PREVIOUS", "Chỉ số không được nhỏ hơn kỳ trước.");
      const row = await ChiSoDien.create({ ...parsed, ma_phong: contract.ma_phong, chi_so_moi: value, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_ghi_nhan_id: req.user.ma_tai_khoan, nguoi_xac_nhan_id: req.user.ma_tai_khoan, ngay_xac_nhan: new Date() });
      res.apiSuccess(service.toDto(await service.findReading(row.ma_chi_so)), null, 201);
    } catch (e) { next(e); }
  }
  async privateFile(req, res, next) {
    try { const row = await service.findReading(req.params.id); await canRead(req, row); if (!row.anh_cong_to_url || !fs.existsSync(row.anh_cong_to_url)) return res.apiError(404, "FILE_NOT_FOUND", "Không tìm thấy minh chứng."); res.sendFile(path.resolve(row.anh_cong_to_url)); } catch (e) { next(e); }
  }
}
module.exports = new MeterReadingController();
