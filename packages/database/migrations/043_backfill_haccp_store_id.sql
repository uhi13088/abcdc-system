-- Migration: 043_backfill_haccp_store_id
-- Description: 기존 HACCP 테이블들의 store_id를 백필
-- Created: 2026-01-31
--
-- 이 마이그레이션은 기존 데이터에 store_id를 채웁니다.
-- 한 회사에 여러 매장이 있는 경우, 가장 먼저 생성된 매장을 기본값으로 설정합니다.

-- =====================================================
-- 1. ccp_definitions 테이블 백필
-- =====================================================
UPDATE ccp_definitions cd
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = cd.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE cd.store_id IS NULL
  AND cd.company_id IS NOT NULL;

-- =====================================================
-- 2. ccp_records 테이블 백필
-- =====================================================
UPDATE ccp_records cr
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = cr.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE cr.store_id IS NULL
  AND cr.company_id IS NOT NULL;

-- =====================================================
-- 3. daily_hygiene_checks 테이블 백필
-- =====================================================
UPDATE daily_hygiene_checks dhc
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = dhc.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE dhc.store_id IS NULL
  AND dhc.company_id IS NOT NULL;

-- =====================================================
-- 4. haccp_company_settings 테이블 백필
-- =====================================================
UPDATE haccp_company_settings hcs
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = hcs.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE hcs.store_id IS NULL
  AND hcs.company_id IS NOT NULL;

-- =====================================================
-- 5. haccp_zones 테이블 백필
-- =====================================================
UPDATE haccp_zones hz
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = hz.company_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE hz.store_id IS NULL
  AND hz.company_id IS NOT NULL;

-- =====================================================
-- 6. notification_settings 테이블 백필 (company_id가 있는 경우)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_settings'
    AND column_name = 'company_id'
  ) THEN
    UPDATE notification_settings ns
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = ns.company_id
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE ns.store_id IS NULL
      AND ns.company_id IS NOT NULL;
  END IF;
END $$;

-- =====================================================
-- 확인용 쿼리 (결과 출력)
-- =====================================================
DO $$
DECLARE
  ccp_def_null_count INTEGER;
  ccp_rec_null_count INTEGER;
  hygiene_null_count INTEGER;
  settings_null_count INTEGER;
  zones_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ccp_def_null_count FROM ccp_definitions WHERE store_id IS NULL;
  SELECT COUNT(*) INTO ccp_rec_null_count FROM ccp_records WHERE store_id IS NULL;
  SELECT COUNT(*) INTO hygiene_null_count FROM daily_hygiene_checks WHERE store_id IS NULL;
  SELECT COUNT(*) INTO settings_null_count FROM haccp_company_settings WHERE store_id IS NULL;
  SELECT COUNT(*) INTO zones_null_count FROM haccp_zones WHERE store_id IS NULL;

  RAISE NOTICE '백필 완료 - NULL store_id 남은 수:';
  RAISE NOTICE '  ccp_definitions: %', ccp_def_null_count;
  RAISE NOTICE '  ccp_records: %', ccp_rec_null_count;
  RAISE NOTICE '  daily_hygiene_checks: %', hygiene_null_count;
  RAISE NOTICE '  haccp_company_settings: %', settings_null_count;
  RAISE NOTICE '  haccp_zones: %', zones_null_count;
END $$;

SELECT 'Backfill completed!' as status;
