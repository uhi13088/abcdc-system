-- Migration: 016_fix_rls_policies
-- Description: Fix RLS policies for companies, brands, users tables
-- Created: 2026-01-12
-- NOTE: PostgreSQL doesn't support "CREATE POLICY IF NOT EXISTS", use DROP + CREATE

-- =============================================
-- COMPANIES TABLE RLS POLICIES
-- =============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can create their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;
DROP POLICY IF EXISTS "Users can read their own company" ON companies;
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;

-- Allow authenticated users to create a company
CREATE POLICY "companies_insert_policy"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to update their own company
CREATE POLICY "companies_update_policy"
ON companies
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
);

-- Allow users to read their own company (or any company if super_admin)
CREATE POLICY "companies_select_policy"
ON companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- =============================================
-- BRANDS TABLE RLS POLICIES
-- =============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can create brands in their company" ON brands;
DROP POLICY IF EXISTS "Users can read brands in their company" ON brands;
DROP POLICY IF EXISTS "Users can update brands in their company" ON brands;
DROP POLICY IF EXISTS "brands_select" ON brands;
DROP POLICY IF EXISTS "brands_insert" ON brands;
DROP POLICY IF EXISTS "brands_update" ON brands;

-- Allow users to create brands in their company
CREATE POLICY "brands_insert_policy"
ON brands
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow users to read brands in their company
CREATE POLICY "brands_select_policy"
ON brands
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow users to update brands in their company
CREATE POLICY "brands_update_policy"
ON brands
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow users to delete brands in their company
CREATE POLICY "brands_delete_policy"
ON brands
FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- =============================================
-- USERS TABLE RLS POLICIES
-- =============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can update own record" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;

-- Allow users to read their own record OR records in same company
CREATE POLICY "users_select_policy"
ON users
FOR SELECT
TO authenticated
USING (
  auth_id = auth.uid()  -- Can always read own record
  OR
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid() AND company_id IS NOT NULL
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

-- Allow users to update their own record
CREATE POLICY "users_update_policy"
ON users
FOR UPDATE
TO authenticated
USING (
  auth_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('super_admin', 'company_admin')
  )
)
WITH CHECK (
  auth_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('super_admin', 'company_admin')
  )
);

-- Allow creating new users (for registration)
CREATE POLICY "users_insert_policy"
ON users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =============================================
-- STORES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "stores_select" ON stores;
DROP POLICY IF EXISTS "stores_insert" ON stores;
DROP POLICY IF EXISTS "stores_update" ON stores;
DROP POLICY IF EXISTS "stores_delete" ON stores;

CREATE POLICY "stores_select_policy"
ON stores
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "stores_insert_policy"
ON stores
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "stores_update_policy"
ON stores
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "stores_delete_policy"
ON stores
FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
);
