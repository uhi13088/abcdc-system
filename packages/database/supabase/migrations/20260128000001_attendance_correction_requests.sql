-- ============================================
-- 근태 수정 요청 시스템 (Attendance Correction Requests)
-- ============================================
-- 지각, 조퇴, 연장근무 등의 근태 수정 요청 및 승인 관리

-- ============================================
-- 1. 근태 수정 요청 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  -- 요청 유형
  -- LATE_CHECKIN: 지각 (출근 시간 수정)
  -- EARLY_CHECKOUT: 조퇴 (퇴근 시간 수정)
  -- OVERTIME: 연장근무 (퇴근 시간 연장)
  -- NO_SHOW_REASON: 미출근 사유
  -- TIME_CORRECTION: 일반 시간 수정
  request_type VARCHAR(30) NOT NULL CHECK (request_type IN (
    'LATE_CHECKIN', 'EARLY_CHECKOUT', 'OVERTIME', 'NO_SHOW_REASON', 'TIME_CORRECTION'
  )),

  -- 원래 시간
  original_check_in TIMESTAMPTZ,
  original_check_out TIMESTAMPTZ,

  -- 요청 시간 (수정 희망 시간)
  requested_check_in TIMESTAMPTZ,
  requested_check_out TIMESTAMPTZ,

  -- 사유
  reason TEXT NOT NULL,
  reason_category VARCHAR(50), -- 교통지연, 개인사유, 병원, 가족돌봄, 업무연장 등

  -- 연장근무 관련
  overtime_hours DECIMAL(4,2), -- 연장근무 시간
  overtime_type VARCHAR(20) CHECK (overtime_type IN ('REGULAR', 'NIGHT', 'HOLIDAY')),

  -- 승인 상태
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),

  -- 승인 정보
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,

  -- 알림 발송 여부
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,

  -- 자동 생성 여부 (Cron에서 자동 생성된 경우)
  auto_generated BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_correction_requests_attendance ON attendance_correction_requests(attendance_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_staff ON attendance_correction_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_company ON attendance_correction_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_status ON attendance_correction_requests(status);
CREATE INDEX IF NOT EXISTS idx_correction_requests_pending ON attendance_correction_requests(company_id, status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_correction_requests_created ON attendance_correction_requests(created_at DESC);

-- RLS
ALTER TABLE attendance_correction_requests ENABLE ROW LEVEL SECURITY;

-- 직원은 자신의 요청만 조회/생성 가능
CREATE POLICY correction_requests_staff_policy ON attendance_correction_requests
  FOR ALL USING (
    staff_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- 관리자는 자사 요청 모두 조회/수정 가능
CREATE POLICY correction_requests_admin_policy ON attendance_correction_requests
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
      AND role IN ('company_admin', 'COMPANY_ADMIN', 'store_manager', 'STORE_MANAGER', 'manager', 'MANAGER')
    )
  );

-- ============================================
-- 2. 사유 카테고리 (참조용)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_reason_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 적용 가능한 요청 유형들
  applicable_types TEXT[] DEFAULT ARRAY['LATE_CHECKIN', 'EARLY_CHECKOUT', 'OVERTIME', 'NO_SHOW_REASON'],

  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 사유 카테고리 추가
INSERT INTO attendance_reason_categories (company_id, code, name, applicable_types, sort_order) VALUES
  (NULL, 'TRAFFIC', '교통 지연', ARRAY['LATE_CHECKIN'], 1),
  (NULL, 'PERSONAL', '개인 사유', ARRAY['LATE_CHECKIN', 'EARLY_CHECKOUT', 'NO_SHOW_REASON'], 2),
  (NULL, 'MEDICAL', '병원/건강', ARRAY['LATE_CHECKIN', 'EARLY_CHECKOUT', 'NO_SHOW_REASON'], 3),
  (NULL, 'FAMILY', '가족 돌봄', ARRAY['LATE_CHECKIN', 'EARLY_CHECKOUT', 'NO_SHOW_REASON'], 4),
  (NULL, 'WORK_EXTENSION', '업무 연장', ARRAY['OVERTIME'], 5),
  (NULL, 'MEETING', '회의/미팅', ARRAY['OVERTIME'], 6),
  (NULL, 'URGENT_TASK', '긴급 업무', ARRAY['OVERTIME'], 7),
  (NULL, 'OTHER', '기타', ARRAY['LATE_CHECKIN', 'EARLY_CHECKOUT', 'OVERTIME', 'NO_SHOW_REASON'], 99)
ON CONFLICT DO NOTHING;

-- RLS for reason categories
ALTER TABLE attendance_reason_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY reason_categories_read_policy ON attendance_reason_categories
  FOR SELECT USING (
    company_id IS NULL -- 기본 카테고리는 모두 조회 가능
    OR company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

-- ============================================
-- 3. 근태 수정 요청 처리 함수
-- ============================================

-- 승인 시 근태 기록 업데이트 함수
CREATE OR REPLACE FUNCTION approve_attendance_correction(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
  v_result JSONB;
BEGIN
  -- 요청 조회
  SELECT * INTO v_request
  FROM attendance_correction_requests
  WHERE id = p_request_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  -- 근태 기록 업데이트
  UPDATE attendances
  SET
    actual_check_in = COALESCE(v_request.requested_check_in, actual_check_in),
    actual_check_out = COALESCE(v_request.requested_check_out, actual_check_out),
    overtime_hours = COALESCE(v_request.overtime_hours, overtime_hours),
    extensions = COALESCE(extensions, '{}'::jsonb) || jsonb_build_object(
      'correction_applied', true,
      'correction_request_id', p_request_id,
      'correction_type', v_request.request_type,
      'correction_reason', v_request.reason,
      'approved_by', p_reviewer_id,
      'approved_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = v_request.attendance_id;

  -- 요청 상태 업데이트
  UPDATE attendance_correction_requests
  SET
    status = 'APPROVED',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_comment = p_comment,
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Attendance correction approved',
    'attendance_id', v_request.attendance_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 거절 함수
CREATE OR REPLACE FUNCTION reject_attendance_correction(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_comment TEXT
)
RETURNS JSONB AS $$
BEGIN
  UPDATE attendance_correction_requests
  SET
    status = 'REJECTED',
    reviewed_by = p_reviewer_id,
    reviewed_at = NOW(),
    review_comment = p_comment,
    updated_at = NOW()
  WHERE id = p_request_id AND status = 'PENDING';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Attendance correction rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Grants
-- ============================================
GRANT ALL ON attendance_correction_requests TO authenticated;
GRANT ALL ON attendance_correction_requests TO service_role;
GRANT ALL ON attendance_reason_categories TO authenticated;
GRANT ALL ON attendance_reason_categories TO service_role;
GRANT EXECUTE ON FUNCTION approve_attendance_correction TO authenticated;
GRANT EXECUTE ON FUNCTION reject_attendance_correction TO authenticated;

-- ============================================
-- Done
-- ============================================
SELECT 'Attendance correction requests table created successfully!' as result;
