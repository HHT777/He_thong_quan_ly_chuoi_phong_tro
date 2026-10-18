-- FR-144..157, FR-164, FR-172..176: billing details, scheduled adjustments and debt lifecycle.
-- MySQL 8.0.16+ / MariaDB 10.4 compatible. Additive DDL is guarded through
-- INFORMATION_SCHEMA; ADD COLUMN IF NOT EXISTS is deliberately not used.
--
-- Rollback is manual: export billing data first; remove the 013 foreign keys and
-- indexes, remove the new columns, restore ck_ChiTietThanhToan_1 (soTien >= 0),
-- then drop KhoanDieuChinh. Signed adjustment rows must be reconciled before rollback.

SET @schema_name = DATABASE();

-- Refuse to migrate inconsistent bills. This is detection only: no amount is repaired.
SELECT COUNT(*) INTO @bill_total_mismatches
FROM (
  SELECT t.`maThanhToan`
  FROM `ThanhToan` t
  LEFT JOIN `ChiTietThanhToan` ct ON ct.`maThanhToan` = t.`maThanhToan`
  GROUP BY t.`maThanhToan`, t.`tongPhaiTra`
  HAVING ABS(COALESCE(SUM(ct.`soTien`), 0) - t.`tongPhaiTra`) > 0.001
) mismatches;
SET @sql = IF(@bill_total_mismatches = 0, 'SELECT 1', "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MIGRATION_013_BILL_DETAIL_TOTAL_MISMATCH'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Only documented legacy aliases and the new canonical values are accepted.
SELECT COUNT(*) INTO @unknown_line_types
FROM `ChiTietThanhToan`
WHERE `loaiKhoan` NOT IN (
  'TIEN_PHONG','TIEN_DIEN','TIEN_NUOC','DICH_VU','PHAT_SINH','PHI_DICH_VU',
  'PHI_PHAT_SINH','GIAM_TRU','DIEU_CHINH_TANG','DIEU_CHINH_GIAM',
  'NO_SAU_THANH_LY','SUA_CHUA'
);
SET @sql = IF(@unknown_line_types = 0, 'SELECT 1', "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='MIGRATION_013_UNKNOWN_BILL_LINE_TYPE'");
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `KhoanDieuChinh` (
  `maKhoanDieuChinh` varchar(36) NOT NULL,
  `maHopDong` varchar(36) NOT NULL,
  `loaiKhoan` varchar(30) NOT NULL,
  `tenLyDo` varchar(255) NOT NULL,
  `soTien` decimal(18,2) NOT NULL,
  `cheDo` varchar(20) NOT NULL,
  `thangApDung` integer NULL,
  `namApDung` integer NULL,
  `ngayBatDau` date NULL,
  `trangThai` varchar(20) NOT NULL DEFAULT 'DANG_AP_DUNG',
  `ngayTao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ngayCapNhat` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ngayTat` timestamp NULL DEFAULT NULL,
  `lyDoTat` varchar(1000) NULL,
  `nguoiTaoId` varchar(36) NOT NULL,
  `nguoiCapNhatId` varchar(36) NULL,
  PRIMARY KEY (`maKhoanDieuChinh`),
  KEY `ix_KhoanDieuChinh_ap_dung` (`maHopDong`,`trangThai`,`cheDo`,`namApDung`,`thangApDung`),
  CONSTRAINT `fk_KhoanDieuChinh_hopDong` FOREIGN KEY (`maHopDong`) REFERENCES `HopDong` (`maHopDong`),
  CONSTRAINT `fk_KhoanDieuChinh_nguoiTao` FOREIGN KEY (`nguoiTaoId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `fk_KhoanDieuChinh_nguoiCapNhat` FOREIGN KEY (`nguoiCapNhatId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `ck_KhoanDieuChinh_1` CHECK (`loaiKhoan` IN ('PHI_PHAT_SINH','GIAM_TRU')),
  CONSTRAINT `ck_KhoanDieuChinh_2` CHECK (`soTien` > 0),
  CONSTRAINT `ck_KhoanDieuChinh_3` CHECK (`cheDo` IN ('CO_DINH','THEO_KY')),
  CONSTRAINT `ck_KhoanDieuChinh_4` CHECK (
    (`cheDo`='THEO_KY' AND `thangApDung` BETWEEN 1 AND 12 AND `namApDung` > 0 AND `ngayBatDau` IS NULL)
    OR (`cheDo`='CO_DINH' AND `thangApDung` IS NULL AND `namApDung` IS NULL AND `ngayBatDau` IS NOT NULL)
  ),
  CONSTRAINT `ck_KhoanDieuChinh_5` CHECK (`trangThai` IN ('DANG_AP_DUNG','DA_TAT')),
  CONSTRAINT `ck_KhoanDieuChinh_6` CHECK (
    (`trangThai`='DANG_AP_DUNG' AND `ngayTat` IS NULL AND `lyDoTat` IS NULL)
    OR (`trangThai`='DA_TAT' AND `ngayTat` IS NOT NULL AND `lyDoTat` IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Billing lifecycle columns are nullable while legacy rows are backfilled. New rows
-- get unprocessed defaults only after the backfill has completed.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='ngayLap'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `ngayLap` timestamp NULL DEFAULT NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='daGui'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `daGui` boolean NOT NULL DEFAULT false'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='ngayGui'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `ngayGui` timestamp NULL DEFAULT NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='daNhacHan'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `daNhacHan` boolean NOT NULL DEFAULT false'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='ngayNhacHan'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `ngayNhacHan` timestamp NULL DEFAULT NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='quaHan'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `quaHan` boolean NOT NULL DEFAULT false'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='ngayQuaHan'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `ngayQuaHan` timestamp NULL DEFAULT NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='daChotCongNo'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `daChotCongNo` boolean NOT NULL DEFAULT false'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='ngayChotCongNo'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `ngayChotCongNo` timestamp NULL DEFAULT NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='soTienChotCongNo'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `soTienChotCongNo` decimal(18,2) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Legacy anti-spam backfill. ngayLap IS NULL identifies rows that existed before 013.
-- No notification is emitted and the outstanding balance is deliberately unchanged.
UPDATE `ThanhToan`
SET `ngayLap`=TIMESTAMP(CONCAT(`nam`, '-', LPAD(`thang`, 2, '0'), '-01 00:00:00')),
    `daGui`=true,
    `ngayGui`=TIMESTAMP(CONCAT(`nam`, '-', LPAD(`thang`, 2, '0'), '-01 00:00:00')),
    `daNhacHan`=true,
    `ngayNhacHan`=TIMESTAMP(CONCAT(`nam`, '-', LPAD(`thang`, 2, '0'), '-05 00:00:00')),
    `quaHan`=true,
    `ngayQuaHan`=TIMESTAMP(CONCAT(`nam`, '-', LPAD(`thang`, 2, '0'), '-06 00:00:00')),
    `daChotCongNo`=true,
    `ngayChotCongNo`=TIMESTAMP(CONCAT(`nam`, '-', LPAD(`thang`, 2, '0'), '-10 23:59:59')),
    `soTienChotCongNo`=`soTienConNo`
WHERE `ngayLap` IS NULL;
ALTER TABLE `ThanhToan` MODIFY COLUMN `ngayLap` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ThanhToan' AND index_name='ix_ThanhToan_tac_vu'), 'SELECT 1', 'CREATE INDEX `ix_ThanhToan_tac_vu` ON `ThanhToan` (`loaiThanhToan`,`nam`,`thang`,`soTienConNo`,`daGui`,`daNhacHan`,`quaHan`,`daChotCongNo`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ChiTietThanhToan' AND column_name='maKhoanDieuChinh'), 'SELECT 1', 'ALTER TABLE `ChiTietThanhToan` ADD COLUMN `maKhoanDieuChinh` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ChiTietThanhToan' AND column_name='nguoiThucHienId'), 'SELECT 1', 'ALTER TABLE `ChiTietThanhToan` ADD COLUMN `nguoiThucHienId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ChiTietThanhToan' AND column_name='thoiDiemTao'), 'SELECT 1', 'ALTER TABLE `ChiTietThanhToan` ADD COLUMN `thoiDiemTao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Keep a dedicated index for the ThanhToan FK so removing/changing the adjustment
-- uniqueness constraint can never orphan the FK support index.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ChiTietThanhToan' AND index_name='ix_ChiTietThanhToan_maThanhToan'), 'SELECT 1', 'CREATE INDEX `ix_ChiTietThanhToan_maThanhToan` ON `ChiTietThanhToan` (`maThanhToan`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ChiTietThanhToan' AND index_name='uq_ChiTietThanhToan_dieu_chinh'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_ChiTietThanhToan_dieu_chinh` ON `ChiTietThanhToan` (`maThanhToan`,`maKhoanDieuChinh`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ChiTietThanhToan' AND constraint_name='fk_ChiTietThanhToan_khoanDieuChinh'), 'SELECT 1', 'ALTER TABLE `ChiTietThanhToan` ADD CONSTRAINT `fk_ChiTietThanhToan_khoanDieuChinh` FOREIGN KEY (`maKhoanDieuChinh`) REFERENCES `KhoanDieuChinh` (`maKhoanDieuChinh`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ChiTietThanhToan' AND constraint_name='fk_ChiTietThanhToan_nguoiThucHien'), 'SELECT 1', 'ALTER TABLE `ChiTietThanhToan` ADD CONSTRAINT `fk_ChiTietThanhToan_nguoiThucHien` FOREIGN KEY (`nguoiThucHienId`) REFERENCES `TaiKhoan` (`maTaiKhoan`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Normalize aliases before enabling the canonical type/sign domain.
UPDATE `ChiTietThanhToan` SET `loaiKhoan`='PHI_DICH_VU' WHERE `loaiKhoan`='DICH_VU';
UPDATE `ChiTietThanhToan` SET `loaiKhoan`='PHI_PHAT_SINH' WHERE `loaiKhoan`='PHAT_SINH';

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ChiTietThanhToan' AND constraint_name='ck_ChiTietThanhToan_1'), IF(LOCATE('MariaDB', VERSION()) > 0, 'ALTER TABLE `ChiTietThanhToan` DROP CONSTRAINT `ck_ChiTietThanhToan_1`', 'ALTER TABLE `ChiTietThanhToan` DROP CHECK `ck_ChiTietThanhToan_1`'), 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ChiTietThanhToan' AND constraint_name='ck_ChiTietThanhToan_013'), 'SELECT 1', "ALTER TABLE `ChiTietThanhToan` ADD CONSTRAINT `ck_ChiTietThanhToan_013` CHECK ((`loaiKhoan` IN ('GIAM_TRU','DIEU_CHINH_GIAM') AND `soTien` < 0) OR (`loaiKhoan` IN ('TIEN_PHONG','TIEN_DIEN','TIEN_NUOC','PHI_DICH_VU','PHI_PHAT_SINH','DIEU_CHINH_TANG','NO_SAU_THANH_LY','SUA_CHUA') AND `soTien` >= 0))"); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='ck_ThanhToan_013_gui'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `ck_ThanhToan_013_gui` CHECK ((`daGui`=false AND `ngayGui` IS NULL) OR (`daGui`=true AND `ngayGui` IS NOT NULL))'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='ck_ThanhToan_013_nhac'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `ck_ThanhToan_013_nhac` CHECK ((`daNhacHan`=false AND `ngayNhacHan` IS NULL) OR (`daNhacHan`=true AND `ngayNhacHan` IS NOT NULL))'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='ck_ThanhToan_013_qua_han'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `ck_ThanhToan_013_qua_han` CHECK ((`quaHan`=false AND `ngayQuaHan` IS NULL) OR (`quaHan`=true AND `ngayQuaHan` IS NOT NULL))'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='ck_ThanhToan_013_chot_no'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `ck_ThanhToan_013_chot_no` CHECK ((`daChotCongNo`=false AND `ngayChotCongNo` IS NULL AND `soTienChotCongNo` IS NULL) OR (`daChotCongNo`=true AND `ngayChotCongNo` IS NOT NULL AND `soTienChotCongNo` IS NOT NULL AND `soTienChotCongNo` >= 0))'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Default configurable processing window. The row is inserted only when a landlord
-- account exists; systemConfig.service still provides the same default otherwise.
INSERT INTO `CauHinhHeThong` (`maCauHinh`,`khoa`,`giaTri`,`moTa`,`ngayCapNhat`,`nguoiCapNhatId`)
SELECT UUID(), 'billingCronLookbackMonths', JSON_EXTRACT('3', '$'), 'Số kỳ gần nhất cron phiếu thu/công nợ được phép xử lý', CURRENT_TIMESTAMP, tk.`maTaiKhoan`
FROM `TaiKhoan` tk
WHERE tk.`vaiTro`='CHU_TRO'
  AND NOT EXISTS (SELECT 1 FROM `CauHinhHeThong` WHERE `khoa`='billingCronLookbackMonths')
ORDER BY tk.`maTaiKhoan`
LIMIT 1;
