-- ============================================
-- Production DB Patch: store_id 컬럼 추가
-- 이 파일은 Supabase 프로덕션 DB에서 직접 실행하세요
-- Created: 2026-01-31
-- ============================================

-- ============================================
-- STEP 1: haccp_company_settings 테이블 수정
-- ============================================

-- 1-1. store_id 컬럼 추가
ALTER TABLE haccp_company_settings
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- 1-2. 기존 UNIQUE 제약조건 삭제 (여러 가능한 이름으로 시도)
ALTER TABLE haccp_company_settings DROP CONSTRAINT IF EXISTS haccp_company_settings_company_id_key;
ALTER TABLE haccp_company_settings DROP CONSTRAINT IF EXISTS haccp_company_settings_company_id_unique;
ALTER TABLE haccp_company_settings DROP CONSTRAINT IF EXISTS haccp_company_settings_pkey_company;

-- 1-3. 새 UNIQUE 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'haccp_company_settings_company_store_unique'
  ) THEN
    ALTER TABLE haccp_company_settings
    ADD CONSTRAINT haccp_company_settings_company_store_unique UNIQUE (company_id, store_id);
  END IF;
END $$;

-- 1-4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_haccp_company_settings_store ON haccp_company_settings(store_id);

-- ============================================
-- STEP 2: haccp_zones 테이블 수정
-- ============================================

-- 2-1. store_id 컬럼 추가
ALTER TABLE haccp_zones
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- 2-2. 기존 UNIQUE 제약조건 삭제
ALTER TABLE haccp_zones DROP CONSTRAINT IF EXISTS haccp_zones_company_id_zone_code_key;
ALTER TABLE haccp_zones DROP CONSTRAINT IF EXISTS haccp_zones_company_zone_unique;

-- 2-3. 새 UNIQUE 제약조건 추가 (store_id 포함)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'haccp_zones_company_store_zone_unique'
  ) THEN
    ALTER TABLE haccp_zones
    ADD CONSTRAINT haccp_zones_company_store_zone_unique UNIQUE (company_id, store_id, zone_code);
  END IF;
END $$;

-- 2-4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_haccp_zones_store ON haccp_zones(store_id);

-- ============================================
-- STEP 3: notification_settings 테이블 수정
-- ============================================

-- 3-1. 필요한 컬럼들 추가
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- user-level 알림 설정 컬럼들
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS attendance_alerts BOOLEAN DEFAULT true;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS approval_alerts BOOLEAN DEFAULT true;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS salary_alerts BOOLEAN DEFAULT true;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS schedule_alerts BOOLEAN DEFAULT true;

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS haccp_alerts BOOLEAN DEFAULT true;

-- 3-2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_notification_settings_store ON notification_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_category ON notification_settings(category);

-- ============================================
-- STEP 4: 기타 HACCP 테이블들 store_id 추가
-- ============================================

-- ccp_definitions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ccp_definitions') THEN
    ALTER TABLE ccp_definitions
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_ccp_definitions_store ON ccp_definitions(store_id);
  END IF;
END $$;

-- ccp_records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ccp_records') THEN
    ALTER TABLE ccp_records
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_ccp_records_store ON ccp_records(store_id);
  END IF;
END $$;

-- daily_hygiene_checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_hygiene_checks') THEN
    ALTER TABLE daily_hygiene_checks
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_daily_hygiene_checks_store ON daily_hygiene_checks(store_id);
  END IF;
END $$;

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
-- 완료!
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '프로덕션 패치 완료: store_id 컬럼 추가됨';
END $$;

SELECT 'Production patch completed successfully!' as status;
