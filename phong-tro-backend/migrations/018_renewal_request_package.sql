-- FR-087/185: preserve the selected package independently of contract edits.
-- No backfill: NULL means a legacy request with an unknown package.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='YeuCauGiaHan' AND column_name='goiGiaHanThang'), 'SELECT 1', 'ALTER TABLE `YeuCauGiaHan` ADD COLUMN `goiGiaHanThang` TINYINT UNSIGNED NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='YeuCauGiaHan' AND constraint_name='ck_YeuCauGiaHan_goiGiaHanThang' AND constraint_type='CHECK'), 'SELECT 1', 'ALTER TABLE `YeuCauGiaHan` ADD CONSTRAINT `ck_YeuCauGiaHan_goiGiaHanThang` CHECK (`goiGiaHanThang` IS NULL OR `goiGiaHanThang` IN (6,12))');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
