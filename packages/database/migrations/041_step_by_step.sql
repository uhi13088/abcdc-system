-- ============================================
-- STEP 1: 기존 테이블에 store_id 컬럼 추가
-- 이 섹션을 먼저 실행하세요
-- ============================================

-- haccp_company_settings
ALTER TABLE haccp_company_settings
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- notification_settings
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS settings JSONB;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS created_by UUID;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS updated_by UUID;

-- user_id 컬럼이 없을 수 있으므로 먼저 추가 (Supabase 마이그레이션과의 호환성)
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS user_id UUID;

-- ccp_definitions (이미 있을 수 있음)
ALTER TABLE ccp_definitions
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- ccp_records (이미 있을 수 있음)
ALTER TABLE ccp_records
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- daily_hygiene_checks (이미 있을 수 있음)
ALTER TABLE daily_hygiene_checks
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- haccp_zones (기존 테이블에 store_id 컬럼 추가)
ALTER TABLE haccp_zones
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- ============================================
-- STEP 2: 인덱스 추가
-- ============================================

CREATE INDEX IF NOT EXISTS idx_haccp_company_settings_store ON haccp_company_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_store ON notification_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_category ON notification_settings(category);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_ccp_definitions_store ON ccp_definitions(store_id);
CREATE INDEX IF NOT EXISTS idx_ccp_records_store ON ccp_records(store_id);
CREATE INDEX IF NOT EXISTS idx_daily_hygiene_checks_store ON daily_hygiene_checks(store_id);

-- ============================================
-- STEP 3: company_equipment_settings 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS company_equipment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  equipment_name VARCHAR(100) NOT NULL,
  equipment_type VARCHAR(50) NOT NULL,
  location VARCHAR(255),
  min_temp DECIMAL(5,2),
  max_temp DECIMAL(5,2),
  target_temp DECIMAL(5,2),
  temp_unit VARCHAR(10) DEFAULT 'celsius',
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold_minutes INTEGER DEFAULT 30,
  ccp_definition_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_equipment_settings_company ON company_equipment_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_settings_store ON company_equipment_settings(store_id);

-- ============================================
-- STEP 4: haccp_zones 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS haccp_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  zone_code VARCHAR(20) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  zone_type VARCHAR(50),
  description TEXT,
  required_temp_min DECIMAL(5,2),
  required_temp_max DECIMAL(5,2),
  humidity_min DECIMAL(5,2),
  humidity_max DECIMAL(5,2),
  inspection_frequency VARCHAR(20) DEFAULT 'daily',
  responsible_role VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_haccp_zones_company ON haccp_zones(company_id);
CREATE INDEX IF NOT EXISTS idx_haccp_zones_store ON haccp_zones(store_id);

-- ============================================
-- STEP 5: stores 테이블에 HACCP 인증 정보 추가
-- ============================================

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_certification_number VARCHAR(50);

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_certification_date DATE;

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_certification_expiry DATE;

-- ============================================
-- STEP 6: RLS 정책 (company_equipment_settings)
-- ============================================

ALTER TABLE company_equipment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_settings_select ON company_equipment_settings;
CREATE POLICY equipment_settings_select ON company_equipment_settings
  FOR SELECT USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS equipment_settings_insert ON company_equipment_settings;
CREATE POLICY equipment_settings_insert ON company_equipment_settings
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS equipment_settings_update ON company_equipment_settings;
CREATE POLICY equipment_settings_update ON company_equipment_settings
  FOR UPDATE USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS equipment_settings_delete ON company_equipment_settings;
CREATE POLICY equipment_settings_delete ON company_equipment_settings
  FOR DELETE USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

-- ============================================
-- STEP 7: RLS 정책 (haccp_zones)
-- ============================================

ALTER TABLE haccp_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS haccp_zones_select ON haccp_zones;
CREATE POLICY haccp_zones_select ON haccp_zones
  FOR SELECT USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS haccp_zones_insert ON haccp_zones;
CREATE POLICY haccp_zones_insert ON haccp_zones
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS haccp_zones_update ON haccp_zones;
CREATE POLICY haccp_zones_update ON haccp_zones
  FOR UPDATE USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS haccp_zones_delete ON haccp_zones;
CREATE POLICY haccp_zones_delete ON haccp_zones
  FOR DELETE USING (company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()));

-- ============================================
-- 완료!
-- ============================================
SELECT 'Migration completed successfully!' as status;
