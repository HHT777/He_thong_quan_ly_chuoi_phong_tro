-- Seed the built-in incident categories used by tenant and landlord forms.
-- INSERT IGNORE keeps this migration idempotent and preserves custom names/order.
INSERT IGNORE INTO `DanhMucSuCo` (`maDanhMuc`, `ma`, `ten`, `dangHoatDong`, `thuTu`) VALUES
  (UUID(), 'THIET_BI', 'Thiết bị', TRUE, 10),
  (UUID(), 'HONG_THIET_BI', 'Hỏng thiết bị', TRUE, 20),
  (UUID(), 'DIEN', 'Điện', TRUE, 30),
  (UUID(), 'NUOC', 'Nước', TRUE, 40),
  (UUID(), 'VE_SINH', 'Vệ sinh', TRUE, 50),
  (UUID(), 'AN_NINH', 'An ninh', TRUE, 60),
  (UUID(), 'KHAC', 'Khác', TRUE, 70);
