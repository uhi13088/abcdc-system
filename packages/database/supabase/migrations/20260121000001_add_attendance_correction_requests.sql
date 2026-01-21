-- 출퇴근 수정 요청 테이블 생성
-- 직원이 자신의 출퇴근 기록 수정을 요청하고, 관리자가 승인/거절하는 기능

-- 1. attendance_correction_requests 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 관련 출퇴근 기록
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,

  -- 요청자 정보
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  -- 요청 타입: CHECK_IN, CHECK_OUT, BOTH, STATUS
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('CHECK_IN', 'CHECK_OUT', 'BOTH', 'STATUS')),

  -- 원본 값
  original_check_in TIMESTAMPTZ,
  original_check_out TIMESTAMPTZ,
  original_status VARCHAR(30),

  -- 요청된 수정 값
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,
  requested_status VARCHAR(30),

  -- 수정 사유
  reason TEXT NOT NULL,

  -- 요청 상태: PENDING, APPROVED, REJECTED
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

  -- 처리자 정보
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- 미리 계산된 급여 정보 (승인 시 반영될 값)
  calculated_work_hours DECIMAL(5, 2),
  calculated_base_pay INTEGER,
  calculated_overtime_pay INTEGER,
  calculated_night_pay INTEGER,
  calculated_daily_total INTEGER,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. attendances 테이블에 수정 관련 컬럼 추가
ALTER TABLE attendances
ADD COLUMN IF NOT EXISTS correction_reason TEXT,
ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_correction_requests_attendance_id
ON attendance_correction_requests(attendance_id);

CREATE INDEX IF NOT EXISTS idx_correction_requests_requested_by
ON attendance_correction_requests(requested_by);

CREATE INDEX IF NOT EXISTS idx_correction_requests_status
ON attendance_correction_requests(status);

CREATE INDEX IF NOT EXISTS idx_correction_requests_company_id
ON attendance_correction_requests(company_id);

CREATE INDEX IF NOT EXISTS idx_attendances_corrected_at
ON attendances(corrected_at)
WHERE corrected_at IS NOT NULL;

-- 4. RLS 정책 설정
ALTER TABLE attendance_correction_requests ENABLE ROW LEVEL SECURITY;

-- 직원은 자신의 요청만 조회 가능
CREATE POLICY "Staff can view own correction requests"
ON attendance_correction_requests
FOR SELECT
TO authenticated
USING (
  requested_by IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  )
);

-- 관리자는 소속 회사의 모든 요청 조회 가능
CREATE POLICY "Managers can view company correction requests"
ON attendance_correction_requests
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users
    WHERE auth_id = auth.uid()
    AND role IN ('company_admin', 'manager', 'store_manager')
  )
);

-- 직원은 수정 요청 생성 가능
CREATE POLICY "Staff can create correction requests"
ON attendance_correction_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by IN (
    SELECT id FROM users WHERE auth_id = auth.uid()
  )
);

-- 관리자만 수정 요청 업데이트 가능 (승인/거절)
CREATE POLICY "Managers can update correction requests"
ON attendance_correction_requests
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users
    WHERE auth_id = auth.uid()
    AND role IN ('company_admin', 'manager', 'store_manager')
  )
);

-- 5. 테이블 및 컬럼 코멘트
COMMENT ON TABLE attendance_correction_requests IS '출퇴근 수정 요청 테이블';
COMMENT ON COLUMN attendance_correction_requests.request_type IS '요청 타입: CHECK_IN, CHECK_OUT, BOTH, STATUS';
COMMENT ON COLUMN attendance_correction_requests.status IS '요청 상태: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN attendances.correction_reason IS '수정 사유 (승인된 경우)';
COMMENT ON COLUMN attendances.corrected_at IS '수정 승인 시간';
COMMENT ON COLUMN attendances.corrected_by IS '수정 승인한 관리자 ID';
