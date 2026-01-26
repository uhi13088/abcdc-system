-- 생산-원료 연동 마이그레이션
-- 생산 기록에서 레시피 기반 원료 자동 출고 기능 지원

-- 1. production_records 테이블에 원료 사용 관련 컬럼 추가
ALTER TABLE production_records
ADD COLUMN IF NOT EXISTS material_usage_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS material_usage_summary JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS material_usage_errors TEXT[] DEFAULT NULL;

-- 컬럼 코멘트
COMMENT ON COLUMN production_records.material_usage_processed IS '원료 출고 처리 여부';
COMMENT ON COLUMN production_records.material_usage_summary IS '원료 사용 요약 정보 (JSON)';
COMMENT ON COLUMN production_records.material_usage_errors IS '원료 출고 처리 중 발생한 오류';

-- 2. material_transactions 테이블에 생산 연결 정보 개선
-- production_lot 컬럼이 생산 기록 ID를 저장하도록 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_material_transactions_production_lot
ON material_transactions(production_lot)
WHERE production_lot IS NOT NULL;

-- 3. 원료 사용 요약 뷰 생성
CREATE OR REPLACE VIEW material_usage_by_production AS
SELECT
  pr.id AS production_record_id,
  pr.production_date,
  pr.lot_number AS production_lot,
  p.name AS product_name,
  pr.quantity_produced,
  mt.material_id,
  m.name AS material_name,
  m.code AS material_code,
  SUM(mt.quantity) AS total_used,
  mt.unit
FROM production_records pr
LEFT JOIN products p ON pr.product_id = p.id
LEFT JOIN material_transactions mt ON mt.production_lot = pr.lot_number OR mt.production_lot = pr.id::text
LEFT JOIN materials m ON mt.material_id = m.id
WHERE mt.transaction_type = 'OUT'
GROUP BY
  pr.id, pr.production_date, pr.lot_number, p.name, pr.quantity_produced,
  mt.material_id, m.name, m.code, mt.unit
ORDER BY pr.production_date DESC, m.name;

-- 4. 원료 재고 현황 뷰 업데이트
CREATE OR REPLACE VIEW material_stock_summary AS
SELECT
  ms.company_id,
  ms.material_id,
  m.code AS material_code,
  m.name AS material_name,
  m.material_type,
  SUM(CASE WHEN ms.status = 'AVAILABLE' THEN ms.quantity ELSE 0 END) AS available_quantity,
  SUM(CASE WHEN ms.status = 'RESERVED' THEN ms.quantity ELSE 0 END) AS reserved_quantity,
  SUM(ms.quantity) AS total_quantity,
  ms.unit,
  MIN(CASE WHEN ms.status = 'AVAILABLE' AND ms.quantity > 0 THEN ms.expiry_date END) AS earliest_expiry,
  COUNT(DISTINCT CASE WHEN ms.status = 'AVAILABLE' AND ms.quantity > 0 THEN ms.lot_number END) AS lot_count
FROM material_stocks ms
JOIN materials m ON ms.material_id = m.id
WHERE ms.status != 'DISPOSED'
GROUP BY ms.company_id, ms.material_id, m.code, m.name, m.material_type, ms.unit;

-- 5. 원료 수불부 뷰 (일별)
CREATE OR REPLACE VIEW material_ledger_daily AS
WITH daily_in AS (
  SELECT
    company_id,
    material_id,
    transaction_date,
    SUM(quantity) AS in_quantity
  FROM material_transactions
  WHERE transaction_type = 'IN'
  GROUP BY company_id, material_id, transaction_date
),
daily_out AS (
  SELECT
    company_id,
    material_id,
    transaction_date,
    SUM(quantity) AS out_quantity
  FROM material_transactions
  WHERE transaction_type = 'OUT'
  GROUP BY company_id, material_id, transaction_date
),
daily_adjust AS (
  SELECT
    company_id,
    material_id,
    transaction_date,
    SUM(quantity) AS adjust_quantity
  FROM material_transactions
  WHERE transaction_type IN ('ADJUST', 'DISPOSE')
  GROUP BY company_id, material_id, transaction_date
)
SELECT
  COALESCE(di.company_id, do.company_id, da.company_id) AS company_id,
  COALESCE(di.material_id, do.material_id, da.material_id) AS material_id,
  m.code AS material_code,
  m.name AS material_name,
  COALESCE(di.transaction_date, do.transaction_date, da.transaction_date) AS transaction_date,
  COALESCE(di.in_quantity, 0) AS in_quantity,
  COALESCE(do.out_quantity, 0) AS out_quantity,
  COALESCE(da.adjust_quantity, 0) AS adjust_quantity,
  COALESCE(di.in_quantity, 0) - COALESCE(do.out_quantity, 0) + COALESCE(da.adjust_quantity, 0) AS net_change
FROM daily_in di
FULL OUTER JOIN daily_out do
  ON di.company_id = do.company_id
  AND di.material_id = do.material_id
  AND di.transaction_date = do.transaction_date
FULL OUTER JOIN daily_adjust da
  ON COALESCE(di.company_id, do.company_id) = da.company_id
  AND COALESCE(di.material_id, do.material_id) = da.material_id
  AND COALESCE(di.transaction_date, do.transaction_date) = da.transaction_date
LEFT JOIN materials m ON m.id = COALESCE(di.material_id, do.material_id, da.material_id)
ORDER BY transaction_date DESC, material_code;

-- 6. 월별 원료 사용량 집계 뷰
CREATE OR REPLACE VIEW material_usage_monthly AS
SELECT
  mt.company_id,
  DATE_TRUNC('month', mt.transaction_date) AS month,
  mt.material_id,
  m.code AS material_code,
  m.name AS material_name,
  m.material_type,
  SUM(CASE WHEN mt.transaction_type = 'IN' THEN mt.quantity ELSE 0 END) AS total_in,
  SUM(CASE WHEN mt.transaction_type = 'OUT' THEN mt.quantity ELSE 0 END) AS total_out,
  SUM(CASE WHEN mt.transaction_type = 'ADJUST' THEN mt.quantity ELSE 0 END) AS total_adjust,
  SUM(CASE WHEN mt.transaction_type = 'DISPOSE' THEN mt.quantity ELSE 0 END) AS total_dispose,
  mt.unit,
  COUNT(DISTINCT CASE WHEN mt.transaction_type = 'OUT' THEN mt.production_lot END) AS production_count
FROM material_transactions mt
JOIN materials m ON mt.material_id = m.id
GROUP BY mt.company_id, DATE_TRUNC('month', mt.transaction_date), mt.material_id,
         m.code, m.name, m.material_type, mt.unit
ORDER BY month DESC, material_code;

-- 7. 생산-원료 연결 정보 테이블 (상세 추적용)
CREATE TABLE IF NOT EXISTS production_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  production_record_id UUID NOT NULL REFERENCES production_records(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(255) NOT NULL,
  required_quantity DECIMAL(10,3) NOT NULL,
  actual_quantity DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'g',
  shortage_quantity DECIMAL(10,3) DEFAULT 0,
  lot_numbers TEXT[], -- 사용된 LOT 번호들
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_material_usage_record
ON production_material_usage(production_record_id);

CREATE INDEX IF NOT EXISTS idx_production_material_usage_material
ON production_material_usage(material_id);

ALTER TABLE production_material_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY production_material_usage_policy ON production_material_usage FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- 8. 원료 부족 알림 함수
CREATE OR REPLACE FUNCTION check_material_shortage(
  p_company_id UUID,
  p_material_id UUID,
  p_required_quantity DECIMAL
)
RETURNS TABLE (
  has_shortage BOOLEAN,
  available_quantity DECIMAL,
  shortage_amount DECIMAL
) AS $$
DECLARE
  v_available DECIMAL;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_available
  FROM material_stocks
  WHERE company_id = p_company_id
    AND material_id = p_material_id
    AND status = 'AVAILABLE'
    AND quantity > 0;

  RETURN QUERY SELECT
    v_available < p_required_quantity,
    v_available,
    GREATEST(p_required_quantity - v_available, 0);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_material_shortage IS '원료 재고 부족 여부 확인';
