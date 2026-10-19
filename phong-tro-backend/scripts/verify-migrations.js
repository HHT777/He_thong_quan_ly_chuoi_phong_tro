require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

const database = String(process.env.MIGRATION_TEST_DB_NAME || "").trim();
if (!/^[A-Za-z0-9_]+_(?:test|ci)$/i.test(database)) throw new Error("MIGRATION_TEST_DB_NAME must end in _test or _ci");
if (database === process.env.DB_NAME) throw new Error("Migration copy must differ from DB_NAME");
if (process.env.MIGRATION_TEST_DB_ALLOWED_NAME && (
  database !== process.env.MIGRATION_TEST_DB_ALLOWED_NAME
  || process.env.TEST_DB_HOST !== "127.0.0.1"
  || Number(process.env.TEST_DB_PORT) !== 3307
)) throw new Error("Migration test DB target is outside explicitly approved scope");

const options = (withDatabase = false) => ({
  host: process.env.TEST_DB_HOST || process.env.DB_HOST,
  port: Number(process.env.TEST_DB_PORT || process.env.DB_PORT || 3306),
  user: process.env.TEST_DB_USER || process.env.DB_USER,
  password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
  ...(withDatabase ? { database } : {}),
  charset: "utf8mb4",
  multipleStatements: true,
});

function baselineSql() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  return source.slice(0, source.indexOf("-- 3."))
    .replace(/^create database[^;]+;\s*$/gim, "")
    .replace(/^use\s+`[^`]+`;\s*$/gim, "");
}

function documentedSchema() {
  const source = fs.readFileSync(path.resolve(__dirname, "../../data2.md"), "utf8");
  const tables = new Map();
  for (const match of source.matchAll(/create table `([^`]+)` \(([\s\S]*?)\) engine=/gi)) {
    tables.set(match[1], [...match[2].matchAll(/^`([^`]+)`\s+/gm)].map((column) => column[1]).sort());
  }
  return tables;
}

async function actualSchema(connection) {
  const [rows] = await connection.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns WHERE table_schema = ? ORDER BY TABLE_NAME, ORDINAL_POSITION",
    [database],
  );
  const tables = new Map();
  for (const row of rows) {
    const tableName = String(row.TABLE_NAME).toLowerCase();
    if (!tables.has(tableName)) tables.set(tableName, []);
    tables.get(tableName).push(row.COLUMN_NAME);
  }
  for (const columns of tables.values()) columns.sort();
  return tables;
}

async function run() {
  const admin = await mysql.createConnection(options(false));
  const [[{ version }]] = await admin.query("SELECT VERSION() version");
  const engine = String(version).includes("MariaDB") ? "MariaDB" : "MySQL8";
  const quoted = `\`${database}\``;
  console.log(`[MIGRATION DB DROP] ENGINE=${engine} host=${options().host} port=${options().port} name=${database}`);
  await admin.query(`DROP DATABASE IF EXISTS ${quoted}`);
  console.log(`[MIGRATION DB CREATE] ENGINE=${engine} host=${options().host} port=${options().port} name=${database}`);
  await admin.query(`CREATE DATABASE ${quoted} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  const connection = await mysql.createConnection(options(true));
  try {
    await connection.query(baselineSql());
    const [beforeRows] = await connection.query("SELECT (SELECT COUNT(*) FROM HopDong) contracts, (SELECT COUNT(*) FROM PhongTro) rooms, (SELECT COUNT(*) FROM TaiKhoan) accounts");
    const [beforeBilling] = await connection.query("SELECT (SELECT COUNT(*) FROM ThongBao) notifications, (SELECT COALESCE(SUM(soTienConNo),0) FROM ThanhToan) outstanding");
    const [beforeRevenue] = await connection.query("SELECT COUNT(*) receipts, COALESCE(SUM(soTien),0) netRevenue FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC'");
    await connection.query(`
      SET FOREIGN_KEY_CHECKS=0;
      ALTER TABLE SuCo DROP FOREIGN KEY fk_SuCo_maSuCoTruoc, DROP INDEX ix_SuCo_maSuCoTruoc, DROP COLUMN maSuCoTruoc;
      DROP TABLE IF EXISTS GiaoDichHoanCoc, LichSuChuyenPhong, LichSuGiaHanHopDong, LichSuSuaHopDong;
      ALTER TABLE ChiTietThanhToan DROP FOREIGN KEY fk_ChiTietThanhToan_khoanDieuChinh, DROP FOREIGN KEY fk_ChiTietThanhToan_nguoiThucHien, DROP INDEX uq_ChiTietThanhToan_dieu_chinh, DROP CONSTRAINT ck_ChiTietThanhToan_013, DROP COLUMN thoiDiemTao, DROP COLUMN nguoiThucHienId, DROP COLUMN maKhoanDieuChinh;
      ALTER TABLE ChiTietThanhToan ADD CONSTRAINT ck_ChiTietThanhToan_1 CHECK (soTien >= 0);
      ALTER TABLE ThanhToan DROP INDEX ix_ThanhToan_tac_vu, DROP CONSTRAINT ck_ThanhToan_013_gui, DROP CONSTRAINT ck_ThanhToan_013_nhac, DROP CONSTRAINT ck_ThanhToan_013_qua_han, DROP CONSTRAINT ck_ThanhToan_013_chot_no, DROP COLUMN soTienChotCongNo, DROP COLUMN ngayChotCongNo, DROP COLUMN daChotCongNo, DROP COLUMN ngayQuaHan, DROP COLUMN quaHan, DROP COLUMN ngayNhacHan, DROP COLUMN daNhacHan, DROP COLUMN ngayGui, DROP COLUMN daGui, DROP COLUMN ngayLap;
      DROP TABLE KhoanDieuChinh;
      DELETE FROM CauHinhHeThong WHERE khoa='billingCronLookbackMonths';
      ALTER TABLE KhoanKhauTru ADD INDEX ix_verify_KhoanKhauTru_maViPham (maViPham);
      ALTER TABLE KhoanKhauTru DROP FOREIGN KEY fk_KhoanKhauTru_maChiPhiSuCo, DROP INDEX uq_KhoanKhauTru_maChiPhiSuCo, DROP INDEX uq_KhoanKhauTru_maViPham, DROP COLUMN maChiPhiSuCo, DROP COLUMN soLuongTaiSan;
      ALTER TABLE ThanhToan DROP FOREIGN KEY fk_ThanhToan_maBienBanTraPhong, DROP INDEX uq_ThanhToan_maBienBanTraPhong, DROP INDEX uq_ThanhToan_ky_loai, ADD UNIQUE INDEX uq_ThanhToan_ky1 (maHopDong, thang, nam), DROP COLUMN maBienBanTraPhong, DROP COLUMN loaiThanhToan;
      ALTER TABLE ChiSoDien DROP INDEX uq_ChiSoDien_nghiepVu, ADD UNIQUE INDEX uq_ChiSoDien_ky1 (maPhong, thang, nam), DROP COLUMN khoaNghiepVu, DROP COLUMN loaiChiSo;
      ALTER TABLE GiaoDichThanhToan DROP COLUMN nguonThanhToan;
      ALTER TABLE BienBanTraPhong DROP COLUMN snapshotJson, DROP COLUMN congThucQuyetToan, DROP COLUMN soTienNoSauThanhLy, DROP COLUMN giaTriQuyetToanRong, DROP COLUMN tienPhongTraTruocDuocHoan, DROP COLUMN tienCocBanDau, DROP COLUMN ngayQuyetToan, DROP COLUMN laDuLieuLegacy;
      ALTER TABLE KhoanThu DROP CONSTRAINT ck_KhoanThu_015_snapshot, DROP CONSTRAINT ck_KhoanThu_015_nguon, DROP COLUMN nguonSnapshot, DROP COLUMN giamTruPhanBo, DROP COLUMN doanhThuGop;
      ALTER TABLE HopDong DROP COLUMN goiGiaHanChoPhep, DROP COLUMN phiDichVu, DROP COLUMN daCoBanGiayKy;
      SET FOREIGN_KEY_CHECKS=1;
    `);
    const migrations = fs.readdirSync(path.resolve(__dirname, "../migrations"))
      .filter((name) => /^(00[4-9]|01[0-6])_.*\.sql$/.test(name))
      .sort();
    for (let pass = 1; pass <= 2; pass += 1) {
      for (const name of migrations) {
        await connection.query(fs.readFileSync(path.resolve(__dirname, "../migrations", name), "utf8"));
      }
    }
    await connection.query("ALTER TABLE KhoanKhauTru DROP INDEX ix_verify_KhoanKhauTru_maViPham");
    const [afterRows] = await connection.query("SELECT (SELECT COUNT(*) FROM HopDong) contracts, (SELECT COUNT(*) FROM PhongTro) rooms, (SELECT COUNT(*) FROM TaiKhoan) accounts");
    if (JSON.stringify(beforeRows[0]) !== JSON.stringify(afterRows[0])) throw new Error("Migration changed existing core row counts");
    const [afterBilling] = await connection.query("SELECT (SELECT COUNT(*) FROM ThongBao) notifications, (SELECT COALESCE(SUM(soTienConNo),0) FROM ThanhToan) outstanding, (SELECT COUNT(*) FROM ThanhToan WHERE daGui=false OR daNhacHan=false OR quaHan=false OR daChotCongNo=false OR ngayGui IS NULL OR ngayNhacHan IS NULL OR ngayQuaHan IS NULL OR ngayChotCongNo IS NULL) unprotectedLegacyBills");
    const [afterRevenue] = await connection.query("SELECT COUNT(*) receipts, SUM(nguonSnapshot='SUY_DIEN') backfilled, COALESCE(SUM(soTien),0) netRevenue, COALESCE(SUM(IF(nguonSnapshot IS NULL,soTien,doanhThuGop-giamTruPhanBo)),0) reportNet FROM KhoanThu WHERE trangThaiGhiNhan='HIEU_LUC'");
    if (Number(beforeBilling[0].notifications) !== Number(afterBilling[0].notifications)) throw new Error("Migration emitted legacy notifications");
    if (Number(beforeBilling[0].outstanding) !== Number(afterBilling[0].outstanding)) throw new Error("Migration changed legacy outstanding balances");
    if (Number(afterBilling[0].unprotectedLegacyBills) !== 0) throw new Error("Migration left legacy bills eligible for cron spam");
    if (Number(beforeRevenue[0].netRevenue) !== Number(afterRevenue[0].reportNet)) throw new Error("Migration 015 changed legacy net report revenue");
    const expected = documentedSchema();
    const actual = await actualSchema(connection);
    const expectedNames = new Set([...expected.keys()].map((table) => table.toLowerCase()));
    const missingTables = [...expected.keys()].filter((table) => !actual.has(table.toLowerCase()));
    const extraTables = [...actual.keys()].filter((table) => !expectedNames.has(table));
    const columnMismatches = [...expected].filter(([table, columns]) => JSON.stringify(columns) !== JSON.stringify(actual.get(table.toLowerCase()) || []));
    if (missingTables.length || extraTables.length || columnMismatches.length) {
      throw new Error(JSON.stringify({ missingTables, extraTables, columnMismatches }));
    }
    console.log(JSON.stringify({ database, passes: 2, migrations, preservedRows: afterRows[0], legacyBackfill: afterBilling[0], receiptBackfill: { before: beforeRevenue[0], after: afterRevenue[0] }, tables: actual.size }));
  } finally {
    await connection.end();
    const cleanup = await mysql.createConnection(options(false));
    console.log(`[MIGRATION DB DROP] ENGINE=${engine} host=${options().host} port=${options().port} name=${database}`);
    await cleanup.query(`DROP DATABASE IF EXISTS ${quoted}`);
    await cleanup.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
