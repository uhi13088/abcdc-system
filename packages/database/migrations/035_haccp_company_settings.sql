-- Migration: 035_haccp_company_settings
-- Description: Add HACCP certification fields to companies and create haccp_company_settings table
-- Created: 2026-01-22

-- Add HACCP certification fields to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS haccp_certification_number VARCHAR(50);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS haccp_certification_date DATE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS haccp_certification_expiry DATE;

COMMENT ON COLUMN companies.haccp_certification_number IS 'HACCP 인증번호';
COMMENT ON COLUMN companies.haccp_certification_date IS 'HACCP 인증일';
COMMENT ON COLUMN companies.haccp_certification_expiry IS 'HACCP 인증 만료일';

-- Create HACCP company settings table for operational settings
CREATE TABLE IF NOT EXISTS haccp_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

  -- Notification settings
  ccp_alert_enabled BOOLEAN DEFAULT true,
  ccp_deviation_notification BOOLEAN DEFAULT true,
  daily_report_enabled BOOLEAN DEFAULT true,
  daily_report_time TIME DEFAULT '18:00',
  inspection_reminder BOOLEAN DEFAULT true,
  inspection_reminder_hours INTEGER DEFAULT 2,
  training_reminder BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  notification_email VARCHAR(255),

  -- HACCP operational settings
  auto_logout_minutes INTEGER DEFAULT 30,
  require_photo_evidence BOOLEAN DEFAULT true,
  allow_late_entry BOOLEAN DEFAULT false,
  late_entry_hours INTEGER DEFAULT 24,
  require_corrective_action BOOLEAN DEFAULT true,
  ccp_monitoring_interval INTEGER DEFAULT 60,
  temperature_unit VARCHAR(20) DEFAULT 'celsius' CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
  record_retention_years INTEGER DEFAULT 3,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_haccp_company_settings_company ON haccp_company_settings(company_id);

-- Enable RLS
ALTER TABLE haccp_company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies - company isolation
CREATE POLICY haccp_company_settings_select ON haccp_company_settings
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY haccp_company_settings_insert ON haccp_company_settings
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY haccp_company_settings_update ON haccp_company_settings
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY haccp_company_settings_delete ON haccp_company_settings
  FOR DELETE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin')
  );

-- Create trigger for updated_at
CREATE OR REPLACE TRIGGER trigger_update_haccp_company_settings_updated_at
BEFORE UPDATE ON haccp_company_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
