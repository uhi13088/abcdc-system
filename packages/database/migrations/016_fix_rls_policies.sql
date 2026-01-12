-- Migration: 016_fix_rls_policies
-- Description: Fix RLS policies for companies table to allow user self-registration
-- Created: 2026-01-12

-- Allow authenticated users to create their own company
CREATE POLICY IF NOT EXISTS "Users can create their own company"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow users to update their own company
CREATE POLICY IF NOT EXISTS "Users can update their own company"
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

-- Allow users to read their own company
CREATE POLICY IF NOT EXISTS "Users can read their own company"
ON companies
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
  OR
  -- Allow reading company if user is being invited to it
  id IN (
    SELECT company_id FROM users WHERE company_id IS NOT NULL
  )
);

-- Brands: Allow users to create brands in their company
DROP POLICY IF EXISTS "Users can create brands in their company" ON brands;
CREATE POLICY "Users can create brands in their company"
ON brands
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
);

-- Brands: Allow users to read brands in their company
DROP POLICY IF EXISTS "Users can read brands in their company" ON brands;
CREATE POLICY "Users can read brands in their company"
ON brands
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
);

-- Brands: Allow users to update brands in their company
DROP POLICY IF EXISTS "Users can update brands in their company" ON brands;
CREATE POLICY "Users can update brands in their company"
ON brands
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
);

-- Users: Allow users to update their own record (for company_id linking)
DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record"
ON users
FOR UPDATE
TO authenticated
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());
