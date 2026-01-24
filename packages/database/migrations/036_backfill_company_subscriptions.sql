-- Migration: 036_backfill_company_subscriptions
-- Description: Create subscription records for existing companies that don't have one
-- Created: 2026-01-24

-- This script creates FREE plan subscriptions for all companies
-- that currently don't have a subscription record

-- Step 1: Insert subscription records for companies without subscriptions
INSERT INTO company_subscriptions (
  company_id,
  plan_id,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT
  c.id as company_id,
  sp.id as plan_id,
  'ACTIVE' as status,
  'MONTHLY' as billing_cycle,
  CURRENT_DATE as current_period_start,
  (CURRENT_DATE + INTERVAL '1 month')::DATE as current_period_end,
  CURRENT_TIMESTAMP as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM companies c
CROSS JOIN subscription_plans sp
WHERE sp.name = 'FREE'
  AND NOT EXISTS (
    SELECT 1
    FROM company_subscriptions cs
    WHERE cs.company_id = c.id
  );

-- Log how many records were created
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Created % subscription records for existing companies', affected_count;
END $$;
