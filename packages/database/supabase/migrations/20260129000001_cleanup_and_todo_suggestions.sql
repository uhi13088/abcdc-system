-- ============================================
-- 불필요한 테이블 정리 및 todo_suggestions 테이블 생성
-- ============================================

-- ============================================
-- 1. CCP 그룹핑 관련 테이블/컬럼 삭제
-- ============================================

-- ccp_definitions에서 master_id, item_code 컬럼 삭제
ALTER TABLE ccp_definitions DROP COLUMN IF EXISTS master_id;
ALTER TABLE ccp_definitions DROP COLUMN IF EXISTS item_code;

-- 관련 인덱스 삭제
DROP INDEX IF EXISTS idx_ccp_definitions_master;
DROP INDEX IF EXISTS idx_ccp_master_company;
DROP INDEX IF EXISTS idx_ccp_master_group_prefix;

-- ccp_master_template 테이블 삭제
DROP TABLE IF EXISTS ccp_master_template CASCADE;

-- ccp_master 테이블 삭제
DROP TABLE IF EXISTS ccp_master CASCADE;

-- 관련 함수들 삭제
DROP FUNCTION IF EXISTS seed_ccp_master_defaults(UUID);
DROP FUNCTION IF EXISTS link_ccp_to_master();
DROP FUNCTION IF EXISTS update_ccp_master_updated_at();

-- ============================================
-- 2. Todo 템플릿 테이블 삭제
-- ============================================

-- 관련 인덱스 삭제
DROP INDEX IF EXISTS idx_todo_templates_company;
DROP INDEX IF EXISTS idx_todo_templates_category;
DROP INDEX IF EXISTS idx_todo_template_items_template;

-- todo_template_items 테이블 삭제
DROP TABLE IF EXISTS todo_template_items CASCADE;

-- todo_templates 테이블 삭제
DROP TABLE IF EXISTS todo_templates CASCADE;

-- 템플릿 관련 함수 삭제
DROP FUNCTION IF EXISTS create_daily_todo_from_template(UUID, DATE, UUID);

-- daily_todos에서 template_id FK 제거 (컬럼 삭제)
ALTER TABLE daily_todos DROP COLUMN IF EXISTS template_id;

-- ============================================
-- 3. todo_suggestions 테이블 생성 (버튼 태그 시스템)
-- ============================================
CREATE TABLE IF NOT EXISTS todo_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 항목 내용 (태그 텍스트)
  content VARCHAR(500) NOT NULL,

  -- 사용 횟수 (자주 쓰는 항목 정렬용)
  usage_count INTEGER DEFAULT 1,

  -- 숨김 여부 (삭제 대신 숨김 처리)
  is_hidden BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 같은 회사에서 중복 내용 방지
  UNIQUE(company_id, content)
);

-- ============================================
-- 4. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_todo_suggestions_company ON todo_suggestions(company_id);
CREATE INDEX IF NOT EXISTS idx_todo_suggestions_usage ON todo_suggestions(company_id, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_todo_suggestions_visible ON todo_suggestions(company_id, is_hidden);

-- ============================================
-- 5. RLS 정책
-- ============================================
ALTER TABLE todo_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY todo_suggestions_policy ON todo_suggestions FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
);

-- ============================================
-- 6. 트리거: updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_todo_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS todo_suggestions_updated_at ON todo_suggestions;
CREATE TRIGGER todo_suggestions_updated_at
  BEFORE UPDATE ON todo_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_todo_suggestions_updated_at();

-- ============================================
-- 7. 기존 daily_todo_items에서 suggestions 마이그레이션
-- ============================================
-- 기존에 사용된 항목들을 suggestions로 자동 이관
INSERT INTO todo_suggestions (company_id, content, usage_count, is_hidden)
SELECT DISTINCT
  dt.company_id,
  dti.content,
  COUNT(*) as usage_count,
  FALSE
FROM daily_todo_items dti
JOIN daily_todos dt ON dti.daily_todo_id = dt.id
GROUP BY dt.company_id, dti.content
ON CONFLICT (company_id, content) DO UPDATE SET
  usage_count = todo_suggestions.usage_count + EXCLUDED.usage_count;

-- ============================================
-- 8. ccp_definitions에 critical_limits 컬럼 추가 (머지용)
-- ============================================
ALTER TABLE ccp_definitions ADD COLUMN IF NOT EXISTS critical_limits JSONB;

-- ============================================
-- 9. 기존 CCP 머지 (CCP-1B-BREAD-TEMP + CCP-1B-BREAD-TIME -> CCP-1B-BREAD)
-- ============================================
-- 같은 프리픽스를 가진 CCP들을 하나로 머지
-- 예: CCP-1B-BREAD-TEMP, CCP-1B-BREAD-TIME, CCP-1B-BREAD-CORE -> CCP-1B-BREAD

DO $$
DECLARE
  company_rec RECORD;
  prefix_rec RECORD;
  main_ccp_id UUID;
  merged_limits JSONB;
  merged_process TEXT;
  merged_hazard TEXT;
  merged_control TEXT;
  merged_monitoring TEXT;
  merged_corrective TEXT;
  ccp_rec RECORD;
BEGIN
  -- 각 회사별로 처리
  FOR company_rec IN SELECT DISTINCT company_id FROM ccp_definitions
  LOOP
    -- 그룹화된 CCP들 찾기 (CCP-XX-YYYY-ZZZZ 형식 -> CCP-XX-YYYY로 그룹)
    FOR prefix_rec IN
      SELECT DISTINCT
        CASE
          -- CCP-1B-BREAD-TEMP 형식 -> CCP-1B-BREAD 추출
          WHEN ccp_number ~ '^CCP-[0-9]+[A-Z]+-[A-Z]+-[A-Z]+$' THEN
            REGEXP_REPLACE(ccp_number, '-[A-Z]+$', '')
          -- 이미 단순 형식이면 그대로
          ELSE ccp_number
        END as base_prefix,
        COUNT(*) as cnt
      FROM ccp_definitions
      WHERE company_id = company_rec.company_id
      GROUP BY base_prefix
      HAVING COUNT(*) > 1
    LOOP
      -- 이 프리픽스에 해당하는 CCP들 머지
      main_ccp_id := NULL;
      merged_limits := '[]'::JSONB;
      merged_process := '';
      merged_hazard := '';
      merged_control := '';
      merged_monitoring := '';
      merged_corrective := '';

      FOR ccp_rec IN
        SELECT *
        FROM ccp_definitions
        WHERE company_id = company_rec.company_id
          AND (
            ccp_number = prefix_rec.base_prefix
            OR ccp_number LIKE prefix_rec.base_prefix || '-%'
          )
        ORDER BY ccp_number
      LOOP
        -- 첫 번째 CCP를 메인으로 사용
        IF main_ccp_id IS NULL THEN
          main_ccp_id := ccp_rec.id;
          merged_process := ccp_rec.process;
          merged_hazard := ccp_rec.hazard;
          merged_control := ccp_rec.control_measure;
          merged_monitoring := ccp_rec.monitoring_method;
          merged_corrective := ccp_rec.corrective_action;
        END IF;

        -- critical_limit을 배열에 추가 (code 필드에 원래 항목 코드 저장)
        IF ccp_rec.critical_limit IS NOT NULL THEN
          merged_limits := merged_limits || jsonb_build_array(
            ccp_rec.critical_limit || jsonb_build_object(
              'code',
              CASE
                WHEN ccp_rec.ccp_number ~ '-[A-Z]+$' THEN
                  REGEXP_REPLACE(ccp_rec.ccp_number, '.*-([A-Z]+)$', '\1')
                ELSE 'MAIN'
              END
            )
          );
        END IF;

        -- 기존 critical_limits 배열이 있으면 추가
        IF ccp_rec.critical_limits IS NOT NULL AND jsonb_array_length(ccp_rec.critical_limits) > 0 THEN
          merged_limits := merged_limits || ccp_rec.critical_limits;
        END IF;
      END LOOP;

      -- 메인 CCP 업데이트
      IF main_ccp_id IS NOT NULL THEN
        UPDATE ccp_definitions
        SET
          ccp_number = prefix_rec.base_prefix,
          process = merged_process,
          hazard = merged_hazard,
          control_measure = merged_control,
          monitoring_method = merged_monitoring,
          corrective_action = merged_corrective,
          critical_limits = merged_limits,
          status = 'ACTIVE'
        WHERE id = main_ccp_id;

        -- ccp_records의 ccp_id를 메인 CCP로 업데이트
        UPDATE ccp_records
        SET ccp_id = main_ccp_id
        WHERE ccp_id IN (
          SELECT id FROM ccp_definitions
          WHERE company_id = company_rec.company_id
            AND id != main_ccp_id
            AND (
              ccp_number = prefix_rec.base_prefix
              OR ccp_number LIKE prefix_rec.base_prefix || '-%'
            )
        );

        -- sensors의 linked_ccp_id를 메인 CCP로 업데이트
        UPDATE sensors
        SET linked_ccp_id = main_ccp_id
        WHERE linked_ccp_id IN (
          SELECT id FROM ccp_definitions
          WHERE company_id = company_rec.company_id
            AND id != main_ccp_id
            AND (
              ccp_number = prefix_rec.base_prefix
              OR ccp_number LIKE prefix_rec.base_prefix || '-%'
            )
        );

        -- 나머지 CCP들 삭제 (MERGED 상태로 변경 대신 삭제)
        DELETE FROM ccp_definitions
        WHERE company_id = company_rec.company_id
          AND id != main_ccp_id
          AND (
            ccp_number = prefix_rec.base_prefix
            OR ccp_number LIKE prefix_rec.base_prefix || '-%'
          );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE todo_suggestions IS '일일 체크리스트 항목 추천 (버튼 태그)';
COMMENT ON COLUMN todo_suggestions.content IS '항목 내용 (태그 텍스트)';
COMMENT ON COLUMN todo_suggestions.usage_count IS '사용 횟수 - 자주 쓰는 항목 우선 정렬';
COMMENT ON COLUMN todo_suggestions.is_hidden IS '숨김 여부 - 삭제 대신 숨김 처리';

SELECT 'Cleanup completed, CCP numbers simplified, and todo_suggestions table created!' as result;
