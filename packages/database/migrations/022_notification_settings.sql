-- Migration: 022_notification_settings
-- Description: Add notification_settings table for user and store notification preferences
-- Created: 2026-01-16

-- Notification settings (사용자별 또는 매장별)
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- 사용자별 설정 (nullable)
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- 매장별 설정

  -- Category for HACCP store settings (ccp_verification, temperature_alert, etc.)
  category VARCHAR(50),

  -- Flexible settings as JSONB (for HACCP store-level settings)
  settings JSONB,

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

  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_company ON notification_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_store ON notification_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_category ON notification_settings(category);

-- Enable RLS
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY notification_settings_user_policy ON notification_settings
  FOR ALL USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Allow admins to see all settings in their company
CREATE POLICY notification_settings_admin_policy ON notification_settings
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
      AND role IN ('COMPANY_ADMIN', 'PLATFORM_ADMIN')
    )
  );
