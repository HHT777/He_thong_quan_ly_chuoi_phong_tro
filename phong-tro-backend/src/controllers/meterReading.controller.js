const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { ChiSoDien, HopDong, LichSuChinhSuaChiSoDien, ThayDongHoDien, PhongTro } = require("../models");
const { writeAuditLog } = require("../services/auditLog.service");
const service = require("../services/meterReading.service");
const { assertOwned } = require("../services/ownership.service");
const replacementService = require("../services/meterReplacement.service");

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
  if (!contract) throw { status: 404, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên" };
}

function tenantInput(req, bodyFields = [], queryFields = []) {
  if (req.user.vai_tro !== "KHACH_THUE") throw { status: 403, code: "FORBIDDEN", message: "Chỉ Khách thuê được dùng API này" };
  if (Object.hasOwn(req.body || {}, "readingValue")) throw { status: 400, code: "TENANT_MANUAL_READING_FORBIDDEN", message: "Khách thuê chỉ được gửi chỉ số qua ảnh/OCR" };
  if (Object.keys(req.body || {}).some((key) => !bodyFields.includes(key)) || Object.keys(req.query || {}).some((key) => !queryFields.includes(key))
    || ["tenantid", "khachthueid", "roomid", "x-tenant-id", "x-room-id"].some((key) => req.headers?.[key] != null)) {
    throw { status: 400, code: "TENANT_SCOPE_OVERRIDE_FORBIDDEN", message: "Không được tự chọn tài khoản hoặc phòng" };
  }
}

class MeterReadingController {
  async context(req, res, next) { try { tenantInput(req, [], ["period"]); res.apiSuccess(await service.getContext(req.user.ma_khach_thue, req.query.period)); } catch (e) { next(e); } }
  async preview(req, res, next) { try { tenantInput(req, ["period"]); if (!req.file) return res.apiError(400, "FILE_REQUIRED", "Vui lòng tải ảnh công tơ."); res.apiSuccess(await service.createPreview(req.user.ma_khach_thue, req.body.period, req.file, undefined, req.user.ma_tai_khoan)); } catch (e) { next(e); } }
  async landlordPreview(req, res, next) { try { landlord(req); if (!req.file) return res.apiError(400, "FILE_REQUIRED", "Vui lòng tải ảnh công tơ."); res.apiSuccess(await service.createPreview(null, req.body.period, req.file, req.body.roomId, req.user.ma_tai_khoan)); } catch (e) { next(e); } }
  async submit(req, res, next) {
    try {
      tenantInput(req, ["period", "uploadToken"]);
      header(req, "Idempotency-Key");
      res.apiSuccess(await service.submit(req.user.ma_khach_thue, req.body, req.user.ma_tai_khoan), null, 201);
    } catch (e) { next(e); }
  }
  async landlordSubmit(req, res, next) { try { landlord(req); header(req, "Idempotency-Key"); res.apiSuccess(await service.submitForLandlord({ period: req.body.period, readingValue: req.body.readingValue, uploadToken: req.body.uploadToken }, req.user.ma_tai_khoan), null, 201); } catch (e) { next(e); } }
  async list(req, res, next) {
    try {
      require("../utils/queryValidation").validateQuery(req.query, { periods: ["period"], strings: ["status", "buildingId"], positiveIntegers: ["page", "pageSize"] });
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
  async detail(req, res, next) { try { const row = await service.findReading(req.params.readingId); await canRead(req, row); res.apiSuccess(service.toDto(row)); } catch (e) { if (req.user.vai_tro === "KHACH_THUE" && e.status === 404) return next({ status: 404, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên" }); next(e); } }
  async update(req, res, next) {
    try {
      landlord(req); header(req, "If-Match"); const reason = String(req.body.reason || "").trim(); if (!reason) return res.apiError(422, "REASON_REQUIRED", "Lý do chỉnh sửa là bắt buộc.");
      const readingId = String(req.params.readingId).replace(/^mr_/, "");
      const value = readingValue(req);
      const result = await sequelize.transaction(async (transaction) => {
        await assertOwned(req.user, "meterReading", readingId, { transaction });
        const locked = await ChiSoDien.findByPk(readingId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!locked || locked.da_xoa) throw { status: 404, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên" };
        if (locked.trang_thai_xac_nhan !== "CHO_XAC_NHAN") throw { status: 409, code: "READING_ALREADY_CONFIRMED", message: "Chỉ được sửa bản chờ xác nhận." };
        const previous = await service.submissionMinimum(locked.ma_phong, `${locked.nam}-${String(locked.thang).padStart(2, "0")}`, transaction);
        if (value < previous) throw { status: 422, code: "READING_BELOW_PREVIOUS", message: "Chỉ số không được nhỏ hơn kỳ trước." };
        const previousValue = locked.chi_so_moi; await LichSuChinhSuaChiSoDien.create({ ma_chi_so: locked.ma_chi_so, chi_so_cu: previousValue, chi_so_moi: value, ly_do: reason, nguoi_sua_id: req.user.ma_tai_khoan }, { transaction });
        await locked.update({ chi_so_moi: value }, { transaction });
        await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "METER_READING_UPDATED", entityType: "ChiSoDien", entityId: locked.ma_chi_so, before: { value: previousValue }, after: { value }, reason });
        return locked;
      }); res.apiSuccess(service.toDto(await service.findReading(result.ma_chi_so)));
    } catch (e) { next(e); }
  }
  async confirm(req, res, next) {
    try {
      landlord(req); header(req, "Idempotency-Key"); header(req, "If-Match");
      const result = await sequelize.transaction(async (transaction) => {
        const readingId = String(req.params.readingId).replace(/^mr_/, "");
        await assertOwned(req.user, "meterReading", readingId, { transaction });
        const row = await ChiSoDien.findByPk(readingId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row || row.da_xoa) throw { status: 404, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên" };
        if (row.trang_thai_xac_nhan === "DA_XAC_NHAN") return row;
        const minimum = await service.submissionMinimum(row.ma_phong, `${row.nam}-${String(row.thang).padStart(2, "0")}`, transaction);
        if (Number(row.chi_so_moi) < minimum) throw { status: 422, code: "READING_BELOW_PREVIOUS", message: "Chỉ số thấp hơn chỉ số đầu đồng hồ mới hoặc kỳ trước" };
        const before = { status: row.trang_thai_xac_nhan }; await row.update({ trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_xac_nhan_id: req.user.ma_tai_khoan, ngay_xac_nhan: new Date() }, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "METER_READING_CONFIRMED", entityType: "ChiSoDien", entityId: row.ma_chi_so, before, after: { status: row.trang_thai_xac_nhan } }); return row;
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
        const readingId = String(req.params.readingId).replace(/^mr_/, "");
        await assertOwned(req.user, "meterReading", readingId, { transaction });
        const locked = await ChiSoDien.findByPk(readingId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!locked || locked.da_xoa) throw { status: 404, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên" };
        if (locked.trang_thai_xac_nhan !== "CHO_XAC_NHAN") throw { status: 409, code: "CONFIRMED_READING_CANNOT_BE_DELETED", message: "Chỉ được xóa chỉ số chờ xác nhận" };
        await locked.update({ da_xoa: true, ly_do_xoa: reason, ngay_xoa: new Date(), nguoi_xoa_id: req.user.ma_tai_khoan }, { transaction });
        await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "METER_READING_SOFT_DELETED", entityType: "ChiSoDien", entityId: locked.ma_chi_so, reason }); return locked;
      }); res.apiSuccess({ id: row.ma_chi_so, deleted: true });
    } catch (e) { next(e); }
  }
  async manual(req, res, next) {
    try {
      landlord(req); header(req, "Idempotency-Key"); const value = readingValue(req); const contract = await service.tenantContract(req.body.tenantId);
      const parsed = service.parsePeriod(req.body.period); if (await ChiSoDien.findOne({ where: { ma_phong: contract.ma_phong, ...parsed } })) return res.apiError(409, "PENDING_READING_EXISTS", "Kỳ này đã có chỉ số.");
      const previous = await service.submissionMinimum(contract.ma_phong, req.body.period); if (value < previous) return res.apiError(422, "READING_BELOW_PREVIOUS", "Chỉ số không được nhỏ hơn kỳ trước.");
      const row = await sequelize.transaction(async (transaction) => { const created = await ChiSoDien.create({ ...parsed, ma_phong: contract.ma_phong, chi_so_moi: value, don_gia_ap_dung: contract.don_gia_dien, trang_thai_xac_nhan: "DA_XAC_NHAN", nguoi_ghi_nhan_id: req.user.ma_tai_khoan, nguoi_xac_nhan_id: req.user.ma_tai_khoan, ngay_xac_nhan: new Date() }, { transaction }); await writeAuditLog({ transaction, actorId: req.user.ma_tai_khoan, action: "METER_READING_MANUAL_CREATED", entityType: "ChiSoDien", entityId: created.ma_chi_so, after: { value, period: req.body.period } }); return created; });
      res.apiSuccess(service.toDto(await service.findReading(row.ma_chi_so)), null, 201);
    } catch (e) { next(e); }
  }
  async privateFile(req, res, next) {
    try { const row = await service.findReading(req.params.id); await canRead(req, row); if (!row.anh_cong_to_url || !fs.existsSync(row.anh_cong_to_url)) return res.apiError(404, "FILE_NOT_FOUND", "Không tìm thấy minh chứng."); res.sendFile(path.resolve(row.anh_cong_to_url)); } catch (e) { next(e); }
  }
  async createReplacement(req, res, next) {
    try { landlord(req); res.apiSuccess(await replacementService.create(req.body, req.files, req.user), null, 201); }
    catch (e) { next(e); }
  }
  async listReplacements(req, res, next) {
    try {
      landlord(req);
      const { buildingId, period } = req.query;
      replacementService.periodParts(period);
      await assertOwned(req.user, "building", buildingId);
      const rows = await ThayDongHoDien.findAll({ where: replacementService.periodParts(period),
        include: [{ model: PhongTro, as: "phongTro", required: true, where: { ma_can: buildingId } }] });
      res.apiSuccess(await Promise.all(rows.map(async (row) => replacementService.toDto(row,
        await service.periodBaseline(row.ma_phong, period)))));
    } catch (e) { next(e); }
  }
  async replacementImage(req, res, next) {
    try {
      landlord(req);
      const row = await ThayDongHoDien.findByPk(req.params.id);
      if (!row) throw { status: 404, code: "RESOURCE_NOT_FOUND", message: "Không tìm thấy tài nguyên" };
      await assertOwned(req.user, "room", row.ma_phong);
      const filePath = req.params.kind === "old" ? row.anh_dong_ho_cu_url : req.params.kind === "new" ? row.anh_dong_ho_moi_url : null;
      const directory = path.resolve(process.env.UPLOAD_DIR || "./uploads", "meter-replacements");
      if (!filePath || !path.resolve(filePath).startsWith(`${directory}${path.sep}`) || !fs.existsSync(filePath))
        return res.apiError(404, "FILE_NOT_FOUND", "Không tìm thấy ảnh đồng hồ");
      res.sendFile(path.resolve(filePath));
    } catch (e) { next(e); }
  }
}
module.exports = new MeterReadingController();
