-- 직원 서류 업로드 기능을 위한 컬럼 추가
-- required_documents: 관리자가 요청한 서류 목록 (초대에서 복사됨)
-- documents: 직원이 업로드한 서류 정보 (migration 017에서 이미 추가됨)

-- required_documents 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '[]';

-- documents 컬럼이 없는 경우 추가 (migration 017에서 이미 있을 수 있음)
ALTER TABLE users ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}';

-- 인덱스 추가 (required_documents가 있는 사용자 조회용)
CREATE INDEX IF NOT EXISTS idx_users_required_documents ON users USING GIN (required_documents);

COMMENT ON COLUMN users.required_documents IS '관리자가 요청한 필수 서류 목록 (예: ["health_certificate", "bank_copy"])';
COMMENT ON COLUMN users.documents IS '직원이 업로드한 서류 정보 (예: {"health_certificate": {"url": "...", "expiry_date": "2025-12-31"}})';
