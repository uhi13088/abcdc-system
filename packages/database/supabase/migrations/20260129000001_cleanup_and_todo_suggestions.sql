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
-- Comments
-- ============================================
COMMENT ON TABLE todo_suggestions IS '일일 체크리스트 항목 추천 (버튼 태그)';
COMMENT ON COLUMN todo_suggestions.content IS '항목 내용 (태그 텍스트)';
COMMENT ON COLUMN todo_suggestions.usage_count IS '사용 횟수 - 자주 쓰는 항목 우선 정렬';
COMMENT ON COLUMN todo_suggestions.is_hidden IS '숨김 여부 - 삭제 대신 숨김 처리';

SELECT 'Cleanup completed and todo_suggestions table created!' as result;
