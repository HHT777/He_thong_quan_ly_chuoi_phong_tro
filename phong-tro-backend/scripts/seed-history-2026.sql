-- HISTORY SEED 2026 (synthetic) â€” MySQL 8.0
-- User-run only. This script writes to the exact database phong_tro_copy_ci.
-- It backfills Jan-Jul readings and Jan-Aug bills/receipts/sample expenses using
-- current contracts beginning 2026-04-01 or 2026-07-01 as templates.
-- Existing Aug-Oct rows are not updated or deleted.
-- Jan-Jul usage is synthetic at 30 kWh/month; Aug usage follows the Sep bill.
-- Set commit_enabled=0 for a persistent-data preview; use 1 to insert.

SET @seed_history_enabled := (DATABASE() = 'phong_tro_copy_ci');
SET @seed_history_commit := 1; -- User-selected insert mode; change to 0 to preview.
SELECT DATABASE() AS selected_database, @seed_history_enabled AS target_ok,
       @seed_history_commit AS commit_enabled;

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS _seed_src;
DROP TEMPORARY TABLE IF EXISTS _seed_contracts;
DROP TEMPORARY TABLE IF EXISTS _seed_periods;
DROP TEMPORARY TABLE IF EXISTS _seed_bill_components;
DROP TEMPORARY TABLE IF EXISTS _seed_bills;
DROP TEMPORARY TABLE IF EXISTS _seed_costs;

-- Eligible source contracts plus their August meter anchor and landlord account.
CREATE TEMPORARY TABLE _seed_src AS
SELECT h.maHopDong AS source_contract_id, h.maKhachThue AS tenant_id,
       h.maPhong AS room_id, h.ngayBatDau AS source_start,
       h.giaThue AS rent, h.donGiaDien AS electricity_rate,
       h.donGiaNuoc AS water_rate, h.phiDichVu AS service_fee,
       h.dieuKhoan AS terms, h.goiGiaHanChoPhep AS renewal_package,
       p.maCan AS building_id, ct.maTaiKhoan AS actor_id,
       a.chiSoMoi AS aug_anchor,
       COALESCE((
         SELECT ROUND(electric_line.soTien / NULLIF(a.donGiaApDung, 0), 0)
         FROM ThanhToan sep_bill
         JOIN ChiTietThanhToan electric_line
           ON electric_line.maThanhToan = sep_bill.maThanhToan
          AND electric_line.loaiKhoan = 'TIEN_DIEN'
         WHERE sep_bill.maHopDong = h.maHopDong
           AND sep_bill.nam = 2026 AND sep_bill.thang = 9
           AND sep_bill.loaiThanhToan = 'DINH_KY'
         LIMIT 1
       ), 30) AS aug_usage
FROM HopDong h
JOIN PhongTro p ON p.maPhong = h.maPhong
JOIN CanTro c ON c.maCan = p.maCan
JOIN ChuTro ct ON ct.maChuTro = c.maChuTro
JOIN ChiSoDien a ON a.maPhong = h.maPhong AND a.nam = 2026 AND a.thang = 8
  AND a.loaiChiSo = 'DINH_KY' AND a.trangThaiXacNhan = 'DA_XAC_NHAN' AND a.daXoa = 0
WHERE @seed_history_enabled = 1
  AND h.ngayBatDau IN ('2026-04-01', '2026-07-01')
  AND h.trangThai IN ('DANG_HIEU_LUC', 'SAP_HET_HAN', 'DA_THANH_LY')
  AND a.chiSoMoi >= 240
  AND (
    NOT EXISTS (SELECT 1 FROM ChiSoDien old_r
      WHERE old_r.maPhong = h.maPhong AND old_r.nam = 2026
        AND old_r.thang BETWEEN 1 AND 7 AND old_r.loaiChiSo = 'DINH_KY'
        AND old_r.daXoa = 0)
    OR EXISTS (SELECT 1 FROM HopDong seeded_h
      WHERE seeded_h.maPhong = h.maPhong
        AND seeded_h.ngayBatDau = '2026-01-01'
        AND seeded_h.ngayKetThuc = DATE_SUB(h.ngayBatDau, INTERVAL 1 DAY)
        AND seeded_h.dieuKhoan LIKE '%SEED_HIST_2026%')
  );

-- One synthetic predecessor contract per source contract (Jan 1 through the
-- day before the source contract starts). Existing matching predecessor rows
-- are reused, making reruns safe.
CREATE TEMPORARY TABLE _seed_contracts AS
SELECT s.*,
       COALESCE(existing.maHopDong, UUID()) AS history_contract_id,
       DATE_SUB(s.source_start, INTERVAL 1 DAY) AS history_end,
       CASE WHEN MONTH(s.source_start) = 4 THEN 3 ELSE 6 END AS history_months
FROM _seed_src s
LEFT JOIN HopDong existing ON existing.maPhong = s.room_id
  AND existing.ngayBatDau = '2026-01-01'
  AND existing.ngayKetThuc = DATE_SUB(s.source_start, INTERVAL 1 DAY)
  AND existing.dieuKhoan LIKE '%SEED_HIST_2026%'
WHERE s.aug_anchor >= s.aug_usage + 210;

SELECT room_id, source_contract_id, source_start, history_end,
       aug_anchor, aug_usage, history_contract_id
FROM _seed_contracts ORDER BY room_id;

-- Insert predecessor contracts only when absent.
INSERT INTO HopDong (
  maHopDong, ngayBatDau, ngayKetThuc, giaThue, donGiaDien, donGiaNuoc,
  dieuKhoan, trangThai, ngayThanhLy, daCoBanGiayKy, phiDichVu,
  goiGiaHanChoPhep, maKhachThue, maPhong
)
SELECT c.history_contract_id, '2026-01-01', c.history_end,
       c.rent, c.electricity_rate, c.water_rate,
       CONCAT(LEFT(COALESCE(c.terms, ''), 210), ' | SEED_HIST_2026'),
       'DA_THANH_LY', c.history_end, 0, c.service_fee,
       c.renewal_package, c.tenant_id, c.room_id
FROM _seed_contracts c
WHERE NOT EXISTS (
  SELECT 1 FROM HopDong h WHERE h.maHopDong = c.history_contract_id
) AND @seed_history_commit = 1;

-- Initial meter value for each generated Jan 1 predecessor contract.
INSERT INTO ChiSoDien (
  maChiSo, thang, nam, chiSoMoi, loaiChiSo, khoaNghiepVu, donGiaApDung,
  trangThaiXacNhan, ngayGhiNhan, nguoiGhiNhanId, nguoiXacNhanId,
  ngayXacNhan, maPhong, daXoa
)
SELECT UUID(), 1, 2026,
       GREATEST(0, c.aug_anchor - c.aug_usage - 7 * 30),
       'DAU_HOP_DONG', c.history_contract_id, c.electricity_rate,
       'DA_XAC_NHAN', '2026-01-01 00:00:00', c.actor_id, c.actor_id,
       '2026-01-01 00:00:00', c.room_id, 0
FROM _seed_contracts c
WHERE @seed_history_enabled = 1
  AND @seed_history_commit = 1
  AND NOT EXISTS (SELECT 1 FROM ChiSoDien r WHERE r.maPhong = c.room_id
    AND r.loaiChiSo = 'DAU_HOP_DONG' AND r.khoaNghiepVu = c.history_contract_id);

-- Synthetic initial and monthly meter readings Jan-Jul. The August confirmed
-- reading is the anchor; the generated usage is 30 kWh per month. No Aug-Oct
-- meter row is modified. Contract start readings and monthly readings have
-- distinct business keys, as required by the schema.
INSERT INTO ChiSoDien (
  maChiSo, thang, nam, chiSoMoi, loaiChiSo, khoaNghiepVu, donGiaApDung,
  trangThaiXacNhan, ngayGhiNhan, nguoiGhiNhanId, nguoiXacNhanId,
  ngayXacNhan, maPhong, daXoa
)
SELECT UUID(), MONTH(c.source_start), 2026,
       GREATEST(0, c.aug_anchor - c.aug_usage - (8 - MONTH(c.source_start)) * 30),
       'DAU_HOP_DONG', c.source_contract_id, c.electricity_rate,
       'DA_XAC_NHAN', c.source_start, c.actor_id, c.actor_id,
       c.source_start, c.room_id, 0
FROM _seed_contracts c
WHERE @seed_history_enabled = 1
  AND @seed_history_commit = 1
  AND NOT EXISTS (SELECT 1 FROM ChiSoDien r WHERE r.maPhong = c.room_id
    AND r.loaiChiSo = 'DAU_HOP_DONG' AND r.khoaNghiepVu = c.source_contract_id);

INSERT INTO ChiSoDien (
  maChiSo, thang, nam, chiSoMoi, loaiChiSo, khoaNghiepVu, donGiaApDung,
  trangThaiXacNhan, ngayGhiNhan, nguoiGhiNhanId, nguoiXacNhanId,
  ngayXacNhan, maPhong, daXoa
)
SELECT UUID(), m.month_no, 2026,
       GREATEST(0, c.aug_anchor - c.aug_usage - (7 - m.month_no) * 30),
       'DINH_KY', CONCAT('DINH_KY:2026-', LPAD(m.month_no, 2, '0')),
       c.electricity_rate, 'DA_XAC_NHAN',
       LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(m.month_no, 2, '0'), '-01'), '%Y-%m-%d')),
       c.actor_id, c.actor_id,
       LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(m.month_no, 2, '0'), '-01'), '%Y-%m-%d')),
       c.room_id, 0
FROM _seed_contracts c
CROSS JOIN (SELECT 1 month_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
            SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) m
WHERE @seed_history_enabled = 1
  AND @seed_history_commit = 1
  AND m.month_no <= MONTH(c.source_start)
  AND NOT EXISTS (SELECT 1 FROM ChiSoDien r WHERE r.maPhong = c.room_id
    AND r.nam = 2026 AND r.thang = m.month_no AND r.loaiChiSo = 'DINH_KY'
    AND r.daXoa = 0);

-- Billing period T charges rent/water/service for T and electricity from T-1.
-- There is no Dec-2025 consumption assigned to the new Jan contract, so the
-- January bill has zero electricity. Jan-Jul meter history funds Feb-Aug bills.
CREATE TEMPORARY TABLE _seed_periods AS
SELECT c.*, m.month_no,
       CASE WHEN m.month_no < MONTH(c.source_start)
            THEN c.history_contract_id ELSE c.source_contract_id END AS contract_id
FROM _seed_contracts c
CROSS JOIN (SELECT 1 month_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
            SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
            UNION ALL SELECT 8) m
WHERE @seed_history_enabled = 1
  AND EXISTS (SELECT 1 FROM _seed_contracts);

CREATE TEMPORARY TABLE _seed_bill_components AS
SELECT p.contract_id,
       p.room_id, p.building_id, p.rent, p.service_fee,
       p.month_no AS bill_month,
       CASE WHEN p.month_no = 1 THEN 0 ELSE 30 * p.electricity_rate END AS electricity_amount,
       p.water_rate * (1 + (
         SELECT COUNT(*) FROM ThanhVienPhong member
         WHERE member.maHopDong = p.contract_id
           AND member.trangThaiCuTru = 'DANG_O'
           AND member.ngayVao <= LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(p.month_no, 2, '0'), '-01'), '%Y-%m-%d'))
           AND (member.ngayRoi IS NULL OR member.ngayRoi > LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(p.month_no, 2, '0'), '-01'), '%Y-%m-%d')))
       )) AS water_amount
FROM _seed_periods p
WHERE NOT EXISTS (
  SELECT 1 FROM ThanhToan b
  WHERE b.maHopDong = p.contract_id AND b.nam = 2026
    AND b.thang = p.month_no AND b.loaiThanhToan = 'DINH_KY'
);

CREATE TEMPORARY TABLE _seed_bills AS
SELECT UUID() AS bill_id, UUID() AS payment_id, c.*,
       ROUND(c.rent + c.electricity_amount + c.water_amount + c.service_fee, 2) AS total_due
FROM _seed_bill_components c;

-- Synthetic building expenses, using a scope value already present for that
-- building. Two recurring categories are used only if present in the DB.
CREATE TEMPORARY TABLE _seed_costs AS
SELECT UUID() AS expense_id, c.maCan AS building_id, m.month_no,
       COALESCE(scopes.phamVi, defaults.default_scope) AS scope_value,
       cats.category_code,
       CASE cats.category_code WHEN 'VE_SINH' THEN 300000 ELSE 500000 END AS amount
FROM CanTro c
LEFT JOIN (
  SELECT maCan, MIN(phamVi) AS phamVi
  FROM KhoanChi WHERE maCan IS NOT NULL
  GROUP BY maCan
) scopes ON scopes.maCan = c.maCan
CROSS JOIN (
  SELECT MIN(phamVi) AS default_scope FROM KhoanChi WHERE maCan IS NOT NULL
) defaults
CROSS JOIN (SELECT 1 month_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
            SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
            UNION ALL SELECT 8) m
JOIN (SELECT DISTINCT loaiKhoanChi AS category_code FROM KhoanChi
      WHERE loaiKhoanChi IN ('VE_SINH', 'BAO_TRI')) cats
WHERE @seed_history_enabled = 1
  AND defaults.default_scope IS NOT NULL
  AND EXISTS (SELECT 1 FROM _seed_contracts);

SELECT building_id, month_no, category_code, amount, scope_value
FROM _seed_costs ORDER BY building_id, month_no, category_code;

INSERT INTO KhoanChi (
  maKhoanChi, loaiKhoanChi, soTien, ngayPhatSinh, phamVi,
  ghiChu, maCan, maSuCo, trangThai
)
SELECT x.expense_id, x.category_code, x.amount,
       LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(x.month_no, 2, '0'), '-01'), '%Y-%m-%d')),
       x.scope_value, CONCAT('SEED_HIST_2026 - chi phí mô phỏng ', x.category_code),
       x.building_id, NULL, 'HIEU_LUC'
FROM _seed_costs x
WHERE @seed_history_commit = 1
  AND NOT EXISTS (
    SELECT 1 FROM KhoanChi old_x
    WHERE old_x.maCan = x.building_id
      AND old_x.ngayPhatSinh = LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(x.month_no, 2, '0'), '-01'), '%Y-%m-%d'))
      AND old_x.ghiChu LIKE '%SEED_HIST_2026%'
      AND old_x.loaiKhoanChi = x.category_code
  );

SELECT room_id, contract_id, bill_month, rent, electricity_amount,
       water_amount, service_fee, total_due
FROM _seed_bills ORDER BY room_id, bill_month;

INSERT INTO ThanhToan (
  maThanhToan, thang, nam, tongPhaiTra, tongDaThanhToan, soTienConNo,
  trangThai, maHopDong, loaiThanhToan, ngayLap, daGui, ngayGui
)
SELECT bill_id, bill_month, 2026, total_due, total_due, 0,
       'DA_THANH_TOAN', contract_id, 'DINH_KY',
       DATE_ADD(STR_TO_DATE(CONCAT('2026-', LPAD(bill_month, 2, '0'), '-01'), '%Y-%m-%d'), INTERVAL 9 HOUR),
       1,
       DATE_ADD(STR_TO_DATE(CONCAT('2026-', LPAD(bill_month, 2, '0'), '-01'), '%Y-%m-%d'), INTERVAL 9 HOUR)
FROM _seed_bills WHERE @seed_history_commit = 1;

INSERT INTO ChiTietThanhToan (
  maChiTiet, loaiKhoan, soTien, dienGiai, maThanhToan,
  maSuCo, maKhoanDieuChinh, nguoiThucHienId
)
SELECT UUID(), 'TIEN_PHONG', rent, 'Tien phong', bill_id, NULL, NULL, NULL
FROM _seed_bills WHERE rent > 0 AND @seed_history_commit = 1
UNION ALL
SELECT UUID(), 'TIEN_DIEN', electricity_amount,
       'Tien dien ky truoc; mo phong 30 kWh', bill_id, NULL, NULL, NULL
FROM _seed_bills WHERE electricity_amount > 0 AND @seed_history_commit = 1
UNION ALL
SELECT UUID(), 'TIEN_NUOC', water_amount,
       'Tien nuoc theo so nguoi o', bill_id, NULL, NULL, NULL
FROM _seed_bills WHERE water_amount > 0 AND @seed_history_commit = 1
UNION ALL
SELECT UUID(), 'PHI_DICH_VU', service_fee,
       'Phi dich vu', bill_id, NULL, NULL, NULL
FROM _seed_bills WHERE service_fee > 0 AND @seed_history_commit = 1;

INSERT INTO GiaoDichThanhToan (
  maGiaoDich, soTien, thoiDiemGhiNhan, trangThaiXacNhan,
  thoiDiemXacNhan, maThanhToan, nguonThanhToan
)
SELECT payment_id, total_due,
       DATE_ADD(STR_TO_DATE(CONCAT('2026-', LPAD(bill_month, 2, '0'), '-01'), '%Y-%m-%d'), INTERVAL 60 HOUR),
       'DA_XAC_NHAN',
       DATE_ADD(STR_TO_DATE(CONCAT('2026-', LPAD(bill_month, 2, '0'), '-01'), '%Y-%m-%d'), INTERVAL 60 HOUR),
       bill_id, 'THU_TIEN'
FROM _seed_bills WHERE @seed_history_commit = 1;

INSERT INTO KhoanThu (
  maKhoanThu, loaiKhoanThu, soTien, ngayGhiNhan, ghiChu,
  trangThaiGhiNhan, maGiaoDichThanhToan, maCan,
  doanhThuGop, giamTruPhanBo, nguonSnapshot
)
SELECT UUID(), 'THANH_TOAN', total_due,
       DATE_ADD(STR_TO_DATE(CONCAT('2026-', LPAD(bill_month, 2, '0'), '-01'), '%Y-%m-%d'), INTERVAL 2 DAY),
       'SEED_HIST_2026 - simulated payment',
       'HIEU_LUC', payment_id, building_id,
       total_due, 0, 'GHI_NHAN'
FROM _seed_bills WHERE @seed_history_commit = 1;

-- Add any missing monthly meter rows between the source contract start and
-- July, using the same anchor and never touching existing periods.
INSERT INTO ChiSoDien (
  maChiSo, thang, nam, chiSoMoi, loaiChiSo, khoaNghiepVu, donGiaApDung,
  trangThaiXacNhan, ngayGhiNhan, nguoiGhiNhanId, nguoiXacNhanId,
  ngayXacNhan, maPhong, daXoa
)
SELECT UUID(), m.month_no, 2026,
       GREATEST(0, c.aug_anchor - c.aug_usage - (7 - m.month_no) * 30),
       'DINH_KY', CONCAT('DINH_KY:2026-', LPAD(m.month_no, 2, '0')),
       c.electricity_rate, 'DA_XAC_NHAN',
       LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(m.month_no, 2, '0'), '-01'), '%Y-%m-%d')),
       c.actor_id, c.actor_id,
       LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(m.month_no, 2, '0'), '-01'), '%Y-%m-%d')),
       c.room_id, 0
FROM _seed_contracts c
CROSS JOIN (SELECT 1 month_no UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
            SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) m
WHERE @seed_history_enabled = 1
  AND @seed_history_commit = 1
  AND m.month_no > MONTH(c.source_start) AND m.month_no <= 7
  AND NOT EXISTS (SELECT 1 FROM ChiSoDien r WHERE r.maPhong = c.room_id
    AND r.nam = 2026 AND r.thang = m.month_no AND r.loaiChiSo = 'DINH_KY'
    AND r.daXoa = 0);

-- Inspect results. With commit_enabled=0, all persistent INSERTs above wrote 0 rows.
SELECT p.soPhong, r.nam, r.thang, r.loaiChiSo, r.chiSoMoi, r.donGiaApDung
FROM ChiSoDien r JOIN PhongTro p ON p.maPhong = r.maPhong
WHERE r.nam = 2026 AND r.thang BETWEEN 1 AND 7
  AND r.khoaNghiepVu LIKE 'DINH_KY:2026-%'
ORDER BY p.soPhong, r.thang;

SELECT maHopDong, maPhong, ngayBatDau, ngayKetThuc, trangThai, dieuKhoan
FROM HopDong WHERE dieuKhoan LIKE '%SEED_HIST_2026%';

-- Generated financial history is synthetic. Deposits/move-out settlements and
-- co-tenant histories are not created by this script.
COMMIT;

DROP TEMPORARY TABLE IF EXISTS _seed_bills;
DROP TEMPORARY TABLE IF EXISTS _seed_bill_components;
DROP TEMPORARY TABLE IF EXISTS _seed_costs;
DROP TEMPORARY TABLE IF EXISTS _seed_periods;
DROP TEMPORARY TABLE IF EXISTS _seed_contracts;
DROP TEMPORARY TABLE IF EXISTS _seed_src;
