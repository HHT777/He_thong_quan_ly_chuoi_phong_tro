-- P2/FR-167..170: room reservations for the UUID/camel-case schema.
-- Rollback is manual after exporting reservation history.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='PhongTro' AND constraint_name='ck_PhongTro_3'), 'ALTER TABLE `PhongTro` DROP CONSTRAINT `ck_PhongTro_3`', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE `PhongTro` ADD CONSTRAINT `ck_PhongTro_3` CHECK (`trangThai` IN ('TRONG', 'DA_GIU', 'DANG_THUE', 'DANG_XU_LY_TRA_PHONG', 'NGUNG_SU_DUNG'));

CREATE TABLE IF NOT EXISTS `DatGiuPhong` (
  `maDatGiu` varchar(36) NOT NULL, `hoTenNguoiGiu` varchar(100) NOT NULL, `soDienThoai` varchar(15) NOT NULL,
  `soTienGiu` decimal(18,2) NOT NULL, `ngayNhan` date NOT NULL, `hanGiu` date NOT NULL, `dieuKien` varchar(1000) NOT NULL, `ghiChu` varchar(1000) NULL,
  `trangThai` varchar(30) NOT NULL DEFAULT 'DANG_GIU', `soTienHoan` decimal(18,2) NOT NULL DEFAULT 0, `lyDoHuy` varchar(1000) NULL, `ngayHuy` timestamp NULL DEFAULT NULL,
  `nguoiThucHienId` varchar(36) NOT NULL, `maPhong` varchar(36) NOT NULL,
  PRIMARY KEY (`maDatGiu`), KEY `ix_DatGiuPhong_1` (`maPhong`, `trangThai`, `hanGiu`),
  CONSTRAINT `fk_DatGiuPhong_nguoiThucHienId` FOREIGN KEY (`nguoiThucHienId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `fk_DatGiuPhong_maPhong` FOREIGN KEY (`maPhong`) REFERENCES `PhongTro` (`maPhong`),
  CONSTRAINT `ck_DatGiuPhong_1` CHECK (`soTienGiu` >= 0 AND `soTienHoan` >= 0 AND `soTienHoan` <= `soTienGiu`),
  CONSTRAINT `ck_DatGiuPhong_2` CHECK (`hanGiu` > `ngayNhan`), CONSTRAINT `ck_DatGiuPhong_3` CHECK (`trangThai` IN ('DANG_GIU', 'DA_HUY', 'DA_CHUYEN_THANH_HOP_DONG'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LichSuGiaHanGiuPhong` (
  `maLichSu` varchar(36) NOT NULL, `hanCu` date NOT NULL, `hanMoi` date NOT NULL, `lyDo` varchar(1000) NULL, `thoiDiemTao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `nguoiThucHienId` varchar(36) NOT NULL, `maDatGiu` varchar(36) NOT NULL, PRIMARY KEY (`maLichSu`),
  CONSTRAINT `fk_LichSuGiaHanGiuPhong_nguoiThucHienId` FOREIGN KEY (`nguoiThucHienId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `fk_LichSuGiaHanGiuPhong_maDatGiu` FOREIGN KEY (`maDatGiu`) REFERENCES `DatGiuPhong` (`maDatGiu`), CONSTRAINT `ck_LichSuGiaHanGiuPhong_1` CHECK (`hanMoi` > `hanCu`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
