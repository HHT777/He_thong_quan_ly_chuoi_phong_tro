-- UC-10: one recorded meter replacement per room and reading period.
SET @schema_name = DATABASE();
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=@schema_name AND table_name='ThayDongHoDien'),
  'SELECT 1',
  'CREATE TABLE `ThayDongHoDien` (
    `maThayDongHo` varchar(36) NOT NULL,
    `maPhong` varchar(36) NOT NULL,
    `nam` integer NOT NULL,
    `thang` integer NOT NULL,
    `ngayThay` date NOT NULL,
    `chiSoCuoiCu` decimal(18,2) NULL,
    `sanLuongCuUocTinh` decimal(18,2) NULL,
    `chiSoDauMoi` decimal(18,2) NOT NULL,
    `lyDo` varchar(1000) NOT NULL,
    `anhDongHoCuUrl` varchar(500) NULL,
    `anhDongHoMoiUrl` varchar(500) NULL,
    `nguoiTaoId` varchar(36) NOT NULL,
    `thoiDiemTao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`maThayDongHo`),
    UNIQUE KEY `uq_ThayDongHoDien_phong_ky` (`maPhong`, `nam`, `thang`),
    CONSTRAINT `fk_ThayDongHoDien_maPhong` FOREIGN KEY (`maPhong`) REFERENCES `PhongTro` (`maPhong`),
    CONSTRAINT `fk_ThayDongHoDien_nguoiTaoId` FOREIGN KEY (`nguoiTaoId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
    CONSTRAINT `ck_ThayDongHoDien_period` CHECK (`nam` > 0 AND `thang` BETWEEN 1 AND 12),
    CONSTRAINT `ck_ThayDongHoDien_values` CHECK (`chiSoDauMoi` >= 0 AND (`chiSoCuoiCu` IS NULL OR `chiSoCuoiCu` >= 0) AND (`sanLuongCuUocTinh` IS NULL OR `sanLuongCuUocTinh` >= 0)),
    CONSTRAINT `ck_ThayDongHoDien_source` CHECK ((`chiSoCuoiCu` IS NOT NULL AND `sanLuongCuUocTinh` IS NULL) OR (`chiSoCuoiCu` IS NULL AND `sanLuongCuUocTinh` IS NOT NULL))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
