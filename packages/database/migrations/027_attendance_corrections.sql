-- Migration: 027_attendance_corrections
-- Description: 출퇴근 기록 수정 기능 관련 컬럼 및 알림 템플릿 추가
-- Created: 2026-01-19

-- 직원 자체 수정 컬럼
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS correction_reason TEXT;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES users(id);

-- 관리자 수정 컬럼
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS admin_correction_reason TEXT;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS admin_corrected_at TIMESTAMP;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS admin_corrected_by UUID REFERENCES users(id);

-- 수정 이력 테이블
CREATE TABLE IF NOT EXISTS attendance_correction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,

  -- 수정 전 값
  previous_check_in TIMESTAMP,
  previous_check_out TIMESTAMP,
  previous_status VARCHAR(20),
  previous_work_hours DECIMAL(5, 2),

  -- 수정 후 값
  new_check_in TIMESTAMP,
  new_check_out TIMESTAMP,
  new_status VARCHAR(20),
  new_work_hours DECIMAL(5, 2),

  -- 수정 정보
  correction_type VARCHAR(20) NOT NULL, -- EMPLOYEE, ADMIN
  correction_reason TEXT,
  corrected_by UUID NOT NULL REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_attendance_correction_history_attendance ON attendance_correction_history(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_correction_history_created ON attendance_correction_history(created_at DESC);

-- 알림 템플릿 추가
INSERT INTO notification_templates (name, category, priority, title_template, body_template, deep_link_template) VALUES
('ATTENDANCE_CORRECTED_BY_ADMIN', 'ATTENDANCE', 'HIGH', '출퇴근 기록 수정 알림', '{{workDate}} 출퇴근 기록이 관리자({{adminName}})에 의해 수정되었습니다. {{#if reason}}사유: {{reason}}{{/if}}', '/attendance/{{attendanceId}}'),
('ATTENDANCE_CORRECTED_BY_EMPLOYEE', 'ATTENDANCE', 'NORMAL', '출퇴근 기록 수정', '{{staffName}}님이 {{workDate}} 출퇴근 기록을 수정했습니다. 사유: {{reason}}', '/attendances/{{attendanceId}}')
ON CONFLICT (name) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template;
