-- Migration: 043_backfill_haccp_store_id
-- Description: 기존 HACCP 테이블들의 store_id를 백필
-- Created: 2026-01-31
-- Updated: 2026-01-31
--
-- 이 마이그레이션은 기존 데이터에 store_id를 채웁니다.
-- 우선순위:
--   1. HACCP가 활성화된 매장 (haccp_enabled = true) 중 가장 오래된 매장
--   2. HACCP 매장이 없으면, 가장 먼저 생성된 매장으로 fallback

-- =====================================================
-- 1. ccp_definitions 테이블 백필
-- =====================================================
-- 먼저 HACCP가 활성화된 매장이 있으면 그 중 가장 오래된 것 선택
UPDATE ccp_definitions cd
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = cd.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE cd.store_id IS NULL
  AND cd.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = cd.company_id
    AND s.haccp_enabled = true
  );

-- HACCP 활성화된 매장이 없으면 가장 오래된 매장으로 fallback
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
-- 먼저 HACCP가 활성화된 매장이 있으면 그 중 가장 오래된 것 선택
UPDATE ccp_records cr
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

-- HACCP 활성화된 매장이 없으면 가장 오래된 매장으로 fallback
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
-- 먼저 HACCP가 활성화된 매장이 있으면 그 중 가장 오래된 것 선택
UPDATE daily_hygiene_checks dhc
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = dhc.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE dhc.store_id IS NULL
  AND dhc.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = dhc.company_id
    AND s.haccp_enabled = true
  );

-- HACCP 활성화된 매장이 없으면 가장 오래된 매장으로 fallback
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
-- 먼저 HACCP가 활성화된 매장이 있으면 그 중 가장 오래된 것 선택
UPDATE haccp_company_settings hcs
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

-- HACCP 활성화된 매장이 없으면 가장 오래된 매장으로 fallback
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
-- 먼저 HACCP가 활성화된 매장이 있으면 그 중 가장 오래된 것 선택
UPDATE haccp_zones hz
SET store_id = (
  SELECT s.id
  FROM stores s
  WHERE s.company_id = hz.company_id
    AND s.haccp_enabled = true
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE hz.store_id IS NULL
  AND hz.company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM stores s
    WHERE s.company_id = hz.company_id
    AND s.haccp_enabled = true
  );

-- HACCP 활성화된 매장이 없으면 가장 오래된 매장으로 fallback
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
    -- 먼저 HACCP가 활성화된 매장이 있으면 그 중 가장 오래된 것 선택
    UPDATE notification_settings ns
    SET store_id = (
      SELECT s.id
      FROM stores s
      WHERE s.company_id = ns.company_id
        AND s.haccp_enabled = true
      ORDER BY s.created_at ASC
      LIMIT 1
    )
    WHERE ns.store_id IS NULL
      AND ns.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM stores s
        WHERE s.company_id = ns.company_id
        AND s.haccp_enabled = true
      );

    -- HACCP 활성화된 매장이 없으면 가장 오래된 매장으로 fallback
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
  ccp_def_no_company INTEGER;
  ccp_def_no_store INTEGER;
  ccp_rec_null_count INTEGER;
  hygiene_null_count INTEGER;
  settings_null_count INTEGER;
  zones_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO ccp_def_null_count FROM ccp_definitions WHERE store_id IS NULL;
  SELECT COUNT(*) INTO ccp_def_no_company FROM ccp_definitions WHERE store_id IS NULL AND company_id IS NULL;
  SELECT COUNT(*) INTO ccp_def_no_store FROM ccp_definitions cd
    WHERE cd.store_id IS NULL
    AND cd.company_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.company_id = cd.company_id);
  SELECT COUNT(*) INTO ccp_rec_null_count FROM ccp_records WHERE store_id IS NULL;
  SELECT COUNT(*) INTO hygiene_null_count FROM daily_hygiene_checks WHERE store_id IS NULL;
  SELECT COUNT(*) INTO settings_null_count FROM haccp_company_settings WHERE store_id IS NULL;
  SELECT COUNT(*) INTO zones_null_count FROM haccp_zones WHERE store_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE '백필 완료 - NULL store_id 남은 수:';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  ccp_definitions: %', ccp_def_null_count;
  RAISE NOTICE '    - company_id가 NULL: %', ccp_def_no_company;
  RAISE NOTICE '    - 해당 회사에 매장이 없음: %', ccp_def_no_store;
  RAISE NOTICE '  ccp_records: %', ccp_rec_null_count;
  RAISE NOTICE '  daily_hygiene_checks: %', hygiene_null_count;
  RAISE NOTICE '  haccp_company_settings: %', settings_null_count;
  RAISE NOTICE '  haccp_zones: %', zones_null_count;
  RAISE NOTICE '========================================';
END $$;

SELECT 'Backfill completed!' as status;

-- =====================================================
-- 진단용: NULL store_id가 남아있는 레코드의 원인 확인
-- (Supabase SQL Editor에서 수동으로 실행)
-- =====================================================
-- 아래 쿼리를 실행하면 NULL인 이유를 확인할 수 있습니다:
/*
SELECT
  cd.id,
  cd.company_id,
  cd.ccp_name,
  CASE
    WHEN cd.company_id IS NULL THEN 'company_id가 NULL'
    WHEN NOT EXISTS (SELECT 1 FROM stores WHERE company_id = cd.company_id) THEN '해당 회사에 매장이 없음'
    ELSE '알 수 없음'
  END as null_reason
FROM ccp_definitions cd
WHERE cd.store_id IS NULL;
*/
