export const STATUS_LABELS = Object.freeze({
  DANG_THUE: "Đang thuê", TRONG: "Trống", DA_GIU: "Đã giữ",
  DANG_XU_LY_TRA_PHONG: "Đang xử lý trả", NGUNG_SU_DUNG: "Ngừng sử dụng",
  DA_THANH_TOAN: "Đã thanh toán", CHO_THANH_TOAN: "Chờ thanh toán", QUA_HAN: "Quá hạn",
  HIEU_LUC: "Hiệu lực", SAP_HET_HAN: "Sắp hết hạn", HET_HAN: "Hết hạn",
  DA_XU_LY: "Đã xử lý", DANG_XU_LY: "Đang xử lý", CHO_TIEP_NHAN: "Chờ tiếp nhận",
  DA_HUY: "Đã hủy", HOAT_DONG: "Hoạt động", TAM_DUNG: "Tạm dừng", KHAC: "Khác",
});

export const statusLabel = (status) => STATUS_LABELS[String(status || "").trim().toUpperCase()] || "Trạng thái khác";
