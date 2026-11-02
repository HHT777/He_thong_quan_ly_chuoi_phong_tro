import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readCashflow, readExpiring, readIncidents, readSummary } from "../src/modules/overview/dashboard.metrics.mjs";

const requireBackend = createRequire(new URL("../../phong-tro-backend/package.json", import.meta.url));
const mysql = requireBackend("mysql2/promise");
const period = process.env.UI1_LIVE_PERIOD || "2026-10";
const base = process.env.UI1_LIVE_BASE_URL;

test("UI-1a live qlpt_authz_test API maps to direct owner-scoped SQL counts", { skip: !base }, async () => {
  assert.equal(process.env.TEST_DB_HOST, "127.0.0.1");
  assert.equal(process.env.TEST_DB_PORT, "3307");
  assert.equal(process.env.TEST_DB_NAME, "qlpt_authz_test");
  const username = process.env.TEST_LANDLORD_USERNAME;
  const password = process.env.TEST_LANDLORD_PASSWORD;
  assert.ok(username && password);
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ten_dang_nhap: username, mat_khau: password }) });
  assert.equal(login.status, 200);
  const token = (await login.json()).data.token;
  const get = async (path) => {
    const response = await fetch(`${base}/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200, path);
    return response.json();
  };
  const [summary, cashflow, contracts, incidents] = await Promise.all([
    get(`/v1/dashboard/summary?period=${period}`), get(`/v1/reports/cashflow?periodType=month&periodValue=${period}`),
    get("/hop-dong/expiring"), get("/v1/incidents"),
  ]);
  const metrics = readSummary(summary);
  const cash = readCashflow(cashflow);
  const contractRows = readExpiring(contracts);
  const incidentRows = readIncidents(incidents);
  const db = await mysql.createConnection({ host: process.env.TEST_DB_HOST, port: Number(process.env.TEST_DB_PORT), user: process.env.TEST_DB_USER, password: process.env.TEST_DB_PASSWORD || "", database: process.env.TEST_DB_NAME });
  try {
    const [[owner]] = await db.query("SELECT o.maChuTro ownerId FROM ChuTro o JOIN TaiKhoan a ON a.maTaiKhoan=o.maTaiKhoan WHERE a.tenDangNhap=?", [username]);
    assert.ok(owner);
    const ownerId = owner.ownerId;
    const [rooms] = await db.query("SELECT p.trangThai status, COUNT(*) n FROM PhongTro p JOIN CanTro c ON c.maCan=p.maCan WHERE c.maChuTro=? GROUP BY p.trangThai", [ownerId]);
    assert.equal(metrics.rooms.total, rooms.reduce((sum, row) => sum + Number(row.n), 0));
    assert.equal(metrics.rooms.byStatus.DANG_THUE, Number(rooms.find((row) => row.status === "DANG_THUE")?.n || 0));
    const [year, month] = period.split("-").map(Number);
    const [[bills]] = await db.query("SELECT COUNT(*) total, COALESCE(SUM(t.soTienConNo=0),0) paid, COALESCE(SUM(t.soTienConNo>0),0) unpaid FROM ThanhToan t JOIN HopDong h ON h.maHopDong=t.maHopDong JOIN PhongTro p ON p.maPhong=h.maPhong JOIN CanTro c ON c.maCan=p.maCan WHERE c.maChuTro=? AND t.loaiThanhToan='DINH_KY' AND t.nam=? AND t.thang=?", [ownerId, year, month]);
    assert.equal(metrics.bills.total, Number(bills.total));
    assert.equal(metrics.bills.daThu, Number(bills.paid));
    assert.equal(metrics.bills.conNo + metrics.bills.quaHan, Number(bills.unpaid));
    const [incidentCounts] = await db.query("SELECT s.trangThai status, COUNT(*) n FROM SuCo s JOIN PhongTro p ON p.maPhong=s.maPhong JOIN CanTro c ON c.maCan=p.maCan WHERE c.maChuTro=? AND s.daXoa=0 GROUP BY s.trangThai", [ownerId]);
    assert.equal(incidentRows.total, incidentCounts.reduce((sum, row) => sum + Number(row.n), 0));
    for (const row of incidentCounts) assert.equal(incidentRows.byStatus[row.status] || 0, Number(row.n));
    const from = `${period}-01`;
    const to = `${period}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
    const [[receipts]] = await db.query("SELECT COALESCE(SUM(k.soTien),0) amount FROM KhoanThu k JOIN CanTro c ON c.maCan=k.maCan WHERE c.maChuTro=? AND k.trangThaiGhiNhan='HIEU_LUC' AND k.ngayGhiNhan BETWEEN ? AND ?", [ownerId, from, to]);
    const [[deductions]] = await db.query("SELECT COALESCE(SUM(LEAST(b.tienCocBanDau,b.tongKhoanKhauTru)),0) amount FROM BienBanTraPhong b JOIN HopDong h ON h.maHopDong=b.maHopDong JOIN PhongTro p ON p.maPhong=h.maPhong JOIN CanTro c ON c.maCan=p.maCan WHERE c.maChuTro=? AND b.laDuLieuLegacy=0 AND b.ngayQuyetToan BETWEEN ? AND ?", [ownerId, from, to]);
    assert.equal(cash.totalRevenue, Number(receipts.amount) + Number(deductions.amount));
    const businessParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type) => businessParts.find((item) => item.type === type).value;
    const today = `${part("year")}-${part("month")}-${part("day")}`;
    const end = new Date(`${today}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 30);
    const boundary = end.toISOString().slice(0, 10);
    const [[expiring]] = await db.query("SELECT COUNT(*) n FROM HopDong h JOIN PhongTro p ON p.maPhong=h.maPhong JOIN CanTro c ON c.maCan=p.maCan WHERE c.maChuTro=? AND h.trangThai IN ('DANG_HIEU_LUC','SAP_HET_HAN') AND h.ngayKetThuc BETWEEN ? AND ?", [ownerId, today, boundary]);
    assert.equal(contractRows.length, Number(expiring.n));
    console.log(JSON.stringify({ period, rooms: metrics.rooms.total, bills: metrics.bills, revenue: cash.totalRevenue, incidents: incidentRows.total, expiring: contractRows.length }));
  } finally { await db.end(); }
});
