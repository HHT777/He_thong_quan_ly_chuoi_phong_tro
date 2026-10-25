-- ONE-PASS, READ-ONLY premerge audit for the 2026 synthetic history.
-- The USER runs this in phpMyAdmin. It reads phong_tro_copy_ci and phong_tro.
-- It does not modify either database. Do not use this as an import script.
-- The transfer covers Jan-Jul meter readings and Jan-Aug bills only.
-- Later readings may await confirmation; ended contracts need no October bill.

WITH RECURSIVE audit_months AS (
  SELECT 1 AS month_no
  UNION ALL SELECT month_no + 1 FROM audit_months WHERE month_no < 8
),
audit_seed_rooms AS (
  SELECT DISTINCT maPhong
  FROM phong_tro_copy_ci.HopDong
  WHERE dieuKhoan LIKE '%SEED_HIST_2026%'
),
audit_seed_bills AS (
  SELECT b.maThanhToan, b.tongPhaiTra, b.tongDaThanhToan
  FROM phong_tro_copy_ci.ThanhToan b
  JOIN phong_tro_copy_ci.HopDong h ON h.maHopDong = b.maHopDong
  JOIN audit_seed_rooms s ON s.maPhong = h.maPhong
  WHERE b.nam = 2026 AND b.thang BETWEEN 1 AND 8
    AND b.loaiThanhToan = 'DINH_KY'
),
audit_bill_line_totals AS (
  SELECT maThanhToan, SUM(soTien) AS total_lines
  FROM phong_tro_copy_ci.ChiTietThanhToan
  GROUP BY maThanhToan
),
audit_confirmed_payment_totals AS (
  SELECT maThanhToan, SUM(soTien) AS total_confirmed
  FROM phong_tro_copy_ci.GiaoDichThanhToan
  WHERE trangThaiXacNhan = 'DA_XAC_NHAN'
  GROUP BY maThanhToan
),
audit_metrics AS (
  SELECT '01_source_seed_rooms' AS metric,
         (SELECT COUNT(*) FROM audit_seed_rooms) AS observed, 16 AS expected
  UNION ALL
  SELECT '02_source_seed_bills_jan_aug',
         (SELECT COUNT(*) FROM audit_seed_bills),
         (SELECT COUNT(*) * 8 FROM audit_seed_rooms)
  UNION ALL
  SELECT '03_source_missing_jan_jul_readings',
         (SELECT COUNT(*) FROM audit_seed_rooms s CROSS JOIN audit_months m
          WHERE m.month_no <= 7 AND NOT EXISTS (
            SELECT 1 FROM phong_tro_copy_ci.ChiSoDien r
            WHERE r.maPhong = s.maPhong AND r.nam = 2026 AND r.thang = m.month_no
              AND r.loaiChiSo = 'DINH_KY'
              AND r.trangThaiXacNhan = 'DA_XAC_NHAN' AND r.daXoa = 0
          )), 0
  UNION ALL
  SELECT '04_source_missing_jan_aug_bills',
         (SELECT COUNT(*) FROM audit_seed_rooms s CROSS JOIN audit_months m
          WHERE NOT EXISTS (
            SELECT 1 FROM phong_tro_copy_ci.ThanhToan b
            JOIN phong_tro_copy_ci.HopDong h ON h.maHopDong = b.maHopDong
            WHERE h.maPhong = s.maPhong AND b.nam = 2026
              AND b.thang = m.month_no AND b.loaiThanhToan = 'DINH_KY'
          )), 0
  UNION ALL
  SELECT '05_source_bill_line_mismatch',
         (SELECT COUNT(*) FROM audit_seed_bills b
          LEFT JOIN audit_bill_line_totals l ON l.maThanhToan = b.maThanhToan
          WHERE ABS(b.tongPhaiTra - COALESCE(l.total_lines, 0)) > 0.01), 0
  UNION ALL
  SELECT '06_source_confirmed_payment_mismatch',
         (SELECT COUNT(*) FROM audit_seed_bills b
          LEFT JOIN audit_confirmed_payment_totals p
            ON p.maThanhToan = b.maThanhToan
          WHERE ABS(b.tongDaThanhToan - COALESCE(p.total_confirmed, 0)) > 0.01), 0
  UNION ALL
  SELECT '07_source_missing_payment_receipts',
         (SELECT COUNT(*) FROM phong_tro_copy_ci.GiaoDichThanhToan g
          JOIN audit_seed_bills b ON b.maThanhToan = g.maThanhToan
          WHERE g.trangThaiXacNhan = 'DA_XAC_NHAN'
            AND NOT EXISTS (
              SELECT 1 FROM phong_tro_copy_ci.KhoanThu k
              WHERE k.maGiaoDichThanhToan = g.maGiaoDich
                AND k.trangThaiGhiNhan = 'HIEU_LUC'
                AND ABS(k.soTien - g.soTien) <= 0.01
            )), 0
  UNION ALL
  SELECT '08_source_seed_receipts',
         (SELECT COUNT(*) FROM phong_tro_copy_ci.KhoanThu
          WHERE ghiChu LIKE '%SEED_HIST_2026%'),
         (SELECT COUNT(*) FROM audit_seed_bills)
  UNION ALL
  SELECT '09_source_seed_expense_months',
         (SELECT COUNT(DISTINCT MONTH(ngayPhatSinh))
          FROM phong_tro_copy_ci.KhoanChi
          WHERE ghiChu LIKE '%SEED_HIST_2026%'
            AND ngayPhatSinh >= '2026-01-01'
            AND ngayPhatSinh < '2026-09-01'), 8
  UNION ALL
  SELECT '10_target_existing_seed_contracts',
         (SELECT COUNT(*) FROM phong_tro.HopDong
          WHERE dieuKhoan LIKE '%SEED_HIST_2026%'), 0
  UNION ALL
  SELECT '11_target_existing_jan_aug_bills',
         (SELECT COUNT(*) FROM phong_tro.ThanhToan b
          JOIN phong_tro.HopDong h ON h.maHopDong = b.maHopDong
          JOIN audit_seed_rooms s ON s.maPhong = h.maPhong
          WHERE b.nam = 2026 AND b.thang BETWEEN 1 AND 8
            AND b.loaiThanhToan = 'DINH_KY'), 0
  UNION ALL
  SELECT '12_target_existing_jan_jul_readings',
         (SELECT COUNT(*) FROM phong_tro.ChiSoDien r
          JOIN audit_seed_rooms s ON s.maPhong = r.maPhong
          WHERE r.nam = 2026 AND r.thang BETWEEN 1 AND 7
            AND r.loaiChiSo = 'DINH_KY' AND r.daXoa = 0), 0
  UNION ALL
  SELECT '13_target_existing_seed_receipts',
         (SELECT COUNT(*) FROM phong_tro.KhoanThu
          WHERE ghiChu LIKE '%SEED_HIST_2026%'), 0
  UNION ALL
  SELECT '14_target_existing_seed_expenses',
         (SELECT COUNT(*) FROM phong_tro.KhoanChi
          WHERE ghiChu LIKE '%SEED_HIST_2026%'), 0
  UNION ALL
  SELECT '15_target_room_missing_or_changed',
         (SELECT COUNT(*) FROM audit_seed_rooms s
          JOIN phong_tro_copy_ci.PhongTro src ON src.maPhong = s.maPhong
          WHERE NOT EXISTS (
            SELECT 1 FROM phong_tro.PhongTro dst
            WHERE dst.maPhong = src.maPhong AND dst.maCan = src.maCan
              AND dst.soPhong = src.soPhong
          )), 0
  UNION ALL
  SELECT '16_target_tenant_missing',
         (SELECT COUNT(*) FROM phong_tro_copy_ci.HopDong h
          WHERE h.dieuKhoan LIKE '%SEED_HIST_2026%'
            AND NOT EXISTS (
              SELECT 1 FROM phong_tro.KhachThue t
              WHERE t.maKhachThue = h.maKhachThue
            )), 0
  UNION ALL
  SELECT '17_target_meter_actor_missing',
         (SELECT COUNT(*) FROM phong_tro_copy_ci.ChiSoDien r
          JOIN audit_seed_rooms s ON s.maPhong = r.maPhong
          WHERE r.nam = 2026 AND r.thang BETWEEN 1 AND 7
            AND r.loaiChiSo = 'DINH_KY' AND r.daXoa = 0
            AND NOT EXISTS (
              SELECT 1 FROM phong_tro.TaiKhoan a
              WHERE a.maTaiKhoan = r.nguoiGhiNhanId
            )), 0
  UNION ALL
  SELECT '18_target_expense_building_missing',
         (SELECT COUNT(*) FROM phong_tro_copy_ci.KhoanChi x
          WHERE x.ghiChu LIKE '%SEED_HIST_2026%' AND x.maCan IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM phong_tro.CanTro c WHERE c.maCan = x.maCan
            )), 0
  UNION ALL
  SELECT '19_target_original_contract_missing_or_changed',
         (SELECT COUNT(*) FROM phong_tro_copy_ci.HopDong src
          JOIN audit_seed_rooms s ON s.maPhong = src.maPhong
          WHERE src.ngayBatDau IN ('2026-04-01', '2026-07-01')
            AND COALESCE(src.dieuKhoan, '') NOT LIKE '%SEED_HIST_2026%'
            AND NOT EXISTS (
              SELECT 1 FROM phong_tro.HopDong dst
              WHERE dst.maHopDong = src.maHopDong
                AND dst.maPhong = src.maPhong
                AND dst.maKhachThue = src.maKhachThue
                AND dst.ngayBatDau = src.ngayBatDau
                AND dst.giaThue = src.giaThue
                AND dst.donGiaDien = src.donGiaDien
                AND dst.donGiaNuoc = src.donGiaNuoc
            )), 0
  UNION ALL
  SELECT '20_target_column_shape_mismatch',
         (SELECT COUNT(*) FROM information_schema.COLUMNS src
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
                AND dst.ORDINAL_POSITION = src.ORDINAL_POSITION
            ))
         +
         (SELECT COUNT(*) FROM information_schema.COLUMNS dst
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
                AND src.ORDINAL_POSITION = dst.ORDINAL_POSITION
            )), 0
)
SELECT metric, observed, expected,
       CASE WHEN observed = expected THEN 'PASS' ELSE 'REVIEW' END AS status
FROM audit_metrics
ORDER BY metric;
