-- ============================================
-- HACCP 앱 전역 설정 및 방충방서 관리 테이블
-- 모든 설정은 DB에서 관리 (하드코딩 금지)
-- ============================================

-- ============================================
-- 1. 앱 전역 설정 테이블
-- ============================================
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

-- 기본 설정값 삽입을 위한 함수
-- 회사가 생성될 때 기본 설정을 자동으로 생성하는 트리거용

-- ============================================
-- 2. 구역 마스터 테이블
-- ============================================
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

-- ============================================
-- 3. 해충 종류 마스터 테이블
-- ============================================
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

-- ============================================
-- 4. 방충방서 관리 기준 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS pest_control_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  season VARCHAR(20) NOT NULL CHECK (season IN ('동절기', '하절기')),
  zone_grade VARCHAR(20) NOT NULL CHECK (zone_grade IN ('청결구역', '일반구역')),
  pest_category VARCHAR(20) NOT NULL CHECK (pest_category IN ('비래해충', '보행해충', '설치류')),
  level INTEGER NOT NULL CHECK (level IN (1, 2)), -- 1단계, 2단계
  upper_limit INTEGER NOT NULL, -- 상한값
  lower_limit INTEGER DEFAULT 0, -- 하한값
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, season, zone_grade, pest_category, level)
);

-- ============================================
-- 5. 포획기 설치 위치 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS trap_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES haccp_zones(id) ON DELETE SET NULL,
  location_code VARCHAR(50) NOT NULL,
  location_name VARCHAR(100) NOT NULL,
  trap_type VARCHAR(50) NOT NULL, -- 페로몬트랩, 끈끈이트랩, 전격살충기, 쥐덫 등
  target_pest_category VARCHAR(20) CHECK (target_pest_category IN ('비래해충', '보행해충', '설치류')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, location_code)
);

-- ============================================
-- 6. 방충방서 점검 기록 테이블 (기존 테이블 확장)
-- ============================================
-- 기존 pest_control_checks 테이블에 컬럼 추가

ALTER TABLE pest_control_checks
  ADD COLUMN IF NOT EXISTS season VARCHAR(20),
  ADD COLUMN IF NOT EXISTS inspection_week INTEGER, -- 몇 주차
  ADD COLUMN IF NOT EXISTS pest_counts JSONB DEFAULT '{}'; -- 구역별, 해충별 포획수

-- pest_counts 구조:
-- {
--   "구역코드": {
--     "비래해충": {"파리": 2, "모기": 1},
--     "보행해충": {"바퀴벌레": 0},
--     "설치류": {"쥐": 0}
--   }
-- }

-- ============================================
-- 7. 방충방서 점검 상세 기록 테이블 (정규화)
-- ============================================
CREATE TABLE IF NOT EXISTS pest_control_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_id UUID NOT NULL REFERENCES pest_control_checks(id) ON DELETE CASCADE,
  trap_location_id UUID REFERENCES trap_locations(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES haccp_zones(id) ON DELETE SET NULL,
  pest_category VARCHAR(20) NOT NULL,
  pest_type VARCHAR(100),
  catch_count INTEGER DEFAULT 0,
  trap_condition VARCHAR(20) DEFAULT '양호' CHECK (trap_condition IN ('양호', '교체필요', '파손', '분실')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. 점검 결과 판정 기록 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS pest_control_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_id UUID NOT NULL REFERENCES pest_control_checks(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES haccp_zones(id),
  zone_grade VARCHAR(20) NOT NULL,
  pest_category VARCHAR(20) NOT NULL,
  total_count INTEGER NOT NULL,
  evaluation_level INTEGER, -- 1단계 초과, 2단계 초과, 정상(NULL)
  standard_id UUID REFERENCES pest_control_standards(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_haccp_app_settings_company ON haccp_app_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_haccp_zones_company ON haccp_zones(company_id);
CREATE INDEX IF NOT EXISTS idx_pest_types_company ON pest_types(company_id);
CREATE INDEX IF NOT EXISTS idx_pest_control_standards_company ON pest_control_standards(company_id);
CREATE INDEX IF NOT EXISTS idx_trap_locations_company ON trap_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_pest_control_details_check ON pest_control_details(check_id);
CREATE INDEX IF NOT EXISTS idx_pest_control_evaluations_check ON pest_control_evaluations(check_id);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE haccp_app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_control_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE trap_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_control_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_control_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY haccp_app_settings_policy ON haccp_app_settings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY haccp_zones_policy ON haccp_zones FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY pest_types_policy ON pest_types FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY pest_control_standards_policy ON pest_control_standards FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY trap_locations_policy ON trap_locations FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY pest_control_details_policy ON pest_control_details FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY pest_control_evaluations_policy ON pest_control_evaluations FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 기본 데이터 (템플릿용 - 회사 생성시 복사)
-- ============================================

-- 시즌 설정 기본값 (앱 설정에서 관리)
-- setting_key: 'season_config'
-- setting_value: {"동절기": {"start_month": 11, "end_month": 3}, "하절기": {"start_month": 4, "end_month": 10}}

-- 기본 구역 목록 템플릿 테이블
CREATE TABLE IF NOT EXISTS haccp_zones_template (
  id SERIAL PRIMARY KEY,
  zone_code VARCHAR(50) NOT NULL,
  zone_name VARCHAR(100) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO haccp_zones_template (zone_code, zone_name, zone_grade, sort_order) VALUES
('changing_room', '탈의실', '청결구역', 1),
('sanitary_room', '위생전실', '청결구역', 2),
('mixing_room', '배합실', '일반구역', 3),
('heating_room', '가열실', '일반구역', 4),
('inner_packaging', '내포장실', '청결구역', 5),
('outer_packaging', '외포장실', '일반구역', 6),
('storage_room', '실온창고', '일반구역', 7),
('shipping_room', '입출고실', '일반구역', 8),
('entrance', '외곽출입구', '일반구역', 9),
('kitchen', '부대시설', '일반구역', 10)
ON CONFLICT DO NOTHING;

-- 기본 해충 종류 템플릿
CREATE TABLE IF NOT EXISTS pest_types_template (
  id SERIAL PRIMARY KEY,
  pest_category VARCHAR(20) NOT NULL,
  pest_name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0
);

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
('설치류', '기타', 2)
ON CONFLICT DO NOTHING;

-- 기본 관리기준 템플릿
CREATE TABLE IF NOT EXISTS pest_control_standards_template (
  id SERIAL PRIMARY KEY,
  season VARCHAR(20) NOT NULL,
  zone_grade VARCHAR(20) NOT NULL,
  pest_category VARCHAR(20) NOT NULL,
  level INTEGER NOT NULL,
  upper_limit INTEGER NOT NULL
);

INSERT INTO pest_control_standards_template (season, zone_grade, pest_category, level, upper_limit) VALUES
-- 동절기 청결구역
('동절기', '청결구역', '비래해충', 1, 2),
('동절기', '청결구역', '비래해충', 2, 4),
('동절기', '청결구역', '보행해충', 1, 1),
('동절기', '청결구역', '보행해충', 2, 3),
('동절기', '청결구역', '설치류', 1, 0),
('동절기', '청결구역', '설치류', 2, 2),
-- 동절기 일반구역
('동절기', '일반구역', '비래해충', 1, 3),
('동절기', '일반구역', '비래해충', 2, 10),
('동절기', '일반구역', '보행해충', 1, 1),
('동절기', '일반구역', '보행해충', 2, 5),
('동절기', '일반구역', '설치류', 1, 0),
('동절기', '일반구역', '설치류', 2, 2),
-- 하절기 청결구역
('하절기', '청결구역', '비래해충', 1, 3),
('하절기', '청결구역', '비래해충', 2, 10),
('하절기', '청결구역', '보행해충', 1, 1),
('하절기', '청결구역', '보행해충', 2, 3),
('하절기', '청결구역', '설치류', 1, 0),
('하절기', '청결구역', '설치류', 2, 2),
-- 하절기 일반구역
('하절기', '일반구역', '비래해충', 1, 5),
('하절기', '일반구역', '비래해충', 2, 15),
('하절기', '일반구역', '보행해충', 1, 2),
('하절기', '일반구역', '보행해충', 2, 10),
('하절기', '일반구역', '설치류', 1, 0),
('하절기', '일반구역', '설치류', 2, 2)
ON CONFLICT DO NOTHING;

-- Done
SELECT 'Pest control settings tables created successfully!' as result;
