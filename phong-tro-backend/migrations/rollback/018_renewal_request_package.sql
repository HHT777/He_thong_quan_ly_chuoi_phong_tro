-- Rollback discards selected packages. Back up first; use only with old app.
SET @schema_name = DATABASE();
SET @drop_check = IF(LOCATE('MariaDB', VERSION()) > 0, 'DROP CONSTRAINT', 'DROP CHECK');
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='YeuCauGiaHan' AND constraint_name='ck_YeuCauGiaHan_goiGiaHanThang' AND constraint_type='CHECK'), CONCAT('ALTER TABLE `YeuCauGiaHan` ', @drop_check, ' `ck_YeuCauGiaHan_goiGiaHanThang`'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='YeuCauGiaHan' AND column_name='goiGiaHanThang'), 'ALTER TABLE `YeuCauGiaHan` DROP COLUMN `goiGiaHanThang`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
