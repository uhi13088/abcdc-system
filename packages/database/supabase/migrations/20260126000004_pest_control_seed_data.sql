-- ============================================
-- 방충방서 관리기준 시드 데이터 (완전 독립 실행 가능)
-- 모든 필요한 테이블 생성 + 기본 데이터 적용
-- ============================================

-- ============================================
-- 0. 필요한 테이블들 모두 생성 (없으면)
-- ============================================

-- haccp_app_settings
CREATE TABLE IF NOT EXISTS haccp_app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, setting_key)
);

-- haccp_zones (회사별 구역)
CREATE TABLE IF NOT EXISTS haccp_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  zone_code VARCHAR(50) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL CHECK (zone_grade IN ('청결구역', '일반구역')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, zone_code)
);

-- pest_types (회사별 해충 종류)
CREATE TABLE IF NOT EXISTS pest_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  pest_category VARCHAR(20) NOT NULL CHECK (pest_category IN ('비래해충', '보행해충', '설치류')),
  pest_name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, pest_category, pest_name)
);

-- pest_control_standards (회사별 관리기준)
CREATE TABLE IF NOT EXISTS pest_control_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  season VARCHAR(20) NOT NULL CHECK (season IN ('동절기', '하절기')),
  zone_grade VARCHAR(20) NOT NULL CHECK (zone_grade IN ('청결구역', '일반구역')),
  pest_category VARCHAR(20) NOT NULL CHECK (pest_category IN ('비래해충', '보행해충', '설치류')),
  level INTEGER NOT NULL CHECK (level IN (1, 2)),
  upper_limit INTEGER NOT NULL,
  lower_limit INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, season, zone_grade, pest_category, level)
);

-- 템플릿 테이블들
CREATE TABLE IF NOT EXISTS haccp_zones_template (
  id SERIAL PRIMARY KEY,
  zone_code VARCHAR(50) NOT NULL UNIQUE,
  zone_name VARCHAR(100) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pest_types_template (
  id SERIAL PRIMARY KEY,
  pest_category VARCHAR(20) NOT NULL,
  pest_name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(pest_category, pest_name)
);

CREATE TABLE IF NOT EXISTS pest_control_standards_template (
  id SERIAL PRIMARY KEY,
  season VARCHAR(20) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL,
  pest_category VARCHAR(20) NOT NULL,
  level INTEGER NOT NULL,
  upper_limit INTEGER NOT NULL,
  UNIQUE(season, zone_grade, pest_category, level)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_haccp_app_settings_company ON haccp_app_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_haccp_zones_company ON haccp_zones(company_id);
CREATE INDEX IF NOT EXISTS idx_pest_types_company ON pest_types(company_id);
CREATE INDEX IF NOT EXISTS idx_pest_control_standards_company ON pest_control_standards(company_id);

-- RLS
ALTER TABLE haccp_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_control_standards ENABLE ROW LEVEL SECURITY;

-- RLS Policies (이미 있으면 스킵)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'haccp_app_settings_policy') THEN
    CREATE POLICY haccp_app_settings_policy ON haccp_app_settings FOR ALL USING (
      company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'haccp_zones_policy') THEN
    CREATE POLICY haccp_zones_policy ON haccp_zones FOR ALL USING (
      company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pest_types_policy') THEN
    CREATE POLICY pest_types_policy ON pest_types FOR ALL USING (
      company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pest_control_standards_policy') THEN
    CREATE POLICY pest_control_standards_policy ON pest_control_standards FOR ALL USING (
      company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
  END IF;
END $$;

-- ============================================
-- 1. 템플릿 테이블 데이터
-- ============================================
DELETE FROM haccp_zones_template;
DELETE FROM pest_types_template;
DELETE FROM pest_control_standards_template;

-- 구역 템플릿
INSERT INTO haccp_zones_template (zone_code, zone_name, zone_grade, sort_order) VALUES
  ('changing_room', '탈의실', '일반구역', 1),
  ('sanitary_room', '위생전실', '일반구역', 2),
  ('mixing_room', '배합실', '일반구역', 3),
  ('heating_room', '가열실', '일반구역', 4),
  ('inner_packaging', '내포장실', '일반구역', 5),
  ('outer_packaging', '외포장실', '일반구역', 6),
  ('storage_room', '실온창고', '일반구역', 7),
  ('shipping_room', '입출고실', '일반구역', 8),
  ('entrance', '외곽출입구', '일반구역', 9);

-- 해충 종류 템플릿
INSERT INTO pest_types_template (pest_category, pest_name, sort_order) VALUES
  ('비래해충', '파리', 1),
  ('비래해충', '모기', 2),
  ('비래해충', '나방', 3),
  ('비래해충', '초파리', 4),
  ('비래해충', '날파리', 5),
  ('비래해충', '기타', 6),
  ('보행해충', '바퀴벌레', 1),
  ('보행해충', '거미', 2),
  ('보행해충', '개미', 3),
  ('보행해충', '집게벌레', 4),
  ('보행해충', '기타', 5),
  ('설치류', '쥐', 1),
  ('설치류', '기타', 2);

-- 관리기준 템플릿
INSERT INTO pest_control_standards_template (season, zone_grade, pest_category, level, upper_limit) VALUES
  ('동절기', '청결구역', '비래해충', 1, 2),
  ('동절기', '청결구역', '비래해충', 2, 4),
  ('동절기', '청결구역', '보행해충', 1, 1),
  ('동절기', '청결구역', '보행해충', 2, 3),
  ('동절기', '청결구역', '설치류', 1, 0),
  ('동절기', '청결구역', '설치류', 2, 2),
  ('동절기', '일반구역', '비래해충', 1, 3),
  ('동절기', '일반구역', '비래해충', 2, 10),
  ('동절기', '일반구역', '보행해충', 1, 1),
  ('동절기', '일반구역', '보행해충', 2, 5),
  ('동절기', '일반구역', '설치류', 1, 0),
  ('동절기', '일반구역', '설치류', 2, 2),
  ('하절기', '청결구역', '비래해충', 1, 3),
  ('하절기', '청결구역', '비래해충', 2, 10),
  ('하절기', '청결구역', '보행해충', 1, 1),
  ('하절기', '청결구역', '보행해충', 2, 3),
  ('하절기', '청결구역', '설치류', 1, 0),
  ('하절기', '청결구역', '설치류', 2, 2),
  ('하절기', '일반구역', '비래해충', 1, 5),
  ('하절기', '일반구역', '비래해충', 2, 15),
  ('하절기', '일반구역', '보행해충', 1, 2),
  ('하절기', '일반구역', '보행해충', 2, 10),
  ('하절기', '일반구역', '설치류', 1, 0),
  ('하절기', '일반구역', '설치류', 2, 2);

-- ============================================
-- 2. 회사별 기본 데이터 시드 함수
-- ============================================
CREATE OR REPLACE FUNCTION seed_pest_control_defaults(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- 구역 데이터
  INSERT INTO haccp_zones (company_id, zone_code, zone_name, zone_grade, sort_order, is_active)
  SELECT p_company_id, zone_code, zone_name, zone_grade, sort_order, true
  FROM haccp_zones_template
  ON CONFLICT (company_id, zone_code) DO NOTHING;

  -- 해충 종류
  INSERT INTO pest_types (company_id, pest_category, pest_name, sort_order, is_active)
  SELECT p_company_id, pest_category, pest_name, sort_order, true
  FROM pest_types_template
  ON CONFLICT (company_id, pest_category, pest_name) DO NOTHING;

  -- 관리기준
  INSERT INTO pest_control_standards (company_id, season, zone_grade, pest_category, level, upper_limit, lower_limit)
  SELECT p_company_id, season, zone_grade, pest_category, level, upper_limit, 0
  FROM pest_control_standards_template
  ON CONFLICT (company_id, season, zone_grade, pest_category, level) DO NOTHING;

  -- 시즌 설정
  INSERT INTO haccp_app_settings (company_id, setting_key, setting_value, description)
  VALUES (p_company_id, 'season_config',
    '{"동절기": {"start_month": 11, "end_month": 3}, "하절기": {"start_month": 4, "end_month": 10}}'::jsonb,
    '방충방서 관리 시즌 설정')
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  -- 구역등급 매핑
  INSERT INTO haccp_app_settings (company_id, setting_key, setting_value, description)
  VALUES (p_company_id, 'zone_grades',
    '{"탈의실":"일반구역","위생전실":"일반구역","배합실":"일반구역","가열실":"일반구역","내포장실":"일반구역","외포장실":"일반구역","실온창고":"일반구역","입출고실":"일반구역","외곽출입구":"일반구역"}'::jsonb,
    '구역별 등급 매핑')
  ON CONFLICT (company_id, setting_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. 모든 회사에 기본 데이터 적용
-- ============================================
DO $$
DECLARE
  company_rec RECORD;
BEGIN
  FOR company_rec IN SELECT id FROM companies
  LOOP
    PERFORM seed_pest_control_defaults(company_rec.id);
  END LOOP;
END $$;

-- ============================================
-- 4. 트리거 (새 회사/HACCP 활성화 시 자동 시드)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_seed_pest_control_on_company_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_pest_control_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_pest_control_on_company ON companies;
CREATE TRIGGER trg_seed_pest_control_on_company
  AFTER INSERT ON companies FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_pest_control_on_company_insert();

CREATE OR REPLACE FUNCTION trigger_seed_pest_control_on_haccp_enabled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.haccp_addon_enabled = true AND (OLD.haccp_addon_enabled IS NULL OR OLD.haccp_addon_enabled = false) THEN
    PERFORM seed_pest_control_defaults(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_pest_control_on_haccp ON company_subscriptions;
CREATE TRIGGER trg_seed_pest_control_on_haccp
  AFTER INSERT OR UPDATE ON company_subscriptions FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_pest_control_on_haccp_enabled();

SELECT 'Pest control seed data applied successfully!' as result;
