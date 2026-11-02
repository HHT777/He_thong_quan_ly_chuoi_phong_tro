-- FR-130: additive status constraint for databases without ck_SuCo_1.
-- Existing data must be checked for allowed statuses before this migration runs.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_schema = @schema_name AND LOWER(table_name) = 'suco'
    AND LOWER(constraint_name) = 'ck_suco_1' AND constraint_type = 'CHECK'
), 'SELECT 1', 'ALTER TABLE `SuCo` ADD CONSTRAINT `ck_SuCo_1` CHECK (`trangThai` IN (''CHO_TIEP_NHAN'',''DANG_XU_LY'',''DA_XU_LY'',''DA_HUY''))');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
