import test from "node:test";
import assert from "node:assert/strict";
import { residentRoster } from "../src/modules/residents-contracts/resident-roster.js";

test("resident roster shows a principal once when also stored as a co-tenant", () => {
  const principal = { ma_khach_thue: "tenant-a", ho_ten: "Nguyễn Thị Yến", so_dien_thoai: "0912000015", cccd_giay_to: "079900000015" };
  const contract = { ma_hop_dong: "contract-a", ma_phong: "room-a", trang_thai: "DANG_HIEU_LUC", phongTro: { ma_phong: "room-a", so_phong: "304" }, thanhVienPhongs: [
    { ma_thanh_vien_phong: "member-a", ho_ten: "Nguyễn Thị Yến", so_dien_thoai: "0912000015", trang_thai_cu_tru: "DANG_O" },
    { ma_thanh_vien_phong: "member-b", ho_ten: "Bạn cùng phòng", so_dien_thoai: "0912000016", trang_thai_cu_tru: "DANG_O" },
  ] };
  const rows = residentRoster([{ ...principal, hopDongs: [contract] }]);
  assert.deepEqual(rows.map((row) => row.vai_tro_cu_tru), ["Người đứng tên hợp đồng", "Người ở cùng"]);
  assert.equal(rows[0].ho_ten, "Nguyễn Thị Yến");
  assert.equal(rows[1].ho_ten, "Bạn cùng phòng");
});
