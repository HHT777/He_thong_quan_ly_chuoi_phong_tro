-- P1 additive migration for the UUID/camel-case schema defined in data2.md.
-- Run once after the data2.md baseline. It does not alter or delete business rows.
-- Rollback is manual because lifecycle/audit data must be exported before dropping columns/tables.
SET @schema_name = DATABASE();

ALTER TABLE `YeuCau`
  ADD COLUMN IF NOT EXISTS `lyDoXuLy` varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS `ngayDuyet` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `ngayRutDuyet` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `nguoiXuLyId` varchar(36) NULL;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='YeuCau' AND constraint_name='fk_YeuCau_nguoiXuLyId'), 'SELECT 1', 'ALTER TABLE `YeuCau` ADD CONSTRAINT `fk_YeuCau_nguoiXuLyId` FOREIGN KEY (`nguoiXuLyId`) REFERENCES `TaiKhoan` (`maTaiKhoan`)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='YeuCau' AND constraint_name='ck_YeuCau_2'), 'ALTER TABLE `YeuCau` DROP CONSTRAINT `ck_YeuCau_2`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE `YeuCau` ADD CONSTRAINT `ck_YeuCau_2` CHECK (`trangThai` IN ('CHO_XU_LY', 'DA_PHE_DUYET', 'TU_CHOI', 'DA_RUT'));

ALTER TABLE `YeuCauTraPhong`
  ADD COLUMN IF NOT EXISTS `ngayTraDuKien` date NULL,
  ADD COLUMN IF NOT EXISTS `ngayTraDaDuyet` date NULL,
  ADD COLUMN IF NOT EXISTS `lyDoTraSom` varchar(1000) NULL;

CREATE TABLE IF NOT EXISTS `ChiPhiSuCoKhachThue` (
  `maChiPhiSuCo` varchar(36) NOT NULL,
  `maSuCo` varchar(36) NOT NULL,
  `maHopDong` varchar(36) NOT NULL,
  `soTien` decimal(18,2) NOT NULL,
  `canCuTrachNhiem` varchar(1000) NOT NULL,
  `trangThai` varchar(30) NOT NULL DEFAULT 'CHO_KHAU_TRU',
  `ngayGhiNhan` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ngayKhauTru` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`maChiPhiSuCo`), UNIQUE KEY `uq_ChiPhiSuCoKhachThue_maSuCo` (`maSuCo`),
  CONSTRAINT `fk_ChiPhiSuCoKhachThue_maSuCo` FOREIGN KEY (`maSuCo`) REFERENCES `SuCo` (`maSuCo`),
  CONSTRAINT `fk_ChiPhiSuCoKhachThue_maHopDong` FOREIGN KEY (`maHopDong`) REFERENCES `HopDong` (`maHopDong`),
  CONSTRAINT `ck_ChiPhiSuCoKhachThue_1` CHECK (`soTien` >= 0),
  CONSTRAINT `ck_ChiPhiSuCoKhachThue_2` CHECK (`trangThai` IN ('CHO_KHAU_TRU', 'DA_KHAU_TRU', 'DA_HUY'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actor_id` varchar(36) NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` varchar(100) NOT NULL,
  `before_json` json NULL,
  `after_json` json NULL,
  `reason` text NULL,
  `correlation_id` varchar(100) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The older MVP foundation created this column as INT; account identifiers in
-- the current schema are UUID strings.
ALTER TABLE `audit_log` MODIFY COLUMN `actor_id` varchar(36) NOT NULL;
