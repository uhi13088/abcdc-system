-- Migration: 026_contracts_rls_policies
-- Description: Add RLS policies for contracts table with proper role-based access control
-- Created: 2026-01-17

-- =============================================
-- Helper function to get current user's store_id
-- =============================================
CREATE OR REPLACE FUNCTION get_current_store_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT store_id FROM users
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- CONTRACTS TABLE RLS POLICIES
-- =============================================

-- Drop existing policies first (if any)
DROP POLICY IF EXISTS "contracts_select" ON contracts;
DROP POLICY IF EXISTS "contracts_insert" ON contracts;
DROP POLICY IF EXISTS "contracts_update" ON contracts;
DROP POLICY IF EXISTS "contracts_delete" ON contracts;
DROP POLICY IF EXISTS "contracts_select_policy" ON contracts;
DROP POLICY IF EXISTS "contracts_insert_policy" ON contracts;
DROP POLICY IF EXISTS "contracts_update_policy" ON contracts;
DROP POLICY IF EXISTS "contracts_delete_policy" ON contracts;

-- SELECT Policy: Who can view contracts
-- - super_admin: Can view all contracts
-- - company_admin, manager: Can view all contracts in their company
-- - store_manager: Can view contracts for their store only
-- - staff: Can view their own contracts only
CREATE POLICY "contracts_select_policy"
ON contracts
FOR SELECT
TO authenticated
USING (
  -- super_admin can see all
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- company_admin and manager can see all contracts in their company
  (
    company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid() AND role IN ('company_admin', 'manager')
    )
  )
  OR
  -- store_manager can see contracts in their store
  (
    store_id IN (
      SELECT store_id FROM users WHERE auth_id = auth.uid() AND role = 'store_manager'
    )
  )
  OR
  -- staff can see their own contracts
  (
    staff_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  )
);

-- INSERT Policy: Who can create contracts
-- - super_admin: Can create contracts for any company
-- - company_admin, manager: Can create contracts for their company only
-- - store_manager: Can create contracts for their store only
CREATE POLICY "contracts_insert_policy"
ON contracts
FOR INSERT
TO authenticated
WITH CHECK (
  -- super_admin can create for anyone
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- company_admin and manager can create for their company only
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('company_admin', 'manager')
    )
    AND company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  )
  OR
  -- store_manager can create for their store only
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'store_manager'
    )
    AND store_id IN (
      SELECT store_id FROM users WHERE auth_id = auth.uid()
    )
  )
);

-- UPDATE Policy: Who can update contracts
-- - super_admin: Can update any contract
-- - company_admin, manager: Can update contracts in their company
-- - store_manager: Can update contracts in their store
CREATE POLICY "contracts_update_policy"
ON contracts
FOR UPDATE
TO authenticated
USING (
  -- super_admin can update all
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- company_admin and manager can update contracts in their company
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('company_admin', 'manager')
    )
    AND company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  )
  OR
  -- store_manager can update contracts in their store
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'store_manager'
    )
    AND store_id IN (
      SELECT store_id FROM users WHERE auth_id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Same conditions for the new row
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('company_admin', 'manager')
    )
    AND company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'store_manager'
    )
    AND store_id IN (
      SELECT store_id FROM users WHERE auth_id = auth.uid()
    )
  )
);

-- DELETE Policy: Who can delete contracts
-- - super_admin: Can delete any contract
-- - company_admin: Can delete contracts in their company
CREATE POLICY "contracts_delete_policy"
ON contracts
FOR DELETE
TO authenticated
USING (
  -- super_admin can delete all
  EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  )
  OR
  -- company_admin can delete contracts in their company
  (
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'company_admin'
    )
    AND company_id IN (
      SELECT company_id FROM users WHERE auth_id = auth.uid()
    )
  )
);

-- Ensure RLS is enabled on contracts table
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
