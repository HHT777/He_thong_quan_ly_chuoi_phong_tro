(function () {
  const api = () => window.ApiClient;
  const currency = (value) =>
    window.FormatUtil?.currency
      ? window.FormatUtil.currency(Number(value || 0))
      : `${Number(value || 0).toLocaleString("vi-VN")} đ`;
  const date = (value, withTime = false) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleString("vi-VN", withTime ? {} : { dateStyle: "short" });
  };
  const text = (value, fallback = "—") =>
    value === null || value === undefined || value === "" ? fallback : String(value);

  function setStats(values) {
    document.querySelectorAll(".stat-card__value").forEach((element, index) => {
      if (values[index] !== undefined) element.textContent = values[index];
    });
  }

  function renderTable(rows) {
    const tbody = document.querySelector(".data-table tbody");
    if (!tbody) return;
    tbody.replaceChildren();
    if (!rows.length) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = document.querySelectorAll(".data-table thead th").length || 1;
      cell.textContent = "Chưa có dữ liệu.";
      return;
    }
    rows.forEach((cells) => {
      const row = tbody.insertRow();
      cells.forEach((value) => {
        const cell = row.insertCell();
        cell.textContent = text(value);
      });
    });
  }

  function renderError(error) {
    const tbody = document.querySelector(".data-table tbody");
    if (!tbody) return;
    const columns = document.querySelectorAll(".data-table thead th").length || 1;
    tbody.innerHTML = "";
    const row = tbody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = columns;
    cell.textContent = error.message || "Không thể tải dữ liệu.";
  }

  async function loadDeposits() {
    const { data = [] } = await api().get("/dat-coc?limit=100");
    const total = data.reduce((sum, item) => sum + Number(item.so_tien_coc || 0), 0);
    setStats([
      currency(total),
      data.filter((item) => item.trang_thai === "DA_NHAN").length,
      data.filter((item) => item.trang_thai === "CHUA_NHAN").length,
      data.filter((item) => item.trang_thai === "DA_HOAN").length,
    ]);
    renderTable(
      data.map((item) => [
        item.hopDong?.khachThue?.ho_ten,
        item.hopDong?.phongTro?.ma_phong ? `P${item.hopDong.phongTro.ma_phong}` : null,
        currency(item.so_tien_coc),
        date(item.ngay_nhan_coc),
        item.trang_thai,
      ]),
    );
  }

  const billRoom = (bill) => bill.hopDong?.phongTro?.ma_phong;
  const billTenant = (bill) => bill.hopDong?.khachThue?.ho_ten;
  const billPeriod = (bill) =>
    bill.nam && bill.thang ? `${String(bill.thang).padStart(2, "0")}/${bill.nam}` : "—";

  async function loadDebt() {
    const { data = [] } = await api().get("/v1/debt");
    const total = data.reduce((sum, item) => sum + Number(item.so_tien_con_no || 0), 0);
    setStats([currency(total), data.length]);
    renderTable(
      data.map((item) => [
        billTenant(item),
        billRoom(item) ? `P${billRoom(item)}` : null,
        currency(item.so_tien_con_no),
        item.loai_thanh_toan === "SAU_THANH_LY" ? "Nợ sau thanh lý" : `10/${String(item.thang).padStart(2, "0")}/${item.nam}`,
        item.trang_thai,
      ]),
    );
  }

  async function loadBills() {
    const { data = [] } = await api().get("/khoan-phai-thu?limit=100");
    const total = data.reduce((sum, item) => sum + Number(item.tong_phai_tra || 0), 0);
    const collected = data.reduce((sum, item) => sum + Number(item.tong_da_thanh_toan || 0), 0);
    setStats([
      currency(total),
      total ? `${Math.round((collected / total) * 100)}%` : "0%",
      data.filter((item) => Number(item.so_tien_con_no) > 0).length,
      data.length,
    ]);
    renderTable(
      data.map((item) => [
        billTenant(item),
        billRoom(item) ? `P${billRoom(item)}` : null,
        currency(item.tong_phai_tra),
        `Kỳ ${billPeriod(item)}`,
        item.trang_thai,
      ]),
    );
  }

  async function loadPayments() {
    const { data = [] } = await api().get("/khoan-phai-thu/payment/list?limit=100");
    const total = data.reduce((sum, item) => sum + Number(item.so_tien || 0), 0);
    setStats([
      currency(total),
      data.filter((item) => item.trang_thai_xac_nhan === "DA_XAC_NHAN").length,
      data.filter((item) => item.trang_thai_xac_nhan !== "DA_XAC_NHAN").length,
      data.length,
    ]);
    renderTable(
      data.map((item) => [
        item.thanhToan?.hopDong?.khachThue?.ho_ten || `Hóa đơn #${item.ma_thanh_toan}`,
        "Thanh toán",
        currency(item.so_tien),
        date(item.thoi_diem_ghi_nhan, true),
        item.trang_thai_xac_nhan,
      ]),
    );
  }

  async function loadIncidents() {
    const { data = [] } = await api().get("/v1/incidents");
    setStats([
      data.length,
      data.filter((item) => item.trang_thai === "DANG_XU_LY").length,
      data.filter((item) => item.trang_thai === "DA_XU_LY").length,
      data.filter((item) => item.muc_do_uu_tien === "KHAN_CAP").length,
    ]);
    renderTable(
      data.map((item) => [
        item.ma_phong ? `P${item.ma_phong}` : null,
        item.mo_ta || item.loai_su_co,
        item.muc_do_uu_tien,
        item.trang_thai,
        date(item.ngay_gui, true),
      ]),
    );
  }

  async function loadNotifications() {
    const { data = [] } = await api().get("/v1/notifications");
    setStats([
      data.length,
      data.filter((item) => !item.da_doc).length,
      data.filter((item) => item.da_doc).length,
      data.length ? `${Math.round((data.filter((item) => item.da_doc).length / data.length) * 100)}%` : "0%",
    ]);
    renderTable(
      data.map((item) => [
        item.noi_dung,
        item.loai_thong_bao,
        date(item.thoi_diem_tao, true),
        item.da_doc ? "Đã đọc" : "Chưa đọc",
      ]),
    );
  }

  async function loadReport() {
    const { data = {} } = await api().get("/v1/reports/cashflow");
    const revenue = Number(data.totalRevenue ?? data.totalCollected ?? 0);
    const grossRevenue = Number(data.grossRevenue ?? revenue);
    const expenses = Number(data.totalExpenses || 0);
    const profit = Number(data.profit ?? (revenue - expenses));
    const margin = revenue ? Math.round((profit / revenue) * 100) : 0;
    setStats([currency(profit), `${margin}%`, currency(expenses), currency(revenue)]);
    renderTable([["Tổng hiện tại", currency(revenue), currency(grossRevenue), currency(expenses), currency(profit), `${margin}%`]]);
  }

  async function loadMoveOuts() {
    const [{ data: requests = [] }, { data: contracts = [] }, { data: tenants = [] }] =
      await Promise.all([
        api().get("/v1/requests"),
        api().get("/hop-dong?limit=100"),
        api().get("/management/khach-thue"),
      ]);
    const tenantMap = new Map(tenants.map((item) => [String(item.ma_khach_thue), item]));
    const contractMap = new Map();
    contracts.forEach((item) => {
      const key = String(item.ma_khach_thue);
      if (!contractMap.has(key) || ["DANG_HIEU_LUC", "SAP_HET_HAN"].includes(item.trang_thai)) {
        contractMap.set(key, item);
      }
    });
    const moveOuts = requests.filter((item) => item.loai_yeu_cau === "TRA_PHONG");
    setStats([
      moveOuts.filter((item) => item.trang_thai === "CHO_XU_LY").length,
      moveOuts.length,
    ]);
    renderTable(
      moveOuts.map((item) => {
        const contract = contractMap.get(String(item.ma_khach_thue));
        return [
          tenantMap.get(String(item.ma_khach_thue))?.ho_ten,
          contract?.ma_phong ? `P${contract.ma_phong}` : null,
          date(item.ngay_gui),
          item.noi_dung,
          item.trang_thai,
          "—",
        ];
      }),
    );
    document.querySelectorAll(".data-table tbody tr").forEach((row, index) => {
      const item = moveOuts[index];
      if (item?.trang_thai !== "DA_PHE_DUYET") return;
      const actionCell = row.lastElementChild;
      actionCell.textContent = "";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn--ghost";
      button.textContent = "Rút duyệt";
      button.addEventListener("click", async () => {
        const reason = window.prompt("Nhập lý do rút duyệt yêu cầu trả phòng:")?.trim();
        if (!reason) return window.alert("Lý do rút duyệt là bắt buộc.");
        button.disabled = true;
        try {
          await api().post(`/v1/requests/${item.ma_yeu_cau}/revoke`, { reason });
          await loadMoveOuts();
        } catch (error) {
          window.alert(error.message);
          button.disabled = false;
        }
      });
      actionCell.append(button);
    });
  }

  const loaders = {
    coc: loadDeposits,
    "cong-no": loadDebt,
    "tien-phong": loadBills,
    "thanh-toan": loadPayments,
    "su-co": loadIncidents,
    "thong-bao": loadNotifications,
    "bao-cao": loadReport,
    "tra-phong": loadMoveOuts,
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const loader = loaders[document.body.dataset.activePage];
    if (!loader || !api()) return;
    try {
      await loader();
    } catch (error) {
      renderError(error);
    }
  });
})();
