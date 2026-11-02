/*
 * Read-only, privacy-filtered data inventory for the 2026 demo seed plan.
 * This script never calls sync(), a transaction, or a write query.
 * Use a MySQL account granted SELECT only.
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");

const INSPECT_ENV = {
  database: process.env.SEED_INSPECT_DB_NAME,
  host: process.env.SEED_INSPECT_DB_HOST,
  port: process.env.SEED_INSPECT_DB_PORT,
  user: process.env.SEED_INSPECT_DB_USER,
  password: process.env.SEED_INSPECT_DB_PASSWORD,
};

function assertSafeTarget() {
  const required = [
    ["SEED_INSPECT_DB_NAME", INSPECT_ENV.database],
    ["SEED_INSPECT_DB_HOST", INSPECT_ENV.host],
    ["SEED_INSPECT_DB_PORT", INSPECT_ENV.port],
    ["SEED_INSPECT_DB_USER", INSPECT_ENV.user],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(", ")}`);
  if (INSPECT_ENV.password === undefined) throw new Error("Thiếu biến SEED_INSPECT_DB_PASSWORD (đặt chuỗi rỗng nếu tài khoản không có mật khẩu)");
  if (!/^\d+$/.test(INSPECT_ENV.port)) throw new Error("SEED_INSPECT_DB_PORT phải là số cổng");
  if (process.env.NODE_ENV === "production") throw new Error("Từ chối chạy khi NODE_ENV=production");
  if (/(^|[^a-z])(prod|production|live)([^a-z]|$)/i.test(INSPECT_ENV.database)) throw new Error("Tên database có dấu hiệu production; đã từ chối kết nối");
  if (process.env.SEED_INSPECT_CONFIRM !== "development") throw new Error("Đặt SEED_INSPECT_CONFIRM=development để xác nhận rõ môi trường chạy");
}

function compactIdMap(rows, field, prefix) {
  return new Map(rows.map((row, index) => [row[field], `${prefix}-${String(index + 1).padStart(2, "0")}`]));
}

function amount(value) {
  return value === null || value === undefined ? null : Number(value);
}

function dateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function monthBounds(month) {
  const [year, part] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, part, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function monthMatchesAdjustment(row, year, month) {
  if (row.che_do === "THEO_KY") return Number(row.nam_ap_dung) === year && Number(row.thang_ap_dung) === month;
  const start = String(row.ngay_bat_dau || "").slice(0, 10);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = monthBounds(`${year}-${String(month).padStart(2, "0")}`).to;
  const stopped = String(row.ngay_tat || "").slice(0, 10);
  return Boolean(start && start <= monthEnd && (!stopped || stopped > monthStart));
}

function csvSafe(value) {
  return String(value ?? "").replace(/[|\r\n]/g, " ").trim();
}

function markdownSummary(data) {
  const lines = [
    "# Tóm tắt khảo sát dữ liệu seed (đã ẩn danh)",
    "",
    `- Thời điểm khảo sát: ${data.generatedAt}`,
    `- Database: ${data.database.name} (host/cổng không được xuất)`,
    `- Chủ trọ: ${data.overview.landlordCount}`,
    `- Căn: ${data.overview.buildingCount}; phòng: ${data.overview.roomCount}`,
    "",
    "## Phòng theo trạng thái",
    "",
    "| Căn | Tổng phòng | Trạng thái | Số phòng |",
    "|---|---:|---|---:|",
  ];
  for (const building of data.buildings) {
    for (const [status, count] of Object.entries(building.roomCounts)) {
      lines.push(`| ${csvSafe(building.name)} | ${building.totalRooms} | ${csvSafe(status)} | ${count} |`);
    }
  }
  lines.push("", "## Hợp đồng hiệu lực", "", "| HĐ | Căn | Phòng | Khách | Bắt đầu | Kết thúc | Giá thuê | Cọc | Điện | Nước | Phí dịch vụ | Người ở | Trạng thái |", "|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|");
  for (const row of data.activeContracts) {
    lines.push(`| ${row.contractCode} | ${csvSafe(row.buildingName)} | ${csvSafe(row.roomNumber)} | ${row.tenantCode} | ${row.startDate} | ${row.endDate} | ${row.rent} | ${row.deposit} | ${row.electricityUnitPrice} | ${row.waterUnitPrice} | ${row.serviceFee} | ${row.occupantCount} | ${row.status} |`);
  }
  lines.push("", "## Chỉ số điện theo phòng", "", "| Căn | Phòng | Số bản ghi lịch sử | Mới nhất đã xác nhận | Chỉ số | Đơn giá |", "|---|---|---:|---|---:|---:|");
  for (const room of data.meterReadings) {
    const latest = room.latestConfirmed;
    lines.push(`| ${csvSafe(room.buildingName)} | ${csvSafe(room.roomNumber)} | ${room.history.length} | ${latest ? `${latest.year}-${String(latest.month).padStart(2, "0")}` : "—"} | ${latest?.reading ?? "—"} | ${latest?.unitPrice ?? "—"} |`);
  }
  lines.push("", "## Tài chính tháng 9 và 10/2026", "", "| Kỳ | Thực nhận | Chi phí | Lợi nhuận | Phiếu thu | Giao dịch thanh toán | Khoản chi | Điều chỉnh |", "|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const month of data.financialMonths) {
    if (month.report.perLandlord) {
      lines.push(`| ${month.period} | nhiều Chủ trọ; xem JSON | nhiều Chủ trọ; xem JSON | nhiều Chủ trọ; xem JSON | ${month.counts.bills} | ${month.counts.payments} | ${month.counts.expenses} | ${month.counts.adjustments} |`);
      for (const owner of month.report.perLandlord) lines.push(`| ↳ ${owner.landlordCode} | ${owner.totalRevenue} | ${owner.totalExpenses} | ${owner.profit} | ${owner.billCount} | — | — | — |`);
    } else {
      lines.push(`| ${month.period} | ${month.report.totalRevenue} | ${month.report.totalExpenses} | ${month.report.profit} | ${month.counts.bills} | ${month.counts.payments} | ${month.counts.expenses} | ${month.counts.adjustments} |`);
    }
  }
  lines.push("", "## Lưu ý về danh mục", "", `- Loại chi phí quan sát được: ${data.catalogs.expenseTypes.join(", ") || "không có"}.`, `- Loại phí trên chi tiết phiếu: ${data.catalogs.billLineTypes.join(", ") || "không có"}.`, `- Phương thức thanh toán: ${data.catalogs.paymentMethodNote}.`, "- Tên khách, số điện thoại, giấy tờ, email và UUID thật không được xuất.", "");
  return lines.join("\n");
}

async function inspect() {
  assertSafeTarget();

  // Configure the application's Sequelize instance before model imports. Use
  // separate inspect credentials; the DB account itself should have SELECT only.
  process.env.NODE_ENV = "seed-inspect"; // Disable development SQL logging for this inventory run.
  process.env.DB_NAME = INSPECT_ENV.database;
  process.env.DB_HOST = INSPECT_ENV.host;
  process.env.DB_PORT = INSPECT_ENV.port;
  process.env.DB_USER = INSPECT_ENV.user;
  process.env.DB_PASSWORD = INSPECT_ENV.password;

  const sequelize = require("../src/config/database");
  const models = require("../src/models");
  const { Op } = require("sequelize");
  const { getCashflow } = require("../src/services/cashflowReport.service");
  const { CONFIG_CATALOG, DEFAULTS } = require("../src/services/systemConfig.service");

  const {
    ChuTro, CanTro, PhongTro, HopDong, TienCoc, ThanhVienPhong, ChiSoDien,
    LichSuChinhSuaChiSoDien, CauHinhHeThong, ThanhToan, GiaoDichThanhToan,
    ChiTietThanhToan, KhoanDieuChinh, KhoanChi, KhoanThu,
  } = models;

  await sequelize.authenticate();
  try {
    const asOfDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const [landlords, buildings, rooms, contracts, allMeters, meterEdits, configRows] = await Promise.all([
      ChuTro.findAll({ attributes: ["ma_chu_tro"] }),
      CanTro.findAll({ attributes: ["ma_can", "ten_can", "trang_thai", "ma_chu_tro"], order: [["ten_can", "ASC"], ["ma_can", "ASC"]], raw: true }),
      PhongTro.findAll({ attributes: ["ma_phong", "ma_can", "so_phong", "trang_thai"], order: [["ma_can", "ASC"], ["so_phong", "ASC"]], raw: true }),
      HopDong.findAll({
        where: {
          trang_thai: { [Op.in]: ["DANG_HIEU_LUC", "SAP_HET_HAN"] },
          ngay_bat_dau: { [Op.lte]: asOfDate },
          ngay_ket_thuc: { [Op.gte]: asOfDate },
        },
        include: [
          { model: models.KhachThue, as: "khachThue", attributes: ["ma_khach_thue", "ho_ten"], required: true },
          { model: PhongTro, as: "phongTro", attributes: ["ma_phong", "ma_can", "so_phong"], required: true },
          { model: TienCoc, as: "tienCoc", attributes: ["so_tien_coc"], required: false },
          { model: ThanhVienPhong, as: "thanhVienPhongs", attributes: ["ma_thanh_vien_phong"], where: { trang_thai_cu_tru: "DANG_O" }, required: false },
        ], order: [["ngay_bat_dau", "ASC"], ["ma_phong", "ASC"]],
      }),
      ChiSoDien.findAll({
        where: { da_xoa: false },
        attributes: ["ma_chi_so", "ma_phong", "nam", "thang", "chi_so_moi", "don_gia_ap_dung", "trang_thai_xac_nhan", "loai_chi_so", "ngay_ghi_nhan"],
        order: [["ma_phong", "ASC"], ["nam", "ASC"], ["thang", "ASC"], ["ngay_ghi_nhan", "ASC"]], raw: true,
      }),
      LichSuChinhSuaChiSoDien.findAll({ attributes: ["ma_chi_so", "chi_so_cu", "chi_so_moi", "thoi_diem_sua"], order: [["thoi_diem_sua", "ASC"]], raw: true }),
      CauHinhHeThong.findAll({ where: { khoa: Object.keys(CONFIG_CATALOG) }, attributes: ["khoa", "gia_tri"], raw: true }),
    ]);

    const buildingCode = compactIdMap(buildings, "ma_can", "CAN");
    const roomCode = compactIdMap(rooms, "ma_phong", "PH");
    const contractRows = [...contracts].sort((a, b) => `${a.ngay_bat_dau}|${a.ma_hop_dong}`.localeCompare(`${b.ngay_bat_dau}|${b.ma_hop_dong}`));
    const allContractRows = await HopDong.findAll({ attributes: ["ma_hop_dong", "ma_khach_thue", "ngay_bat_dau"], order: [["ngay_bat_dau", "ASC"], ["ma_hop_dong", "ASC"]], raw: true });
    const allTenantIds = [...new Set(allContractRows.map((row) => row.ma_khach_thue))].sort();
    const tenantCode = new Map(allTenantIds.map((id, index) => [id, `KH-${String(index + 1).padStart(2, "0")}`]));
    const contractCode = compactIdMap(allContractRows, "ma_hop_dong", "HD");
    const roomById = new Map(rooms.map((row) => [row.ma_phong, row]));
    const buildingById = new Map(buildings.map((row) => [row.ma_can, row]));
    const historyByRoom = new Map();
    for (const meter of allMeters) {
      const bucket = historyByRoom.get(meter.ma_phong) || [];
      bucket.push({
        period: `${meter.nam}-${String(meter.thang).padStart(2, "0")}`,
        year: Number(meter.nam), month: Number(meter.thang), reading: amount(meter.chi_so_moi),
        unitPrice: amount(meter.don_gia_ap_dung), status: meter.trang_thai_xac_nhan,
        type: meter.loai_chi_so, recordedAt: dateValue(meter.ngay_ghi_nhan),
      });
      historyByRoom.set(meter.ma_phong, bucket);
    }
    const editsByMeter = new Map();
    for (const edit of meterEdits) {
      const bucket = editsByMeter.get(edit.ma_chi_so) || [];
      bucket.push({ oldReading: amount(edit.chi_so_cu), newReading: amount(edit.chi_so_moi), editedAt: dateValue(edit.thoi_diem_sua) });
      editsByMeter.set(edit.ma_chi_so, bucket);
    }
    const meterReadings = rooms.map((room) => {
      const history = historyByRoom.get(room.ma_phong) || [];
      const confirmed = allMeters.filter((item) => item.ma_phong === room.ma_phong && item.trang_thai_xac_nhan === "DA_XAC_NHAN")
        .sort((a, b) => String(b.ngay_ghi_nhan).localeCompare(String(a.ngay_ghi_nhan)) || b.nam - a.nam || b.thang - a.thang);
      const newest = confirmed[0];
      return {
        buildingName: buildingById.get(room.ma_can)?.ten_can || null,
        roomNumber: room.so_phong,
        history: history.map((item, index) => {
          const original = allMeters.find((meter) => `${meter.nam}-${String(meter.thang).padStart(2, "0")}` === item.period && meter.ma_phong === room.ma_phong && meter.chi_so_moi === item.reading);
          return { ...item, editHistory: original ? editsByMeter.get(original.ma_chi_so) || [] : [] };
        }),
        latestConfirmed: newest ? {
          period: `${newest.nam}-${String(newest.thang).padStart(2, "0")}`,
          year: Number(newest.nam), month: Number(newest.thang), reading: amount(newest.chi_so_moi), unitPrice: amount(newest.don_gia_ap_dung),
        } : null,
      };
    });

    const activeContracts = contractRows.map((row) => ({
      contractCode: contractCode.get(row.ma_hop_dong), tenantCode: tenantCode.get(row.ma_khach_thue),
      buildingName: row.phongTro?.canTro?.ten_can || buildingById.get(row.phongTro?.ma_can)?.ten_can || null,
      roomNumber: row.phongTro?.so_phong || roomById.get(row.ma_phong)?.so_phong || null,
      startDate: dateValue(row.ngay_bat_dau), endDate: dateValue(row.ngay_ket_thuc), rent: amount(row.gia_thue),
      deposit: amount(row.tienCoc?.so_tien_coc), electricityUnitPrice: amount(row.don_gia_dien),
      waterUnitPrice: amount(row.don_gia_nuoc), serviceFee: amount(row.phi_dich_vu),
      occupantCount: 1 + (row.thanhVienPhongs?.length || 0), status: row.trang_thai,
    }));

    const storedConfig = Object.fromEntries(configRows.map((row) => [row.khoa, row.gia_tri]));
    const config = Object.fromEntries(Object.entries(CONFIG_CATALOG).map(([key, item]) => [key, {
      stored: Object.hasOwn(storedConfig, key), value: storedConfig[key] ?? null,
      codeDefault: DEFAULTS[key],
    }]));

    const financialMonths = [];
    for (const period of ["2026-09", "2026-10"]) {
      const { from, to } = monthBounds(period);
      const [year, month] = period.split("-").map(Number);
      const [bills, payments, expenses, adjustments, receipts] = await Promise.all([
        ThanhToan.findAll({ where: { nam: year, thang: month }, include: [
          { model: HopDong, as: "hopDong", include: [
            { model: KhachThue, as: "khachThue", attributes: ["ma_khach_thue"] },
            { model: PhongTro, as: "phongTro", attributes: ["ma_phong", "ma_can", "so_phong"] },
          ] },
          { model: ChiTietThanhToan, as: "chiTiets" },
          { model: GiaoDichThanhToan, as: "giaoDichs" },
        ], order: [["ma_hop_dong", "ASC"]] }),
        GiaoDichThanhToan.findAll({ where: { thoi_diem_ghi_nhan: { [Op.between]: [`${from} 00:00:00`, `${to} 23:59:59`] } }, include: [{ model: ThanhToan, as: "thanhToan", required: true, include: [{ model: HopDong, as: "hopDong", include: [{ model: PhongTro, as: "phongTro", attributes: ["ma_phong", "ma_can", "so_phong"] }] }] }], order: [["thoi_diem_ghi_nhan", "ASC"]] }),
        KhoanChi.findAll({ where: { ngay_phat_sinh: { [Op.between]: [from, to] } }, order: [["ngay_phat_sinh", "ASC"]], raw: true }),
        KhoanDieuChinh.findAll({ order: [["ngay_tao", "ASC"]], raw: true }).then((rows) => rows.filter((row) => monthMatchesAdjustment(row, year, month))),
        KhoanThu.findAll({ where: { ngay_ghi_nhan: { [Op.between]: [from, to] } }, order: [["ngay_ghi_nhan", "ASC"]], raw: true }),
      ]);
      const lineTypes = [...new Set(bills.flatMap((bill) => (bill.chiTiets || []).map((line) => line.loai_khoan)))].sort();
      const billPayments = await GiaoDichThanhToan.findAll({
        where: { ma_thanh_toan: { [Op.in]: bills.map((row) => row.ma_thanh_toan) } },
        order: [["thoi_diem_ghi_nhan", "ASC"], ["ma_giao_dich", "ASC"]], raw: true,
      });
      const billReceipts = billPayments.length ? await KhoanThu.findAll({
        where: { ma_giao_dich_thanh_toan: { [Op.in]: billPayments.map((row) => row.ma_giao_dich) } }, raw: true,
      }) : [];
      const paymentById = new Map(billPayments.map((row, index) => [row.ma_giao_dich, `GD-${String(index + 1).padStart(3, "0")}`]));
      const receiptByTransaction = new Map(billReceipts.map((row) => [row.ma_giao_dich_thanh_toan, row]));
      const billCode = compactIdMap(bills, "ma_thanh_toan", "PT");
      const expenseTypes = [...new Set(expenses.map((row) => row.loai_khoan_chi))].sort();
      const ownerReports = [];
      for (const landlord of landlords) {
        const ownedBuildingIds = buildings.filter((row) => row.ma_chu_tro === landlord.ma_chu_tro).map((row) => row.ma_can);
        const report = await getCashflow({ periodType: "month", periodValue: period, ownedBuildingIds });
        ownerReports.push({ landlordCode: `CHU-TRO-${String(landlords.indexOf(landlord) + 1).padStart(2, "0")}`, totalRevenue: report.totalRevenue, totalExpenses: report.totalExpenses, profit: report.profit, billCount: bills.filter((bill) => ownedBuildingIds.includes(bill.hopDong?.phongTro?.ma_can)).length });
      }
      financialMonths.push({
        period,
        report: ownerReports.length === 1 ? ownerReports[0] : { perLandlord: ownerReports },
        counts: { bills: bills.length, payments: payments.length, expenses: expenses.length, adjustments: adjustments.length, receipts: receipts.length },
        payments: payments.map((payment) => {
          const bill = payment.thanhToan;
          const room = bill?.hopDong?.phongTro;
          const receipt = receiptByTransaction.get(payment.ma_giao_dich);
          return {
            code: paymentById.get(payment.ma_giao_dich) || "GD-ngoài-kỳ",
            billCode: billCode.get(payment.ma_thanh_toan) || "phiếu khác",
            buildingName: buildingById.get(room?.ma_can)?.ten_can || null, roomNumber: room?.so_phong || null,
            period: bill ? `${bill.nam}-${String(bill.thang).padStart(2, "0")}` : null,
            amount: amount(payment.so_tien), recordedAt: dateValue(payment.thoi_diem_ghi_nhan),
            status: payment.trang_thai_xac_nhan, source: payment.nguon_thanh_toan,
            receipt: receipt ? { amount: amount(receipt.so_tien), date: dateValue(receipt.ngay_ghi_nhan), status: receipt.trang_thai_ghi_nhan, grossSnapshot: amount(receipt.doanh_thu_gop), discountSnapshot: amount(receipt.giam_tru_phan_bo), snapshotSource: receipt.nguon_snapshot } : null,
          };
        }),
        bills: bills.map((bill) => {
          const room = bill.hopDong?.phongTro;
          const tenantId = bill.hopDong?.ma_khach_thue;
          const selectedLines = (bill.chiTiets || []).map((line) => ({ type: line.loai_khoan, amount: amount(line.so_tien) }));
          const selectedPayments = (bill.giaoDichs || []).map((payment) => {
            const receipt = receiptByTransaction.get(payment.ma_giao_dich);
            return {
              transactionCode: paymentById.get(payment.ma_giao_dich) || "GD-ngoài-kỳ",
              amount: amount(payment.so_tien), recordedAt: dateValue(payment.thoi_diem_ghi_nhan),
              status: payment.trang_thai_xac_nhan, source: payment.nguon_thanh_toan,
              receipt: receipt ? { amount: amount(receipt.so_tien), date: dateValue(receipt.ngay_ghi_nhan), status: receipt.trang_thai_ghi_nhan, grossSnapshot: amount(receipt.doanh_thu_gop), discountSnapshot: amount(receipt.giam_tru_phan_bo), snapshotSource: receipt.nguon_snapshot } : null,
            };
          });
          return {
            code: billCode.get(bill.ma_thanh_toan), contractCode: contractCode.get(bill.ma_hop_dong) || null,
            tenantCode: tenantId ? tenantCode.get(tenantId) || null : null,
            buildingName: buildingById.get(room?.ma_can)?.ten_can || null, roomNumber: room?.so_phong || null,
            period: `${bill.nam}-${String(bill.thang).padStart(2, "0")}`, kind: bill.loai_thanh_toan,
            total: amount(bill.tong_phai_tra), paid: amount(bill.tong_da_thanh_toan), outstanding: amount(bill.so_tien_con_no), status: bill.trang_thai,
            lines: selectedLines, payments: selectedPayments,
          };
        }),
        expenses: expenses.map((row, index) => ({ code: `CP-${String(index + 1).padStart(3, "0")}`, type: row.loai_khoan_chi, amount: amount(row.so_tien), date: dateValue(row.ngay_phat_sinh), scope: row.pham_vi, buildingName: buildingById.get(row.ma_can)?.ten_can || null, status: row.trang_thai })),
        adjustments: adjustments.map((row, index) => ({ code: `DC-${String(index + 1).padStart(3, "0")}`, contractCode: contractCode.get(row.ma_hop_dong) || null, type: row.loai_khoan, amount: amount(row.so_tien), mode: row.che_do, status: row.trang_thai })),
        receiptTotals: { count: receipts.length, collected: receipts.filter((row) => row.trang_thai_ghi_nhan === "HIEU_LUC").reduce((sum, row) => sum + Number(row.so_tien), 0), byType: Object.entries(receipts.reduce((all, row) => { if (row.trang_thai_ghi_nhan === "HIEU_LUC") all[row.loai_khoan_thu] = (all[row.loai_khoan_thu] || 0) + Number(row.so_tien); return all; }, {})).map(([type, total]) => ({ type, total })) },
        observedExpenseTypes: expenseTypes, observedBillLineTypes: lineTypes,
      });
    }

    const allExpenseTypes = [...new Set((await KhoanChi.findAll({ attributes: ["loai_khoan_chi"], raw: true })).map((row) => row.loai_khoan_chi))].sort();
    const allBillLineTypes = [...new Set((await ChiTietThanhToan.findAll({ attributes: ["loai_khoan"], raw: true })).map((row) => row.loai_khoan))].sort();
    const output = {
      generatedAt: new Date().toISOString(), inspectedAsOfDate: asOfDate, database: { name: INSPECT_ENV.database },
      overview: { landlordCount: landlords.length, buildingCount: buildings.length, roomCount: rooms.length },
      buildings: buildings.map((building) => {
        const buildingRooms = rooms.filter((room) => room.ma_can === building.ma_can);
        const roomCounts = Object.fromEntries([...new Set([...buildingRooms.map((room) => room.trang_thai), "TRONG", "DA_GIU", "DANG_THUE", "DANG_XU_LY_TRA_PHONG", "NGUNG_SU_DUNG"])].sort().map((status) => [status, buildingRooms.filter((room) => room.trang_thai === status).length]));
        return { code: buildingCode.get(building.ma_can), name: building.ten_can, status: building.trang_thai, totalRooms: buildingRooms.length, roomCounts, rooms: buildingRooms.map((room) => ({ code: roomCode.get(room.ma_phong), number: room.so_phong, status: room.trang_thai })) };
      }),
      activeContracts,
      meterReadings,
      storedDebtConfiguration: config,
      financialMonths,
      catalogs: {
        expenseTypes: allExpenseTypes, billLineTypes: allBillLineTypes,
        serviceFeeNote: "Không có bảng danh mục phí dịch vụ riêng trong schema hiện hành; phí dịch vụ là số tiền trên hợp đồng và dòng PHI_DICH_VU trên phiếu.",
        paymentMethodNote: "Schema giao dịch hiện hành không có cột phương thức thanh toán; chỉ lưu nguồn thanh toán THU_TIEN/KHAU_TRU_COC.",
      },
    };

    // Do not include UUIDs, raw tenant names, addresses, notes, login names,
    // contacts, account data, or arbitrary free-text in generated artifacts.
    const outputDirArg = process.argv.find((arg) => arg.startsWith("--output-dir="))?.slice("--output-dir=".length);
    const outputDir = path.resolve(outputDirArg || path.join(process.cwd(), "reports", "seed-inspection"));
    fs.mkdirSync(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outputDir, `seed-inspection-${stamp}.json`);
    const mdPath = path.join(outputDir, `seed-inspection-${stamp}.md`);
    fs.writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    fs.writeFileSync(mdPath, `${markdownSummary(output)}\n`, { encoding: "utf8", flag: "wx" });
    console.log(`Đã xuất JSON đã ẩn danh: ${jsonPath}`);
    console.log(`Đã xuất bảng tóm tắt đã ẩn danh: ${mdPath}`);
    console.log("Trước khi gửi, mở cả hai file và xác nhận không có tên khách, thông tin liên hệ hoặc UUID.");
  } finally {
    await sequelize.close();
  }
}

inspect().catch((error) => {
  console.error(`[SEED INSPECT] Đã dừng an toàn: ${error.message}`);
  process.exitCode = 1;
});
