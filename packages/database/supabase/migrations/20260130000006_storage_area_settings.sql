-- ============================================
-- 보관창고 구역 설정 테이블 (Storage Area Settings)
-- 기존 테이블에 누락된 컬럼 추가
-- ============================================

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS storage_area_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  area_name VARCHAR(100) NOT NULL,
  storage_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 누락된 컬럼들 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'area_code') THEN
    ALTER TABLE storage_area_settings ADD COLUMN area_code VARCHAR(50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'description') THEN
    ALTER TABLE storage_area_settings ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'temperature_min') THEN
    ALTER TABLE storage_area_settings ADD COLUMN temperature_min DECIMAL(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'temperature_max') THEN
    ALTER TABLE storage_area_settings ADD COLUMN temperature_max DECIMAL(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'temperature_unit') THEN
    ALTER TABLE storage_area_settings ADD COLUMN temperature_unit VARCHAR(10) DEFAULT 'C';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'humidity_min') THEN
    ALTER TABLE storage_area_settings ADD COLUMN humidity_min DECIMAL(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'humidity_max') THEN
    ALTER TABLE storage_area_settings ADD COLUMN humidity_max DECIMAL(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'iot_sensor_id') THEN
    ALTER TABLE storage_area_settings ADD COLUMN iot_sensor_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'iot_enabled') THEN
    ALTER TABLE storage_area_settings ADD COLUMN iot_enabled BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'inspection_frequency') THEN
    ALTER TABLE storage_area_settings ADD COLUMN inspection_frequency VARCHAR(20) DEFAULT 'DAILY';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'is_active') THEN
    ALTER TABLE storage_area_settings ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_area_settings' AND column_name = 'sort_order') THEN
    ALTER TABLE storage_area_settings ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- unique constraint 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'storage_area_settings_company_id_area_name_key'
  ) THEN
    ALTER TABLE storage_area_settings ADD CONSTRAINT storage_area_settings_company_id_area_name_key UNIQUE(company_id, area_name);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_storage_area_settings_company ON storage_area_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_storage_area_settings_active ON storage_area_settings(company_id, is_active);

-- RLS
ALTER TABLE storage_area_settings ENABLE ROW LEVEL SECURITY;

-- 정책 (이미 있으면 삭제 후 재생성)
DROP POLICY IF EXISTS storage_area_settings_policy ON storage_area_settings;
CREATE POLICY storage_area_settings_policy ON storage_area_settings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- storage_inspections 테이블에 storage_area_setting_id 컬럼 추가 (테이블 존재 시에만)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_inspections') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_inspections' AND column_name = 'storage_area_setting_id') THEN
      ALTER TABLE storage_inspections ADD COLUMN storage_area_setting_id UUID;
    END IF;
  END IF;
END $$;

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

SELECT 'Storage area settings table updated successfully!' as result;
