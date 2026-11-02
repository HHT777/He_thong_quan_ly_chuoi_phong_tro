import test from "node:test";
import assert from "node:assert/strict";
import { broadcastRecipients, broadcastPayload } from "../src/modules/notifications/broadcast.model.mjs";

test("chỉ chọn tài khoản khách thuê đang hoạt động, không lặp tài khoản", () => {
  const tenants = [
    { ho_ten: "An", so_dien_thoai: "0911", taiKhoan: { ma_tai_khoan: "a", vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG" }, hopDongs: [{ trang_thai: "DANG_HIEU_LUC", phongTro: { so_phong: "101", canTro: { ten_can: "Căn A" } } }] },
    { ho_ten: "An", taiKhoan: { ma_tai_khoan: "a", vai_tro: "KHACH_THUE", trang_thai: "HOAT_DONG" } },
    { ho_ten: "B", taiKhoan: { ma_tai_khoan: "b", vai_tro: "KHACH_THUE", trang_thai: "TAM_KHOA" } },
    { ho_ten: "C", taiKhoan: { ma_tai_khoan: "c", vai_tro: "CHU_TRO", trang_thai: "HOAT_DONG" } },
    { ho_ten: "D" },
  ];
  const recipients = broadcastRecipients(tenants);
  assert.deepEqual(recipients.map((row) => row.id), ["a"]);
  assert.equal(recipients[0].phone, "0911");
  assert.equal(recipients[0].room, "Căn A · 101");
});

test("payload gửi danh sách tường minh, đã chuẩn hóa và giữ nguyên xuống dòng", () => {
  assert.deepEqual(broadcastPayload("  Tiêu đề  ", "  Dòng 1\nDòng 2  ", ["b", "a", "b"]), {
    subject: "Tiêu đề", content: "Dòng 1\nDòng 2", recipientIds: ["a", "b"],
  });
  assert.throws(() => broadcastPayload("T", "N", []), /ít nhất một người nhận/);
  assert.throws(() => broadcastPayload(" ", "N", ["a"]), /tiêu đề và nội dung/);
  assert.throws(() => broadcastPayload("T", " ", ["a"]), /tiêu đề và nội dung/);
});

test("giới hạn đúng kích thước chuỗi lưu trong thông báo", () => {
  assert.equal(`[${broadcastPayload("T", "x".repeat(996), ["a"]).subject}] ${"x".repeat(996)}`.length, 1000);
  assert.throws(() => broadcastPayload("T", "x".repeat(997), ["a"]), /1.000 ký tự/);
});
