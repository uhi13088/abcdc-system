-- Company Equipment Settings Table
-- For configuring monitoring equipment locations/targets

CREATE TABLE IF NOT EXISTS company_equipment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('freezer', 'fridge')),
  target_temp DECIMAL(5,2) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  location TEXT,
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_equipment_settings_company_id ON company_equipment_settings(company_id);

-- Add RLS policies
ALTER TABLE company_equipment_settings ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read their company's equipment settings
CREATE POLICY company_equipment_settings_select ON company_equipment_settings
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Policy for authenticated users to insert equipment settings for their company
CREATE POLICY company_equipment_settings_insert ON company_equipment_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Policy for authenticated users to update their company's equipment settings
CREATE POLICY company_equipment_settings_update ON company_equipment_settings
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Policy for authenticated users to delete their company's equipment settings
CREATE POLICY company_equipment_settings_delete ON company_equipment_settings
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_company_equipment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_equipment_settings_updated_at
  BEFORE UPDATE ON company_equipment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_company_equipment_settings_updated_at();

-- Comments
COMMENT ON TABLE company_equipment_settings IS 'Company-specific temperature monitoring equipment settings';
COMMENT ON COLUMN company_equipment_settings.key IS 'Unique key identifier for the equipment within a company';
COMMENT ON COLUMN company_equipment_settings.type IS 'Equipment type: freezer or fridge';
COMMENT ON COLUMN company_equipment_settings.target_temp IS 'Target temperature in Celsius';
COMMENT ON COLUMN company_equipment_settings.sensor_id IS 'Optional linked IoT sensor';
