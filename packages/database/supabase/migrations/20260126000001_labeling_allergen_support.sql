-- ============================================
-- 한글표시사항(라벨링) 및 알레르기 정보 지원
-- ============================================

-- ============================================
-- 1. materials 테이블에 allergens 컬럼 추가
-- ============================================
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]';

COMMENT ON COLUMN materials.allergens IS '알레르기 유발물질 ID 배열 (예: ["egg", "milk", "wheat"])';

-- ============================================
-- 2. storage_inspections 테이블에 inspected_by_name 컬럼 추가
-- ============================================
ALTER TABLE storage_inspections
  ADD COLUMN IF NOT EXISTS inspected_by_name VARCHAR(100);

COMMENT ON COLUMN storage_inspections.inspected_by_name IS '점검자 이름 (외래키 없이 직접 저장)';

-- ============================================
-- 3. products 테이블에 라벨링 관련 컬럼 추가
-- ============================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS label_data JSONB DEFAULT NULL;

COMMENT ON COLUMN products.label_data IS '한글표시사항 데이터 (자동생성 또는 수동입력)';

-- ============================================
-- 4. hygiene_checks 뷰 생성 (호환성)
-- daily_hygiene_checks 테이블의 별칭으로 사용
-- ============================================
CREATE OR REPLACE VIEW hygiene_checks AS
SELECT
  id,
  company_id,
  check_date,
  check_period,
  checked_by,
  checked_by_name,
  pre_work_checks,
  during_work_checks,
  post_work_checks,
  temperature_records,
  overall_status,
  corrective_action,
  remarks,
  improvement_result,
  verified_by,
  verified_by_name,
  verified_at,
  created_at
FROM daily_hygiene_checks;

-- 뷰에 대한 INSERT/UPDATE/DELETE 트리거 생성
CREATE OR REPLACE FUNCTION hygiene_checks_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_hygiene_checks (
    company_id, check_date, check_period, checked_by, checked_by_name,
    pre_work_checks, during_work_checks, post_work_checks,
    temperature_records, overall_status, corrective_action,
    remarks, improvement_result, verified_by, verified_by_name, verified_at, created_at
  ) VALUES (
    NEW.company_id, NEW.check_date, NEW.check_period, NEW.checked_by, NEW.checked_by_name,
    COALESCE(NEW.pre_work_checks, '{}'),
    COALESCE(NEW.during_work_checks, '{}'),
    COALESCE(NEW.post_work_checks, '{}'),
    COALESCE(NEW.temperature_records, '{}'),
    NEW.overall_status, NEW.corrective_action,
    NEW.remarks, NEW.improvement_result, NEW.verified_by, NEW.verified_by_name, NEW.verified_at,
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
  )
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hygiene_checks_insert ON hygiene_checks;
CREATE TRIGGER hygiene_checks_insert
  INSTEAD OF INSERT ON hygiene_checks
  FOR EACH ROW EXECUTE FUNCTION hygiene_checks_insert_trigger();

-- Done
SELECT 'Labeling and allergen support migration completed!' as result;
