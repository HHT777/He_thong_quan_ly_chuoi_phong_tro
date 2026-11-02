export function broadcastRecipients(tenants) {
  const accounts = new Map();
  for (const tenant of tenants || []) {
    const account = tenant.taiKhoan;
    if (account?.vai_tro !== "KHACH_THUE" || account.trang_thai !== "HOAT_DONG" || !account.ma_tai_khoan) continue;
    const rooms = (tenant.hopDongs || []).filter((contract) => ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(contract.trang_thai))
      .map((contract) => [contract.phongTro?.canTro?.ten_can, contract.phongTro?.so_phong].filter(Boolean).join(" · "));
    const previous = accounts.get(account.ma_tai_khoan);
    accounts.set(account.ma_tai_khoan, {
      id: account.ma_tai_khoan,
      name: previous?.name || tenant.ho_ten || account.ten_dang_nhap,
      phone: previous?.phone || tenant.so_dien_thoai || "",
      room: [...new Set([previous?.room, ...rooms].filter(Boolean))].join(", "),
    });
  }
  return [...accounts.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), "vi"));
}

export function broadcastPayload(subject, content, recipientIds) {
  const title = String(subject || "").trim(); const body = String(content || "").trim();
  if (!title || !body) throw new Error("Hãy nhập tiêu đề và nội dung thông báo.");
  if (`[${title}] ${body}`.length > 1000) throw new Error("Tiêu đề và nội dung gộp lại không được vượt 1.000 ký tự.");
  const ids = [...new Set(recipientIds || [])].filter(Boolean).sort();
  if (!ids.length) throw new Error("Hãy chọn ít nhất một người nhận có tài khoản đang hoạt động.");
  return { subject: title, content: body, recipientIds: ids };
}
