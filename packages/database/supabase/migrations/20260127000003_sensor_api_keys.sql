-- ============================================
-- Sensor API Keys for ESP32/IoT Direct Connection
-- ============================================

CREATE TABLE IF NOT EXISTS sensor_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sensor_id UUID REFERENCES iot_sensors(id) ON DELETE CASCADE,

  -- API Key (랜덤 생성)
  api_key VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL, -- "냉장고1 센서 키" 등

  -- 제한 설정
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, -- null이면 무제한

  -- 사용 통계
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,

  -- 메타데이터
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sensor_api_keys_api_key ON sensor_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_sensor_api_keys_company ON sensor_api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_sensor_api_keys_sensor ON sensor_api_keys(sensor_id);

-- RLS
ALTER TABLE sensor_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY sensor_api_keys_policy ON sensor_api_keys FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Grants
GRANT ALL ON sensor_api_keys TO authenticated;
GRANT ALL ON sensor_api_keys TO service_role;

-- ============================================
-- Helper function to generate API key
-- ============================================
CREATE OR REPLACE FUNCTION generate_sensor_api_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := 'sk_';
  i INTEGER;
BEGIN
  FOR i IN 1..40 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Done
-- ============================================
SELECT 'Sensor API keys table created!' as result;
