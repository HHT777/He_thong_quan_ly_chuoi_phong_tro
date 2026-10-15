CREATE TABLE IF NOT EXISTS yeu_cau (
  ma_yeu_cau INT AUTO_INCREMENT PRIMARY KEY,
  loai ENUM('GIA_HAN','TRA_PHONG') NOT NULL,
  ma_khach_thue INT NOT NULL,
  ma_hop_dong INT NULL,
  noi_dung TEXT NULL,
  ngay_du_kien DATETIME NULL,
  trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI','DA_RUT') NOT NULL DEFAULT 'CHO_DUYET',
  ly_do_xu_ly TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_yeu_cau_tenant (ma_khach_thue, trang_thai),
  CONSTRAINT fk_yeu_cau_tenant FOREIGN KEY (ma_khach_thue) REFERENCES khach_thue(ma_khach_thue)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS su_co (
  ma_su_co INT AUTO_INCREMENT PRIMARY KEY,
  ma_khach_thue INT NOT NULL,
  ma_phong INT NOT NULL,
  tieu_de VARCHAR(200) NOT NULL,
  mo_ta TEXT NOT NULL,
  trang_thai ENUM('MOI','DANG_XU_LY','HOAN_TAT','DA_HUY') NOT NULL DEFAULT 'MOI',
  ben_chiu_chi_phi ENUM('CHU_TRO','KHACH_THUE','CHUA_XAC_DINH') NOT NULL DEFAULT 'CHUA_XAC_DINH',
  chi_phi DECIMAL(12,2) NOT NULL DEFAULT 0,
  ghi_chu_xu_ly TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_su_co_tenant (ma_khach_thue, trang_thai)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nguoi_o (
  ma_nguoi_o INT AUTO_INCREMENT PRIMARY KEY,
  ma_khach_thue INT NOT NULL,
  ho_ten VARCHAR(150) NOT NULL,
  cccd VARCHAR(50) NOT NULL,
  so_dien_thoai VARCHAR(20) NULL,
  quan_he VARCHAR(80) NULL,
  trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI') NOT NULL DEFAULT 'CHO_DUYET',
  ly_do TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_nguoi_o_tenant (ma_khach_thue, trang_thai)
) ENGINE=InnoDB;
