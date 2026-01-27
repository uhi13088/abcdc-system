-- Tuya/Smart Life IoT Integration Tables
-- This migration adds support for Tuya Smart Life device integration

-- Create a key-value platform settings table for API credentials and configs
CREATE TABLE IF NOT EXISTS platform_kv_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON platform_kv_settings TO authenticated;
GRANT ALL ON platform_kv_settings TO service_role;

-- RLS policy - only super_admin can access
ALTER TABLE platform_kv_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage platform kv settings"
  ON platform_kv_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- User Tuya Connections table
-- Stores individual user's Smart Life account connection
CREATE TABLE IF NOT EXISTS user_tuya_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  tuya_uid VARCHAR(100) NOT NULL,
  tuya_username VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  expire_time BIGINT,
  device_count INT DEFAULT 0,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_tuya_connections_user_id ON user_tuya_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tuya_connections_company_id ON user_tuya_connections(company_id);

-- Grant permissions
GRANT ALL ON user_tuya_connections TO authenticated;
GRANT ALL ON user_tuya_connections TO service_role;

-- RLS policies
ALTER TABLE user_tuya_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Tuya connection"
  ON user_tuya_connections
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own Tuya connection"
  ON user_tuya_connections
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Tuya Devices table
-- Stores devices synced from Smart Life
CREATE TABLE IF NOT EXISTS tuya_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  tuya_device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  product_id VARCHAR(100),
  product_name VARCHAR(255),
  is_online BOOLEAN DEFAULT false,
  icon TEXT,
  ip_address VARCHAR(50),
  time_zone VARCHAR(50),
  last_status JSONB,
  linked_sensor_id UUID REFERENCES iot_sensors(id) ON DELETE SET NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tuya_device_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tuya_devices_user_id ON tuya_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_tuya_devices_company_id ON tuya_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_tuya_devices_tuya_device_id ON tuya_devices(tuya_device_id);
CREATE INDEX IF NOT EXISTS idx_tuya_devices_linked_sensor_id ON tuya_devices(linked_sensor_id);

-- Grant permissions
GRANT ALL ON tuya_devices TO authenticated;
GRANT ALL ON tuya_devices TO service_role;

-- RLS policies
ALTER TABLE tuya_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Tuya devices"
  ON tuya_devices
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own Tuya devices"
  ON tuya_devices
  FOR ALL
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Company admins can view all devices in their company
CREATE POLICY "Company admins can view company Tuya devices"
  ON tuya_devices
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('company_admin', 'store_manager')
    )
  );
