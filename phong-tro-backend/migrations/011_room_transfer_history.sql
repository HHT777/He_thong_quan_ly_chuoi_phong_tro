-- P3/FR-195: preserve the existing contract while recording a room transfer.
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- Rollback (manual, only after exporting history): DROP TABLE LichSuChuyenPhong;
CREATE TABLE IF NOT EXISTS `LichSuChuyenPhong` (
  `maLichSu` varchar(36) NOT NULL,
  `maHopDong` varchar(36) NOT NULL,
  `maPhongCu` varchar(36) NOT NULL,
  `maPhongMoi` varchar(36) NOT NULL,
  `ngayChuyen` date NOT NULL,
  `giaThueCu` decimal(18,2) NOT NULL,
  `giaThueMoi` decimal(18,2) NOT NULL,
  `chiSoDienCuoiPhongCu` decimal(18,2) NOT NULL,
  `chiSoDienDauPhongMoi` decimal(18,2) NOT NULL,
  `nguoiThucHienId` varchar(36) NOT NULL,
  `thoiDiemTao` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`maLichSu`),
  CONSTRAINT `fk_LichSuChuyenPhong_hopDong` FOREIGN KEY (`maHopDong`) REFERENCES `HopDong` (`maHopDong`),
  CONSTRAINT `fk_LichSuChuyenPhong_phongCu` FOREIGN KEY (`maPhongCu`) REFERENCES `PhongTro` (`maPhong`),
  CONSTRAINT `fk_LichSuChuyenPhong_phongMoi` FOREIGN KEY (`maPhongMoi`) REFERENCES `PhongTro` (`maPhong`),
  CONSTRAINT `fk_LichSuChuyenPhong_nguoiThucHien` FOREIGN KEY (`nguoiThucHienId`) REFERENCES `TaiKhoan` (`maTaiKhoan`),
  CONSTRAINT `ck_LichSuChuyenPhong_1` CHECK (`maPhongCu` <> `maPhongMoi`),
  CONSTRAINT `ck_LichSuChuyenPhong_2` CHECK (`chiSoDienCuoiPhongCu` >= 0 AND `chiSoDienDauPhongMoi` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
