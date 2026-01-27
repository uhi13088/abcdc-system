-- ============================================
-- ESP32 Device Registration System
-- 고객이 QR코드/등록코드로 쉽게 기기 등록
-- ============================================

-- 기기 프로비저닝 테이블 (Admin이 기기 생산 시 등록)
CREATE TABLE IF NOT EXISTS esp32_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기기 식별 정보
  device_code VARCHAR(12) NOT NULL UNIQUE,  -- 등록 코드 (예: ABC-123-XYZ)
  serial_number VARCHAR(50) UNIQUE,          -- 시리얼 번호
  mac_address VARCHAR(17),                   -- MAC 주소 (XX:XX:XX:XX:XX:XX)

  -- 기기 정보
  device_name VARCHAR(100) DEFAULT 'HACCP 온도센서',
  device_type VARCHAR(30) DEFAULT 'TEMPERATURE',
  firmware_version VARCHAR(20) DEFAULT '1.0.0',
  hardware_version VARCHAR(20) DEFAULT '1.0',

  -- 등록 상태
  status VARCHAR(20) DEFAULT 'PROVISIONED' CHECK (status IN (
    'PROVISIONED',  -- 생산됨 (미등록)
    'CLAIMED',      -- 고객이 등록함
    'ACTIVE',       -- 활성화 (데이터 전송 중)
    'OFFLINE',      -- 오프라인
    'DEACTIVATED'   -- 비활성화
  )),

  -- 고객 연결 정보 (등록 후 설정됨)
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  linked_sensor_id UUID REFERENCES iot_sensors(id) ON DELETE SET NULL,

  -- 연결 정보
  last_ip VARCHAR(45),
  last_seen_at TIMESTAMPTZ,
  wifi_ssid VARCHAR(100),
  wifi_signal_strength INTEGER,  -- dBm

  -- API 인증
  api_key VARCHAR(64) UNIQUE,

  -- 메타데이터
  manufactured_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_esp32_devices_code ON esp32_devices(device_code);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_status ON esp32_devices(status);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_company ON esp32_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_claimed_by ON esp32_devices(claimed_by);
CREATE INDEX IF NOT EXISTS idx_esp32_devices_api_key ON esp32_devices(api_key);

-- RLS
ALTER TABLE esp32_devices ENABLE ROW LEVEL SECURITY;

-- Super admin can see all
CREATE POLICY esp32_devices_super_admin ON esp32_devices FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Users can see their claimed devices
CREATE POLICY esp32_devices_user_select ON esp32_devices FOR SELECT USING (
  claimed_by = (SELECT id FROM users WHERE auth_id = auth.uid())
  OR company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
);

-- Users can update their claimed devices (limited)
CREATE POLICY esp32_devices_user_update ON esp32_devices FOR UPDATE USING (
  claimed_by = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Grants
GRANT ALL ON esp32_devices TO authenticated;
GRANT ALL ON esp32_devices TO service_role;

-- ============================================
-- Helper function: Generate device code
-- Format: XXX-XXX-XXX (알파벳+숫자)
-- ============================================
CREATE OR REPLACE FUNCTION generate_device_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 혼동되는 문자 제외 (0,O,1,I)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  result := result || '-';
  FOR i IN 1..3 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Helper function: Generate API key for device
-- ============================================
CREATE OR REPLACE FUNCTION generate_device_api_key()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := 'dev_';
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
SELECT 'ESP32 device registration tables created!' as result;
