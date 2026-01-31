-- Migration: 20260131000001_haccp_settings_store_separation
-- Description: Separate HACCP settings and certification by store (not company)
-- Each store can have different HACCP certifications
-- Created: 2026-01-31

-- ============================================
-- 1. Add HACCP certification fields to stores table
-- ============================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS haccp_certification_number VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS haccp_certification_date DATE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS haccp_certification_expiry DATE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_number VARCHAR(20);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS representative VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS fax VARCHAR(20);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS email VARCHAR(255);

COMMENT ON COLUMN stores.haccp_certification_number IS 'HACCP 인증번호 (매장별)';
COMMENT ON COLUMN stores.haccp_certification_date IS 'HACCP 인증일 (매장별)';
COMMENT ON COLUMN stores.haccp_certification_expiry IS 'HACCP 인증 만료일 (매장별)';
COMMENT ON COLUMN stores.business_number IS '사업자등록번호 (매장별, 본사와 다를 수 있음)';
COMMENT ON COLUMN stores.representative IS '대표자명 (매장별)';
COMMENT ON COLUMN stores.fax IS '팩스번호';
COMMENT ON COLUMN stores.email IS '이메일';

-- ============================================
-- 2. Add store_id to haccp_company_settings
-- ============================================
-- First, drop the unique constraint on company_id
ALTER TABLE haccp_company_settings DROP CONSTRAINT IF EXISTS haccp_company_settings_company_id_key;

-- Add store_id column (nullable initially for migration)
ALTER TABLE haccp_company_settings ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- Create index on store_id
CREATE INDEX IF NOT EXISTS idx_haccp_company_settings_store ON haccp_company_settings(store_id);

-- Create unique constraint on company_id + store_id
ALTER TABLE haccp_company_settings ADD CONSTRAINT haccp_company_settings_company_store_unique UNIQUE (company_id, store_id);

COMMENT ON COLUMN haccp_company_settings.store_id IS 'HACCP 설정이 적용되는 매장 (매장별 다른 설정 가능)';

-- ============================================
-- 3. Drop old RLS policies and create new ones
-- ============================================
DROP POLICY IF EXISTS haccp_company_settings_select ON haccp_company_settings;
DROP POLICY IF EXISTS haccp_company_settings_insert ON haccp_company_settings;
DROP POLICY IF EXISTS haccp_company_settings_update ON haccp_company_settings;
DROP POLICY IF EXISTS haccp_company_settings_delete ON haccp_company_settings;

-- New RLS policies with store_id consideration
CREATE POLICY haccp_company_settings_select ON haccp_company_settings
  FOR SELECT USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (
      store_id IS NULL
      OR store_id = (SELECT store_id FROM users WHERE auth_id = auth.uid())
      OR (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
    )
  );

CREATE POLICY haccp_company_settings_insert ON haccp_company_settings
  FOR INSERT WITH CHECK (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
    AND (
      store_id IS NULL
      OR store_id IN (SELECT id FROM stores WHERE company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid()))
    )
  );

CREATE POLICY haccp_company_settings_update ON haccp_company_settings
  FOR UPDATE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin', 'manager')
  );

CREATE POLICY haccp_company_settings_delete ON haccp_company_settings
  FOR DELETE USING (
    company_id = (SELECT company_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('super_admin', 'company_admin')
  );

-- ============================================
-- 4. Migrate existing data (copy company HACCP info to stores)
-- ============================================
-- For existing stores without HACCP info, copy from parent company
UPDATE stores s
SET
  haccp_certification_number = c.haccp_certification_number,
  haccp_certification_date = c.haccp_certification_date,
  haccp_certification_expiry = c.haccp_certification_expiry
FROM companies c
WHERE s.company_id = c.id
  AND s.haccp_certification_number IS NULL
  AND c.haccp_certification_number IS NOT NULL;
