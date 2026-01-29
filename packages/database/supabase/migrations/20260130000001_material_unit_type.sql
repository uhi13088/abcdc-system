-- ============================================
-- 원부재료 단위 타입 추가
-- ============================================

-- 1. materials 테이블에 unit_type 컬럼 추가
ALTER TABLE materials ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20)
  CHECK (unit_type IN ('weight', 'volume', 'count'));

-- 2. 기존 데이터 업데이트 - unit 컬럼 값을 기준으로 unit_type 설정
UPDATE materials
SET unit_type = CASE
  WHEN unit IN ('kg', 'g') THEN 'weight'
  WHEN unit IN ('L', 'mL') THEN 'volume'
  ELSE 'count'
END
WHERE unit_type IS NULL;

-- 3. 기본값이 없는 경우 count로 설정
UPDATE materials SET unit_type = 'count' WHERE unit_type IS NULL;

-- 4. unit_type NOT NULL 제약조건 추가
ALTER TABLE materials ALTER COLUMN unit_type SET NOT NULL;
ALTER TABLE materials ALTER COLUMN unit_type SET DEFAULT 'count';

-- 5. material_stocks에 base_quantity 컬럼 추가 (기본단위 저장용)
-- 기존 quantity는 표시 단위, base_quantity는 기본단위(g, mL, ea)
ALTER TABLE material_stocks ADD COLUMN IF NOT EXISTS base_quantity DECIMAL(12,2);

-- 6. 기존 데이터 변환 (kg→g, L→mL)
UPDATE material_stocks ms
SET base_quantity = CASE
  WHEN ms.unit = 'kg' THEN ms.quantity * 1000
  WHEN ms.unit = 'L' THEN ms.quantity * 1000
  ELSE ms.quantity
END
WHERE base_quantity IS NULL;

-- 7. 변환되지 않은 데이터는 quantity 그대로 사용
UPDATE material_stocks
SET base_quantity = quantity
WHERE base_quantity IS NULL;

-- 8. material_transactions에도 base_quantity 추가
ALTER TABLE material_transactions ADD COLUMN IF NOT EXISTS base_quantity DECIMAL(12,2);

-- 9. 기존 트랜잭션 데이터 변환
UPDATE material_transactions mt
SET base_quantity = CASE
  WHEN mt.unit = 'kg' THEN mt.quantity * 1000
  WHEN mt.unit = 'L' THEN mt.quantity * 1000
  ELSE mt.quantity
END
WHERE base_quantity IS NULL;

UPDATE material_transactions
SET base_quantity = quantity
WHERE base_quantity IS NULL;

-- 10. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_materials_unit_type ON materials(unit_type);
CREATE INDEX IF NOT EXISTS idx_material_stocks_base_quantity ON material_stocks(base_quantity);

-- 코멘트 추가
COMMENT ON COLUMN materials.unit_type IS '단위 타입: weight(중량), volume(용량), count(개수)';
COMMENT ON COLUMN material_stocks.base_quantity IS '기본단위 기준 수량 (g, mL, ea)';
COMMENT ON COLUMN material_transactions.base_quantity IS '기본단위 기준 수량 (g, mL, ea)';
