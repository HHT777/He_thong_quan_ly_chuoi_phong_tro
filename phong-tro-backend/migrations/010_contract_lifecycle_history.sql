-- P2/FR-038, FR-042, FR-108, FR-185: additive contract lifecycle history.
-- Idempotent: guarded columns and CREATE TABLE IF NOT EXISTS.
-- Rollback (manual, only after exporting history): DROP TABLE LichSuSuaHopDong,
-- LichSuGiaHanHopDong; ALTER TABLE HopDong DROP COLUMN goiGiaHanChoPhep,
-- DROP COLUMN phiDichVu, DROP COLUMN daCoBanGiayKy;
ALTER TABLE `HopDong`
  ADD COLUMN IF NOT EXISTS `daCoBanGiayKy` boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS `phiDichVu` decimal(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `goiGiaHanChoPhep` varchar(20) NULL;
CREATE TABLE IF NOT EXISTS `LichSuGiaHanHopDong` (`maLichSu` varchar(36) NOT NULL, `maHopDong` varchar(36) NOT NULL, `ngayKetThucCu` date NOT NULL, `ngayKetThucMoi` date NOT NULL, `soThang` integer NOT NULL, `nguoiDuyetId` varchar(36) NOT NULL, `thoiDiemDuyet` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`maLichSu`), CONSTRAINT `fk_LichSuGiaHanHopDong_hopDong` FOREIGN KEY (`maHopDong`) REFERENCES `HopDong` (`maHopDong`), CONSTRAINT `fk_LichSuGiaHanHopDong_nguoiDuyet` FOREIGN KEY (`nguoiDuyetId`) REFERENCES `TaiKhoan` (`maTaiKhoan`), CONSTRAINT `ck_LichSuGiaHanHopDong_1` CHECK (`soThang` IN (6,12))) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `LichSuSuaHopDong` (`maLichSu` varchar(36) NOT NULL, `maHopDong` varchar(36) NOT NULL, `truocJson` json NULL, `sauJson` json NOT NULL, `lyDo` varchar(1000) NOT NULL, `nguoiSuaId` varchar(36) NOT NULL, `thoiDiemSua` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`maLichSu`), CONSTRAINT `fk_LichSuSuaHopDong_hopDong` FOREIGN KEY (`maHopDong`) REFERENCES `HopDong` (`maHopDong`), CONSTRAINT `fk_LichSuSuaHopDong_nguoiSua` FOREIGN KEY (`nguoiSuaId`) REFERENCES `TaiKhoan` (`maTaiKhoan`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
