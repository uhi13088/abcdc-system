-- ============================================
-- HACCP System Database Tables
-- ============================================

-- ============================================
-- 1. 제품 마스터 (Products)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  specification TEXT,
  shelf_life INTEGER, -- 유통기한 (일)
  storage_condition VARCHAR(100),
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, code)
);

-- ============================================
-- 2. 공급업체 (Suppliers)
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  certifications JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, code)
);

-- ============================================
-- 3. 원부재료 마스터 (Materials)
-- ============================================
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('원료', '부재료', '포장재')),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  specification TEXT,
  storage_temp VARCHAR(50),
  shelf_life INTEGER,
  unit VARCHAR(20), -- kg, g, ea 등
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, code)
);

-- ============================================
-- 4. CCP 정의 (CCP Definitions)
-- ============================================
CREATE TABLE IF NOT EXISTS ccp_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- 매장별 CCP 정의
  ccp_number VARCHAR(20) NOT NULL, -- CCP-1, CCP-2 등
  process VARCHAR(100) NOT NULL, -- 공정명
  hazard TEXT NOT NULL, -- 위해요소
  control_measure TEXT NOT NULL, -- 관리방법
  critical_limit JSONB NOT NULL, -- {parameter, min, max, unit}
  monitoring_method TEXT,
  monitoring_frequency VARCHAR(50), -- 점검주기
  corrective_action TEXT, -- 개선조치
  verification_method TEXT, -- 검증방법
  record_keeping TEXT, -- 기록관리
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, store_id, ccp_number)
);

-- ============================================
-- 5. CCP 기록 (CCP Records)
-- ============================================
CREATE TABLE IF NOT EXISTS ccp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- 매장별 CCP 기록
  ccp_id UUID NOT NULL REFERENCES ccp_definitions(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  record_time TIME NOT NULL,
  recorded_by UUID REFERENCES users(id),

  lot_number VARCHAR(100), -- 제조번호
  product_id UUID REFERENCES products(id),

  measurement JSONB NOT NULL, -- {value, unit, etc}
  is_within_limit BOOLEAN NOT NULL,
  deviation_action TEXT, -- 이탈 시 조치

  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_ccp_records_date (company_id, store_id, record_date)
);

-- ============================================
-- 6. 일일 위생 점검 (Daily Hygiene Checks)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_hygiene_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- 매장별 위생점검
  check_date DATE NOT NULL,
  shift VARCHAR(20) NOT NULL CHECK (shift IN ('오전', '오후', '야간')),
  checked_by UUID REFERENCES users(id),

  personal_hygiene JSONB, -- 개인위생
  facility_hygiene JSONB, -- 시설위생
  equipment_hygiene JSONB, -- 설비위생
  material_management JSONB, -- 원료관리

  overall_status VARCHAR(20) CHECK (overall_status IN ('PASS', 'FAIL')),
  corrective_action TEXT,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, store_id, check_date, shift)
);

-- ============================================
-- 7. 원부재료 입고검사 (Material Inspections)
-- ============================================
CREATE TABLE IF NOT EXISTS material_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL,
  inspected_by UUID REFERENCES users(id),

  material_id UUID NOT NULL REFERENCES materials(id),
  supplier_id UUID REFERENCES suppliers(id),
  lot_number VARCHAR(100),
  quantity DECIMAL(10,2),
  unit VARCHAR(20),

  -- 검사 항목
  appearance_check BOOLEAN, -- 외관검사
  packaging_check BOOLEAN, -- 포장상태
  label_check BOOLEAN, -- 표시사항
  temp_check JSONB, -- 온도 {value, passed}
  expiry_check BOOLEAN, -- 유통기한
  document_check BOOLEAN, -- 서류확인

  overall_result VARCHAR(20) CHECK (overall_result IN ('PASS', 'FAIL', 'CONDITIONAL')),
  rejection_reason TEXT,
  corrective_action TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 8. 생산 기록 (Production Records)
-- ============================================
CREATE TABLE IF NOT EXISTS production_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_date DATE NOT NULL,
  lot_number VARCHAR(100) NOT NULL,

  product_id UUID NOT NULL REFERENCES products(id),
  line_number VARCHAR(50), -- 생산라인

  start_time TIME,
  end_time TIME,

  planned_quantity DECIMAL(10,2),
  actual_quantity DECIMAL(10,2),
  defect_quantity DECIMAL(10,2) DEFAULT 0,
  unit VARCHAR(20),

  -- 생산 조건
  production_conditions JSONB, -- 온도, 습도, 압력 등

  supervisor_id UUID REFERENCES users(id),
  workers JSONB, -- 작업자 목록

  notes TEXT,
  status VARCHAR(20) DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, lot_number)
);

-- ============================================
-- 9. 출하 기록 (Shipment Records)
-- ============================================
CREATE TABLE IF NOT EXISTS shipment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shipment_date DATE NOT NULL,
  shipment_number VARCHAR(100) NOT NULL,

  customer_name VARCHAR(255),
  customer_address TEXT,

  items JSONB NOT NULL, -- [{product_id, lot_number, quantity, unit}]

  vehicle_number VARCHAR(50), -- 차량번호
  vehicle_temp DECIMAL(5,2), -- 차량온도
  driver_name VARCHAR(100),

  shipped_by UUID REFERENCES users(id),

  notes TEXT,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, shipment_number)
);

-- ============================================
-- 10. 방충방서 점검 (Pest Control Checks)
-- ============================================
CREATE TABLE IF NOT EXISTS pest_control_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'EXTERNAL')),
  checked_by UUID REFERENCES users(id),

  -- 포획기 점검
  trap_checks JSONB, -- [{location, trap_type, catch_count, condition}]

  -- 외부 환경
  external_check JSONB, -- 외부 환경 점검

  -- 발견 사항
  findings TEXT,
  corrective_action TEXT,

  -- 외부업체 점검 시
  external_company VARCHAR(255),
  external_report_url TEXT,

  overall_status VARCHAR(20) CHECK (overall_status IN ('NORMAL', 'ATTENTION', 'CRITICAL')),

  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 11. 원료 수불 기록 (Material Transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS material_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST', 'DISPOSE')),

  material_id UUID NOT NULL REFERENCES materials(id),
  lot_number VARCHAR(100),

  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),

  -- 입고 정보
  supplier_id UUID REFERENCES suppliers(id),
  purchase_price DECIMAL(10,2),

  -- 출고 정보
  production_lot VARCHAR(100), -- 사용된 생산 로트

  -- 폐기 정보
  disposal_reason TEXT,

  recorded_by UUID REFERENCES users(id),
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 12. 원료 재고 (Material Stocks)
-- ============================================
CREATE TABLE IF NOT EXISTS material_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  lot_number VARCHAR(100),

  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20),

  received_date DATE,
  expiry_date DATE,
  location VARCHAR(100), -- 보관위치

  status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'EXPIRED', 'DISPOSED')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, material_id, lot_number)
);

-- ============================================
-- 13. CCP 월간 검증 (CCP Monthly Verification)
-- ============================================
CREATE TABLE IF NOT EXISTS ccp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  verification_year INTEGER NOT NULL,
  verification_month INTEGER NOT NULL,
  ccp_id UUID NOT NULL REFERENCES ccp_definitions(id),

  -- 검증 내용
  records_reviewed INTEGER, -- 검토한 기록 수
  deviations_found INTEGER, -- 발견된 이탈 수
  corrective_actions_taken INTEGER, -- 개선조치 수

  effectiveness_rating VARCHAR(20) CHECK (effectiveness_rating IN ('EXCELLENT', 'GOOD', 'FAIR', 'POOR')),

  findings TEXT,
  recommendations TEXT,

  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, verification_year, verification_month, ccp_id)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_company ON materials(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_ccp_definitions_company ON ccp_definitions(company_id);
CREATE INDEX IF NOT EXISTS idx_ccp_records_company_date ON ccp_records(company_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_hygiene_company_date ON daily_hygiene_checks(company_id, check_date);
CREATE INDEX IF NOT EXISTS idx_production_company_date ON production_records(company_id, production_date);
CREATE INDEX IF NOT EXISTS idx_shipment_company_date ON shipment_records(company_id, shipment_date);
CREATE INDEX IF NOT EXISTS idx_material_transactions_date ON material_transactions(company_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_material_stocks_material ON material_stocks(company_id, material_id);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccp_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_hygiene_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pest_control_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ccp_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (company isolation)
CREATE POLICY products_policy ON products FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY suppliers_policy ON suppliers FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY materials_policy ON materials FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY ccp_definitions_policy ON ccp_definitions FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY ccp_records_policy ON ccp_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY daily_hygiene_checks_policy ON daily_hygiene_checks FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY material_inspections_policy ON material_inspections FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY production_records_policy ON production_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY shipment_records_policy ON shipment_records FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY pest_control_checks_policy ON pest_control_checks FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY material_transactions_policy ON material_transactions FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY material_stocks_policy ON material_stocks FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY ccp_verifications_policy ON ccp_verifications FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Done
SELECT 'HACCP tables created successfully!' as result;
