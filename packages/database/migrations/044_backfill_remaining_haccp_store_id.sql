-- Migration: 044_backfill_remaining_haccp_store_id
-- Description: 나머지 HACCP 테이블들의 store_id 컬럼 추가 및 백필
-- Created: 2026-01-31
--
-- 이 마이그레이션은:
-- 1. store_id 컬럼이 없으면 먼저 추가
-- 2. 기존 데이터의 store_id를 백필
--
-- 우선순위:
--   1. HACCP가 활성화된 매장 (haccp_enabled = true) 중 가장 오래된 매장
--   2. HACCP 매장이 없으면, 가장 먼저 생성된 매장으로 fallback

-- =====================================================
-- 0. 필요한 테이블들에 store_id 컬럼 추가 (없으면)
-- =====================================================

-- ccp_verifications
ALTER TABLE ccp_verifications ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ccp_verifications_store ON ccp_verifications(store_id);

-- production_records
ALTER TABLE production_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_production_records_store ON production_records(store_id);

-- pest_control_checks
ALTER TABLE pest_control_checks ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pest_control_checks_store ON pest_control_checks(store_id);

-- material_inspections
ALTER TABLE material_inspections ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_material_inspections_store ON material_inspections(store_id);

-- material_stocks
ALTER TABLE material_stocks ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_material_stocks_store ON material_stocks(store_id);

-- material_transactions
ALTER TABLE material_transactions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_material_transactions_store ON material_transactions(store_id);

-- iot_sensors (이미 있을 수 있음)
ALTER TABLE iot_sensors ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_iot_sensors_store ON iot_sensors(store_id);

-- shipment_records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shipment_records') THEN
    ALTER TABLE shipment_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_shipment_records_store ON shipment_records(store_id);
  END IF;
END $$;

-- corrective_actions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'corrective_actions') THEN
    ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_corrective_actions_store ON corrective_actions(store_id);
  END IF;
END $$;

-- storage_inspections
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_inspections') THEN
    ALTER TABLE storage_inspections ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_storage_inspections_store ON storage_inspections(store_id);
  END IF;
END $$;

-- calibration_records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calibration_records') THEN
    ALTER TABLE calibration_records ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_calibration_records_store ON calibration_records(store_id);
  END IF;
END $$;

-- returns_disposals
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns_disposals') THEN
    ALTER TABLE returns_disposals ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_returns_disposals_store ON returns_disposals(store_id);
  END IF;
END $$;

-- haccp_check_status
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_check_status') THEN
    ALTER TABLE haccp_check_status ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_haccp_check_status_store ON haccp_check_status(store_id);
  END IF;
END $$;

-- =====================================================
-- 1. ccp_verifications 테이블 백필
-- =====================================================
UPDATE ccp_verifications cv
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = cv.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE cv.store_id IS NULL
  AND cv.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = cv.company_id
    AND s.haccp_enabled = true
  );

UPDATE ccp_verifications cv
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = cv.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE cv.store_id IS NULL
  AND cv.company_id IS NOT NULL;

-- =====================================================
-- 2. production_records 테이블 백필
-- =====================================================
UPDATE production_records pr
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = pr.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE pr.store_id IS NULL
  AND pr.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = pr.company_id
    AND s.haccp_enabled = true
  );

UPDATE production_records pr
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = pr.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE pr.store_id IS NULL
  AND pr.company_id IS NOT NULL;

-- =====================================================
-- 3. pest_control_checks 테이블 백필
-- =====================================================
UPDATE pest_control_checks pcc
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = pcc.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE pcc.store_id IS NULL
  AND pcc.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = pcc.company_id
    AND s.haccp_enabled = true
  );

UPDATE pest_control_checks pcc
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = pcc.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE pcc.store_id IS NULL
  AND pcc.company_id IS NOT NULL;

-- =====================================================
-- 4. material_inspections 테이블 백필
-- =====================================================
UPDATE material_inspections mi
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = mi.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE mi.store_id IS NULL
  AND mi.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = mi.company_id
    AND s.haccp_enabled = true
  );

UPDATE material_inspections mi
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = mi.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE mi.store_id IS NULL
  AND mi.company_id IS NOT NULL;

-- =====================================================
-- 5. material_stocks 테이블 백필
-- =====================================================
UPDATE material_stocks ms
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = ms.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE ms.store_id IS NULL
  AND ms.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = ms.company_id
    AND s.haccp_enabled = true
  );

UPDATE material_stocks ms
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = ms.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE ms.store_id IS NULL
  AND ms.company_id IS NOT NULL;

-- =====================================================
-- 6. material_transactions 테이블 백필
-- =====================================================
UPDATE material_transactions mt
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = mt.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE mt.store_id IS NULL
  AND mt.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = mt.company_id
    AND s.haccp_enabled = true
  );

UPDATE material_transactions mt
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = mt.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE mt.store_id IS NULL
  AND mt.company_id IS NOT NULL;

-- =====================================================
-- 7. iot_sensors 테이블 백필
-- =====================================================
UPDATE iot_sensors ios
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = ios.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE ios.store_id IS NULL
  AND ios.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = ios.company_id
    AND s.haccp_enabled = true
  );

UPDATE iot_sensors ios
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = ios.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE ios.store_id IS NULL
  AND ios.company_id IS NOT NULL;

-- =====================================================
-- 8. shipment_records 테이블 백필
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipment_records' AND column_name = 'store_id') THEN
    UPDATE shipment_records sr
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = sr.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE sr.store_id IS NULL
      AND sr.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = sr.company_id
        AND s.haccp_enabled = true
      );

    UPDATE shipment_records sr
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = sr.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE sr.store_id IS NULL
      AND sr.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 9. corrective_actions 테이블 백필
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'corrective_actions' AND column_name = 'store_id') THEN
    UPDATE corrective_actions ca
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = ca.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE ca.store_id IS NULL
      AND ca.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = ca.company_id
        AND s.haccp_enabled = true
      );

    UPDATE corrective_actions ca
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = ca.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE ca.store_id IS NULL
      AND ca.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 10. storage_inspections 테이블 백필
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'storage_inspections' AND column_name = 'store_id') THEN
    UPDATE storage_inspections si
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = si.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE si.store_id IS NULL
      AND si.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = si.company_id
        AND s.haccp_enabled = true
      );

    UPDATE storage_inspections si
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = si.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE si.store_id IS NULL
      AND si.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 11. calibration_records 테이블 백필
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calibration_records' AND column_name = 'store_id') THEN
    UPDATE calibration_records cr
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = cr.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE cr.store_id IS NULL
      AND cr.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = cr.company_id
        AND s.haccp_enabled = true
      );

    UPDATE calibration_records cr
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = cr.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE cr.store_id IS NULL
      AND cr.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 12. returns_disposals 테이블 백필
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns_disposals' AND column_name = 'store_id') THEN
    UPDATE returns_disposals rd
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = rd.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE rd.store_id IS NULL
      AND rd.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = rd.company_id
        AND s.haccp_enabled = true
      );

    UPDATE returns_disposals rd
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = rd.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE rd.store_id IS NULL
      AND rd.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 13. haccp_check_status 테이블 백필
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'haccp_check_status' AND column_name = 'store_id') THEN
    UPDATE haccp_check_status hcs
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = hcs.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE hcs.store_id IS NULL
      AND hcs.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = hcs.company_id
        AND s.haccp_enabled = true
      );

    UPDATE haccp_check_status hcs
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = hcs.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE hcs.store_id IS NULL
      AND hcs.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 확인용 쿼리 (결과 출력)
-- =====================================================
DO $$
DECLARE
  ccp_verif_null INTEGER;
  production_null INTEGER;
  pest_null INTEGER;
  mat_insp_null INTEGER;
  mat_stock_null INTEGER;
  mat_trans_null INTEGER;
  iot_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO ccp_verif_null FROM ccp_verifications WHERE store_id IS NULL;
  SELECT COUNT(*) INTO production_null FROM production_records WHERE store_id IS NULL;
  SELECT COUNT(*) INTO pest_null FROM pest_control_checks WHERE store_id IS NULL;
  SELECT COUNT(*) INTO mat_insp_null FROM material_inspections WHERE store_id IS NULL;
  SELECT COUNT(*) INTO mat_stock_null FROM material_stocks WHERE store_id IS NULL;
  SELECT COUNT(*) INTO mat_trans_null FROM material_transactions WHERE store_id IS NULL;
  SELECT COUNT(*) INTO iot_null FROM iot_sensors WHERE store_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '추가 백필 완료 - NULL store_id 남은 수:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  ccp_verifications: %', ccp_verif_null;
  RAISE NOTICE '  production_records: %', production_null;
  RAISE NOTICE '  pest_control_checks: %', pest_null;
  RAISE NOTICE '  material_inspections: %', mat_insp_null;
  RAISE NOTICE '  material_stocks: %', mat_stock_null;
  RAISE NOTICE '  material_transactions: %', mat_trans_null;
  RAISE NOTICE '  iot_sensors: %', iot_null;
  RAISE NOTICE '========================================';
END $$;

SELECT 'Additional backfill completed!' as status;
