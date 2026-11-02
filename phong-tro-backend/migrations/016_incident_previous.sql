-- FR-192: link a newly reported incident to one completed incident.
-- Guard each DDL operation for repeat execution on MySQL 8 / MariaDB 10.4.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='SuCo' AND column_name='maSuCoTruoc'), 'SELECT 1', 'ALTER TABLE `SuCo` ADD COLUMN `maSuCoTruoc` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='SuCo' AND index_name='ix_SuCo_maSuCoTruoc'), 'SELECT 1', 'ALTER TABLE `SuCo` ADD INDEX `ix_SuCo_maSuCoTruoc` (`maSuCoTruoc`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='SuCo' AND constraint_name='fk_SuCo_maSuCoTruoc'), 'SELECT 1', 'ALTER TABLE `SuCo` ADD CONSTRAINT `fk_SuCo_maSuCoTruoc` FOREIGN KEY (`maSuCoTruoc`) REFERENCES `SuCo` (`maSuCo`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
