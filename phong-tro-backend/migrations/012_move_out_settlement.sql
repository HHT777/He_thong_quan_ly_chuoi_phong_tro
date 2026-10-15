-- FR-187..190: move-out settlement, actual deposit refunds and post-liquidation debt.
-- Compatible with MySQL 8 and MariaDB: every additive/change operation is guarded
-- through INFORMATION_SCHEMA; no ADD COLUMN IF NOT EXISTS is used.
-- Rollback is manual and must only be attempted after exporting settlement/refund data.
-- Drop GiaoDichHoanCoc first, restore the old period indexes, then remove the 012 columns.
SET @schema_name = DATABASE();

-- Meter readings use a non-null business key. This avoids the NULL semantics of
-- composite unique indexes on both supported engines.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ChiSoDien' AND column_name='loaiChiSo'), 'SELECT 1', "ALTER TABLE `ChiSoDien` ADD COLUMN `loaiChiSo` varchar(30) NOT NULL DEFAULT 'DINH_KY'"); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ChiSoDien' AND column_name='khoaNghiepVu'), 'SELECT 1', "ALTER TABLE `ChiSoDien` ADD COLUMN `khoaNghiepVu` varchar(100) NOT NULL DEFAULT 'DINH_KY'"); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `ChiSoDien` SET `khoaNghiepVu`=CONCAT('DINH_KY:', `nam`, '-', LPAD(`thang`, 2, '0')) WHERE `loaiChiSo`='DINH_KY' AND (`khoaNghiepVu`='DINH_KY' OR `khoaNghiepVu`='');
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ChiSoDien' AND index_name='uq_ChiSoDien_nghiepVu'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_ChiSoDien_nghiepVu` ON `ChiSoDien` (`maPhong`,`loaiChiSo`,`khoaNghiepVu`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- uq_ChiSoDien_nghiepVu starts with maPhong, so the room FK retains a supporting index.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ChiSoDien' AND index_name='uq_ChiSoDien_ky1'), 'DROP INDEX `uq_ChiSoDien_ky1` ON `ChiSoDien`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='loaiThanhToan'), 'SELECT 1', "ALTER TABLE `ThanhToan` ADD COLUMN `loaiThanhToan` varchar(30) NOT NULL DEFAULT 'DINH_KY'"); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='ThanhToan' AND column_name='maBienBanTraPhong'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD COLUMN `maBienBanTraPhong` varchar(36) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ThanhToan' AND index_name='uq_ThanhToan_ky_loai'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_ThanhToan_ky_loai` ON `ThanhToan` (`maHopDong`,`thang`,`nam`,`loaiThanhToan`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ThanhToan' AND index_name='uq_ThanhToan_maBienBanTraPhong'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_ThanhToan_maBienBanTraPhong` ON `ThanhToan` (`maBienBanTraPhong`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='ThanhToan' AND constraint_name='fk_ThanhToan_maBienBanTraPhong'), 'SELECT 1', 'ALTER TABLE `ThanhToan` ADD CONSTRAINT `fk_ThanhToan_maBienBanTraPhong` FOREIGN KEY (`maBienBanTraPhong`) REFERENCES `BienBanTraPhong` (`maBienBan`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- uq_ThanhToan_ky_loai starts with maHopDong, preserving the contract FK index.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='ThanhToan' AND index_name='uq_ThanhToan_ky1'), 'DROP INDEX `uq_ThanhToan_ky1` ON `ThanhToan`', 'SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='GiaoDichThanhToan' AND column_name='nguonThanhToan'), 'SELECT 1', "ALTER TABLE `GiaoDichThanhToan` ADD COLUMN `nguonThanhToan` varchar(30) NOT NULL DEFAULT 'THU_TIEN'"); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing reports are explicitly marked legacy. Adding with DEFAULT TRUE backfills
-- old rows without fabricating refund transactions; the default is then changed for new rows.
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='laDuLieuLegacy'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `laDuLieuLegacy` boolean NOT NULL DEFAULT true'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE `BienBanTraPhong` ALTER COLUMN `laDuLieuLegacy` SET DEFAULT false;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='ngayQuyetToan'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `ngayQuyetToan` date NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='tienCocBanDau'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `tienCocBanDau` decimal(18,2) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='tienPhongTraTruocDuocHoan'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `tienPhongTraTruocDuocHoan` decimal(18,2) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='giaTriQuyetToanRong'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `giaTriQuyetToanRong` decimal(18,2) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='soTienNoSauThanhLy'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `soTienNoSauThanhLy` decimal(18,2) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='congThucQuyetToan'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `congThucQuyetToan` varchar(255) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='BienBanTraPhong' AND column_name='snapshotJson'), 'SELECT 1', 'ALTER TABLE `BienBanTraPhong` ADD COLUMN `snapshotJson` json NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `BienBanTraPhong` b JOIN `TienCoc` c ON c.`maHopDong`=b.`maHopDong` SET b.`tienCocBanDau`=c.`soTienCoc` WHERE b.`tienCocBanDau` IS NULL;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='KhoanKhauTru' AND column_name='soLuongTaiSan'), 'SELECT 1', 'ALTER TABLE `KhoanKhauTru` ADD COLUMN `soLuongTaiSan` integer NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='KhoanKhauTru' AND column_name='maChiPhiSuCo'), 'SELECT 1', 'ALTER TABLE `KhoanKhauTru` ADD COLUMN `maChiPhiSuCo` varchar(36) NULL'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='KhoanKhauTru' AND index_name='uq_KhoanKhauTru_maViPham'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_KhoanKhauTru_maViPham` ON `KhoanKhauTru` (`maViPham`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=@schema_name AND table_name='KhoanKhauTru' AND index_name='uq_KhoanKhauTru_maChiPhiSuCo'), 'SELECT 1', 'CREATE UNIQUE INDEX `uq_KhoanKhauTru_maChiPhiSuCo` ON `KhoanKhauTru` (`maChiPhiSuCo`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='KhoanKhauTru' AND constraint_name='fk_KhoanKhauTru_maChiPhiSuCo'), 'SELECT 1', 'ALTER TABLE `KhoanKhauTru` ADD CONSTRAINT `fk_KhoanKhauTru_maChiPhiSuCo` FOREIGN KEY (`maChiPhiSuCo`) REFERENCES `ChiPhiSuCoKhachThue` (`maChiPhiSuCo`)'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `GiaoDichHoanCoc` (
  `maGiaoDichHoanCoc` varchar(36) NOT NULL,
  `maBienBanTraPhong` varchar(36) NOT NULL,
  `maTienCoc` varchar(36) NOT NULL,
  `ngayHoan` date NOT NULL,
  `soTien` decimal(18,2) NOT NULL,
  `nguoiGhiNhanId` varchar(36) NOT NULL,
  `khoaChongTrung` varchar(100) NOT NULL,
  `thoiDiemTao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`maGiaoDichHoanCoc`),
  UNIQUE KEY `uq_GiaoDichHoanCoc_khoaChongTrung` (`khoaChongTrung`),
  CONSTRAINT `fk_GiaoDichHoanCoc_bienBan` FOREIGN KEY (`maBienBanTraPhong`) REFERENCES `BienBanTraPhong` (`maBienBan`),
  CONSTRAINT `fk_GiaoDichHoanCoc_tienCoc` FOREIGN KEY (`maTienCoc`) REFERENCES `TienCoc` (`maTienCoc`),
  CONSTRAINT `fk_GiaoDichHoanCoc_nguoiGhiNhan` FOREIGN KEY (`nguoiGhiNhanId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `ck_GiaoDichHoanCoc_1` CHECK (`soTien` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
