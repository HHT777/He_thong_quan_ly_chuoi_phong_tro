-- CHI CHAY KHI DA SAO LUU phong_tro VA DUOC NGUOI DUNG XAC NHAN.
-- Select database phong_tro in phpMyAdmin, then run the WHOLE file once.
-- MySQL 8 / MariaDB 10.4. This file is in apply mode after user approval.
-- Transfer only SEED_HIST_2026 history from phong_tro_copy_ci to phong_tro.
-- No UPDATE/DELETE and no Aug-Oct original records are copied.
-- If any SQL statement errors, stop and run ROLLBACK in the same DB session.

SET @history_apply := 1;
SET @history_backup_ack := 'BACKUP_PHONG_TRO_2026_CONFIRMED';

DROP TEMPORARY TABLE IF EXISTS _mh_contracts;
DROP TEMPORARY TABLE IF EXISTS _mh_rooms;
DROP TEMPORARY TABLE IF EXISTS _mh_meters;
DROP TEMPORARY TABLE IF EXISTS _mh_bills;
DROP TEMPORARY TABLE IF EXISTS _mh_lines;
DROP TEMPORARY TABLE IF EXISTS _mh_payments;
DROP TEMPORARY TABLE IF EXISTS _mh_receipts;
DROP TEMPORARY TABLE IF EXISTS _mh_expenses;

CREATE TEMPORARY TABLE _mh_contracts AS
SELECT maHopDong, maPhong FROM phong_tro_copy_ci.HopDong
WHERE dieuKhoan LIKE '%SEED_HIST_2026%'
  AND ngayBatDau = '2026-01-01';

CREATE TEMPORARY TABLE _mh_rooms AS
SELECT DISTINCT maPhong FROM _mh_contracts;

-- Monthly Jan-Jul readings plus synthetic contract-start readings.
CREATE TEMPORARY TABLE _mh_meters AS
SELECT DISTINCT r.maChiSo, r.maPhong, r.loaiChiSo, r.khoaNghiepVu
FROM phong_tro_copy_ci.ChiSoDien r
JOIN _mh_rooms s ON s.maPhong = r.maPhong
WHERE r.daXoa = 0 AND r.nam = 2026
  AND ((r.loaiChiSo = 'DINH_KY' AND r.thang BETWEEN 1 AND 7
        AND r.khoaNghiepVu = CONCAT('DINH_KY:2026-', LPAD(r.thang, 2, '0')))
       OR (r.loaiChiSo = 'DAU_HOP_DONG' AND EXISTS (
         SELECT 1 FROM phong_tro_copy_ci.HopDong h
         WHERE h.maHopDong = r.khoaNghiepVu AND h.maPhong = r.maPhong
           AND (h.dieuKhoan LIKE '%SEED_HIST_2026%'
                OR h.ngayBatDau IN ('2026-04-01', '2026-07-01')))));

CREATE TEMPORARY TABLE _mh_bills AS
SELECT b.maThanhToan, b.maHopDong, b.nam, b.thang
FROM phong_tro_copy_ci.ThanhToan b
JOIN phong_tro_copy_ci.HopDong h ON h.maHopDong = b.maHopDong
JOIN _mh_rooms s ON s.maPhong = h.maPhong
WHERE b.nam = 2026 AND b.thang BETWEEN 1 AND 8
  AND b.loaiThanhToan = 'DINH_KY';

CREATE TEMPORARY TABLE _mh_lines AS
SELECT l.maChiTiet FROM phong_tro_copy_ci.ChiTietThanhToan l
JOIN _mh_bills b ON b.maThanhToan = l.maThanhToan;

CREATE TEMPORARY TABLE _mh_payments AS
SELECT g.maGiaoDich FROM phong_tro_copy_ci.GiaoDichThanhToan g
JOIN _mh_bills b ON b.maThanhToan = g.maThanhToan;

CREATE TEMPORARY TABLE _mh_receipts AS
SELECT k.maKhoanThu FROM phong_tro_copy_ci.KhoanThu k
JOIN phong_tro_copy_ci.GiaoDichThanhToan g
  ON g.maGiaoDich = k.maGiaoDichThanhToan
JOIN _mh_payments p ON p.maGiaoDich = g.maGiaoDich
WHERE k.ghiChu LIKE '%SEED_HIST_2026%';

CREATE TEMPORARY TABLE _mh_expenses AS
SELECT maKhoanChi FROM phong_tro_copy_ci.KhoanChi
WHERE ghiChu LIKE '%SEED_HIST_2026%'
  AND ngayPhatSinh >= '2026-01-01' AND ngayPhatSinh < '2026-09-01';

-- All guards are evaluated again at apply time. No transfer if any is nonzero.
SET @history_issues := (
  SELECT
    (SELECT ABS(COUNT(*) - 16) FROM _mh_contracts)
    + (SELECT ABS(COUNT(*) - 16) FROM _mh_rooms)
    + (SELECT ABS(COUNT(*) - 128) FROM _mh_bills)
    + (SELECT ABS(COUNT(*) - 128) FROM _mh_payments)
    + (SELECT ABS(COUNT(*) - 128) FROM _mh_receipts)
    + (SELECT COUNT(*) FROM _mh_contracts s
       LEFT JOIN phong_tro.KhachThue t ON t.maKhachThue =
         (SELECT h.maKhachThue FROM phong_tro_copy_ci.HopDong h
          WHERE h.maHopDong = s.maHopDong)
       WHERE t.maKhachThue IS NULL)
    + (SELECT COUNT(*) FROM _mh_contracts s
       LEFT JOIN phong_tro.PhongTro p ON p.maPhong = s.maPhong
       WHERE p.maPhong IS NULL)
    + (SELECT COUNT(*) FROM _mh_contracts s JOIN phong_tro.HopDong d
       ON d.maHopDong = s.maHopDong)
    + (SELECT COUNT(*) FROM _mh_meters s JOIN phong_tro.ChiSoDien d
       ON d.maChiSo = s.maChiSo)
    + (SELECT COUNT(*) FROM _mh_meters s JOIN phong_tro.ChiSoDien d
       ON d.maPhong = s.maPhong AND d.loaiChiSo = s.loaiChiSo
         AND d.khoaNghiepVu = s.khoaNghiepVu AND d.daXoa = 0)
    + (SELECT COUNT(*) FROM _mh_bills s JOIN phong_tro.ThanhToan d
       ON d.maThanhToan = s.maThanhToan)
    + (SELECT COUNT(*) FROM _mh_bills s
       JOIN phong_tro.HopDong h ON h.maHopDong = s.maHopDong
       JOIN phong_tro.ThanhToan d ON d.maHopDong = h.maHopDong
         AND d.nam = s.nam AND d.thang = s.thang
         AND d.loaiThanhToan = 'DINH_KY')
    + (SELECT COUNT(*) FROM _mh_lines s JOIN phong_tro.ChiTietThanhToan d
       ON d.maChiTiet = s.maChiTiet)
    + (SELECT COUNT(*) FROM _mh_payments s JOIN phong_tro.GiaoDichThanhToan d
       ON d.maGiaoDich = s.maGiaoDich)
    + (SELECT COUNT(*) FROM _mh_receipts s JOIN phong_tro.KhoanThu d
       ON d.maKhoanThu = s.maKhoanThu)
    + (SELECT COUNT(*) FROM _mh_expenses s JOIN phong_tro.KhoanChi d
       ON d.maKhoanChi = s.maKhoanChi)
    + (SELECT COUNT(*) FROM _mh_expenses s
       JOIN phong_tro_copy_ci.KhoanChi x ON x.maKhoanChi = s.maKhoanChi
       JOIN phong_tro.KhoanChi d ON d.maCan <=> x.maCan
         AND d.ngayPhatSinh = x.ngayPhatSinh
         AND d.loaiKhoanChi = x.loaiKhoanChi
         AND d.trangThai = 'HIEU_LUC')
    + (SELECT COUNT(*) FROM _mh_expenses s
       JOIN phong_tro_copy_ci.KhoanChi x ON x.maKhoanChi = s.maKhoanChi
       LEFT JOIN phong_tro.CanTro c ON c.maCan = x.maCan
       WHERE x.maCan IS NOT NULL AND c.maCan IS NULL)
    + (SELECT COUNT(*) FROM _mh_meters s
       JOIN phong_tro_copy_ci.ChiSoDien r ON r.maChiSo = s.maChiSo
       LEFT JOIN phong_tro.TaiKhoan a ON a.maTaiKhoan = r.nguoiGhiNhanId
       WHERE r.nguoiGhiNhanId IS NOT NULL AND a.maTaiKhoan IS NULL)
    + (SELECT COUNT(*) FROM _mh_bills s
       JOIN phong_tro_copy_ci.HopDong h ON h.maHopDong = s.maHopDong
       LEFT JOIN phong_tro.HopDong d ON d.maHopDong = h.maHopDong
       WHERE d.maHopDong IS NULL AND NOT EXISTS (
         SELECT 1 FROM _mh_contracts c WHERE c.maHopDong = h.maHopDong))
    + (SELECT COUNT(*) FROM information_schema.COLUMNS src
       WHERE src.TABLE_SCHEMA = 'phong_tro_copy_ci'
         AND src.TABLE_NAME IN ('HopDong', 'ChiSoDien', 'ThanhToan',
           'ChiTietThanhToan', 'GiaoDichThanhToan', 'KhoanThu', 'KhoanChi')
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.COLUMNS dst
           WHERE dst.TABLE_SCHEMA = 'phong_tro'
             AND dst.TABLE_NAME = src.TABLE_NAME
             AND dst.COLUMN_NAME = src.COLUMN_NAME
             AND dst.COLUMN_TYPE = src.COLUMN_TYPE
             AND dst.IS_NULLABLE = src.IS_NULLABLE
             AND dst.ORDINAL_POSITION = src.ORDINAL_POSITION))
    + (SELECT COUNT(*) FROM information_schema.COLUMNS dst
       WHERE dst.TABLE_SCHEMA = 'phong_tro'
         AND dst.TABLE_NAME IN ('HopDong', 'ChiSoDien', 'ThanhToan',
           'ChiTietThanhToan', 'GiaoDichThanhToan', 'KhoanThu', 'KhoanChi')
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.COLUMNS src
           WHERE src.TABLE_SCHEMA = 'phong_tro_copy_ci'
             AND src.TABLE_NAME = dst.TABLE_NAME
             AND src.COLUMN_NAME = dst.COLUMN_NAME
             AND src.COLUMN_TYPE = dst.COLUMN_TYPE
             AND src.IS_NULLABLE = dst.IS_NULLABLE
             AND src.ORDINAL_POSITION = dst.ORDINAL_POSITION))
);

SET @history_ready := (DATABASE() = 'phong_tro'
  AND @history_issues = 0
  AND @history_apply = 1
  AND @history_backup_ack = 'BACKUP_PHONG_TRO_2026_CONFIRMED');

SELECT DATABASE() AS selected_database, @history_apply AS apply_requested,
       @history_issues AS guard_issues, @history_ready AS ready_to_write,
       (SELECT COUNT(*) FROM _mh_contracts) AS contracts,
       (SELECT COUNT(*) FROM _mh_meters) AS meter_rows,
       (SELECT COUNT(*) FROM _mh_bills) AS bills,
       (SELECT COUNT(*) FROM _mh_lines) AS bill_lines,
       (SELECT COUNT(*) FROM _mh_payments) AS payments,
       (SELECT COUNT(*) FROM _mh_receipts) AS receipts,
       (SELECT COUNT(*) FROM _mh_expenses) AS expenses;

START TRANSACTION;

INSERT INTO phong_tro.HopDong
SELECT src.* FROM phong_tro_copy_ci.HopDong src
JOIN _mh_contracts x ON x.maHopDong = src.maHopDong
WHERE @history_ready = 1;

INSERT INTO phong_tro.ChiSoDien
SELECT src.* FROM phong_tro_copy_ci.ChiSoDien src
JOIN _mh_meters x ON x.maChiSo = src.maChiSo
WHERE @history_ready = 1;

INSERT INTO phong_tro.KhoanChi
SELECT src.* FROM phong_tro_copy_ci.KhoanChi src
JOIN _mh_expenses x ON x.maKhoanChi = src.maKhoanChi
WHERE @history_ready = 1;

INSERT INTO phong_tro.ThanhToan
SELECT src.* FROM phong_tro_copy_ci.ThanhToan src
JOIN _mh_bills x ON x.maThanhToan = src.maThanhToan
WHERE @history_ready = 1;

INSERT INTO phong_tro.ChiTietThanhToan
SELECT src.* FROM phong_tro_copy_ci.ChiTietThanhToan src
JOIN _mh_lines x ON x.maChiTiet = src.maChiTiet
WHERE @history_ready = 1;

INSERT INTO phong_tro.GiaoDichThanhToan
SELECT src.* FROM phong_tro_copy_ci.GiaoDichThanhToan src
JOIN _mh_payments x ON x.maGiaoDich = src.maGiaoDich
WHERE @history_ready = 1;

INSERT INTO phong_tro.KhoanThu
SELECT src.* FROM phong_tro_copy_ci.KhoanThu src
JOIN _mh_receipts x ON x.maKhoanThu = src.maKhoanThu
WHERE @history_ready = 1;

SELECT @history_ready AS applied,
       (SELECT COUNT(*) FROM phong_tro.HopDong d JOIN _mh_contracts s
        ON s.maHopDong = d.maHopDong) AS transferred_contracts,
       (SELECT COUNT(*) FROM phong_tro.ChiSoDien d JOIN _mh_meters s
        ON s.maChiSo = d.maChiSo) AS transferred_meter_rows,
       (SELECT COUNT(*) FROM phong_tro.ThanhToan d JOIN _mh_bills s
        ON s.maThanhToan = d.maThanhToan) AS transferred_bills,
       (SELECT COUNT(*) FROM phong_tro.KhoanThu d JOIN _mh_receipts s
        ON s.maKhoanThu = d.maKhoanThu) AS transferred_receipts;

-- Never continue to this COMMIT after an error in any INSERT above.
COMMIT;

DROP TEMPORARY TABLE IF EXISTS _mh_expenses;
DROP TEMPORARY TABLE IF EXISTS _mh_receipts;
DROP TEMPORARY TABLE IF EXISTS _mh_payments;
DROP TEMPORARY TABLE IF EXISTS _mh_lines;
DROP TEMPORARY TABLE IF EXISTS _mh_bills;
DROP TEMPORARY TABLE IF EXISTS _mh_meters;
DROP TEMPORARY TABLE IF EXISTS _mh_rooms;
DROP TEMPORARY TABLE IF EXISTS _mh_contracts;
