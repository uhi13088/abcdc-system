-- ============================================
-- Equipment Temperature Records Table
-- For manual temperature recording (HACCP)
-- ============================================

CREATE TABLE IF NOT EXISTS equipment_temperature_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 기록 정보
  record_date DATE NOT NULL,
  record_time TIME NOT NULL,

  -- 장비 정보
  equipment_location VARCHAR(100) NOT NULL,
  equipment_id UUID,

  -- 온도 기록
  temperature DECIMAL(5,2) NOT NULL,
  target_temperature DECIMAL(5,2),
  is_within_limit BOOLEAN DEFAULT true,

  -- 입력 유형
  input_type VARCHAR(20) DEFAULT 'manual' CHECK (input_type IN ('manual', 'iot')),

  -- 이탈 시 조치
  deviation_action TEXT,

  -- 기록자
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_company ON equipment_temperature_records(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_date ON equipment_temperature_records(company_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_location ON equipment_temperature_records(company_id, equipment_location);
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_limit ON equipment_temperature_records(company_id, is_within_limit) WHERE is_within_limit = false;

-- RLS 정책
ALTER TABLE equipment_temperature_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_temp_records_policy ON equipment_temperature_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_equipment_temp_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_equipment_temp_records_updated_at
  BEFORE UPDATE ON equipment_temperature_records
  FOR EACH ROW
  EXECUTE FUNCTION update_equipment_temp_records_updated_at();

-- 코멘트
COMMENT ON TABLE equipment_temperature_records IS '장비 온도 기록 (수동 입력)';
COMMENT ON COLUMN equipment_temperature_records.input_type IS '입력 유형: manual(수동), iot(자동)';
COMMENT ON COLUMN equipment_temperature_records.deviation_action IS '온도 이탈 시 취한 조치';

SELECT 'Equipment temperature records table created successfully!' as result;
