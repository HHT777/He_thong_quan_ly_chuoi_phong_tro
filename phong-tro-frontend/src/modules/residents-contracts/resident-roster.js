const ACTIVE_CONTRACTS = new Set(["DANG_HIEU_LUC", "SAP_HET_HAN"]);
const clean = (value) => String(value || "").trim().toLocaleLowerCase("vi");

export function residentRoster(tenants = [], scope = {}) {
  const rows = [];
  const seenMembers = new Set();
  for (const tenant of tenants) {
    const activeContracts = (tenant.hopDongs || []).filter((contract) => ACTIVE_CONTRACTS.has(contract.trang_thai));
    if (!activeContracts.length) {
      rows.push({ ...tenant, vai_tro_cu_tru: "Chưa gắn hợp đồng hiệu lực", ma_phong: null, ten_can: "—", so_phong: "—" });
      continue;
    }

    for (const contract of activeContracts) {
      const linkedContract = scope.contractById?.get(String(contract.ma_hop_dong)) || contract;
      const room = scope.roomById?.get(String(linkedContract.ma_phong || contract.ma_phong)) || contract.phongTro || {};
      const building = scope.buildingById?.get(String(room.ma_can)) || room.canTro;
      const buildingName = building?.name || building?.ten_can || contract.phongTro?.canTro?.ten_can || "—";
      const roomName = room.so_phong || contract.phongTro?.so_phong || "—";
      const base = {
        ma_khach_thue: tenant.ma_khach_thue,
        ma_tai_khoan: tenant.ma_tai_khoan,
        ma_phong: room.ma_phong || contract.ma_phong,
        ten_can: buildingName,
        so_phong: roomName,
      };
      rows.push({ ...base, ...tenant, ma_phong: base.ma_phong, ten_can: base.ten_can, so_phong: base.so_phong, hopDongs: [contract], vai_tro_cu_tru: "Người đứng tên hợp đồng", isCoTenant: false });
      for (const member of contract.thanhVienPhongs || linkedContract.thanhVienPhongs || []) {
        if (member.trang_thai_cu_tru !== "DANG_O") continue;
        const samePrincipal = (clean(member.cccd_giay_to) && clean(member.cccd_giay_to) === clean(tenant.cccd_giay_to))
          || (clean(member.ho_ten) === clean(tenant.ho_ten) && clean(member.so_dien_thoai) && clean(member.so_dien_thoai) === clean(tenant.so_dien_thoai));
        if (samePrincipal || (member.ma_thanh_vien_phong && seenMembers.has(String(member.ma_thanh_vien_phong)))) continue;
        if (member.ma_thanh_vien_phong) seenMembers.add(String(member.ma_thanh_vien_phong));
        rows.push({
          ...member,
          ma_khach_thue: null,
          ma_tai_khoan: null,
          ma_phong: base.ma_phong,
          ten_can: base.ten_can,
          so_phong: base.so_phong,
          hopDongs: [contract],
          vai_tro_cu_tru: "Người ở cùng",
          isCoTenant: true,
        });
      }
    }
  }
  return rows;
}
