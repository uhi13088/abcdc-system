-- ============================================
-- 누락된 HACCP 테이블 생성
-- haccp_zones, haccp_zones_template 등
-- ============================================

-- ============================================
-- 1. HACCP 구역 템플릿 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_zones_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_code VARCHAR(50) NOT NULL UNIQUE,
  zone_name VARCHAR(100) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL CHECK (zone_grade IN ('청결구역', '일반구역')),
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 구역 템플릿 데이터 삽입
INSERT INTO haccp_zones_template (zone_code, zone_name, zone_grade, sort_order) VALUES
  ('mixing_room', '배합실', '청결구역', 1),
  ('inner_packaging', '내포장실', '청결구역', 2),
  ('outer_packaging', '외포장실', '일반구역', 3),
  ('warehouse', '창고', '일반구역', 4),
  ('raw_material', '원료보관실', '일반구역', 5),
  ('freezer', '냉동창고', '일반구역', 6),
  ('refrigerator', '냉장창고', '일반구역', 7),
  ('entrance', '입구/출입구', '일반구역', 8)
ON CONFLICT (zone_code) DO NOTHING;

-- ============================================
-- 2. HACCP 구역 테이블 (회사별)
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  zone_code VARCHAR(50) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL CHECK (zone_grade IN ('청결구역', '일반구역')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, zone_code)
);

CREATE INDEX IF NOT EXISTS idx_haccp_zones_company ON haccp_zones(company_id);

-- RLS 정책
ALTER TABLE haccp_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS haccp_zones_policy ON haccp_zones FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 3. 시즌 설정 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_season_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  winter_start_month INTEGER NOT NULL DEFAULT 11,
  winter_end_month INTEGER NOT NULL DEFAULT 3,
  summer_start_month INTEGER NOT NULL DEFAULT 4,
  summer_end_month INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_haccp_season_settings_company ON haccp_season_settings(company_id);

ALTER TABLE haccp_season_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS haccp_season_settings_policy ON haccp_season_settings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 4. haccp_company_settings 누락 컬럼 추가
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_company_settings') THEN
    -- 알림 관련 컬럼
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS ccp_alert_enabled BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS ccp_deviation_notification BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS daily_report_enabled BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS daily_report_time TIME DEFAULT '18:00';
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS inspection_reminder BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS inspection_reminder_hours INTEGER DEFAULT 2;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS training_reminder BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255);

    -- 운영 관련 컬럼
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS auto_logout_minutes INTEGER DEFAULT 30;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS require_photo_evidence BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS allow_late_entry BOOLEAN DEFAULT false;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS late_entry_hours INTEGER DEFAULT 24;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS require_corrective_action BOOLEAN DEFAULT true;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS ccp_monitoring_interval INTEGER DEFAULT 60;
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS temperature_unit VARCHAR(20) DEFAULT 'celsius';
    ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS record_retention_years INTEGER DEFAULT 3;
  END IF;
END $$;

-- Done
SELECT 'Missing HACCP tables created successfully!' as result;
