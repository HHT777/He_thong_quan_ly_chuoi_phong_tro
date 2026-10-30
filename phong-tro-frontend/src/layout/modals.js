/**
 * ISK19 Modal Manager for Settings, Support, and Profile
 */
import { icons } from "../shared/components/icons.js";
import { escapeHtml } from "../shared/components/view.js";
import { showToast } from "../shared/components/toast.js";

let activeModal = null;

export function closeModal() {
  if (activeModal && activeModal.parentElement) {
    activeModal.parentElement.removeChild(activeModal);
  }
  activeModal = null;
  document.removeEventListener("keydown", handleKeyDown);
}

function handleKeyDown(event) {
  if (event.key === "Escape") {
    closeModal();
  }
}

function renderModalWrapper(title, iconHtml, bodyHtml) {
  closeModal();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div class="modal-title-wrap">
          <span class="modal-icon">${iconHtml}</span>
          <h3 id="modal-title" class="modal-title">${escapeHtml(title)}</h3>
        </div>
        <button class="modal-close-btn" aria-label="Đóng" data-modal-close>
          ${icons.x(20)}
        </button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
    </div>
  `;

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-modal-close]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", handleKeyDown);
  document.body.appendChild(overlay);
  activeModal = overlay;

  return overlay;
}

export function openProfileModal(currentUser) {
  const roleName = currentUser?.vai_tro === "KHACH_THUE" ? "Khách thuê" : "Chủ trọ";
  const name = currentUser?.ho_ten || currentUser?.ten_dang_nhap || "Người dùng";
  const email = currentUser?.email || `${currentUser?.ten_dang_nhap || "user"}@isk19.vn`;
  const phone = currentUser?.so_dien_thoai || "Chưa cập nhật";

  const bodyHtml = `
    <div class="profile-card">
      <div class="profile-card__avatar">
        ${name.charAt(0).toUpperCase()}
      </div>
      <div class="profile-card__info">
        <h4>${escapeHtml(name)}</h4>
        <span class="badge badge--success">${escapeHtml(roleName)}</span>
      </div>
    </div>

    <div class="modal-form-grid">
      <div class="modal-field">
        <label>Tên đăng nhập</label>
        <input type="text" class="form-control" value="${escapeHtml(currentUser?.ten_dang_nhap || "")}" readonly disabled>
      </div>
      <div class="modal-field">
        <label>Họ và tên</label>
        <input type="text" class="form-control" value="${escapeHtml(name)}" readonly disabled>
      </div>
      <div class="modal-field">
        <label>Email liên hệ</label>
        <input type="email" class="form-control" value="${escapeHtml(email)}" readonly disabled>
      </div>
      <div class="modal-field">
        <label>Số điện thoại</label>
        <input type="text" class="form-control" value="${escapeHtml(phone)}" readonly disabled>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn--secondary" data-modal-close>Đóng</button>
    </div>
  `;

  renderModalWrapper("Thông tin tài khoản", icons.user(20), bodyHtml);
}

export function openSettingsModal() {
  const bodyHtml = `
    <div class="settings-tabs">
      <div class="settings-section">
        <h5 class="settings-section-title">Giao diện hiển thị</h5>
        <div class="settings-row">
          <div>
            <strong>Giao diện sáng (Light Mode)</strong>
            <p class="settings-desc">Tối ưu cho hiển thị bảng biểu và độ tương phản chuẩn SaaS.</p>
          </div>
          <span class="badge badge--info">Mặc định</span>
        </div>
      </div>

      <div class="settings-section">
        <h5 class="settings-section-title">Thông báo hệ thống</h5>
        <div class="settings-row">
          <div>
            <strong>Thông báo chuông trong ứng dụng</strong>
            <p class="settings-desc">Nhận thông báo khi có hóa đơn mới, thanh toán hoặc sự cố phòng.</p>
          </div>
          <input type="checkbox" checked style="width: 18px; height: 18px; accent-color: var(--brand-primary);">
        </div>
      </div>

      <div class="settings-section">
        <h5 class="settings-section-title">Ngôn ngữ & Vùng</h5>
        <div class="settings-row">
          <div>
            <strong>Ngôn ngữ chính</strong>
            <p class="settings-desc">Hệ thống đang hiển thị Tiếng Việt.</p>
          </div>
          <select class="form-control" style="width: auto; padding: 6px 12px;">
            <option selected>Tiếng Việt (VN)</option>
            <option disabled>English (Sắp hỗ trợ)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn--secondary" data-modal-close>Đóng</button>
      <button class="btn btn--primary" id="saveSettingsBtn">Lưu cài đặt</button>
    </div>
  `;

  const modal = renderModalWrapper("Cài đặt hệ thống", icons.settings(20), bodyHtml);
  modal.querySelector("#saveSettingsBtn")?.addEventListener("click", () => {
    showToast("Đã lưu thiết lập giao diện và thông báo.", "success");
    closeModal();
  });
}

export function openSupportModal() {
  const bodyHtml = `
    <div class="support-content">
      <div class="support-intro">
        <p>Trung tâm trợ giúp và hỗ trợ kỹ thuật giải pháp quản lý nhà trọ <strong>ISK19</strong>.</p>
      </div>

      <div class="support-cards-grid">
        <div class="support-card">
          <div class="support-card__icon">${icons.help(22)}</div>
          <h6>Hotline hỗ trợ</h6>
          <p>1900 6868 (8:00 - 20:00)</p>
        </div>
        <div class="support-card">
          <div class="support-card__icon">${icons.bell(22)}</div>
          <h6>Email trợ giúp</h6>
          <p>hotro@isk19.vn</p>
        </div>
      </div>

      <div class="settings-section" style="margin-top: 18px;">
        <h5 class="settings-section-title">Phím tắt thao tác nhanh (Keyboard Shortcuts)</h5>
        <div class="shortcut-list">
          <div class="shortcut-item">
            <span>Tìm kiếm nhanh</span>
            <kbd>Ctrl</kbd> + <kbd>K</kbd>
          </div>
          <div class="shortcut-item">
            <span>Đóng hộp thoại / Menu</span>
            <kbd>Esc</kbd>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <a class="btn btn--secondary" href="./member.html" target="_blank" rel="noopener noreferrer" aria-label="Mở trang Hỗ trợ trong tab mới">${icons.help(18)} Hỗ trợ</a>
      <button class="btn btn--secondary" data-modal-close>Đóng</button>
    </div>
  `;

  renderModalWrapper("Trợ giúp & Hỗ trợ", icons.help(20), bodyHtml);
}
