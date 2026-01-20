-- 템플릿에 매장 연결 추가
-- 매장별로 템플릿을 관리하고, 매장 운영시간을 활용

-- store_id 컬럼 추가 (nullable - 전체 회사 템플릿 or 특정 매장 템플릿)
ALTER TABLE invitation_templates
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 매장 연결 시 운영시간 활용 여부 플래그
ALTER TABLE invitation_templates
ADD COLUMN IF NOT EXISTS use_store_hours BOOLEAN DEFAULT false;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_invitation_templates_store_id ON invitation_templates(store_id);

-- 코멘트 추가
COMMENT ON COLUMN invitation_templates.store_id IS '연결된 매장 (NULL이면 회사 전체 템플릿)';
COMMENT ON COLUMN invitation_templates.use_store_hours IS '매장 운영시간을 근무시간으로 사용 여부';
