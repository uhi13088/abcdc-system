-- ============================================
-- 보관창고 구역 설정 테이블 (Storage Area Settings)
-- 점검 구역별 사전 설정 (온습도 기준값, IoT 센서 연동 등)
-- ============================================

CREATE TABLE IF NOT EXISTS storage_area_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 구역 정보
  area_name VARCHAR(100) NOT NULL,
  area_code VARCHAR(50),
  storage_type VARCHAR(50) NOT NULL CHECK (storage_type IN ('REFRIGERATOR', 'FREEZER', 'DRY_STORAGE', 'CHEMICAL_STORAGE', 'PACKAGING_STORAGE', 'OTHER')),
  description TEXT,

  -- 온도 기준값
  temperature_min DECIMAL(5,2),
  temperature_max DECIMAL(5,2),
  temperature_unit VARCHAR(10) DEFAULT 'C',

  -- 습도 기준값
  humidity_min DECIMAL(5,2),
  humidity_max DECIMAL(5,2),

  -- IoT 센서 연동 (나중에 equipment_sensors 테이블 생성 시 FK 추가 가능)
  iot_sensor_id UUID,
  iot_enabled BOOLEAN DEFAULT false,

  -- 점검 주기
  inspection_frequency VARCHAR(20) DEFAULT 'DAILY' CHECK (inspection_frequency IN ('HOURLY', 'TWICE_DAILY', 'DAILY', 'WEEKLY')),

  -- 상태
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, area_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_storage_area_settings_company ON storage_area_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_storage_area_settings_active ON storage_area_settings(company_id, is_active);

-- RLS 정책
ALTER TABLE storage_area_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY storage_area_settings_policy ON storage_area_settings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- storage_inspections 테이블에 storage_area_setting_id 컬럼 추가
ALTER TABLE storage_inspections ADD COLUMN IF NOT EXISTS storage_area_setting_id UUID REFERENCES storage_area_settings(id) ON DELETE SET NULL;

-- 코멘트
COMMENT ON TABLE storage_area_settings IS '보관창고 구역별 점검 설정';
COMMENT ON COLUMN storage_area_settings.storage_type IS '창고 유형: REFRIGERATOR(냉장), FREEZER(냉동), DRY_STORAGE(상온), CHEMICAL_STORAGE(화학물질), PACKAGING_STORAGE(포장재), OTHER(기타)';
COMMENT ON COLUMN storage_area_settings.iot_sensor_id IS '연동된 IoT 온습도 센서 ID (향후 equipment_sensors 테이블 연동)';
COMMENT ON COLUMN storage_area_settings.inspection_frequency IS '점검 주기: HOURLY, TWICE_DAILY, DAILY, WEEKLY';

-- 기본 데이터 시드 함수
CREATE OR REPLACE FUNCTION seed_storage_area_settings_for_company(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO storage_area_settings (company_id, area_name, area_code, storage_type, temperature_min, temperature_max, humidity_min, humidity_max, description, sort_order)
  VALUES
    (p_company_id, '냉장고-1', 'REF-01', 'REFRIGERATOR', 0, 10, 50, 70, '주원재료 보관', 1),
    (p_company_id, '냉장고-2', 'REF-02', 'REFRIGERATOR', 0, 10, 50, 70, '부재료 보관', 2),
    (p_company_id, '냉동고-1', 'FRZ-01', 'FREEZER', -25, -18, NULL, NULL, '냉동 원료 보관', 3),
    (p_company_id, '상온창고-1', 'DRY-01', 'DRY_STORAGE', 10, 25, 40, 70, '상온 보관 원료', 4),
    (p_company_id, '포장재창고', 'PKG-01', 'PACKAGING_STORAGE', 10, 30, 30, 60, '포장재 보관', 5)
  ON CONFLICT (company_id, area_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Done
SELECT 'Storage area settings table created successfully!' as result;
