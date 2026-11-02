-- FR-087/185: MariaDB may expose lower-case physical table names.
-- Keep legacy requests NULL; no existing row is rewritten.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = @schema_name AND LOWER(table_name) = 'yeucaugiahan'
    AND LOWER(column_name) = 'goigiahanthang'
), 'SELECT 1', 'ALTER TABLE `YeuCauGiaHan` ADD COLUMN `goiGiaHanThang` TINYINT UNSIGNED NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_schema = @schema_name AND LOWER(table_name) = 'yeucaugiahan'
    AND LOWER(constraint_name) = 'ck_yeucaugiahan_goigiahanthang' AND constraint_type = 'CHECK'
), 'SELECT 1', 'ALTER TABLE `YeuCauGiaHan` ADD CONSTRAINT `ck_YeuCauGiaHan_goiGiaHanThang` CHECK (`goiGiaHanThang` IS NULL OR `goiGiaHanThang` IN (6,12))');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
