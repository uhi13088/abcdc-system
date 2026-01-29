-- ============================================
-- CCP Master Groups 제거 (불필요한 그룹 구조 삭제)
-- ============================================

-- 1. ccp_definitions에서 master_id, item_code 컬럼 제거
ALTER TABLE ccp_definitions DROP COLUMN IF EXISTS master_id;
ALTER TABLE ccp_definitions DROP COLUMN IF EXISTS item_code;

-- 2. 인덱스 삭제
DROP INDEX IF EXISTS idx_ccp_definitions_master;
DROP INDEX IF EXISTS idx_ccp_master_company;
DROP INDEX IF EXISTS idx_ccp_master_group_prefix;

-- 3. 트리거 삭제
DROP TRIGGER IF EXISTS ccp_master_updated_at ON ccp_master;

-- 4. 함수 삭제
DROP FUNCTION IF EXISTS update_ccp_master_updated_at();
DROP FUNCTION IF EXISTS seed_ccp_master_defaults(UUID);
DROP FUNCTION IF EXISTS link_ccp_to_master();

-- 5. RLS 정책 삭제
DROP POLICY IF EXISTS ccp_master_policy ON ccp_master;

-- 6. 테이블 삭제
DROP TABLE IF EXISTS ccp_master_template;
DROP TABLE IF EXISTS ccp_master CASCADE;

-- 7. 트리거 함수 업데이트 (ccp_master 참조 제거)
CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_defaults_on_company_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 방충방서 기본 데이터
  PERFORM seed_pest_control_defaults(NEW.id);
  -- CCP 기본 데이터
  PERFORM seed_ccp_defaults(NEW.id);
  -- ccp_master 시드 제거됨
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_on_haccp_enabled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.haccp_addon_enabled = true AND (OLD.haccp_addon_enabled IS NULL OR OLD.haccp_addon_enabled = false) THEN
    PERFORM seed_pest_control_defaults(NEW.company_id);
    PERFORM seed_ccp_defaults(NEW.company_id);
    -- ccp_master 시드 제거됨
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'CCP Master Groups removed successfully!' as result;
