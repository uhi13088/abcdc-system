-- ============================================
-- HACCP 매장/공장 레벨 데이터 분리
-- store_id 추가로 멀티 공장 지원
-- ============================================

-- stores 테이블에 is_haccp_enabled 컬럼 추가
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_haccp_enabled BOOLEAN DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS haccp_factory_name VARCHAR(100);
COMMENT ON COLUMN stores.is_haccp_enabled IS 'HACCP 공장 여부';
COMMENT ON COLUMN stores.haccp_factory_name IS 'HACCP 공장명 (예: 1공장, 2공장)';

-- ============================================
-- CCP 관련 테이블
-- ============================================
ALTER TABLE ccp_definitions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE ccp_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE ccp_verifications ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ccp_definitions_store ON ccp_definitions(store_id);
CREATE INDEX IF NOT EXISTS idx_ccp_records_store ON ccp_records(store_id);
CREATE INDEX IF NOT EXISTS idx_ccp_verifications_store ON ccp_verifications(store_id);

-- ============================================
-- 생산/출하 관련 테이블
-- ============================================
ALTER TABLE production_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_production_records_store ON production_records(store_id);
CREATE INDEX IF NOT EXISTS idx_shipment_records_store ON shipment_records(store_id);

-- ============================================
-- 위생/방충 관련 테이블
-- ============================================
ALTER TABLE daily_hygiene_checks ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE pest_control_checks ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_daily_hygiene_checks_store ON daily_hygiene_checks(store_id);
CREATE INDEX IF NOT EXISTS idx_pest_control_checks_store ON pest_control_checks(store_id);

-- ============================================
-- 원자재 관련 테이블
-- ============================================
ALTER TABLE material_inspections ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE material_transactions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
ALTER TABLE material_stocks ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_material_inspections_store ON material_inspections(store_id);
CREATE INDEX IF NOT EXISTS idx_material_transactions_store ON material_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_material_stocks_store ON material_stocks(store_id);

-- ============================================
-- 보관창고 관련 테이블
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_inspections') THEN
    ALTER TABLE storage_inspections ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_storage_inspections_store ON storage_inspections(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finished_product_storage_locations') THEN
    ALTER TABLE finished_product_storage_locations ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_fp_storage_locations_store ON finished_product_storage_locations(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'finished_product_storage_inspections') THEN
    ALTER TABLE finished_product_storage_inspections ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_fp_storage_inspections_store ON finished_product_storage_inspections(store_id);
  END IF;
END $$;

-- ============================================
-- IoT/센서 관련 테이블
-- ============================================
ALTER TABLE iot_sensors ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_iot_sensors_store ON iot_sensors(store_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sensor_readings') THEN
    ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_sensor_readings_store ON sensor_readings(store_id);
  END IF;
END $$;

-- ============================================
-- 기타 HACCP 관련 테이블
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'corrective_actions') THEN
    ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_corrective_actions_store ON corrective_actions(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_training_records') THEN
    ALTER TABLE haccp_training_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_haccp_training_records_store ON haccp_training_records(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_reports') THEN
    ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_audit_reports_store ON audit_reports(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calibration_records') THEN
    ALTER TABLE calibration_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_calibration_records_store ON calibration_records(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns_disposals') THEN
    ALTER TABLE returns_disposals ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_returns_disposals_store ON returns_disposals(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_check_status') THEN
    ALTER TABLE haccp_check_status ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_haccp_check_status_store ON haccp_check_status(store_id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_reminders') THEN
    ALTER TABLE haccp_reminders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_haccp_reminders_store ON haccp_reminders(store_id);
  END IF;
END $$;

-- ============================================
-- 코멘트 추가
-- ============================================
COMMENT ON COLUMN ccp_definitions.store_id IS '공장/매장 ID';
COMMENT ON COLUMN ccp_records.store_id IS '공장/매장 ID';
COMMENT ON COLUMN production_records.store_id IS '공장/매장 ID';
COMMENT ON COLUMN daily_hygiene_checks.store_id IS '공장/매장 ID';
COMMENT ON COLUMN iot_sensors.store_id IS '공장/매장 ID';

-- ============================================
-- 사용자 테이블에 현재 선택된 매장 추가
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
COMMENT ON COLUMN users.current_store_id IS '현재 선택된 매장/공장 (HACCP 앱용)';
