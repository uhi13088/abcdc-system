-- ============================================
-- 보관위치 테이블 (Storage Locations)
-- ============================================

CREATE TABLE IF NOT EXISTS storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  zone_type VARCHAR(20) NOT NULL CHECK (zone_type IN ('냉장', '냉동', '상온')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_storage_locations_company ON storage_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_storage_locations_active ON storage_locations(company_id, is_active);

-- RLS 정책
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_locations_policy ON storage_locations;
CREATE POLICY storage_locations_policy ON storage_locations FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
);

-- 기본 보관위치 시드 데이터 삽입 함수
CREATE OR REPLACE FUNCTION seed_storage_locations_for_company(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO storage_locations (company_id, name, zone_type, description)
  VALUES
    (p_company_id, '냉장고-1', '냉장', '주요 원재료 보관'),
    (p_company_id, '냉장고-2', '냉장', '부재료 보관'),
    (p_company_id, '냉동고-1', '냉동', '냉동 원료 보관'),
    (p_company_id, '창고-1', '상온', '상온 보관 원료'),
    (p_company_id, '창고-2', '상온', '포장재 보관')
  ON CONFLICT (company_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 코멘트 추가
COMMENT ON TABLE storage_locations IS '원부재료 보관위치 관리';
COMMENT ON COLUMN storage_locations.zone_type IS '구역 타입: 냉장, 냉동, 상온';
COMMENT ON COLUMN storage_locations.is_active IS '활성 상태 (비활성화된 위치는 선택 불가)';
