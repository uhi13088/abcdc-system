-- ============================================
-- 검증(승인) 권한 설정
-- 각 HACCP 기록물에 대한 검증 가능 최소 역할 설정
-- ============================================

-- haccp_company_settings 테이블에 검증 권한 설정 컬럼 추가
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_company_settings') THEN
    -- 검증 가능 최소 역할 (기본값: manager)
    ALTER TABLE haccp_company_settings
      ADD COLUMN IF NOT EXISTS verification_min_role VARCHAR(50) DEFAULT 'manager';

    -- 본인 검증 허용 여부 (기본값: false - 본인이 작성한 기록은 본인이 검증 불가)
    ALTER TABLE haccp_company_settings
      ADD COLUMN IF NOT EXISTS allow_self_verification BOOLEAN DEFAULT false;

    -- 기록 유형별 검증 설정 (JSONB)
    -- 예: {"hygiene": "team_leader", "ccp": "manager", "storage": "store_manager"}
    ALTER TABLE haccp_company_settings
      ADD COLUMN IF NOT EXISTS verification_roles_by_type JSONB DEFAULT '{}';
  END IF;
END $$;

-- 코멘트 추가
COMMENT ON COLUMN haccp_company_settings.verification_min_role IS '검증 가능 최소 역할 (기본 설정)';
COMMENT ON COLUMN haccp_company_settings.allow_self_verification IS '본인 작성 기록 본인 검증 허용 여부';
COMMENT ON COLUMN haccp_company_settings.verification_roles_by_type IS '기록 유형별 검증 최소 역할 설정';

-- Done
SELECT 'Verification permission settings migration completed!' as result;
