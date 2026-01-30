-- ============================================
-- IoT Sensors Table
-- For managing IoT temperature/humidity sensors
-- ============================================

CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 센서 정보
  sensor_name VARCHAR(100) NOT NULL,
  sensor_type VARCHAR(20) NOT NULL CHECK (sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'PH', 'PRESSURE', 'FLOW', 'WEIGHT', 'OTHER')),
  protocol VARCHAR(20) NOT NULL CHECK (protocol IN ('MQTT', 'HTTP', 'BLE', 'MODBUS', 'SERIAL')),

  -- 연결 정보
  connection_string TEXT,
  device_id VARCHAR(100),
  location VARCHAR(200),
  store_id UUID,

  -- CCP 연동
  ccp_definition_id UUID,

  -- 설정
  reading_interval_seconds INTEGER DEFAULT 60,
  alert_enabled BOOLEAN DEFAULT true,
  calibration_offset DECIMAL(10,4) DEFAULT 0,
  last_calibrated_at TIMESTAMPTZ,
  calibration_due_at TIMESTAMPTZ,

  -- 상태
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'UNKNOWN' CHECK (status IN ('ONLINE', 'OFFLINE', 'UNKNOWN')),
  last_reading_at TIMESTAMPTZ,
  last_reading_value DECIMAL(10,2),

  -- 현재 값 (실시간 업데이트용)
  current_temperature DECIMAL(10,2),
  current_humidity DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_iot_sensors_company ON iot_sensors(company_id);
CREATE INDEX IF NOT EXISTS idx_iot_sensors_active ON iot_sensors(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_iot_sensors_status ON iot_sensors(company_id, status);
CREATE INDEX IF NOT EXISTS idx_iot_sensors_device_id ON iot_sensors(device_id);

-- RLS 정책
ALTER TABLE iot_sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY iot_sensors_policy ON iot_sensors FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_iot_sensors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_iot_sensors_updated_at
  BEFORE UPDATE ON iot_sensors
  FOR EACH ROW
  EXECUTE FUNCTION update_iot_sensors_updated_at();

-- 코멘트
COMMENT ON TABLE iot_sensors IS 'IoT 센서 장치 관리';
COMMENT ON COLUMN iot_sensors.sensor_type IS '센서 유형: TEMPERATURE, HUMIDITY, PH, PRESSURE, FLOW, WEIGHT, OTHER';
COMMENT ON COLUMN iot_sensors.protocol IS '통신 프로토콜: MQTT, HTTP, BLE, MODBUS, SERIAL';
COMMENT ON COLUMN iot_sensors.status IS '연결 상태: ONLINE, OFFLINE, UNKNOWN';

SELECT 'IoT sensors table created successfully!' as result;
