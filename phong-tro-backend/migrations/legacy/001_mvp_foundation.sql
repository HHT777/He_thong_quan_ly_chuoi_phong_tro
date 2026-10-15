-- Additive MVP foundation migration for the existing MySQL schema.
-- This migration is safe to run repeatedly: each column is added only when it
-- is absent, while CREATE TABLE IF NOT EXISTS handles the new tables.
SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @db_name AND table_name = 'dien_nuoc'),
  IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = 'ma_khach_thue'), 'SELECT 1', 'ALTER TABLE dien_nuoc ADD COLUMN ma_khach_thue INT NULL'),
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @columns = 'ocr_value VARCHAR(32) NULL,entry_mode ENUM(''OCR_ACCEPTED'',''OCR_CORRECTED'',''MANUAL_AFTER_OCR_FAILURE'',''LANDLORD_MANUAL'') NULL,correction_requested TINYINT(1) NOT NULL DEFAULT 0,correction_reason TEXT NULL,evidence_path VARCHAR(500) NULL,submitted_at DATETIME NULL,confirmed_at DATETIME NULL,confirmed_by INT NULL,version INT NOT NULL DEFAULT 1';
SET @column_name = 'ocr_value';
SET @sql = IF(EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = @db_name AND table_name = 'dien_nuoc') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN ocr_value VARCHAR(32) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'entry_mode';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN entry_mode ENUM(''OCR_ACCEPTED'',''OCR_CORRECTED'',''MANUAL_AFTER_OCR_FAILURE'',''LANDLORD_MANUAL'') NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'correction_requested';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN correction_requested TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'correction_reason';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN correction_reason TEXT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'evidence_path';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN evidence_path VARCHAR(500) NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'submitted_at';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN submitted_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'confirmed_at';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN confirmed_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'confirmed_by';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN confirmed_by INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @column_name = 'version';
SET @sql = IF(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @db_name AND table_name = 'dien_nuoc' AND column_name = @column_name), 'ALTER TABLE dien_nuoc ADD COLUMN version INT NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  reason TEXT NULL,
  correlation_id VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbox_event (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_id VARCHAR(100) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  aggregate_id VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS idempotency_key (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(150) NOT NULL,
  `key` VARCHAR(150) NOT NULL,
  response_status INT NOT NULL,
  response_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idempotency_scope_key (scope, `key`)
);

CREATE TABLE IF NOT EXISTS meter_upload (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token VARCHAR(100) NOT NULL UNIQUE,
  account_id INT NOT NULL,
  period CHAR(7) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  ocr_status VARCHAR(30) NOT NULL,
  ocr_value VARCHAR(32) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
