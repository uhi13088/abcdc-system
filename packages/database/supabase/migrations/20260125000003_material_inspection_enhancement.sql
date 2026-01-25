-- ============================================
-- Material Inspection Enhancement
-- 원·부재료 및 포장재 육안검사일지 개선
-- ============================================

-- 기존 테이블에 새 컬럼 추가
ALTER TABLE material_inspections
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(20), -- 원료/부재료/포장재
  ADD COLUMN IF NOT EXISTS inspected_by_name VARCHAR(100), -- 검사자명

  -- 추가 검사 항목
  ADD COLUMN IF NOT EXISTS foreign_matter_check BOOLEAN, -- 이물혼입 확인
  ADD COLUMN IF NOT EXISTS odor_check BOOLEAN, -- 이취/변질 확인
  ADD COLUMN IF NOT EXISTS weight_check BOOLEAN, -- 중량/개수 확인
  ADD COLUMN IF NOT EXISTS sensory_check BOOLEAN, -- 관능검사 (색상, 형태 등)

  -- 상세 정보
  ADD COLUMN IF NOT EXISTS expiry_date DATE, -- 실제 유통기한 날짜
  ADD COLUMN IF NOT EXISTS manufacture_date DATE, -- 제조일자
  ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(10,2), -- 입고수량
  ADD COLUMN IF NOT EXISTS accepted_quantity DECIMAL(10,2), -- 적합수량
  ADD COLUMN IF NOT EXISTS rejected_quantity DECIMAL(10,2) DEFAULT 0, -- 부적합수량

  -- 포장재 전용 검사항목
  ADD COLUMN IF NOT EXISTS packaging_integrity_check BOOLEAN, -- 포장재 완전성
  ADD COLUMN IF NOT EXISTS printing_check BOOLEAN, -- 인쇄상태
  ADD COLUMN IF NOT EXISTS specification_check BOOLEAN, -- 규격 확인

  -- 원료 전용 검사항목
  ADD COLUMN IF NOT EXISTS freshness_check BOOLEAN, -- 신선도 확인
  ADD COLUMN IF NOT EXISTS color_check BOOLEAN, -- 색상 확인
  ADD COLUMN IF NOT EXISTS texture_check BOOLEAN, -- 질감 확인

  -- 거래명세서/성적서 관련
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100), -- 거래명세서 번호
  ADD COLUMN IF NOT EXISTS test_report_check BOOLEAN, -- 시험성적서 확인
  ADD COLUMN IF NOT EXISTS certificate_check BOOLEAN, -- 인증서 확인

  -- 온도 상세
  ADD COLUMN IF NOT EXISTS temp_standard_min DECIMAL(5,2), -- 온도 기준 최소
  ADD COLUMN IF NOT EXISTS temp_standard_max DECIMAL(5,2), -- 온도 기준 최대

  -- 보관 위치
  ADD COLUMN IF NOT EXISTS storage_location VARCHAR(100), -- 보관 위치

  -- 검증자
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,

  -- 비고
  ADD COLUMN IF NOT EXISTS remarks TEXT,

  -- 사진 첨부
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_material_inspections_date
  ON material_inspections(company_id, inspection_date);
CREATE INDEX IF NOT EXISTS idx_material_inspections_material
  ON material_inspections(company_id, material_id);
CREATE INDEX IF NOT EXISTS idx_material_inspections_result
  ON material_inspections(company_id, overall_result);

-- ============================================
-- 검사 기준 설정 테이블 (재료 유형별)
-- ============================================
CREATE TABLE IF NOT EXISTS material_inspection_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('원료', '부재료', '포장재')),

  -- 필수 검사 항목 설정
  required_checks JSONB NOT NULL DEFAULT '{
    "appearance_check": true,
    "packaging_check": true,
    "label_check": true,
    "temp_check": true,
    "expiry_check": true,
    "document_check": true,
    "foreign_matter_check": true,
    "odor_check": true,
    "weight_check": true
  }',

  -- 온도 기준 (null이면 N/A)
  default_temp_min DECIMAL(5,2),
  default_temp_max DECIMAL(5,2),

  -- 합격 기준 (몇 개 이상 적합해야 PASS)
  pass_threshold INTEGER DEFAULT 9, -- 9개 이상 적합 시 PASS
  conditional_threshold INTEGER DEFAULT 7, -- 7~8개 적합 시 CONDITIONAL

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, material_type)
);

-- 기본 검사 기준 템플릿
CREATE TABLE IF NOT EXISTS material_inspection_standards_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_type VARCHAR(20) NOT NULL UNIQUE,
  required_checks JSONB NOT NULL,
  default_temp_min DECIMAL(5,2),
  default_temp_max DECIMAL(5,2),
  pass_threshold INTEGER DEFAULT 9,
  conditional_threshold INTEGER DEFAULT 7
);

-- 기본 템플릿 데이터 삽입
INSERT INTO material_inspection_standards_template (material_type, required_checks, default_temp_min, default_temp_max)
VALUES
  ('원료', '{
    "appearance_check": true,
    "packaging_check": true,
    "label_check": true,
    "temp_check": true,
    "expiry_check": true,
    "document_check": true,
    "foreign_matter_check": true,
    "odor_check": true,
    "weight_check": true,
    "freshness_check": true,
    "color_check": true,
    "texture_check": false,
    "sensory_check": true
  }', 0, 10),
  ('부재료', '{
    "appearance_check": true,
    "packaging_check": true,
    "label_check": true,
    "temp_check": false,
    "expiry_check": true,
    "document_check": true,
    "foreign_matter_check": true,
    "odor_check": false,
    "weight_check": true,
    "sensory_check": false
  }', NULL, NULL),
  ('포장재', '{
    "appearance_check": true,
    "packaging_check": false,
    "label_check": true,
    "temp_check": false,
    "expiry_check": false,
    "document_check": true,
    "foreign_matter_check": true,
    "odor_check": false,
    "weight_check": true,
    "packaging_integrity_check": true,
    "printing_check": true,
    "specification_check": true
  }', NULL, NULL)
ON CONFLICT (material_type) DO NOTHING;

-- RLS 정책
ALTER TABLE material_inspection_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_inspection_standards_policy ON material_inspection_standards FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Done
SELECT 'Material inspection enhancement migration completed!' as result;
