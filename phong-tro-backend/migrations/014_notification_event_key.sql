-- FR-159: idempotent notification event keys. MySQL 8/MariaDB compatible.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThongBao' AND column_name='khoaSuKien'), 'SELECT 1', 'ALTER TABLE `ThongBao` ADD COLUMN `khoaSuKien` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Keep the existing read index and add the event uniqueness index only once.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ThongBao' AND index_name='uq_ThongBao_maTaiKhoan_khoaSuKien'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_ThongBao_maTaiKhoan_khoaSuKien` ON `ThongBao` (`maTaiKhoan`,`khoaSuKien`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
