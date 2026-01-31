-- Notification Settings Table
-- 알림 설정을 저장하는 테이블

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- 사용자별 설정 (nullable)
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- 매장별 설정
    category VARCHAR(50),
    -- 카테고리: ccp_verification, daily_checklist, equipment_calibration 등
    settings JSONB DEFAULT '{}',
    -- 설정 내용 (JSON)
    -- 예: {
    --   "monthly_verification_reminder_enabled": true,
    --   "reminder_day": "last_friday",
    --   "reminder_time": "09:00",
    --   "target_roles": ["VERIFIER", "ADMIN"],
    --   "reminder_message": "..."
    -- }

    -- Channel settings (for user-level settings)
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,

    -- Alert type settings (for user-level settings)
    attendance_alerts BOOLEAN DEFAULT true,
    approval_alerts BOOLEAN DEFAULT true,
    salary_alerts BOOLEAN DEFAULT true,
    schedule_alerts BOOLEAN DEFAULT true,
    haccp_alerts BOOLEAN DEFAULT true,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_settings_company_category
ON notification_settings(company_id, category);

CREATE INDEX IF NOT EXISTS idx_notification_settings_user
ON notification_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_settings_store
ON notification_settings(store_id);

-- RLS Policies
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 같은 회사 사용자 또는 본인 설정만 조회 가능
CREATE POLICY "notification_settings_select_policy" ON notification_settings
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE auth_id = auth.uid()
        )
        OR user_id IN (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
    );

-- 관리자 또는 본인 설정만 생성 가능
CREATE POLICY "notification_settings_insert_policy" ON notification_settings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER', 'VERIFIER')
        )
        OR user_id IN (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "notification_settings_update_policy" ON notification_settings
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER', 'VERIFIER')
        )
        OR user_id IN (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "notification_settings_delete_policy" ON notification_settings
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER')
        )
        OR user_id IN (
            SELECT id FROM users WHERE auth_id = auth.uid()
        )
    );

-- Comments
COMMENT ON TABLE notification_settings IS '알림 설정 테이블';
COMMENT ON COLUMN notification_settings.user_id IS '사용자별 알림 설정 (nullable)';
COMMENT ON COLUMN notification_settings.store_id IS '매장별 알림 설정';
COMMENT ON COLUMN notification_settings.category IS '알림 카테고리 (ccp_verification, daily_checklist 등)';
COMMENT ON COLUMN notification_settings.settings IS '알림 설정 내용 (JSON)';
