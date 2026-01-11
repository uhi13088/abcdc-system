-- Migration: 005_notifications
-- Description: Push notifications and FCM tables
-- Created: 2026-01-10

-- User FCM tokens
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  fcm_token TEXT NOT NULL,
  device_type VARCHAR(20),
  device_name VARCHAR(100),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, fcm_token)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Classification
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',

  -- Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,

  -- Actions
  actions JSONB,

  -- Deep link
  deep_link TEXT,

  -- Additional data
  data JSONB,

  -- Sound/Vibration
  sound VARCHAR(50),
  vibration BOOLEAN DEFAULT true,
  badge INTEGER,

  -- Status
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  -- Reference
  reference_type VARCHAR(50),
  reference_id UUID,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Category preferences
  categories JSONB DEFAULT '{}',

  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  -- Frequency
  digest_enabled BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(20),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',

  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,

  actions JSONB,
  deep_link_template TEXT,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fcm_user ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_category ON notifications(user_id, category);

-- Insert default notification templates
INSERT INTO notification_templates (name, category, priority, title_template, body_template, deep_link_template) VALUES
('CONTRACT_SIGN_REQUEST', 'CONTRACT', 'HIGH', '계약서 서명 요청', '새로운 근로계약서가 발송되었습니다. 확인 후 서명해주세요.', '/contracts/{{contractId}}/sign'),
('CONTRACT_SIGNED', 'CONTRACT', 'NORMAL', '계약서 서명 완료', '{{staffName}}님이 계약서에 서명했습니다.', '/contracts/{{contractId}}'),
('SHIFT_REMINDER', 'SCHEDULE', 'NORMAL', '출근 시간 알림', '30분 후 출근 시간입니다. ({{startTime}})', '/attendance/check-in'),
('SALARY_CONFIRMED', 'SALARY', 'HIGH', '{{year}}년 {{month}}월 급여 확정', '급여가 확정되었습니다. 실수령액: {{netPay}}원', '/salary/{{salaryId}}'),
('APPROVAL_REQUEST', 'APPROVAL', 'HIGH', '{{approvalType}} 승인 요청', '{{requesterName}}님이 {{approvalType}}을(를) 신청했습니다.', '/approvals/{{approvalId}}'),
('APPROVAL_APPROVED', 'APPROVAL', 'NORMAL', '{{approvalType}} 승인됨', '신청하신 {{approvalType}}이(가) 승인되었습니다.', '/approvals/{{approvalId}}'),
('APPROVAL_REJECTED', 'APPROVAL', 'HIGH', '{{approvalType}} 거부됨', '신청하신 {{approvalType}}이(가) 거부되었습니다. 사유: {{reason}}', '/approvals/{{approvalId}}'),
('EMERGENCY_SHIFT_INVITATION', 'EMERGENCY_SHIFT', 'HIGH', '긴급 근무 요청', '{{date}} {{startTime}}~{{endTime}} 근무 가능하신가요? (시급: {{hourlyRate}}원)', '/emergency-shifts/{{shiftId}}'),
('NOTICE_PUBLISHED', 'NOTICE', 'NORMAL', '{{noticeTitle}}', '{{noticePreview}}', '/notices/{{noticeId}}'),
('MESSAGE_RECEIVED', 'MESSAGE', 'NORMAL', '{{senderName}}님의 메시지', '{{messagePreview}}', '/messages/{{messageId}}'),
('CHECKIN_ANOMALY', 'ATTENDANCE', 'HIGH', '출퇴근 이상 감지', '{{staffName}}님의 출퇴근에 이상이 감지되었습니다.', '/attendance/{{attendanceId}}'),
('CCP_LIMIT_EXCEEDED', 'HACCP', 'CRITICAL', 'CCP 한계 초과', '{{process}}: {{value}}{{unit}} - 즉시 확인이 필요합니다.', '/haccp/ccp/{{ccpId}}')
ON CONFLICT (name) DO UPDATE SET
  title_template = EXCLUDED.title_template,
  body_template = EXCLUDED.body_template;
