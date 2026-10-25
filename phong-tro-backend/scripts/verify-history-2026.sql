-- Read-only verification for the synthetic Jan-Oct 2026 history.
-- Run the whole file once in phpMyAdmin after selecting phong_tro_copy_ci.
-- No temporary tables, transaction, INSERT, UPDATE, DELETE or DDL.

SELECT DATABASE() AS selected_database;

-- Result 1: monthly coverage and raw totals. These are database totals,
-- not a replacement for the cashflow API's business calculation.
WITH RECURSIVE months AS (
  SELECT 1 AS thang
  UNION ALL SELECT thang + 1 FROM months WHERE thang < 10
)
SELECT m.thang,
       COALESCE(b.so_phieu, 0) AS so_phieu_dinh_ky,
       COALESCE(b.phai_thu, 0) AS tong_phai_thu,
       COALESCE(b.da_thanh_toan, 0) AS tong_da_thanh_toan,
       COALESCE(b.con_no, 0) AS tong_con_no,
       COALESCE(r.so_phong_co_chi_so, 0) AS so_phong_co_chi_so_dien,
       COALESCE(t.so_khoan_thu, 0) AS so_khoan_thu,
       COALESCE(t.thuc_nhan, 0) AS khoan_thu_hieu_luc,
       COALESCE(c.so_khoan_chi, 0) AS so_khoan_chi,
       COALESCE(c.chi_phi, 0) AS khoan_chi_hieu_luc
FROM months m
LEFT JOIN (
  SELECT thang, COUNT(*) AS so_phieu,
         SUM(tongPhaiTra) AS phai_thu,
         SUM(tongDaThanhToan) AS da_thanh_toan,
         SUM(soTienConNo) AS con_no
  FROM ThanhToan
  WHERE nam = 2026 AND thang BETWEEN 1 AND 10
    AND loaiThanhToan = 'DINH_KY'
  GROUP BY thang
) b ON b.thang = m.thang
LEFT JOIN (
  SELECT thang, COUNT(DISTINCT maPhong) AS so_phong_co_chi_so
  FROM ChiSoDien
  WHERE nam = 2026 AND thang BETWEEN 1 AND 10
    AND loaiChiSo = 'DINH_KY' AND trangThaiXacNhan = 'DA_XAC_NHAN'
    AND daXoa = 0
  GROUP BY thang
) r ON r.thang = m.thang
LEFT JOIN (
  SELECT MONTH(ngayGhiNhan) AS thang,
         COUNT(*) AS so_khoan_thu, SUM(soTien) AS thuc_nhan
  FROM KhoanThu
  WHERE ngayGhiNhan >= '2026-01-01' AND ngayGhiNhan < '2026-11-01'
    AND trangThaiGhiNhan = 'HIEU_LUC'
  GROUP BY MONTH(ngayGhiNhan)
) t ON t.thang = m.thang
LEFT JOIN (
  SELECT MONTH(ngayPhatSinh) AS thang,
         COUNT(*) AS so_khoan_chi, SUM(soTien) AS chi_phi
  FROM KhoanChi
  WHERE ngayPhatSinh >= '2026-01-01' AND ngayPhatSinh < '2026-11-01'
    AND trangThai = 'HIEU_LUC'
  GROUP BY MONTH(ngayPhatSinh)
) c ON c.thang = m.thang
ORDER BY m.thang;

-- Result 2: seed coverage. For a complete 16-room Jan-Oct fixture,
-- missing_readings and missing_bills should both be 0.
WITH RECURSIVE months AS (
  SELECT 1 AS thang
  UNION ALL SELECT thang + 1 FROM months WHERE thang < 10
),
seed_rooms AS (
  SELECT DISTINCT maPhong
  FROM HopDong
  WHERE dieuKhoan LIKE '%SEED_HIST_2026%'
)
SELECT (SELECT COUNT(*) FROM HopDong
        WHERE dieuKhoan LIKE '%SEED_HIST_2026%') AS hop_dong_lich_su,
       (SELECT COUNT(*) FROM seed_rooms) AS so_phong_duoc_bo_sung,
       (SELECT COUNT(*) FROM KhoanThu
        WHERE ghiChu LIKE '%SEED_HIST_2026%') AS khoan_thu_duoc_bo_sung,
       (SELECT COUNT(*) FROM KhoanChi
        WHERE ghiChu LIKE '%SEED_HIST_2026%') AS khoan_chi_duoc_bo_sung,
       (SELECT COUNT(*) FROM seed_rooms s CROSS JOIN months m
        WHERE NOT EXISTS (
          SELECT 1 FROM ChiSoDien r
          WHERE r.maPhong = s.maPhong AND r.nam = 2026 AND r.thang = m.thang
            AND r.loaiChiSo = 'DINH_KY'
            AND r.trangThaiXacNhan = 'DA_XAC_NHAN' AND r.daXoa = 0
        )) AS missing_readings,
       (SELECT COUNT(*) FROM seed_rooms s CROSS JOIN months m
        WHERE NOT EXISTS (
          SELECT 1 FROM ThanhToan b JOIN HopDong h ON h.maHopDong = b.maHopDong
          WHERE h.maPhong = s.maPhong AND b.nam = 2026 AND b.thang = m.thang
            AND b.loaiThanhToan = 'DINH_KY'
        )) AS missing_bills;

-- Result 3: financial consistency for Jan-Aug bills in seeded rooms.
-- All three mismatch counts should be 0. Sep-Oct legacy data is excluded.
WITH seed_rooms AS (
  SELECT DISTINCT maPhong FROM HopDong
  WHERE dieuKhoan LIKE '%SEED_HIST_2026%'
),
seed_bills AS (
  SELECT b.maThanhToan, b.tongPhaiTra, b.tongDaThanhToan
  FROM ThanhToan b
  JOIN HopDong h ON h.maHopDong = b.maHopDong
  JOIN seed_rooms s ON s.maPhong = h.maPhong
  WHERE b.nam = 2026 AND b.thang BETWEEN 1 AND 8
    AND b.loaiThanhToan = 'DINH_KY'
),
bill_line_totals AS (
  SELECT maThanhToan, SUM(soTien) AS total_lines
  FROM ChiTietThanhToan GROUP BY maThanhToan
),
confirmed_payment_totals AS (
  SELECT maThanhToan, SUM(soTien) AS total_confirmed
  FROM GiaoDichThanhToan
  WHERE trangThaiXacNhan = 'DA_XAC_NHAN'
  GROUP BY maThanhToan
)
SELECT (SELECT COUNT(*) FROM seed_bills) AS so_phieu_thang_1_8,
       (SELECT COUNT(*) FROM seed_bills b LEFT JOIN bill_line_totals l
        ON l.maThanhToan = b.maThanhToan
        WHERE ABS(b.tongPhaiTra - COALESCE(l.total_lines, 0)) > 0.01)
         AS bill_line_mismatch,
       (SELECT COUNT(*) FROM seed_bills b LEFT JOIN confirmed_payment_totals p
        ON p.maThanhToan = b.maThanhToan
        WHERE ABS(b.tongDaThanhToan - COALESCE(p.total_confirmed, 0)) > 0.01)
         AS payment_mismatch,
       (SELECT COUNT(*) FROM GiaoDichThanhToan g
        JOIN seed_bills b ON b.maThanhToan = g.maThanhToan
        WHERE g.trangThaiXacNhan = 'DA_XAC_NHAN'
          AND NOT EXISTS (
            SELECT 1 FROM KhoanThu k
            WHERE k.maGiaoDichThanhToan = g.maGiaoDich
              AND k.trangThaiGhiNhan = 'HIEU_LUC'
              AND ABS(k.soTien - g.soTien) <= 0.01
          )) AS receipt_mismatch;
