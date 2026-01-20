-- 관리자 출퇴근 기록 직접 수정 기능을 위한 컬럼 추가
-- admin_corrected_at: 관리자가 수정한 시간
-- admin_corrected_by: 수정한 관리자 ID
-- admin_correction_reason: 수정 사유

ALTER TABLE attendances
ADD COLUMN IF NOT EXISTS admin_corrected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_corrected_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS admin_correction_reason TEXT;

-- 인덱스 추가 (수정된 기록 조회용)
CREATE INDEX IF NOT EXISTS idx_attendances_admin_corrected
ON attendances(admin_corrected_at)
WHERE admin_corrected_at IS NOT NULL;

COMMENT ON COLUMN attendances.admin_corrected_at IS '관리자가 수정한 시간';
COMMENT ON COLUMN attendances.admin_corrected_by IS '수정한 관리자 ID';
COMMENT ON COLUMN attendances.admin_correction_reason IS '관리자 수정 사유';
