-- ============================================
-- CCP 마스터 시드 데이터
-- 모든 회사에 기본 CCP 정의 자동 적용
-- ============================================

-- ============================================
-- 0-1. ccp_definitions 테이블의 ccp_number 컬럼 길이 확장
-- ============================================
ALTER TABLE ccp_definitions
  ALTER COLUMN ccp_number TYPE VARCHAR(50);

-- ============================================
-- 0-2. CCP 템플릿 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS ccp_definitions_template (
  id SERIAL PRIMARY KEY,
  ccp_code VARCHAR(50) NOT NULL UNIQUE,
  process_name VARCHAR(200) NOT NULL,
  lower_limit DECIMAL(10,2),
  upper_limit DECIMAL(10,2),
  unit VARCHAR(20) NOT NULL,
  monitoring_frequency VARCHAR(100),
  equipment_id VARCHAR(100),
  hazard TEXT,
  control_measure TEXT,
  corrective_action TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 1. CCP 템플릿 데이터 입력
-- ============================================
DELETE FROM ccp_definitions_template;

INSERT INTO ccp_definitions_template (ccp_code, process_name, lower_limit, upper_limit, unit, monitoring_frequency, sort_order) VALUES
  -- CCP-1B: 오븐(굽기) - 과자류
  ('CCP-1B-COOKIE-TEMP', '오븐(굽기)-과자-가열온도(°C)', 180, 210, '°C', '시작전/2시간마다/변경시/종료', 1),
  ('CCP-1B-COOKIE-TIME', '오븐(굽기)-과자-가열시간(분)', 50, 60, '분', '시작전/2시간마다/변경시/종료', 2),
  ('CCP-1B-COOKIE-CORE', '오븐(굽기)-과자-가열 후 품온(°C)', 80, 210, '°C', '시작전/2시간마다/변경시/종료', 3),

  -- CCP-1B: 오븐(굽기) - 빵류
  ('CCP-1B-BREAD-TEMP', '오븐(굽기)-빵류-가열온도(°C)', 145, 225, '°C', '시작전/2시간마다/변경시/종료', 4),
  ('CCP-1B-BREAD-TIME', '오븐(굽기)-빵류-가열시간(분)', 30, 60, '분', '시작전/2시간마다/변경시/종료', 5),
  ('CCP-1B-BREAD-CORE', '오븐(굽기)-빵류-가열 후 품온(°C)', 90, 200, '°C', '시작전/2시간마다/변경시/종료', 6),

  -- CCP-2B: 크림(휘핑)
  ('CCP-2B-CREAM-MASS', '크림(휘핑)-배합량(kg)', 0, 3.5, 'kg', '제조 직후', 7),
  ('CCP-2B-CREAM-TEMP-START', '크림(휘핑)-품온(제조직후)', -99, 15, '°C', '제조 직후', 8),
  ('CCP-2B-CREAM-TEMP-END', '크림(휘핑)-품온(소진직전)', -99, 15, '°C', '소진 직전', 9),
  ('CCP-2B-CREAM-USE-TIME', '크림(휘핑)-소진시간(분)', 34, 40, '분', '사용 중(필요시)', 10),
  ('CCP-2B-ENV-ROOM-TEMP', '크림(휘핑)-작업장-온도(°C)', 0, 23, '°C', '작업 중 상시', 11),

  -- CCP-3B: 시럽가열
  ('CCP-3B-SYRUP-TEMP', '시럽가열-가열온도(°C)', 85, 95, '°C', '매작업시', 12),
  ('CCP-3B-SYRUP-TIME', '시럽가열-가열시간(분)', 5, 62, '분', '매작업시', 13),
  ('CCP-3B-SYRUP-CORE', '시럽가열-가열 후 품온(°C)', 80, 999, '°C', '매작업시', 14),

  -- CCP-4B: 세척원료
  ('CCP-4B-WASH-RAWWT', '세척원료-원료량(g)', 0, 500, 'g', '매작업시', 15),
  ('CCP-4B-WASH-VOL', '세척원료-세척수량(ℓ)', 3, 9999, 'L', '매작업시', 16),
  ('CCP-4B-WASH-TIME', '세척원료-세척시간(분)', 5, 9999, '분', '매작업시', 17),

  -- CCP-5P: 금속검출
  ('CCP-5P-PIECE-FE20', '금속검출-테스트피스 Fe2.0mm 통과', 1, 1, 'Bool', '작업시작/2시간/변경/종료', 18),
  ('CCP-5P-PIECE-SUS25', '금속검출-테스트피스 SUS2.5mm 통과', 1, 1, 'Bool', '작업시작/2시간/변경/종료', 19),
  ('CCP-5P-PROD', '금속검출-제품 불검출', 1, 1, 'Bool', '상시', 20);

-- ============================================
-- 2. CCP 시드 함수
-- ============================================
CREATE OR REPLACE FUNCTION seed_ccp_defaults(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  tmpl RECORD;
  ccp_num VARCHAR(20);
  process_name_only VARCHAR(100);
BEGIN
  FOR tmpl IN SELECT * FROM ccp_definitions_template ORDER BY sort_order
  LOOP
    -- CCP 번호 추출 (예: CCP-1B-COOKIE-TEMP -> CCP-1B)
    ccp_num := SPLIT_PART(tmpl.ccp_code, '-', 1) || '-' || SPLIT_PART(tmpl.ccp_code, '-', 2);

    -- 공정명에서 첫 부분 추출 (예: 오븐(굽기)-과자-가열온도 -> 오븐(굽기))
    process_name_only := SPLIT_PART(tmpl.process_name, '-', 1);

    INSERT INTO ccp_definitions (
      company_id,
      ccp_number,
      process,
      hazard,
      control_measure,
      critical_limit,
      monitoring_method,
      monitoring_frequency,
      corrective_action,
      status
    ) VALUES (
      p_company_id,
      tmpl.ccp_code,
      process_name_only,
      CASE
        WHEN tmpl.ccp_code LIKE 'CCP-1B%' THEN '가열 불충분으로 인한 병원성 미생물 생존'
        WHEN tmpl.ccp_code LIKE 'CCP-2B%' THEN '냉장 온도 미준수로 인한 미생물 증식'
        WHEN tmpl.ccp_code LIKE 'CCP-3B%' THEN '가열 불충분으로 인한 병원성 미생물 생존'
        WHEN tmpl.ccp_code LIKE 'CCP-4B%' THEN '세척 불충분으로 인한 이물질 잔류'
        WHEN tmpl.ccp_code LIKE 'CCP-5P%' THEN '금속 이물질 혼입'
        ELSE '미지정'
      END,
      CASE
        WHEN tmpl.ccp_code LIKE 'CCP-1B%' THEN '가열온도/시간 관리'
        WHEN tmpl.ccp_code LIKE 'CCP-2B%' THEN '냉장 보관 및 사용시간 관리'
        WHEN tmpl.ccp_code LIKE 'CCP-3B%' THEN '가열온도/시간 관리'
        WHEN tmpl.ccp_code LIKE 'CCP-4B%' THEN '세척 조건 관리'
        WHEN tmpl.ccp_code LIKE 'CCP-5P%' THEN '금속검출기 작동 확인'
        ELSE '미지정'
      END,
      jsonb_build_object(
        'parameter', tmpl.process_name,
        'min', tmpl.lower_limit,
        'max', tmpl.upper_limit,
        'unit', tmpl.unit
      ),
      tmpl.process_name,
      tmpl.monitoring_frequency,
      CASE
        WHEN tmpl.ccp_code LIKE 'CCP-1B%' THEN '재가열 또는 폐기 처리'
        WHEN tmpl.ccp_code LIKE 'CCP-2B%' THEN '폐기 처리'
        WHEN tmpl.ccp_code LIKE 'CCP-3B%' THEN '재가열 또는 폐기 처리'
        WHEN tmpl.ccp_code LIKE 'CCP-4B%' THEN '재세척 실시'
        WHEN tmpl.ccp_code LIKE 'CCP-5P%' THEN '제품 격리 및 재검사, 장비 점검'
        ELSE '담당자 보고 후 조치'
      END,
      'ACTIVE'
    )
    ON CONFLICT (company_id, ccp_number) DO NOTHING;
  END LOOP;
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
    PERFORM seed_ccp_defaults(company_rec.id);
  END LOOP;
END $$;

-- ============================================
-- 4. 트리거 업데이트 (회사 생성 시 CCP도 시드)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_defaults_on_company_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 방충방서 기본 데이터
  PERFORM seed_pest_control_defaults(NEW.id);
  -- CCP 기본 데이터
  PERFORM seed_ccp_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_pest_control_on_company ON companies;
DROP TRIGGER IF EXISTS trg_seed_all_haccp_on_company ON companies;

CREATE TRIGGER trg_seed_all_haccp_on_company
  AFTER INSERT ON companies FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_all_haccp_defaults_on_company_insert();

-- HACCP 활성화 시에도 CCP 시드
CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_on_haccp_enabled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.haccp_addon_enabled = true AND (OLD.haccp_addon_enabled IS NULL OR OLD.haccp_addon_enabled = false) THEN
    PERFORM seed_pest_control_defaults(NEW.company_id);
    PERFORM seed_ccp_defaults(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_pest_control_on_haccp ON company_subscriptions;
DROP TRIGGER IF EXISTS trg_seed_all_haccp_on_subscription ON company_subscriptions;

CREATE TRIGGER trg_seed_all_haccp_on_subscription
  AFTER INSERT OR UPDATE ON company_subscriptions FOR EACH ROW
  EXECUTE FUNCTION trigger_seed_all_haccp_on_haccp_enabled();

SELECT 'CCP seed data applied successfully!' as result;
