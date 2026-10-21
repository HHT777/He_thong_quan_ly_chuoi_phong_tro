export const STATUS_LABELS = Object.freeze({
  DANG_THUE: "Đang thuê", TRONG: "Trống", DA_GIU: "Đã giữ",
  DANG_XU_LY_TRA_PHONG: "Đang xử lý trả", NGUNG_SU_DUNG: "Ngừng sử dụng",
  DA_THANH_TOAN: "Đã thanh toán", CHO_THANH_TOAN: "Chờ thanh toán", QUA_HAN: "Quá hạn",
  HIEU_LUC: "Hiệu lực", DANG_HIEU_LUC: "Đang hiệu lực", SAP_HET_HAN: "Sắp hết hạn", HET_HAN: "Hết hạn", DA_THANH_LY: "Đã thanh lý",
  DA_XU_LY: "Đã xử lý", DANG_XU_LY: "Đang xử lý", CHO_TIEP_NHAN: "Chờ tiếp nhận",
  DA_HUY: "Đã hủy", HOAT_DONG: "Hoạt động", TAM_DUNG: "Tạm dừng", KHAC: "Khác",
  CHUA_NHAN: "Chưa nhận", DA_NHAN: "Đã nhận", DA_HOAN: "Đã hoàn",
  DA_KHAU_TRU_MOT_PHAN: "Đã khấu trừ một phần", DA_KHAU_TRU_TOAN_BO: "Đã khấu trừ toàn bộ",
});

export const statusLabel = (status) => STATUS_LABELS[String(status || "").trim().toUpperCase()] || "Trạng thái khác";
