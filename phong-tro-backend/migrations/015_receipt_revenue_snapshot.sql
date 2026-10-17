-- FR-133/BR-44: immutable gross-revenue and discount allocation per receipt.
-- Compatible with MySQL 8 and MariaDB 10.4; safe to run repeatedly.
SET @schema_name = DATABASE();

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='KhoanThu' AND column_name='doanhThuGop'), 'SELECT 1', 'ALTER TABLE `KhoanThu` ADD COLUMN `doanhThuGop` decimal(18,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='KhoanThu' AND column_name='giamTruPhanBo'), 'SELECT 1', 'ALTER TABLE `KhoanThu` ADD COLUMN `giamTruPhanBo` decimal(18,2) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=@schema_name AND table_name='KhoanThu' AND column_name='nguonSnapshot'), 'SELECT 1', 'ALTER TABLE `KhoanThu` ADD COLUMN `nguonSnapshot` varchar(20) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='KhoanThu' AND constraint_name='ck_KhoanThu_015_nguon'), 'SELECT 1', 'ALTER TABLE `KhoanThu` ADD CONSTRAINT `ck_KhoanThu_015_nguon` CHECK (`nguonSnapshot` IS NULL OR `nguonSnapshot` IN (''GHI_NHAN'',''SUY_DIEN''))');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema=@schema_name AND table_name='KhoanThu' AND constraint_name='ck_KhoanThu_015_snapshot'), 'SELECT 1', 'ALTER TABLE `KhoanThu` ADD CONSTRAINT `ck_KhoanThu_015_snapshot` CHECK ((`nguonSnapshot` IS NULL AND `doanhThuGop` IS NULL AND `giamTruPhanBo` IS NULL) OR (`nguonSnapshot` IS NOT NULL AND `doanhThuGop` IS NOT NULL AND `giamTruPhanBo` IS NOT NULL AND `doanhThuGop` >= 0 AND `giamTruPhanBo` >= 0 AND (`nguonSnapshot` <> ''GHI_NHAN'' OR `doanhThuGop` - `giamTruPhanBo` = `soTien`)))');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Legacy rows are inferred from the current bill. This is explicitly not an
-- assertion about the historical bill state; new writes use GHI_NHAN instead.
UPDATE `KhoanThu` kt
JOIN `GiaoDichThanhToan` gd ON gd.`maGiaoDich`=kt.`maGiaoDichThanhToan` AND gd.`nguonThanhToan`='THU_TIEN'
JOIN `ThanhToan` t ON t.`maThanhToan`=gd.`maThanhToan` AND t.`loaiThanhToan`<>'SAU_THANH_LY'
LEFT JOIN (
  SELECT `maThanhToan`,
    SUM(IF(`loaiKhoan`='GIAM_TRU',0,GREATEST(`soTien`,0))) AS grossTotal,
    SUM(IF(`loaiKhoan`='GIAM_TRU',ABS(`soTien`),0)) AS discountTotal
  FROM `ChiTietThanhToan` GROUP BY `maThanhToan`
) x ON x.`maThanhToan`=t.`maThanhToan`
SET kt.`giamTruPhanBo`=ROUND(kt.`soTien` * COALESCE(x.`discountTotal`,0) / NULLIF(t.`tongPhaiTra`,0),2),
    kt.`doanhThuGop`=kt.`soTien` + ROUND(kt.`soTien` * COALESCE(x.`discountTotal`,0) / NULLIF(t.`tongPhaiTra`,0),2),
    kt.`nguonSnapshot`='SUY_DIEN'
WHERE kt.`nguonSnapshot` IS NULL;
