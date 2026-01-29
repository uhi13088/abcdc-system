-- 고객/거래처 관리 테이블
-- 출하 시 고객을 선택하면 거래명세서에 자동으로 정보가 입력됨

-- 고객 테이블 생성
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  -- 기본 정보
  name VARCHAR(255) NOT NULL,                    -- 거래처명/고객명
  business_number VARCHAR(20),                   -- 사업자등록번호
  representative VARCHAR(100),                   -- 대표자명

  -- 연락처 정보
  phone VARCHAR(50),                             -- 전화번호
  fax VARCHAR(50),                               -- 팩스번호
  email VARCHAR(255),                            -- 이메일

  -- 주소 정보
  address TEXT,                                  -- 주소
  postal_code VARCHAR(10),                       -- 우편번호

  -- 담당자 정보
  contact_person VARCHAR(100),                   -- 담당자명
  contact_phone VARCHAR(50),                     -- 담당자 연락처

  -- 거래 정보
  payment_terms VARCHAR(100),                    -- 결제조건 (현금, 30일, 60일 등)
  credit_limit DECIMAL(15, 2),                   -- 여신한도
  notes TEXT,                                    -- 메모

  -- 상태
  status VARCHAR(20) DEFAULT 'ACTIVE',           -- ACTIVE, INACTIVE

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_customers_company_id ON customers(company_id);
CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_business_number ON customers(business_number);
CREATE INDEX idx_customers_status ON customers(status);

-- shipments 테이블에 customer_id 컬럼 추가
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shipments_customer_id ON shipments(customer_id);

-- RLS 정책
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 같은 회사 소속만 조회 가능
CREATE POLICY "customers_select_policy" ON customers
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

-- 같은 회사 소속만 추가 가능
CREATE POLICY "customers_insert_policy" ON customers
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 같은 회사 소속만 수정 가능
CREATE POLICY "customers_update_policy" ON customers
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 같은 회사 소속만 삭제 가능
CREATE POLICY "customers_delete_policy" ON customers
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE customers IS '고객/거래처 관리 테이블';
COMMENT ON COLUMN customers.name IS '거래처명/고객명';
COMMENT ON COLUMN customers.business_number IS '사업자등록번호';
COMMENT ON COLUMN customers.representative IS '대표자명';
COMMENT ON COLUMN customers.payment_terms IS '결제조건 (현금, 30일, 60일 등)';
COMMENT ON COLUMN customers.credit_limit IS '여신한도';
