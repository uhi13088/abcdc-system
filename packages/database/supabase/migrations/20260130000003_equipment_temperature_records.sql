-- ============================================
-- Equipment Temperature Records Table - Schema Update
-- 기존 테이블에 누락된 컬럼 추가
-- ============================================

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS equipment_temperature_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  equipment_location VARCHAR(100) NOT NULL,
  temperature DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 누락된 컬럼들 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'record_time') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN record_time TIME;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'equipment_id') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN equipment_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'target_temperature') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN target_temperature DECIMAL(5,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'is_within_limit') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN is_within_limit BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'input_type') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN input_type VARCHAR(20) DEFAULT 'manual';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'deviation_action') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN deviation_action TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'recorded_by') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'equipment_temperature_records' AND column_name = 'updated_at') THEN
    ALTER TABLE equipment_temperature_records ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_company ON equipment_temperature_records(company_id);
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_date ON equipment_temperature_records(company_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_temp_records_location ON equipment_temperature_records(company_id, equipment_location);

-- RLS
ALTER TABLE equipment_temperature_records ENABLE ROW LEVEL SECURITY;

-- 정책 (이미 있으면 삭제 후 재생성)
DROP POLICY IF EXISTS equipment_temp_records_policy ON equipment_temperature_records;
CREATE POLICY equipment_temp_records_policy ON equipment_temperature_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 업데이트 트리거
DROP TRIGGER IF EXISTS update_equipment_temp_records_updated_at ON equipment_temperature_records;
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

SELECT 'Equipment temperature records table updated successfully!' as result;
