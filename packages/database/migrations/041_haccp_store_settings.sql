-- Migration: 041_haccp_store_settings
-- Description: Add store_id support for HACCP settings (매장별 설정 분리)
-- Created: 2026-01-31

-- =====================================================
-- 1. haccp_company_settings 테이블에 store_id 추가
-- =====================================================

-- store_id 컬럼 추가
ALTER TABLE haccp_company_settings
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- 기존 UNIQUE 제약조건 제거 (company_id만 있던 것)
ALTER TABLE haccp_company_settings
DROP CONSTRAINT IF EXISTS haccp_company_settings_company_id_key;

-- 새 UNIQUE 제약조건 추가 (company_id + store_id) - 이미 존재하면 스킵
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'haccp_company_settings_company_store_unique'
  ) THEN
    ALTER TABLE haccp_company_settings
    ADD CONSTRAINT haccp_company_settings_company_store_unique UNIQUE (company_id, store_id);
  END IF;
END $$;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_haccp_company_settings_store ON haccp_company_settings(store_id);

-- =====================================================
-- 2. company_equipment_settings 테이블 생성 (장비 온도 설정)
-- =====================================================

CREATE TABLE IF NOT EXISTS company_equipment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  -- 장비 정보
  equipment_name VARCHAR(100) NOT NULL,
  equipment_type VARCHAR(50) NOT NULL, -- 'refrigerator', 'freezer', 'water_heater', etc.
  location VARCHAR(255),

  -- 온도 한계 설정
  min_temp DECIMAL(5,2),
  max_temp DECIMAL(5,2),
  target_temp DECIMAL(5,2),
  temp_unit VARCHAR(10) DEFAULT 'celsius',

  -- 알림 설정
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold_minutes INTEGER DEFAULT 30,

  -- CCP 연결
  ccp_definition_id UUID REFERENCES ccp_definitions(id),

  -- 상태
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_equipment_settings_company ON company_equipment_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_settings_store ON company_equipment_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_equipment_settings_type ON company_equipment_settings(equipment_type);

-- RLS 활성화
ALTER TABLE company_equipment_settings ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY equipment_settings_select ON company_equipment_settings
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY equipment_settings_insert ON company_equipment_settings
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY equipment_settings_update ON company_equipment_settings
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY equipment_settings_delete ON company_equipment_settings
  FOR DELETE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin')
  );

-- =====================================================
-- 3. notification_settings 테이블 수정 (HACCP 매장별 알림 설정)
-- =====================================================

-- 기존 테이블이 user_id 기반이므로 HACCP용 컬럼 추가
-- store_id 추가
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- category 컬럼 추가 (ccp_verification, temperature_alert, etc.)
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- settings JSONB 컬럼 추가 (유연한 설정 저장)
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS settings JSONB;

-- created_by, updated_by 컬럼 추가
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- user_id를 nullable로 변경 (매장별 설정은 user_id 없이 사용)
ALTER TABLE notification_settings
ALTER COLUMN user_id DROP NOT NULL;

-- 기존 UNIQUE 제약조건 제거
ALTER TABLE notification_settings
DROP CONSTRAINT IF EXISTS notification_settings_user_id_key;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_notification_settings_store ON notification_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_category ON notification_settings(category);

-- =====================================================
-- 4. haccp_zones 테이블 생성 (구역 설정)
-- =====================================================

CREATE TABLE IF NOT EXISTS haccp_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,

  -- 구역 정보
  zone_code VARCHAR(20) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  zone_type VARCHAR(50), -- 'production', 'storage', 'packaging', 'shipping', etc.
  description TEXT,

  -- 온도 요구사항
  required_temp_min DECIMAL(5,2),
  required_temp_max DECIMAL(5,2),
  humidity_min DECIMAL(5,2),
  humidity_max DECIMAL(5,2),

  -- 점검 설정
  inspection_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  responsible_role VARCHAR(50),

  -- 상태
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- 같은 매장 내 구역 코드 중복 방지
  UNIQUE(company_id, store_id, zone_code)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_haccp_zones_company ON haccp_zones(company_id);
CREATE INDEX IF NOT EXISTS idx_haccp_zones_store ON haccp_zones(store_id);
CREATE INDEX IF NOT EXISTS idx_haccp_zones_type ON haccp_zones(zone_type);

-- RLS 활성화
ALTER TABLE haccp_zones ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY haccp_zones_select ON haccp_zones
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY haccp_zones_insert ON haccp_zones
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY haccp_zones_update ON haccp_zones
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY haccp_zones_delete ON haccp_zones
  FOR DELETE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin')
  );

-- =====================================================
-- 5. ccp_definitions 테이블에 store_id 추가 (옵션)
-- =====================================================

ALTER TABLE ccp_definitions
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ccp_definitions_store ON ccp_definitions(store_id);

-- =====================================================
-- 6. stores 테이블에 HACCP 인증 정보 추가
-- =====================================================

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_certification_number VARCHAR(50);

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_certification_date DATE;

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_certification_expiry DATE;

COMMENT ON COLUMN stores.haccp_certification_number IS '매장별 HACCP 인증번호';
COMMENT ON COLUMN stores.haccp_certification_date IS '매장별 HACCP 인증일';
COMMENT ON COLUMN stores.haccp_certification_expiry IS '매장별 HACCP 인증 만료일';

-- =====================================================
-- 7. Triggers for updated_at
-- =====================================================

CREATE OR REPLACE TRIGGER trigger_update_equipment_settings_updated_at
BEFORE UPDATE ON company_equipment_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trigger_update_haccp_zones_updated_at
BEFORE UPDATE ON haccp_zones
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
