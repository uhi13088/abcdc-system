-- Migration: 022_notification_settings
-- Description: Add notification_settings table for user notification preferences
-- Created: 2026-01-16

-- User notification settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Channel settings
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,

  -- Alert type settings
  attendance_alerts BOOLEAN DEFAULT true,
  approval_alerts BOOLEAN DEFAULT true,
  salary_alerts BOOLEAN DEFAULT true,
  schedule_alerts BOOLEAN DEFAULT true,
  haccp_alerts BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_company ON notification_settings(company_id);

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
