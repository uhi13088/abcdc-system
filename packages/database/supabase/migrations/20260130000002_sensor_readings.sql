-- ============================================
-- Sensor Readings Table - Schema Update
-- 기존 테이블에 누락된 컬럼 추가
-- ============================================

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES iot_sensors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reading_value DECIMAL(10,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 누락된 컬럼들 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'reading_unit') THEN
    ALTER TABLE sensor_readings ADD COLUMN reading_unit VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'is_within_limit') THEN
    ALTER TABLE sensor_readings ADD COLUMN is_within_limit BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'limit_min') THEN
    ALTER TABLE sensor_readings ADD COLUMN limit_min DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'limit_max') THEN
    ALTER TABLE sensor_readings ADD COLUMN limit_max DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'recorded_at') THEN
    ALTER TABLE sensor_readings ADD COLUMN recorded_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'raw_data') THEN
    ALTER TABLE sensor_readings ADD COLUMN raw_data JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensor_readings' AND column_name = 'source') THEN
    ALTER TABLE sensor_readings ADD COLUMN source VARCHAR(50) DEFAULT 'IOT';
  END IF;
END $$;

-- 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_company_time ON sensor_readings(company_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at);

-- RLS
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

-- 정책 (이미 있으면 삭제 후 재생성)
DROP POLICY IF EXISTS sensor_readings_policy ON sensor_readings;
CREATE POLICY sensor_readings_policy ON sensor_readings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 센서 최신 값 업데이트 트리거
DROP TRIGGER IF EXISTS update_sensor_last_reading ON sensor_readings;
CREATE OR REPLACE FUNCTION update_sensor_last_reading()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE iot_sensors
  SET
    last_reading_at = NEW.recorded_at,
    last_reading_value = NEW.reading_value,
    status = 'ONLINE',
    updated_at = NOW()
  WHERE id = NEW.sensor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sensor_last_reading
  AFTER INSERT ON sensor_readings
  FOR EACH ROW
  EXECUTE FUNCTION update_sensor_last_reading();

SELECT 'Sensor readings table updated successfully!' as result;
