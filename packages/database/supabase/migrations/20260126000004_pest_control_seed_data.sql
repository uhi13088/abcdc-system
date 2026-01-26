-- ============================================
-- 방충방서 관리기준 시드 데이터
-- 모든 회사에 기본 데이터 자동 적용
-- ============================================

-- ============================================
-- 1. 템플릿 테이블 데이터 정리 및 업데이트
-- ============================================

-- 기존 템플릿 데이터 삭제 후 새로 입력
TRUNCATE TABLE haccp_zones_template RESTART IDENTITY CASCADE;
TRUNCATE TABLE pest_types_template RESTART IDENTITY CASCADE;
TRUNCATE TABLE pest_control_standards_template RESTART IDENTITY CASCADE;

-- 구역 템플릿 (스프레드시트 기준)
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

-- 해충 종류 템플릿 (스프레드시트 기준)
INSERT INTO pest_types_template (pest_category, pest_name, sort_order) VALUES
  -- 비래해충
  ('비래해충', '파리', 1),
  ('비래해충', '모기', 2),
  ('비래해충', '나방', 3),
  ('비래해충', '초파리', 4),
  ('비래해충', '날파리', 5),
  ('비래해충', '기타', 6),
  -- 보행해충
  ('보행해충', '바퀴벌레', 1),
  ('보행해충', '거미', 2),
  ('보행해충', '개미', 3),
  ('보행해충', '집게벌레', 4),
  ('보행해충', '기타', 5),
  -- 설치류
  ('설치류', '쥐', 1),
  ('설치류', '기타', 2);

-- 관리기준 템플릿 (스프레드시트 기준)
INSERT INTO pest_control_standards_template (season, zone_grade, pest_category, level, upper_limit) VALUES
  -- 동절기(11~3) 청결구역
  ('동절기', '청결구역', '비래해충', 1, 2),
  ('동절기', '청결구역', '비래해충', 2, 4),
  ('동절기', '청결구역', '보행해충', 1, 1),
  ('동절기', '청결구역', '보행해충', 2, 3),
  ('동절기', '청결구역', '설치류', 1, 0),
  ('동절기', '청결구역', '설치류', 2, 2),
  -- 동절기(11~3) 일반구역
  ('동절기', '일반구역', '비래해충', 1, 3),
  ('동절기', '일반구역', '비래해충', 2, 10),
  ('동절기', '일반구역', '보행해충', 1, 1),
  ('동절기', '일반구역', '보행해충', 2, 5),
  ('동절기', '일반구역', '설치류', 1, 0),
  ('동절기', '일반구역', '설치류', 2, 2),
  -- 하절기(4~10) 청결구역
  ('하절기', '청결구역', '비래해충', 1, 3),
  ('하절기', '청결구역', '비래해충', 2, 10),
  ('하절기', '청결구역', '보행해충', 1, 1),
  ('하절기', '청결구역', '보행해충', 2, 3),
  ('하절기', '청결구역', '설치류', 1, 0),
  ('하절기', '청결구역', '설치류', 2, 2),
  -- 하절기(4~10) 일반구역
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
  -- 1. 구역 데이터 시드 (이미 있는 경우 스킵)
  INSERT INTO haccp_zones (company_id, zone_code, zone_name, zone_grade, sort_order, is_active)
  SELECT p_company_id, zone_code, zone_name, zone_grade, sort_order, true
  FROM haccp_zones_template
  ON CONFLICT (company_id, zone_code) DO NOTHING;

  -- 2. 해충 종류 데이터 시드 (이미 있는 경우 스킵)
  INSERT INTO pest_types (company_id, pest_category, pest_name, sort_order, is_active)
  SELECT p_company_id, pest_category, pest_name, sort_order, true
  FROM pest_types_template
  ON CONFLICT (company_id, pest_category, pest_name) DO NOTHING;

  -- 3. 관리기준 데이터 시드 (이미 있는 경우 스킵)
  INSERT INTO pest_control_standards (company_id, season, zone_grade, pest_category, level, upper_limit, lower_limit)
  SELECT p_company_id, season, zone_grade, pest_category, level, upper_limit, 0
  FROM pest_control_standards_template
  ON CONFLICT (company_id, season, zone_grade, pest_category, level) DO NOTHING;

  -- 4. 시즌 설정 기본값 (haccp_app_settings)
  INSERT INTO haccp_app_settings (company_id, setting_key, setting_value, description)
  VALUES (
    p_company_id,
    'season_config',
    '{"동절기": {"start_month": 11, "end_month": 3}, "하절기": {"start_month": 4, "end_month": 10}}'::jsonb,
    '방충방서 관리 시즌 설정 (동절기: 11-3월, 하절기: 4-10월)'
  )
  ON CONFLICT (company_id, setting_key) DO NOTHING;

  -- 5. 구역등급 매핑 기본값
  INSERT INTO haccp_app_settings (company_id, setting_key, setting_value, description)
  VALUES (
    p_company_id,
    'zone_grades',
    '{
      "탈의실": "일반구역",
      "위생전실": "일반구역",
      "배합실": "일반구역",
      "가열실": "일반구역",
      "내포장실": "일반구역",
      "외포장실": "일반구역",
      "실온창고": "일반구역",
      "입출고실": "일반구역",
      "외곽출입구": "일반구역"
    }'::jsonb,
    '구역별 등급 매핑 (청결구역/일반구역)'
  )
  ON CONFLICT (company_id, setting_key) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. 기존 모든 회사에 기본 데이터 적용
-- ============================================
DO $$
DECLARE
  company_rec RECORD;
BEGIN
  -- HACCP 애드온이 활성화된 회사들에 대해 시드 데이터 적용
  FOR company_rec IN
    SELECT DISTINCT c.id
    FROM companies c
    LEFT JOIN company_subscriptions cs ON cs.company_id = c.id
    WHERE cs.haccp_addon_enabled = true
       OR EXISTS (SELECT 1 FROM stores s WHERE s.company_id = c.id AND s.haccp_enabled = true)
       OR EXISTS (SELECT 1 FROM users u WHERE u.company_id = c.id AND u.haccp_access = true)
  LOOP
    PERFORM seed_pest_control_defaults(company_rec.id);
    RAISE NOTICE 'Seeded pest control defaults for company: %', company_rec.id;
  END LOOP;

  -- 만약 위 조건에 해당하는 회사가 없으면 모든 회사에 적용
  IF NOT FOUND THEN
    FOR company_rec IN SELECT id FROM companies
    LOOP
      PERFORM seed_pest_control_defaults(company_rec.id);
      RAISE NOTICE 'Seeded pest control defaults for company: %', company_rec.id;
    END LOOP;
  END IF;
END $$;

-- ============================================
-- 4. 새 회사 생성 시 자동 시드 트리거
-- ============================================
CREATE OR REPLACE FUNCTION trigger_seed_pest_control_on_company_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 새 회사 생성 시 방충방서 기본 데이터 자동 시드
  PERFORM seed_pest_control_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제
DROP TRIGGER IF EXISTS trg_seed_pest_control_on_company ON companies;

-- 새 트리거 생성
CREATE TRIGGER trg_seed_pest_control_on_company
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_pest_control_on_company_insert();

-- ============================================
-- 5. HACCP 구독 활성화 시 시드 트리거
-- ============================================
CREATE OR REPLACE FUNCTION trigger_seed_pest_control_on_haccp_enabled()
RETURNS TRIGGER AS $$
BEGIN
  -- HACCP 애드온이 활성화되면 기본 데이터 시드
  IF NEW.haccp_addon_enabled = true AND (OLD.haccp_addon_enabled IS NULL OR OLD.haccp_addon_enabled = false) THEN
    PERFORM seed_pest_control_defaults(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제
DROP TRIGGER IF EXISTS trg_seed_pest_control_on_haccp ON company_subscriptions;

-- 새 트리거 생성
CREATE TRIGGER trg_seed_pest_control_on_haccp
  AFTER INSERT OR UPDATE ON company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_pest_control_on_haccp_enabled();

-- Done
SELECT 'Pest control seed data applied successfully!' as result;
