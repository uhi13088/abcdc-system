-- ============================================
-- Sensor Readings Table
-- For storing IoT sensor reading history
-- ============================================

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES iot_sensors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 측정값
  reading_value DECIMAL(10,4) NOT NULL,
  reading_unit VARCHAR(20),

  -- 한계 기준 확인
  is_within_limit BOOLEAN,
  limit_min DECIMAL(10,2),
  limit_max DECIMAL(10,2),

  -- 기록 시간
  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  -- 메타데이터
  raw_data JSONB,
  source VARCHAR(50) DEFAULT 'IOT'
);

-- 인덱스 (시계열 데이터 최적화)
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_company_time ON sensor_readings(company_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_limit ON sensor_readings(sensor_id, is_within_limit) WHERE is_within_limit = false;

-- 파티셔닝을 위한 시간 인덱스
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at);

-- RLS 정책
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY sensor_readings_policy ON sensor_readings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 센서 최신 값 업데이트 트리거
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

-- 코멘트
COMMENT ON TABLE sensor_readings IS 'IoT 센서 측정값 기록';
COMMENT ON COLUMN sensor_readings.is_within_limit IS '한계 기준 이내 여부';
COMMENT ON COLUMN sensor_readings.source IS '데이터 소스: IOT, MANUAL, IMPORT';

SELECT 'Sensor readings table created successfully!' as result;
