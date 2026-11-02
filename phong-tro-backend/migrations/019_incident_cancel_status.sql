-- KT-12: only expand the existing status CHECK; no new column/table/index.
SET @schema_name = DATABASE();
SET @drop_check = IF(LOCATE('MariaDB', VERSION()) > 0, 'DROP CONSTRAINT', 'DROP CHECK');
SET @applied = EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_schema=@schema_name AND constraint_name='ck_SuCo_1' AND check_clause LIKE '%DA_HUY%');
SET @exists_check = EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='SuCo' AND constraint_name='ck_SuCo_1');
SET @sql = IF(@applied, 'SELECT 1', CONCAT('ALTER TABLE `SuCo` ', IF(@exists_check, CONCAT(@drop_check, ' `ck_SuCo_1`, '), ''), 'ADD CONSTRAINT `ck_SuCo_1` CHECK (`trangThai` IN (''CHO_TIEP_NHAN'',''DANG_XU_LY'',''DA_XU_LY'',''DA_HUY''))'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
