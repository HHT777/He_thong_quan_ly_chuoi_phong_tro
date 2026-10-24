-- FR-152/153: manual issue and auditable draft generation.
-- Additive, repeatable on MySQL 8.0.16+ and MariaDB 10.4.
SET @schema_name = DATABASE();

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='nguoiGuiId'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `nguoiGuiId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='soLanGui'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `soLanGui` integer NOT NULL DEFAULT 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ThanhToan' AND index_name='ix_ThanhToan_nguoiGuiId'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD INDEX `ix_ThanhToan_nguoiGuiId` (`nguoiGuiId`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='fk_ThanhToan_nguoiGuiId'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `fk_ThanhToan_nguoiGuiId` FOREIGN KEY (`nguoiGuiId`) REFERENCES `TaiKhoan` (`maTaiKhoan`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='ck_ThanhToan_017_lan_gui'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `ck_ThanhToan_017_lan_gui` CHECK (`soLanGui` >= 0)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `NhatKyLapPhieu` (
  `maLanChay` varchar(36) NOT NULL,
  `ky` char(7) NOT NULL,
  `thoiDiemHen` datetime NOT NULL,
  `batDau` datetime NOT NULL,
  `ketThuc` datetime NULL,
  `trangThai` varchar(20) NOT NULL,
  `soPhieuLap` integer NOT NULL DEFAULT 0,
  `soPhongBoQua` integer NOT NULL DEFAULT 0,
  `soPhongLoi` integer NOT NULL DEFAULT 0,
  `phamViJson` json NOT NULL,
  PRIMARY KEY (`maLanChay`),
  UNIQUE KEY `uq_NhatKyLapPhieu_ky` (`ky`),
  CONSTRAINT `ck_NhatKyLapPhieu_trangThai` CHECK (`trangThai` IN ('DANG_CHAY','HOAN_TAT','LOI')),
  CONSTRAINT `ck_NhatKyLapPhieu_soLuong` CHECK (`soPhieuLap` >= 0 AND `soPhongBoQua` >= 0 AND `soPhongLoi` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ChiTietNhatKyLapPhieu` (
  `maChiTiet` varchar(36) NOT NULL,
  `maLanChay` varchar(36) NOT NULL,
  `maPhong` varchar(36) NOT NULL,
  `maHopDong` varchar(36) NULL,
  `ketQua` varchar(20) NOT NULL,
  `maLyDo` varchar(60) NULL,
  `dienGiai` varchar(255) NULL,
  PRIMARY KEY (`maChiTiet`),
  UNIQUE KEY `uq_ChiTietNhatKyLapPhieu_lan_phong` (`maLanChay`,`maPhong`),
  KEY `ix_ChiTietNhatKyLapPhieu_phong` (`maPhong`),
  KEY `ix_ChiTietNhatKyLapPhieu_hopDong` (`maHopDong`),
  CONSTRAINT `fk_ChiTietNhatKyLapPhieu_lan` FOREIGN KEY (`maLanChay`) REFERENCES `NhatKyLapPhieu` (`maLanChay`),
  CONSTRAINT `fk_ChiTietNhatKyLapPhieu_phong` FOREIGN KEY (`maPhong`) REFERENCES `PhongTro` (`maPhong`),
  CONSTRAINT `fk_ChiTietNhatKyLapPhieu_hopDong` FOREIGN KEY (`maHopDong`) REFERENCES `HopDong` (`maHopDong`),
  CONSTRAINT `ck_ChiTietNhatKyLapPhieu_ketQua` CHECK (`ketQua` IN ('DA_LAP','BO_QUA','LOI'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
