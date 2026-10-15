-- P2/FR-183: immutable history and soft deletion for UUID meter readings.
-- Rollback is manual after exporting meter history.
SET @schema_name = DATABASE();
ALTER TABLE `ChiSoDien`
  ADD COLUMN IF NOT EXISTS `daXoa` boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `lyDoXoa` varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS `ngayXoa` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `nguoiXoaId` varchar(36) NULL;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ChiSoDien' AND constraint_name='fk_ChiSoDien_nguoiXoaId'), 'SELECT 1', 'ALTER TABLE `ChiSoDien` ADD CONSTRAINT `fk_ChiSoDien_nguoiXoaId` FOREIGN KEY (`nguoiXoaId`) REFERENCES `TaiKhoan` (`maTaiKhoan`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ChiSoDien' AND index_name='ix_ChiSoDien_2'), 'SELECT 1', 'CREATE INDEX `ix_ChiSoDien_2` ON `ChiSoDien` (`maPhong`, `daXoa`, `nam`, `thang`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
CREATE TABLE IF NOT EXISTS `LichSuChinhSuaChiSoDien` (
  `maLichSu` varchar(36) NOT NULL, `chiSoCu` decimal(18,2) NOT NULL, `chiSoMoi` decimal(18,2) NOT NULL, `lyDo` varchar(1000) NOT NULL,
  `thoiDiemSua` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, `nguoiSuaId` varchar(36) NOT NULL, `maChiSo` varchar(36) NOT NULL,
  PRIMARY KEY (`maLichSu`), CONSTRAINT `fk_LichSuChinhSuaChiSoDien_nguoiSuaId` FOREIGN KEY (`nguoiSuaId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `fk_LichSuChinhSuaChiSoDien_maChiSo` FOREIGN KEY (`maChiSo`) REFERENCES `ChiSoDien` (`maChiSo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
