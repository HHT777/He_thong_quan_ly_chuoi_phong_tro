import { listTab } from "../../shared/components/tab-factory.js";
import { date, money } from "../../shared/components/view.js";
const numericContractValues = (raw) => ({
  ...raw,
  gia_thue: Number(raw.gia_thue),
  tien_coc: Number(raw.tien_coc),
  don_gia_dien: Number(raw.don_gia_dien),
  don_gia_nuoc: Number(raw.don_gia_nuoc),
  ngay_nhan_coc: raw.ngay_nhan_coc || null,
});

export default listTab({ id: "contracts", route: "/residents-contracts/contracts", title: "Hợp đồng", tabLabel: "Hợp đồng", group: "residents-contracts", order: 31, roles: ["CHU_TRO"] }, {
  title: "Hợp đồng",
  description: "Tạo hợp đồng kèm hồ sơ cọc và gia hạn hợp đồng hiện có.",
  endpoint: "/hop-dong?limit=100",
  columns: [{ label: "Khách thuê", format: (row) => row.khachThue?.ho_ten || "—" }, { label: "Phòng", format: (row) => row.phongTro?.so_phong || row.ma_phong }, { label: "Giá thuê", format: (row) => money(row.gia_thue) }, { label: "Kết thúc", format: (row) => date(row.ngay_ket_thuc) }, { label: "Trạng thái", key: "trang_thai" }],
  create: {
    label: "Tạo hợp đồng",
    endpoint: "/hop-dong",
    fields: [
      { name: "ma_khach_thue", label: "Mã khách thuê", required: true },
      { name: "ma_phong", label: "Mã phòng", required: true },
      { name: "ngay_bat_dau", label: "Ngày bắt đầu", type: "date", required: true },
      { name: "ngay_ket_thuc", label: "Ngày kết thúc", type: "date", required: true },
      { name: "gia_thue", label: "Giá thuê", type: "number", required: true },
      { name: "tien_coc", label: "Tiền cọc", type: "number", required: true },
      { name: "ngay_nhan_coc", label: "Ngày nhận cọc", type: "date" },
      { name: "don_gia_dien", label: "Đơn giá điện", type: "number", required: true },
      { name: "don_gia_nuoc", label: "Đơn giá nước/người", type: "number", required: true },
      { name: "dieu_khoan", label: "Điều khoản", type: "textarea", required: true },
    ],
    map: numericContractValues,
  },
  rowActions: [{
    id: "renew",
    label: "Gia hạn",
    visible: (row) => ["DANG_HIEU_LUC", "SAP_HET_HAN", "HET_HAN"].includes(row.trang_thai),
    fields: [
      { name: "ngay_bat_dau_moi", label: "Ngày bắt đầu mới", type: "date", required: true },
      { name: "ngay_ket_thuc_moi", label: "Ngày kết thúc mới", type: "date", required: true },
      { name: "gia_thue_moi", label: "Giá thuê mới", type: "number" },
    ],
    initial: (row) => ({ ngay_bat_dau_moi: row.ngay_bat_dau, ngay_ket_thuc_moi: row.ngay_ket_thuc, gia_thue_moi: row.gia_thue }),
    map: (raw) => ({ ...raw, gia_thue_moi: raw.gia_thue_moi ? Number(raw.gia_thue_moi) : undefined }),
    run: (context, row, values) => context.api.post(`/hop-dong/${row.ma_hop_dong}/renew`, values),
  }],
});
