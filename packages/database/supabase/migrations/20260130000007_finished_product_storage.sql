-- 완제품 보관창고 테이블
-- 완제품 보관 위치 및 온습도 관리

-- 완제품 보관창고 위치 테이블
CREATE TABLE IF NOT EXISTS finished_product_storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  storage_type VARCHAR(20) NOT NULL DEFAULT 'cold', -- cold, frozen, room_temp, cool
  temp_min DECIMAL(5,2) DEFAULT 0,
  temp_max DECIMAL(5,2) DEFAULT 10,
  humidity_min DECIMAL(5,2) DEFAULT 0,
  humidity_max DECIMAL(5,2) DEFAULT 100,
  description TEXT,
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 완제품 보관창고 점검 기록 테이블
CREATE TABLE IF NOT EXISTS finished_product_storage_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  storage_id UUID NOT NULL REFERENCES finished_product_storage_locations(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL,
  inspection_time TIME NOT NULL,
  temperature DECIMAL(5,2) NOT NULL,
  humidity DECIMAL(5,2),
  temp_status VARCHAR(20) DEFAULT 'normal', -- normal, warning, critical
  humidity_status VARCHAR(20) DEFAULT 'normal', -- normal, warning, critical
  cleanliness_check BOOLEAN DEFAULT true,
  organization_check BOOLEAN DEFAULT true,
  pest_check BOOLEAN DEFAULT true,
  notes TEXT,
  inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  inspected_by_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_fp_storage_locations_company ON finished_product_storage_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_fp_storage_inspections_company ON finished_product_storage_inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_fp_storage_inspections_date ON finished_product_storage_inspections(inspection_date);
CREATE INDEX IF NOT EXISTS idx_fp_storage_inspections_storage ON finished_product_storage_inspections(storage_id);

-- RLS 활성화
ALTER TABLE finished_product_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_product_storage_inspections ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (서비스 역할용)
DO $$
BEGIN
  -- finished_product_storage_locations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fp_storage_locations_service_all' AND tablename = 'finished_product_storage_locations') THEN
    CREATE POLICY fp_storage_locations_service_all ON finished_product_storage_locations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- finished_product_storage_inspections
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fp_storage_inspections_service_all' AND tablename = 'finished_product_storage_inspections') THEN
    CREATE POLICY fp_storage_inspections_service_all ON finished_product_storage_inspections
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 코멘트
COMMENT ON TABLE finished_product_storage_locations IS '완제품 보관창고 위치';
COMMENT ON TABLE finished_product_storage_inspections IS '완제품 보관창고 점검 기록';
