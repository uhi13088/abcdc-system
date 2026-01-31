-- ============================================
-- HACCP Additional Tables
-- 1. HACCP 교육훈련 기록 (haccp_training_records)
-- 2. 감사 보고서 (audit_reports)
-- 3. 검교정 관리 기록 (calibration_records)
-- 4. 반품/회수/폐기 관리 (returns_disposals)
-- 5. 보관 창고 점검 기록 (storage_inspections)
-- ============================================

-- ============================================
-- 1. HACCP 교육훈련 기록
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  training_date DATE NOT NULL,
  training_type VARCHAR(30) NOT NULL CHECK (training_type IN ('HACCP_BASIC', 'HACCP_ADVANCED', 'HYGIENE', 'SAFETY', 'CCP', 'OTHER')),
  title VARCHAR(255) NOT NULL,
  instructor VARCHAR(100) NOT NULL,
  instructor_company VARCHAR(255), -- 외부강사 소속
  duration_hours DECIMAL(4,1) NOT NULL DEFAULT 1,
  location VARCHAR(100),
  materials TEXT, -- 교육자료
  content_summary TEXT, -- 교육 내용 요약

  attendees JSONB DEFAULT '[]', -- [{user_id, employee_name, department, completed, signature_url}]

  notes TEXT,
  status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),

  created_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. 감사 보고서
-- ============================================
CREATE TABLE IF NOT EXISTS audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('INTERNAL', 'EXTERNAL', 'CERTIFICATION')),

  auditor_name VARCHAR(100) NOT NULL,
  auditor_company VARCHAR(255), -- 감사 기관
  auditor_contact VARCHAR(100),

  audit_scope TEXT, -- 감사 범위
  audit_criteria TEXT, -- 감사 기준
  summary TEXT NOT NULL, -- 감사 요약

  findings JSONB DEFAULT '[]', -- [{category, finding, severity, status, corrective_action, due_date, closed_date}]

  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  effectiveness_rating VARCHAR(20) CHECK (effectiveness_rating IN ('EXCELLENT', 'GOOD', 'FAIR', 'POOR')),

  recommendations TEXT,
  next_audit_date DATE,

  attachment_urls JSONB DEFAULT '[]', -- 첨부 파일 URLs

  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINAL', 'ARCHIVED')),

  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. 검교정 관리 기록
-- ============================================
CREATE TABLE IF NOT EXISTS calibration_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  equipment_name VARCHAR(100) NOT NULL, -- 장비명
  equipment_code VARCHAR(50), -- 장비코드/관리번호
  equipment_type VARCHAR(50) NOT NULL CHECK (equipment_type IN ('THERMOMETER', 'SCALE', 'PH_METER', 'HYGROMETER', 'PRESSURE_GAUGE', 'TIMER', 'OTHER')),
  manufacturer VARCHAR(100), -- 제조사
  model VARCHAR(100), -- 모델명
  serial_number VARCHAR(100), -- 시리얼번호
  location VARCHAR(100), -- 설치위치

  calibration_date DATE NOT NULL,
  next_calibration_date DATE,
  calibration_cycle_months INTEGER DEFAULT 12, -- 검교정 주기 (월)

  calibration_type VARCHAR(30) NOT NULL CHECK (calibration_type IN ('INTERNAL', 'EXTERNAL', 'SELF_CHECK')),
  calibration_agency VARCHAR(255), -- 검교정 기관
  certificate_number VARCHAR(100), -- 성적서 번호
  certificate_url TEXT, -- 성적서 파일 URL

  -- 검교정 결과
  standard_value DECIMAL(10,3), -- 기준값
  measured_value DECIMAL(10,3), -- 측정값
  tolerance DECIMAL(10,3), -- 허용오차
  unit VARCHAR(20), -- 단위

  result VARCHAR(20) NOT NULL CHECK (result IN ('PASS', 'FAIL', 'CONDITIONAL')),
  deviation_action TEXT, -- 불합격 시 조치사항

  notes TEXT,

  calibrated_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'OUT_OF_SERVICE')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, equipment_code)
);

-- ============================================
-- 4. 반품/회수/폐기 관리
-- ============================================
CREATE TABLE IF NOT EXISTS returns_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  record_number VARCHAR(50) NOT NULL, -- 관리번호

  record_type VARCHAR(20) NOT NULL CHECK (record_type IN ('RETURN', 'RECALL', 'DISPOSAL')),

  -- 대상 정보
  product_id UUID REFERENCES products(id),
  material_id UUID REFERENCES materials(id),
  item_name VARCHAR(255) NOT NULL,
  lot_number VARCHAR(100),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),

  -- 원인 및 사유
  reason_category VARCHAR(50) NOT NULL CHECK (reason_category IN ('QUALITY_DEFECT', 'EXPIRY', 'CONTAMINATION', 'DAMAGE', 'CUSTOMER_COMPLAINT', 'RECALL', 'OTHER')),
  reason_detail TEXT NOT NULL,

  -- 조치 사항
  action_taken TEXT,
  disposal_method VARCHAR(50) CHECK (disposal_method IN ('DESTRUCTION', 'REPROCESSING', 'RETURN_TO_SUPPLIER', 'LANDFILL', 'INCINERATION', 'OTHER')),
  disposal_date DATE,
  disposal_location VARCHAR(100),
  disposal_company VARCHAR(255), -- 폐기업체
  disposal_cost DECIMAL(10,2),

  -- 고객/거래처 정보 (반품/회수의 경우)
  customer_name VARCHAR(255),
  customer_contact VARCHAR(100),
  return_date DATE,

  -- 첨부 파일
  attachment_urls JSONB DEFAULT '[]',

  notes TEXT,

  recorded_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,

  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, record_number)
);

-- ============================================
-- 5. 보관 창고 점검 기록
-- ============================================
CREATE TABLE IF NOT EXISTS storage_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL,
  inspection_time TIME NOT NULL,
  shift VARCHAR(20) CHECK (shift IN ('morning', 'afternoon', 'night')),

  storage_area VARCHAR(100) NOT NULL, -- 점검 구역
  storage_type VARCHAR(50) NOT NULL CHECK (storage_type IN ('REFRIGERATOR', 'FREEZER', 'DRY_STORAGE', 'CHEMICAL_STORAGE', 'PACKAGING_STORAGE', 'OTHER')),

  -- 온도/습도 점검
  temperature DECIMAL(5,2),
  temperature_unit VARCHAR(10) DEFAULT 'C',
  temperature_min DECIMAL(5,2), -- 기준 최소
  temperature_max DECIMAL(5,2), -- 기준 최대
  temperature_result VARCHAR(20) CHECK (temperature_result IN ('PASS', 'FAIL', 'NA')),

  humidity DECIMAL(5,2),
  humidity_min DECIMAL(5,2),
  humidity_max DECIMAL(5,2),
  humidity_result VARCHAR(20) CHECK (humidity_result IN ('PASS', 'FAIL', 'NA')),

  -- 위생 점검 항목
  cleanliness_check BOOLEAN DEFAULT false, -- 청결상태
  organization_check BOOLEAN DEFAULT false, -- 정리정돈
  pest_check BOOLEAN DEFAULT false, -- 해충흔적
  damage_check BOOLEAN DEFAULT false, -- 파손/변질
  labeling_check BOOLEAN DEFAULT false, -- 표시사항
  fifo_check BOOLEAN DEFAULT false, -- 선입선출

  -- 종합 판정
  overall_result VARCHAR(20) NOT NULL CHECK (overall_result IN ('PASS', 'FAIL')),

  findings TEXT, -- 발견사항
  corrective_action TEXT, -- 개선조치

  inspected_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_haccp_training_company_date ON haccp_training_records(company_id, training_date);
CREATE INDEX IF NOT EXISTS idx_haccp_training_type ON haccp_training_records(training_type);
CREATE INDEX IF NOT EXISTS idx_haccp_training_store ON haccp_training_records(store_id);

CREATE INDEX IF NOT EXISTS idx_audit_reports_company_date ON audit_reports(company_id, report_date);
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_calibration_company ON calibration_records(company_id);
CREATE INDEX IF NOT EXISTS idx_calibration_next_date ON calibration_records(next_calibration_date);
CREATE INDEX IF NOT EXISTS idx_calibration_equipment_type ON calibration_records(equipment_type);

CREATE INDEX IF NOT EXISTS idx_returns_disposals_company_date ON returns_disposals(company_id, record_date);
CREATE INDEX IF NOT EXISTS idx_returns_disposals_type ON returns_disposals(record_type);

CREATE INDEX IF NOT EXISTS idx_storage_inspections_company_date ON storage_inspections(company_id, inspection_date);
CREATE INDEX IF NOT EXISTS idx_storage_inspections_area ON storage_inspections(storage_area);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE haccp_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns_disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_inspections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY haccp_training_policy ON haccp_training_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY audit_reports_policy ON audit_reports FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY calibration_records_policy ON calibration_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY returns_disposals_policy ON returns_disposals FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY storage_inspections_policy ON storage_inspections FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Done
SELECT 'HACCP additional tables created successfully!' as result;
