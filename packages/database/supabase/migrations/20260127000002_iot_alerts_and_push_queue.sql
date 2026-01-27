-- ============================================
-- IoT Sensor Alerts & Push Notification Queue
-- ============================================

-- ============================================
-- 1. IoT 센서 알림 (IoT Sensor Alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS iot_sensor_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- 알림 정보
  alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('HIGH_TEMPERATURE', 'LOW_TEMPERATURE', 'OFFLINE', 'ERROR', 'CALIBRATION_DUE')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  message TEXT NOT NULL,

  -- 측정값
  temperature_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),

  -- 상태
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,

  -- 조치 연결
  corrective_action_id UUID REFERENCES corrective_actions(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iot_sensor_alerts_sensor ON iot_sensor_alerts(sensor_id);
CREATE INDEX IF NOT EXISTS idx_iot_sensor_alerts_company ON iot_sensor_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_iot_sensor_alerts_created ON iot_sensor_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iot_sensor_alerts_unresolved ON iot_sensor_alerts(company_id, is_resolved) WHERE is_resolved = false;

-- RLS
ALTER TABLE iot_sensor_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY iot_sensor_alerts_policy ON iot_sensor_alerts FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 2. 푸시 알림 대기열 (Push Notification Queue)
-- ============================================
CREATE TABLE IF NOT EXISTS push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,

  -- FCM 토큰
  fcm_tokens TEXT[] NOT NULL,

  -- 알림 내용
  payload JSONB NOT NULL,

  -- 상태
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'PARTIAL')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,

  -- 결과
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  failed_tokens TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_push_queue_status ON push_notification_queue(status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_push_queue_user ON push_notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_push_queue_created ON push_notification_queue(created_at DESC);

-- RLS
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_notification_queue_select ON push_notification_queue FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Service role can insert/update
CREATE POLICY push_notification_queue_service ON push_notification_queue FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 3. 센서 알림 설정 (Sensor Alert Settings)
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES iot_sensors(id) ON DELETE CASCADE UNIQUE,

  -- 알림 활성화
  alert_enabled BOOLEAN DEFAULT true,

  -- 온도 임계값
  min_threshold DECIMAL(10,2),
  max_threshold DECIMAL(10,2),

  -- 알림 간격 (분) - 중복 알림 방지
  alert_interval_minutes INTEGER DEFAULT 5,

  -- 오프라인 알림
  offline_alert_enabled BOOLEAN DEFAULT true,
  offline_threshold_minutes INTEGER DEFAULT 10,

  -- 알림 대상
  notify_roles JSONB DEFAULT '["company_admin", "store_manager", "haccp_manager"]',
  notify_users JSONB DEFAULT '[]',

  -- 알림 채널
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT false,
  sms_enabled BOOLEAN DEFAULT false,

  -- 방해 금지 시간
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_exception_critical BOOLEAN DEFAULT true, -- CRITICAL 알림은 예외

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_alert_settings_sensor ON sensor_alert_settings(sensor_id);

-- RLS
ALTER TABLE sensor_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sensor_alert_settings_policy ON sensor_alert_settings FOR ALL USING (
  sensor_id IN (
    SELECT id FROM iot_sensors WHERE company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  )
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 4. 회사별 HACCP 알림 설정 확장
-- ============================================
ALTER TABLE haccp_company_settings
ADD COLUMN IF NOT EXISTS iot_alert_settings JSONB DEFAULT '{
  "enabled": true,
  "default_alert_interval_minutes": 5,
  "offline_threshold_minutes": 10,
  "push_enabled": true,
  "email_enabled": false,
  "sms_enabled": false
}';

-- ============================================
-- Grants
-- ============================================
GRANT ALL ON iot_sensor_alerts TO authenticated;
GRANT ALL ON iot_sensor_alerts TO service_role;
GRANT ALL ON push_notification_queue TO authenticated;
GRANT ALL ON push_notification_queue TO service_role;
GRANT ALL ON sensor_alert_settings TO authenticated;
GRANT ALL ON sensor_alert_settings TO service_role;

-- ============================================
-- Done
-- ============================================
SELECT 'IoT alerts and push notification queue tables created successfully!' as result;
