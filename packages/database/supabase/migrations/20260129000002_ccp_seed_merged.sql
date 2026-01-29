-- ============================================
-- CCP 시드 데이터 (머지된 형태)
-- 하나의 CCP에 여러 측정 항목(critical_limits)을 포함
-- ============================================

-- ============================================
-- 1. 기존 CCP 템플릿 테이블 삭제 및 재생성
-- ============================================
DROP TABLE IF EXISTS ccp_definitions_template CASCADE;

CREATE TABLE IF NOT EXISTS ccp_definitions_template (
  id SERIAL PRIMARY KEY,
  ccp_code VARCHAR(50) NOT NULL UNIQUE,
  process_name VARCHAR(200) NOT NULL,
  hazard TEXT,
  control_measure TEXT,
  corrective_action TEXT,
  monitoring_frequency VARCHAR(100),
  -- 여러 측정 항목을 배열로 저장
  critical_limits JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 2. 머지된 CCP 템플릿 데이터 입력
-- ============================================
INSERT INTO ccp_definitions_template (ccp_code, process_name, hazard, control_measure, corrective_action, monitoring_frequency, critical_limits, sort_order) VALUES
  -- CCP-1B-COOKIE: 오븐(굽기) - 과자류
  (
    'CCP-1B-COOKIE',
    '오븐(굽기)-과자',
    '가열 불충분으로 인한 병원성 미생물 생존',
    '가열온도/시간 관리',
    '재가열 또는 폐기 처리',
    '시작전/2시간마다/변경시/종료',
    '[
      {"code": "TEMP", "parameter": "가열온도", "min": 180, "max": 210, "unit": "°C"},
      {"code": "TIME", "parameter": "가열시간", "min": 50, "max": 60, "unit": "분"},
      {"code": "CORE", "parameter": "가열 후 품온", "min": 80, "max": 210, "unit": "°C"}
    ]'::jsonb,
    1
  ),

  -- CCP-1B-BREAD: 오븐(굽기) - 빵류
  (
    'CCP-1B-BREAD',
    '오븐(굽기)-빵류',
    '가열 불충분으로 인한 병원성 미생물 생존',
    '가열온도/시간 관리',
    '재가열 또는 폐기 처리',
    '시작전/2시간마다/변경시/종료',
    '[
      {"code": "TEMP", "parameter": "가열온도", "min": 145, "max": 225, "unit": "°C"},
      {"code": "TIME", "parameter": "가열시간", "min": 30, "max": 60, "unit": "분"},
      {"code": "CORE", "parameter": "가열 후 품온", "min": 90, "max": 200, "unit": "°C"}
    ]'::jsonb,
    2
  ),

  -- CCP-2B-CREAM: 크림(휘핑)
  (
    'CCP-2B-CREAM',
    '크림(휘핑)',
    '냉장 온도 미준수로 인한 미생물 증식',
    '냉장 보관 및 사용시간 관리',
    '폐기 처리',
    '제조 직후/소진 직전/작업 중',
    '[
      {"code": "MASS", "parameter": "배합량", "min": 0, "max": 3.5, "unit": "kg"},
      {"code": "TEMP-START", "parameter": "품온(제조직후)", "min": null, "max": 15, "unit": "°C"},
      {"code": "TEMP-END", "parameter": "품온(소진직전)", "min": null, "max": 15, "unit": "°C"},
      {"code": "USE-TIME", "parameter": "소진시간", "min": 34, "max": 40, "unit": "분"},
      {"code": "ROOM-TEMP", "parameter": "작업장 온도", "min": 0, "max": 23, "unit": "°C"}
    ]'::jsonb,
    3
  ),

  -- CCP-3B-SYRUP: 시럽가열
  (
    'CCP-3B-SYRUP',
    '시럽가열',
    '가열 불충분으로 인한 병원성 미생물 생존',
    '가열온도/시간 관리',
    '재가열 또는 폐기 처리',
    '매작업시',
    '[
      {"code": "TEMP", "parameter": "가열온도", "min": 85, "max": 95, "unit": "°C"},
      {"code": "TIME", "parameter": "가열시간", "min": 5, "max": 62, "unit": "분"},
      {"code": "CORE", "parameter": "가열 후 품온", "min": 80, "max": null, "unit": "°C"}
    ]'::jsonb,
    4
  ),

  -- CCP-4B-WASH: 세척원료
  (
    'CCP-4B-WASH',
    '세척원료',
    '세척 불충분으로 인한 이물질 잔류',
    '세척 조건 관리',
    '재세척 실시',
    '매작업시',
    '[
      {"code": "RAWWT", "parameter": "원료량", "min": 0, "max": 500, "unit": "g"},
      {"code": "VOL", "parameter": "세척수량", "min": 3, "max": null, "unit": "L"},
      {"code": "TIME", "parameter": "세척시간", "min": 5, "max": null, "unit": "분"}
    ]'::jsonb,
    5
  ),

  -- CCP-5P-METAL: 금속검출
  (
    'CCP-5P-METAL',
    '금속검출',
    '금속 이물질 혼입',
    '금속검출기 작동 확인',
    '제품 격리 및 재검사, 장비 점검',
    '작업시작/2시간/변경/종료',
    '[
      {"code": "FE20", "parameter": "테스트피스 Fe2.0mm 통과", "min": 1, "max": 1, "unit": "Bool"},
      {"code": "SUS25", "parameter": "테스트피스 SUS2.5mm 통과", "min": 1, "max": 1, "unit": "Bool"},
      {"code": "PROD", "parameter": "제품 불검출", "min": 1, "max": 1, "unit": "Bool"}
    ]'::jsonb,
    6
  );

-- ============================================
-- 3. CCP 시드 함수 (머지된 버전)
-- ============================================
CREATE OR REPLACE FUNCTION seed_ccp_defaults(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  tmpl RECORD;
  first_limit JSONB;
BEGIN
  FOR tmpl IN SELECT * FROM ccp_definitions_template ORDER BY sort_order
  LOOP
    -- 첫 번째 critical_limit 추출 (기존 호환용)
    first_limit := tmpl.critical_limits->0;

    INSERT INTO ccp_definitions (
      company_id,
      ccp_number,
      process,
      hazard,
      control_measure,
      critical_limit,
      critical_limits,
      monitoring_method,
      monitoring_frequency,
      corrective_action,
      status
    ) VALUES (
      p_company_id,
      tmpl.ccp_code,
      tmpl.process_name,
      tmpl.hazard,
      tmpl.control_measure,
      first_limit,
      tmpl.critical_limits,
      tmpl.process_name,
      tmpl.monitoring_frequency,
      tmpl.corrective_action,
      'ACTIVE'
    )
    ON CONFLICT (company_id, ccp_number) DO UPDATE SET
      process = EXCLUDED.process,
      hazard = EXCLUDED.hazard,
      control_measure = EXCLUDED.control_measure,
      critical_limit = EXCLUDED.critical_limit,
      critical_limits = EXCLUDED.critical_limits,
      monitoring_frequency = EXCLUDED.monitoring_frequency,
      corrective_action = EXCLUDED.corrective_action,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. 기존 CCP 데이터 정리 및 재시드
-- ============================================
-- 기존의 분리된 CCP들 삭제 (CCP-1B-COOKIE-TEMP 형식)
DELETE FROM ccp_definitions
WHERE ccp_number ~ '^CCP-[0-9]+[A-Z]+-[A-Z]+-[A-Z]+';

-- 모든 회사에 새 시드 데이터 적용
DO $$
DECLARE
  company_rec RECORD;
BEGIN
  FOR company_rec IN SELECT id FROM companies
  LOOP
    PERFORM seed_ccp_defaults(company_rec.id);
  END LOOP;
END $$;

SELECT 'CCP merged seed data applied successfully!' as result;
