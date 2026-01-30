-- ============================================
-- Company Equipment Settings Table - Schema Update
-- 기존 테이블에 누락된 컬럼 추가
-- ============================================

-- 테이블이 없으면 생성 (sensor_id FK 제거 - iot_sensors 없을 수 있음)
CREATE TABLE IF NOT EXISTS company_equipment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  target_temp DECIMAL(5,2) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  location TEXT,
  sensor_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- unique constraint 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_equipment_settings_company_id_key_key'
  ) THEN
    ALTER TABLE company_equipment_settings ADD CONSTRAINT company_equipment_settings_company_id_key_key UNIQUE(company_id, key);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_company_equipment_settings_company_id ON company_equipment_settings(company_id);

-- RLS
ALTER TABLE company_equipment_settings ENABLE ROW LEVEL SECURITY;

-- 정책 (이미 있으면 삭제 후 재생성)
DROP POLICY IF EXISTS company_equipment_settings_select ON company_equipment_settings;
DROP POLICY IF EXISTS company_equipment_settings_insert ON company_equipment_settings;
DROP POLICY IF EXISTS company_equipment_settings_update ON company_equipment_settings;
DROP POLICY IF EXISTS company_equipment_settings_delete ON company_equipment_settings;

CREATE POLICY company_equipment_settings_select ON company_equipment_settings
  FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY company_equipment_settings_insert ON company_equipment_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY company_equipment_settings_update ON company_equipment_settings
  FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY company_equipment_settings_delete ON company_equipment_settings
  FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

-- 트리거
DROP TRIGGER IF EXISTS update_company_equipment_settings_updated_at ON company_equipment_settings;
CREATE OR REPLACE FUNCTION update_company_equipment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_equipment_settings_updated_at
  BEFORE UPDATE ON company_equipment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_equipment_settings_updated_at();

SELECT 'Company equipment settings table updated successfully!' as result;
