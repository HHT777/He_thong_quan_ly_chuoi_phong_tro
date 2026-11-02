-- FR-162: hide a recipient's notification without releasing its event key.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = @schema_name AND table_name = 'ThongBao' AND column_name = 'daAn'
), 'SELECT 1', 'ALTER TABLE `ThongBao` ADD COLUMN `daAn` TINYINT(1) NOT NULL DEFAULT 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
