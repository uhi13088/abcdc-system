-- ============================================
-- 일일 종합 보고서 및 완제품 업데이트
-- ============================================

-- ============================================
-- 1. 일일 종합 보고서 검증 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS daily_report_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,

  -- 검증 정보
  verified_by UUID REFERENCES users(id),
  verified_by_name VARCHAR(100),
  verified_at TIMESTAMPTZ,
  verification_signature TEXT, -- 전자서명 (base64 이미지 또는 서명 데이터)
  verification_comment TEXT,

  -- 보고서 요약 (검증 시점의 스냅샷)
  summary_snapshot JSONB DEFAULT '{}',
  -- {
  --   ccp_records: { total: 12, passed: 12, failed: 0 },
  --   hygiene_checks: { morning: true, afternoon: true },
  --   equipment_temp: { total: 8, completed: 8 },
  --   inspections: { total: 3, passed: 3, failed: 0 },
  --   production: { total: 5, completed: 5 },
  --   pest_control: { checked: false },
  --   deviations: []
  -- }

  -- 상태
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_report_verifications_company_date
  ON daily_report_verifications(company_id, report_date);

ALTER TABLE daily_report_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'daily_report_verifications_policy') THEN
    CREATE POLICY daily_report_verifications_policy ON daily_report_verifications FOR ALL USING (
      company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
  END IF;
END $$;

-- ============================================
-- 2. 완제품 테이블에 품목제조보고번호 추가
-- ============================================
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS manufacturing_report_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS packing_spec_id UUID;

-- 품목제조보고번호 설명 코멘트
COMMENT ON COLUMN products.manufacturing_report_number IS '품목제조보고번호 (식약처 등록번호)';

-- ============================================
-- 3. 패킹 규격 마스터 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS product_packing_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  spec_name VARCHAR(100) NOT NULL, -- 규격명 (예: 소형박스, 대형박스, 개별포장)
  spec_code VARCHAR(50), -- 규격코드

  -- 규격 상세
  unit_type VARCHAR(50), -- 포장단위 (박스, 봉지, 개 등)
  units_per_pack INTEGER, -- 낱개수량 (1팩당 몇개)
  pack_weight DECIMAL(10,2), -- 포장중량 (g 또는 kg)
  weight_unit VARCHAR(10) DEFAULT 'g', -- g, kg, ml, L

  -- 박스 규격
  box_length DECIMAL(10,2), -- 길이 (cm)
  box_width DECIMAL(10,2), -- 너비 (cm)
  box_height DECIMAL(10,2), -- 높이 (cm)

  -- 팔레트 적재
  packs_per_box INTEGER, -- 박스당 팩 수
  boxes_per_pallet INTEGER, -- 팔레트당 박스 수

  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, spec_code)
);

CREATE INDEX IF NOT EXISTS idx_product_packing_specs_company
  ON product_packing_specs(company_id);

ALTER TABLE product_packing_specs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'product_packing_specs_policy') THEN
    CREATE POLICY product_packing_specs_policy ON product_packing_specs FOR ALL USING (
      company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
      OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
    );
  END IF;
END $$;

-- FK 추가 (products -> packing_specs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_packing_spec_fk'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_packing_spec_fk
      FOREIGN KEY (packing_spec_id)
      REFERENCES product_packing_specs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 4. 기본 패킹 규격 템플릿 데이터
-- ============================================
CREATE TABLE IF NOT EXISTS product_packing_specs_template (
  id SERIAL PRIMARY KEY,
  spec_name VARCHAR(100) NOT NULL,
  spec_code VARCHAR(50) NOT NULL UNIQUE,
  unit_type VARCHAR(50),
  units_per_pack INTEGER,
  pack_weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'g',
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

DELETE FROM product_packing_specs_template;

INSERT INTO product_packing_specs_template (spec_code, spec_name, unit_type, units_per_pack, pack_weight, weight_unit, description, sort_order) VALUES
  ('IND-S', '개별포장(소)', '개', 1, 50, 'g', '낱개 소포장', 1),
  ('IND-M', '개별포장(중)', '개', 1, 100, 'g', '낱개 중포장', 2),
  ('IND-L', '개별포장(대)', '개', 1, 200, 'g', '낱개 대포장', 3),
  ('BOX-6', '6입 박스', '박스', 6, NULL, 'g', '6개입 박스포장', 4),
  ('BOX-10', '10입 박스', '박스', 10, NULL, 'g', '10개입 박스포장', 5),
  ('BOX-12', '12입 박스', '박스', 12, NULL, 'g', '12개입 박스포장', 6),
  ('BOX-20', '20입 박스', '박스', 20, NULL, 'g', '20개입 박스포장', 7),
  ('BULK-1KG', '벌크 1kg', '봉지', 1, 1000, 'g', '1kg 벌크포장', 8),
  ('BULK-5KG', '벌크 5kg', '봉지', 1, 5000, 'g', '5kg 벌크포장', 9),
  ('GIFT-SET', '선물세트', '세트', NULL, NULL, 'g', '선물용 세트포장', 10);

-- 패킹규격 시드 함수
CREATE OR REPLACE FUNCTION seed_packing_specs_defaults(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO product_packing_specs (company_id, spec_code, spec_name, unit_type, units_per_pack, pack_weight, weight_unit, description, sort_order)
  SELECT p_company_id, spec_code, spec_name, unit_type, units_per_pack, pack_weight, weight_unit, description, sort_order
  FROM product_packing_specs_template
  ON CONFLICT (company_id, spec_code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 기존 회사들에 패킹규격 시드
DO $$
DECLARE
  company_rec RECORD;
BEGIN
  FOR company_rec IN SELECT id FROM companies
  LOOP
    PERFORM seed_packing_specs_defaults(company_rec.id);
  END LOOP;
END $$;

-- 트리거 업데이트 (회사 생성 시 패킹규격도 시드)
CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_defaults_on_company_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM seed_pest_control_defaults(NEW.id);
  PERFORM seed_ccp_defaults(NEW.id);
  PERFORM seed_packing_specs_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

SELECT 'Daily report and product updates applied successfully!' as result;
