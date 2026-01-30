-- ============================================
-- IoT Sensors Table - Schema Update
-- 기존 테이블에 누락된 컬럼 추가
-- ============================================

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sensor_name VARCHAR(100) NOT NULL,
  sensor_type VARCHAR(20) NOT NULL,
  protocol VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 누락된 컬럼들 추가 (이미 있으면 무시)
DO $$
BEGIN
  -- 연결 정보
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'connection_string') THEN
    ALTER TABLE iot_sensors ADD COLUMN connection_string TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'device_id') THEN
    ALTER TABLE iot_sensors ADD COLUMN device_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'location') THEN
    ALTER TABLE iot_sensors ADD COLUMN location VARCHAR(200);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'store_id') THEN
    ALTER TABLE iot_sensors ADD COLUMN store_id UUID;
  END IF;

  -- CCP 연동
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'ccp_definition_id') THEN
    ALTER TABLE iot_sensors ADD COLUMN ccp_definition_id UUID;
  END IF;

  -- 설정
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'reading_interval_seconds') THEN
    ALTER TABLE iot_sensors ADD COLUMN reading_interval_seconds INTEGER DEFAULT 60;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'alert_enabled') THEN
    ALTER TABLE iot_sensors ADD COLUMN alert_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'calibration_offset') THEN
    ALTER TABLE iot_sensors ADD COLUMN calibration_offset DECIMAL(10,4) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'last_calibrated_at') THEN
    ALTER TABLE iot_sensors ADD COLUMN last_calibrated_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'calibration_due_at') THEN
    ALTER TABLE iot_sensors ADD COLUMN calibration_due_at TIMESTAMPTZ;
  END IF;

  -- 상태
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'is_active') THEN
    ALTER TABLE iot_sensors ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'status') THEN
    ALTER TABLE iot_sensors ADD COLUMN status VARCHAR(20) DEFAULT 'UNKNOWN';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'last_reading_at') THEN
    ALTER TABLE iot_sensors ADD COLUMN last_reading_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'last_reading_value') THEN
    ALTER TABLE iot_sensors ADD COLUMN last_reading_value DECIMAL(10,2);
  END IF;

  -- 현재 값 (실시간 업데이트용)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'current_temperature') THEN
    ALTER TABLE iot_sensors ADD COLUMN current_temperature DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'iot_sensors' AND column_name = 'current_humidity') THEN
    ALTER TABLE iot_sensors ADD COLUMN current_humidity DECIMAL(10,2);
  END IF;
END $$;

-- 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_iot_sensors_company ON iot_sensors(company_id);
CREATE INDEX IF NOT EXISTS idx_iot_sensors_device_id ON iot_sensors(device_id);

-- RLS
ALTER TABLE iot_sensors ENABLE ROW LEVEL SECURITY;

-- 정책 (이미 있으면 삭제 후 재생성)
DROP POLICY IF EXISTS iot_sensors_policy ON iot_sensors;
CREATE POLICY iot_sensors_policy ON iot_sensors FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 트리거
DROP TRIGGER IF EXISTS update_iot_sensors_updated_at ON iot_sensors;
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

SELECT 'IoT sensors table updated successfully!' as result;
