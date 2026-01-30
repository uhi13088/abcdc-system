-- Notification Settings Table
-- 알림 설정을 저장하는 테이블

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    -- 카테고리: ccp_verification, daily_checklist, equipment_calibration 등
    settings JSONB NOT NULL DEFAULT '{}',
    -- 설정 내용 (JSON)
    -- 예: {
    --   "monthly_verification_reminder_enabled": true,
    --   "reminder_day": "last_friday",
    --   "reminder_time": "09:00",
    --   "target_roles": ["VERIFIER", "ADMIN"],
    --   "reminder_message": "..."
    -- }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE(company_id, category)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_notification_settings_company_category
ON notification_settings(company_id, category);

-- RLS Policies
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- 같은 회사 사용자만 조회 가능
CREATE POLICY "notification_settings_select_policy" ON notification_settings
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE auth_id = auth.uid()
        )
    );

-- 관리자만 생성/수정/삭제 가능
CREATE POLICY "notification_settings_insert_policy" ON notification_settings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER', 'VERIFIER')
        )
    );

CREATE POLICY "notification_settings_update_policy" ON notification_settings
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER', 'VERIFIER')
        )
    );

CREATE POLICY "notification_settings_delete_policy" ON notification_settings
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('ADMIN', 'MANAGER')
        )
    );

-- Comment
COMMENT ON TABLE notification_settings IS '알림 설정 테이블';
COMMENT ON COLUMN notification_settings.category IS '알림 카테고리 (ccp_verification, daily_checklist 등)';
COMMENT ON COLUMN notification_settings.settings IS '알림 설정 내용 (JSON)';
