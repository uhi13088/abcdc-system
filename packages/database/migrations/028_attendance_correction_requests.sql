-- Migration: 028_attendance_correction_requests
-- Description: 출퇴근 수정 요청 테이블 (직원 요청 → 관리자 승인 → 급여 반영)
-- Created: 2026-01-19

-- 출퇴근 수정 요청 테이블
CREATE TABLE IF NOT EXISTS attendance_correction_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,

  -- 요청자 정보
  requested_by UUID NOT NULL REFERENCES users(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  store_id UUID REFERENCES stores(id),

  -- 요청 내용
  request_type VARCHAR(20) NOT NULL, -- CHECK_IN, CHECK_OUT, BOTH, STATUS

  -- 기존 값
  original_check_in TIMESTAMP,
  original_check_out TIMESTAMP,
  original_status VARCHAR(30),

  -- 요청 값
  requested_check_in TIMESTAMP,
  requested_check_out TIMESTAMP,
  requested_status VARCHAR(30),

  -- 사유
  reason TEXT NOT NULL,

  -- 승인 상태
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED

  -- 처리 정보
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMP,
  rejection_reason TEXT,

  -- 급여 계산 관련 (승인 시 사용)
  calculated_work_hours DECIMAL(5, 2),
  calculated_base_pay INTEGER,
  calculated_overtime_pay INTEGER,
  calculated_night_pay INTEGER,
  calculated_daily_total INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_correction_requests_attendance ON attendance_correction_requests(attendance_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_requester ON attendance_correction_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_correction_requests_company ON attendance_correction_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_correction_requests_status ON attendance_correction_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correction_requests_pending ON attendance_correction_requests(company_id, status) WHERE status = 'PENDING';

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_correction_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_correction_request_timestamp ON attendance_correction_requests;
CREATE TRIGGER trigger_update_correction_request_timestamp
  BEFORE UPDATE ON attendance_correction_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_correction_request_timestamp();

-- RLS 정책
ALTER TABLE attendance_correction_requests ENABLE ROW LEVEL SECURITY;

-- 본인 요청 조회
CREATE POLICY "Users can view own correction requests"
  ON attendance_correction_requests FOR SELECT
  USING (requested_by = auth.uid() OR
         EXISTS (
           SELECT 1 FROM users
           WHERE users.auth_id = auth.uid()
           AND users.role IN ('super_admin', 'company_admin', 'manager')
           AND (users.company_id = attendance_correction_requests.company_id OR users.role = 'super_admin')
         ));

-- 본인 요청 생성
CREATE POLICY "Users can create own correction requests"
  ON attendance_correction_requests FOR INSERT
  WITH CHECK (requested_by IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- 관리자 승인/거절
CREATE POLICY "Admins can update correction requests"
  ON attendance_correction_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
    AND users.role IN ('super_admin', 'company_admin', 'manager')
    AND (users.company_id = attendance_correction_requests.company_id OR users.role = 'super_admin')
  ));
