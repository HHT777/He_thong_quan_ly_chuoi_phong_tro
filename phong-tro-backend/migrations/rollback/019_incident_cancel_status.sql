-- Stop the app and Export first. Any DA_HUY rows BLOCK rollback: do not remap/delete them.
-- One ALTER validates the replacement CHECK; invalid existing rows cause an error.
-- Read-only preflight: SELECT COUNT(*) FROM SuCo WHERE trangThai='DA_HUY'; must be 0.
SET @schema_name = DATABASE();
SET @drop_check = IF(LOCATE('MariaDB', VERSION()) > 0, 'DROP CONSTRAINT', 'DROP CHECK');
SET @expanded = EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_schema=@schema_name AND constraint_name='ck_SuCo_1' AND check_clause LIKE '%DA_HUY%');
SET @sql = IF(@expanded, CONCAT('ALTER TABLE `SuCo` ', @drop_check, ' `ck_SuCo_1`, ADD CONSTRAINT `ck_SuCo_1` CHECK (`trangThai` IN (''CHO_TIEP_NHAN'',''DANG_XU_LY'',''DA_XU_LY''))'), 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
