-- Create platform_settings table for super admin configuration
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name VARCHAR(255) DEFAULT 'Peanote',
  support_email VARCHAR(255) DEFAULT 'support@abcstaff.com',
  max_users_per_company INT DEFAULT 100,
  max_stores_per_company INT DEFAULT 50,
  enable_registration BOOLEAN DEFAULT true,
  require_email_verification BOOLEAN DEFAULT true,
  enable_two_factor BOOLEAN DEFAULT false,
  maintenance_mode BOOLEAN DEFAULT false,
  backup_enabled BOOLEAN DEFAULT true,
  backup_frequency VARCHAR(50) DEFAULT 'daily',
  email_notifications BOOLEAN DEFAULT true,
  slack_notifications BOOLEAN DEFAULT false,
  slack_webhook_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO platform_settings (
  platform_name,
  support_email,
  max_users_per_company,
  max_stores_per_company,
  enable_registration,
  require_email_verification,
  enable_two_factor,
  maintenance_mode,
  backup_enabled,
  backup_frequency,
  email_notifications,
  slack_notifications
) VALUES (
  'Peanote',
  'support@abcstaff.com',
  100,
  50,
  true,
  true,
  false,
  false,
  true,
  'daily',
  true,
  false
) ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL ON platform_settings TO authenticated;
GRANT ALL ON platform_settings TO service_role;

-- RLS policy - only super_admin can access
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage platform settings"
  ON platform_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );
