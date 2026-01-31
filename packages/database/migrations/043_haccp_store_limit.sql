-- Migration: 043_haccp_store_limit
-- Description: HACCP 애드온 매장 수 제한 및 멀티 매장 스위칭 지원
-- Created: 2026-01-31

-- HACCP 애드온 매장 수 제한 필드 추가
-- haccp_store_limit: 허용된 HACCP 매장 수 (기본 1개, 추가 구매 시 증가)
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS haccp_store_limit INTEGER DEFAULT 1;

-- HACCP 매장 수 조회용 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_stores_haccp_company ON stores(company_id) WHERE haccp_enabled = true;

-- HACCP 현재 매장 (스위칭) 필드가 없으면 추가
-- users 테이블에 current_haccp_store_id 추가 (HACCP 앱용 별도 current store)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS current_haccp_store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

-- 코멘트 추가
COMMENT ON COLUMN company_subscriptions.haccp_store_limit IS 'Number of stores allowed to use HACCP addon (default: 1, can purchase more)';
COMMENT ON COLUMN users.current_haccp_store_id IS 'Currently selected HACCP store for this user (for store switching)';

-- 기존 HACCP 활성화된 회사들의 haccp_store_limit 백필
-- 현재 haccp_enabled된 매장 수에 따라 limit 설정
UPDATE company_subscriptions cs
SET haccp_store_limit = GREATEST(1, (
  SELECT COUNT(*)
  FROM stores s
  WHERE s.company_id = cs.company_id
    AND s.haccp_enabled = true
))
WHERE cs.haccp_addon_enabled = true;

-- HACCP 매장 수 초과 방지를 위한 체크 함수
CREATE OR REPLACE FUNCTION check_haccp_store_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  allowed_limit INTEGER;
BEGIN
  -- Only check when enabling HACCP
  IF NEW.haccp_enabled = true AND (OLD.haccp_enabled IS NULL OR OLD.haccp_enabled = false) THEN
    -- Get current HACCP enabled store count
    SELECT COUNT(*) INTO current_count
    FROM stores
    WHERE company_id = NEW.company_id
      AND haccp_enabled = true
      AND id != NEW.id;

    -- Get allowed limit from subscription
    SELECT COALESCE(haccp_store_limit, 1) INTO allowed_limit
    FROM company_subscriptions
    WHERE company_id = NEW.company_id;

    -- If no subscription found, default limit is 1
    IF allowed_limit IS NULL THEN
      allowed_limit := 1;
    END IF;

    -- Check if limit would be exceeded
    IF current_count >= allowed_limit THEN
      RAISE EXCEPTION 'HACCP_STORE_LIMIT_EXCEEDED: 현재 HACCP 매장 한도(%)를 초과했습니다. 추가 매장을 활성화하려면 HACCP 애드온을 추가 구매해주세요.', allowed_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 있으면 대체)
DROP TRIGGER IF EXISTS trigger_check_haccp_store_limit ON stores;
CREATE TRIGGER trigger_check_haccp_store_limit
  BEFORE INSERT OR UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION check_haccp_store_limit();
