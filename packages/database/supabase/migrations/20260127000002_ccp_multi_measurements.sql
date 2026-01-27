-- ============================================
-- CCP 다중 측정값 지원 마이그레이션
-- ============================================
-- 하나의 CCP가 여러 측정 항목을 가질 수 있도록 변경
-- 예: CCP-1B-COOKIE = 가열온도 + 가열시간 + 품온

-- ============================================
-- 1. critical_limits 컬럼 추가 (배열)
-- ============================================
ALTER TABLE ccp_definitions
ADD COLUMN IF NOT EXISTS critical_limits JSONB;

-- 기존 critical_limit 데이터를 critical_limits 배열로 마이그레이션
UPDATE ccp_definitions
SET critical_limits = jsonb_build_array(critical_limit)
WHERE critical_limits IS NULL AND critical_limit IS NOT NULL;

-- ============================================
-- 2. ccp_records 테이블에 measurements 컬럼 추가 (배열)
-- ============================================
ALTER TABLE ccp_records
ADD COLUMN IF NOT EXISTS measurements JSONB;

-- 기존 measurement 데이터를 measurements 배열로 마이그레이션
UPDATE ccp_records
SET measurements = jsonb_build_array(measurement)
WHERE measurements IS NULL AND measurement IS NOT NULL;

-- ============================================
-- 3. 새로운 CCP 템플릿 테이블 (다중 측정값 지원)
-- ============================================
DROP TABLE IF EXISTS ccp_template_multi;
CREATE TABLE ccp_template_multi (
  id SERIAL PRIMARY KEY,
  ccp_number VARCHAR(50) NOT NULL UNIQUE,
  process VARCHAR(200) NOT NULL,
  hazard TEXT,
  control_measure TEXT,
  critical_limits JSONB NOT NULL,
  monitoring_method TEXT,
  monitoring_frequency VARCHAR(100),
  corrective_action TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 4. CCP 템플릿 데이터 (하나의 CCP에 여러 측정 항목)
-- ============================================
INSERT INTO ccp_template_multi (ccp_number, process, hazard, control_measure, critical_limits, monitoring_method, monitoring_frequency, corrective_action, sort_order) VALUES
  -- 1B-COOKIE: 오븐(굽기)-과자
  ('CCP-1B-COOKIE', '오븐(굽기)-과자', '생물학적 위해요소 - 병원성 미생물 잔존', '가열온도, 시간, 품온 관리',
   '[
     {"code": "TEMP", "parameter": "가열온도", "min": 180, "max": 210, "unit": "°C"},
     {"code": "TIME", "parameter": "가열시간", "min": 50, "max": 60, "unit": "분"},
     {"code": "CORE", "parameter": "가열 후 품온", "min": 80, "max": 210, "unit": "°C"}
   ]'::jsonb,
   '온도계/타이머/중심온도계', '시작전/2시간마다/변경시/종료', '재가열 또는 폐기', 1),

  -- 1B-BREAD: 오븐(굽기)-빵류
  ('CCP-1B-BREAD', '오븐(굽기)-빵류', '생물학적 위해요소 - 병원성 미생물 잔존', '가열온도, 시간, 품온 관리',
   '[
     {"code": "TEMP", "parameter": "가열온도", "min": 145, "max": 225, "unit": "°C"},
     {"code": "TIME", "parameter": "가열시간", "min": 30, "max": 60, "unit": "분"},
     {"code": "CORE", "parameter": "가열 후 품온", "min": 90, "max": 200, "unit": "°C"}
   ]'::jsonb,
   '온도계/타이머/중심온도계', '시작전/2시간마다/변경시/종료', '재가열 또는 폐기', 2),

  -- 2B-CREAM: 크림(휘핑)
  ('CCP-2B-CREAM', '크림(휘핑)', '생물학적 위해요소 - 미생물 증식', '냉장온도, 소진시간 관리',
   '[
     {"code": "MASS", "parameter": "배합량", "min": 0, "max": 3.5, "unit": "kg"},
     {"code": "TEMP-START", "parameter": "품온(제조직후)", "min": null, "max": 15, "unit": "°C"},
     {"code": "TEMP-END", "parameter": "품온(소진직전)", "min": null, "max": 15, "unit": "°C"},
     {"code": "USE-TIME", "parameter": "소진시간", "min": 34, "max": 40, "unit": "분"},
     {"code": "ROOM-TEMP", "parameter": "작업장 온도", "min": 0, "max": 23, "unit": "°C"}
   ]'::jsonb,
   '온도계/타이머', '제조 직후/소진 직전/작업 중', '폐기 또는 즉시 사용', 3),

  -- 3B-SYRUP: 시럽가열
  ('CCP-3B-SYRUP', '시럽가열', '생물학적 위해요소 - 미생물 잔존', '가열온도, 시간, 품온 관리',
   '[
     {"code": "TEMP", "parameter": "가열온도", "min": 85, "max": 95, "unit": "°C"},
     {"code": "TIME", "parameter": "가열시간", "min": 5, "max": 62, "unit": "분"},
     {"code": "CORE", "parameter": "가열 후 품온", "min": 80, "max": null, "unit": "°C"}
   ]'::jsonb,
   '온도계/타이머', '매작업시', '재가열 또는 폐기', 4),

  -- 4B-WASH: 세척원료
  ('CCP-4B-WASH', '세척원료', '생물학적/화학적 위해요소', '세척 조건 관리',
   '[
     {"code": "RAWWT", "parameter": "원료량", "min": 0, "max": 500, "unit": "g"},
     {"code": "WASH-VOL", "parameter": "세척수량", "min": 3, "max": 9999, "unit": "L"},
     {"code": "WASH-TIME", "parameter": "세척시간", "min": 5, "max": 9999, "unit": "분"}
   ]'::jsonb,
   '저울/타이머', '매작업시', '재세척', 5),

  -- 5P-METAL: 금속검출
  ('CCP-5P-METAL', '금속검출', '물리적 위해요소 - 금속 이물', '금속검출기 작동 확인',
   '[
     {"code": "FE20", "parameter": "Fe 2.0mm 테스트피스", "min": 1, "max": 1, "unit": "통과"},
     {"code": "SUS25", "parameter": "SUS 2.5mm 테스트피스", "min": 1, "max": 1, "unit": "통과"},
     {"code": "PROD", "parameter": "제품 검사", "min": 1, "max": 1, "unit": "불검출"}
   ]'::jsonb,
   '금속검출기/테스트피스', '작업시작/2시간/변경/종료', '라인정지 후 재검사', 6);

-- ============================================
-- 5. seed_ccp_defaults_multi 함수 생성
-- ============================================
CREATE OR REPLACE FUNCTION seed_ccp_defaults_multi(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  tmpl RECORD;
BEGIN
  FOR tmpl IN SELECT * FROM ccp_template_multi ORDER BY sort_order
  LOOP
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
      tmpl.ccp_number,
      tmpl.process,
      tmpl.hazard,
      tmpl.control_measure,
      tmpl.critical_limits->0,
      tmpl.critical_limits,
      tmpl.monitoring_method,
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
      monitoring_method = EXCLUDED.monitoring_method,
      monitoring_frequency = EXCLUDED.monitoring_frequency,
      corrective_action = EXCLUDED.corrective_action,
      status = 'ACTIVE';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. 기존 회사들에 새 CCP 시드 적용
-- ============================================
DO $$
DECLARE
  company_rec RECORD;
BEGIN
  FOR company_rec IN SELECT id FROM companies
  LOOP
    PERFORM seed_ccp_defaults_multi(company_rec.id);
  END LOOP;
END $$;

-- ============================================
-- 7. 기존 개별 CCP들 비활성화
-- ============================================
UPDATE ccp_definitions
SET status = 'MERGED'
WHERE ccp_number LIKE 'CCP-%-%-%-'
  AND status = 'ACTIVE';

-- Done
SELECT 'CCP multi-measurement migration completed!' as result;
