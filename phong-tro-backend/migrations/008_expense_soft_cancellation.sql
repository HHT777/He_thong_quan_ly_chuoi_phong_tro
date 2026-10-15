-- Rollback is manual after exporting cancellation history.
SET @schema_name = DATABASE();
ALTER TABLE `KhoanChi` ADD COLUMN IF NOT EXISTS `trangThai` varchar(30) NOT NULL DEFAULT 'HIEU_LUC', ADD COLUMN IF NOT EXISTS `lyDoHuy` varchar(1000) NULL, ADD COLUMN IF NOT EXISTS `ngayHuy` timestamp NULL DEFAULT NULL, ADD COLUMN IF NOT EXISTS `nguoiHuyId` varchar(36) NULL;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='KhoanChi' AND constraint_name='fk_KhoanChi_nguoiHuyId'), 'SELECT 1', 'ALTER TABLE `KhoanChi` ADD CONSTRAINT `fk_KhoanChi_nguoiHuyId` FOREIGN KEY (`nguoiHuyId`) REFERENCES `TaiKhoan` (`maTaiKhoan`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
