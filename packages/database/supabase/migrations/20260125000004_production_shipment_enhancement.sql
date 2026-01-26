-- ============================================
-- Production & Shipment Enhancement
-- 완제품 생산 및 출하현황일지 개선
-- ============================================

-- ============================================
-- 1. 생산기록 테이블 개선
-- ============================================
ALTER TABLE production_records
  -- 생산조건 상세 (기존 JSONB 대신 구조화)
  ADD COLUMN IF NOT EXISTS temperature DECIMAL(5,2), -- 생산 시 온도
  ADD COLUMN IF NOT EXISTS humidity DECIMAL(5,2), -- 생산 시 습도
  ADD COLUMN IF NOT EXISTS temperature_unit VARCHAR(10) DEFAULT 'C',

  -- 품질검사
  ADD COLUMN IF NOT EXISTS quality_check_status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (quality_check_status IN ('PENDING', 'PASS', 'FAIL', 'CONDITIONAL')),
  ADD COLUMN IF NOT EXISTS quality_checked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS quality_checked_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS quality_notes TEXT,

  -- 품질검사 항목
  ADD COLUMN IF NOT EXISTS appearance_check BOOLEAN, -- 외관검사
  ADD COLUMN IF NOT EXISTS weight_check BOOLEAN, -- 중량검사
  ADD COLUMN IF NOT EXISTS packaging_check BOOLEAN, -- 포장상태
  ADD COLUMN IF NOT EXISTS label_check BOOLEAN, -- 표시사항
  ADD COLUMN IF NOT EXISTS metal_detection_check BOOLEAN, -- 금속검출
  ADD COLUMN IF NOT EXISTS taste_check BOOLEAN, -- 관능검사(맛)
  ADD COLUMN IF NOT EXISTS smell_check BOOLEAN, -- 관능검사(냄새)
  ADD COLUMN IF NOT EXISTS color_check BOOLEAN, -- 관능검사(색상)

  -- 작업자 정보 상세
  ADD COLUMN IF NOT EXISTS worker_names TEXT[], -- 작업자 이름 배열
  ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(100),

  -- 불량 상세
  ADD COLUMN IF NOT EXISTS defect_reason TEXT, -- 불량 사유
  ADD COLUMN IF NOT EXISTS defect_action TEXT, -- 불량 조치

  -- 생산 승인
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'PENDING'
    CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD')),

  -- 비고
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_production_records_quality_status
  ON production_records(company_id, quality_check_status);
CREATE INDEX IF NOT EXISTS idx_production_records_approval_status
  ON production_records(company_id, approval_status);

-- ============================================
-- 2. 출하기록 테이블 개선
-- ============================================
ALTER TABLE shipment_records
  -- 시간 정보
  ADD COLUMN IF NOT EXISTS shipment_time TIME, -- 출하시간
  ADD COLUMN IF NOT EXISTS estimated_arrival_time TIMESTAMP, -- 예상 도착시간
  ADD COLUMN IF NOT EXISTS actual_arrival_time TIMESTAMP, -- 실제 도착시간

  -- 온도 기록 상세
  ADD COLUMN IF NOT EXISTS departure_temp DECIMAL(5,2), -- 출발 시 온도
  ADD COLUMN IF NOT EXISTS arrival_temp DECIMAL(5,2), -- 도착 시 온도
  ADD COLUMN IF NOT EXISTS temp_standard_min DECIMAL(5,2), -- 온도 기준 최소
  ADD COLUMN IF NOT EXISTS temp_standard_max DECIMAL(5,2), -- 온도 기준 최대

  -- 출하 전 검사
  ADD COLUMN IF NOT EXISTS pre_shipment_check BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pre_shipment_checked_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS pre_shipment_checked_by_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pre_shipment_checked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pre_shipment_notes TEXT,

  -- 검사 항목
  ADD COLUMN IF NOT EXISTS product_condition_check BOOLEAN, -- 제품상태
  ADD COLUMN IF NOT EXISTS packaging_condition_check BOOLEAN, -- 포장상태
  ADD COLUMN IF NOT EXISTS quantity_check BOOLEAN, -- 수량확인
  ADD COLUMN IF NOT EXISTS label_check BOOLEAN, -- 표시사항
  ADD COLUMN IF NOT EXISTS vehicle_cleanliness_check BOOLEAN, -- 차량 청결상태
  ADD COLUMN IF NOT EXISTS vehicle_temp_check BOOLEAN, -- 차량 온도 적정 여부

  -- 수령 확인
  ADD COLUMN IF NOT EXISTS received_by VARCHAR(100), -- 수령자
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMP, -- 수령시간
  ADD COLUMN IF NOT EXISTS receiver_signature TEXT, -- 수령 서명 (base64)
  ADD COLUMN IF NOT EXISTS receiving_notes TEXT, -- 수령 시 특이사항
  ADD COLUMN IF NOT EXISTS receiving_temp DECIMAL(5,2), -- 수령 시 온도

  -- 반품 정보
  ADD COLUMN IF NOT EXISTS return_quantity DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_reason TEXT,

  -- 담당자
  ADD COLUMN IF NOT EXISTS shipped_by_name VARCHAR(100),

  -- 비고
  ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shipment_records_status
  ON shipment_records(company_id, status);

-- ============================================
-- 3. 완제품 품질검사 테이블 (별도)
-- ============================================
CREATE TABLE IF NOT EXISTS product_quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 검사 대상
  production_record_id UUID REFERENCES production_records(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id),
  lot_number VARCHAR(100) NOT NULL,
  inspection_date DATE NOT NULL,
  inspection_time TIME,

  -- 검사 항목
  appearance_result VARCHAR(20) CHECK (appearance_result IN ('PASS', 'FAIL', 'NA')),
  appearance_notes TEXT,

  weight_result VARCHAR(20) CHECK (weight_result IN ('PASS', 'FAIL', 'NA')),
  weight_standard DECIMAL(10,2), -- 기준 중량
  weight_actual DECIMAL(10,2), -- 실제 중량
  weight_tolerance DECIMAL(5,2), -- 허용 오차 (%)

  packaging_result VARCHAR(20) CHECK (packaging_result IN ('PASS', 'FAIL', 'NA')),
  packaging_notes TEXT,

  label_result VARCHAR(20) CHECK (label_result IN ('PASS', 'FAIL', 'NA')),
  label_notes TEXT,

  metal_detection_result VARCHAR(20) CHECK (metal_detection_result IN ('PASS', 'FAIL', 'NA')),
  metal_detection_notes TEXT,

  -- 관능검사
  sensory_taste_result VARCHAR(20) CHECK (sensory_taste_result IN ('PASS', 'FAIL', 'NA')),
  sensory_smell_result VARCHAR(20) CHECK (sensory_smell_result IN ('PASS', 'FAIL', 'NA')),
  sensory_color_result VARCHAR(20) CHECK (sensory_color_result IN ('PASS', 'FAIL', 'NA')),
  sensory_texture_result VARCHAR(20) CHECK (sensory_texture_result IN ('PASS', 'FAIL', 'NA')),
  sensory_notes TEXT,

  -- 전체 결과
  overall_result VARCHAR(20) NOT NULL CHECK (overall_result IN ('PASS', 'FAIL', 'CONDITIONAL')),
  fail_reason TEXT,
  corrective_action TEXT,

  -- 검사자/승인자
  inspected_by UUID REFERENCES users(id),
  inspected_by_name VARCHAR(100),

  approved_by UUID REFERENCES users(id),
  approved_by_name VARCHAR(100),
  approved_at TIMESTAMP,

  -- 샘플 정보
  sample_quantity INTEGER, -- 샘플 수량
  sample_unit VARCHAR(20),

  -- 비고
  remarks TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_product_quality_inspections_date
  ON product_quality_inspections(company_id, inspection_date);
CREATE INDEX IF NOT EXISTS idx_product_quality_inspections_lot
  ON product_quality_inspections(company_id, lot_number);
CREATE INDEX IF NOT EXISTS idx_product_quality_inspections_result
  ON product_quality_inspections(company_id, overall_result);

-- RLS 정책
ALTER TABLE product_quality_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_quality_inspections_policy ON product_quality_inspections FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 4. 생산 조건 기준 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS production_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  product_id UUID REFERENCES products(id),
  product_category VARCHAR(100), -- 제품 카테고리 (제품ID 없으면 카테고리로)

  -- 온도/습도 기준
  temp_min DECIMAL(5,2),
  temp_max DECIMAL(5,2),
  humidity_min DECIMAL(5,2),
  humidity_max DECIMAL(5,2),

  -- 품질검사 필수 항목
  required_checks JSONB DEFAULT '{
    "appearance_check": true,
    "weight_check": true,
    "packaging_check": true,
    "label_check": true,
    "metal_detection_check": false,
    "taste_check": false,
    "smell_check": false,
    "color_check": true
  }',

  -- 중량 기준
  weight_standard DECIMAL(10,2),
  weight_tolerance DECIMAL(5,2) DEFAULT 5, -- 허용 오차 (%)

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, product_id)
);

-- RLS 정책
ALTER TABLE production_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY production_standards_policy ON production_standards FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Done
SELECT 'Production & Shipment enhancement migration completed!' as result;
