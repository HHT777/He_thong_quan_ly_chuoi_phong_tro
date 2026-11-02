const { ThongBao } = require("../models");

class TenantController {
  async listNotifications(req, res, next) {
    try {
      const result = await require("../services/notification.service").list(req.user, req.query, req.body);
      res.json({ success: true, ...result, message: "Lấy thông báo thành công" });
    } catch (error) {
      next(error);
    }
  }

  async createIssue(req, res, next) {
    try {
      const allowed = ["contractId", "loai_su_co", "muc_do_uu_tien", "noi_dung"];
      if (Object.keys(req.body || {}).some(key => !allowed.includes(key))) throw Object.assign(new Error("Không nhận phạm vi, trạng thái, chi phí hoặc URL ảnh tùy ý"), { status: 400, code: "INCIDENT_FIELDS_FORBIDDEN" });
      const result = await require("../services/tenantIncident.service").mutate(req.user, { contractId: req.body.contractId, type: req.body.loai_su_co, priority: req.body.muc_do_uu_tien, description: req.body.noi_dung });
      return res.status(result.duplicate ? 200 : 201).json({ success: true, data: result.incident });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TenantController();
