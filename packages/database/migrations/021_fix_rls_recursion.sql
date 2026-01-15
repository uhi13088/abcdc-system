-- Migration: 021_fix_rls_recursion
-- Description: Fix RLS recursion issues by using SECURITY DEFINER functions
-- Created: 2026-01-15
-- Issue: 016_fix_rls_policies.sql used subqueries instead of SECURITY DEFINER functions,
--        causing infinite recursion when accessing users table

-- =============================================
-- 1. Create/Update SECURITY DEFINER helper functions
-- =============================================

-- Get current user's profile ID (users.id, not auth.uid())
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM users
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's company_id (already exists, but ensure SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT company_id FROM users
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's role (already exists, but ensure SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM users
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- 2. Fix USERS TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

-- Users can read: own record OR same company OR super_admin
CREATE POLICY "users_select_policy"
ON users
FOR SELECT
TO authenticated
USING (
  auth_id = auth.uid()  -- Can always read own record (no recursion)
  OR company_id = get_current_company_id()  -- Same company (uses SECURITY DEFINER)
  OR get_current_user_role() = 'super_admin'  -- Super admin sees all
);

-- Users can update: own record OR admin roles
CREATE POLICY "users_update_policy"
ON users
FOR UPDATE
TO authenticated
USING (
  auth_id = auth.uid()
  OR get_current_user_role() IN ('super_admin', 'company_admin')
)
WITH CHECK (
  auth_id = auth.uid()
  OR get_current_user_role() IN ('super_admin', 'company_admin')
);

-- Allow creating new users (for registration)
CREATE POLICY "users_insert_policy"
ON users
FOR INSERT
TO authenticated
WITH CHECK (true);

-- =============================================
-- 3. Fix COMPANIES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "companies_select_policy" ON companies;
DROP POLICY IF EXISTS "companies_update_policy" ON companies;
DROP POLICY IF EXISTS "companies_insert_policy" ON companies;
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;

CREATE POLICY "companies_select_policy"
ON companies
FOR SELECT
TO authenticated
USING (
  id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "companies_insert_policy"
ON companies
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "companies_update_policy"
ON companies
FOR UPDATE
TO authenticated
USING (
  id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

-- =============================================
-- 4. Fix BRANDS TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "brands_select_policy" ON brands;
DROP POLICY IF EXISTS "brands_insert_policy" ON brands;
DROP POLICY IF EXISTS "brands_update_policy" ON brands;
DROP POLICY IF EXISTS "brands_delete_policy" ON brands;
DROP POLICY IF EXISTS "brands_select" ON brands;
DROP POLICY IF EXISTS "brands_insert" ON brands;
DROP POLICY IF EXISTS "brands_update" ON brands;

CREATE POLICY "brands_select_policy"
ON brands
FOR SELECT
TO authenticated
USING (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "brands_insert_policy"
ON brands
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "brands_update_policy"
ON brands
FOR UPDATE
TO authenticated
USING (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "brands_delete_policy"
ON brands
FOR DELETE
TO authenticated
USING (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

-- =============================================
-- 5. Fix STORES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "stores_select_policy" ON stores;
DROP POLICY IF EXISTS "stores_insert_policy" ON stores;
DROP POLICY IF EXISTS "stores_update_policy" ON stores;
DROP POLICY IF EXISTS "stores_delete_policy" ON stores;
DROP POLICY IF EXISTS "stores_select" ON stores;
DROP POLICY IF EXISTS "stores_insert" ON stores;
DROP POLICY IF EXISTS "stores_update" ON stores;

CREATE POLICY "stores_select_policy"
ON stores
FOR SELECT
TO authenticated
USING (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "stores_insert_policy"
ON stores
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "stores_update_policy"
ON stores
FOR UPDATE
TO authenticated
USING (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

CREATE POLICY "stores_delete_policy"
ON stores
FOR DELETE
TO authenticated
USING (
  company_id = get_current_company_id()
  OR get_current_user_role() = 'super_admin'
);

-- =============================================
-- 6. Fix ATTENDANCES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "attendances_select" ON attendances;
DROP POLICY IF EXISTS "attendances_select_policy" ON attendances;
DROP POLICY IF EXISTS "attendances_insert_policy" ON attendances;
DROP POLICY IF EXISTS "attendances_update_policy" ON attendances;

-- Staff can see their own, managers can see company's
CREATE POLICY "attendances_select_policy"
ON attendances
FOR SELECT
TO authenticated
USING (
  staff_id = get_current_user_id()  -- Own records
  OR (
    company_id = get_current_company_id()
    AND get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager', 'team_leader')
  )
);

-- Staff can insert their own attendance
CREATE POLICY "attendances_insert_policy"
ON attendances
FOR INSERT
TO authenticated
WITH CHECK (
  staff_id = get_current_user_id()
  OR get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
);

-- Staff can update their own, managers can update company's
CREATE POLICY "attendances_update_policy"
ON attendances
FOR UPDATE
TO authenticated
USING (
  staff_id = get_current_user_id()
  OR (
    company_id = get_current_company_id()
    AND get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
  )
);

-- =============================================
-- 7. Fix SCHEDULES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "schedules_select" ON schedules;
DROP POLICY IF EXISTS "schedules_select_policy" ON schedules;
DROP POLICY IF EXISTS "schedules_insert_policy" ON schedules;
DROP POLICY IF EXISTS "schedules_update_policy" ON schedules;

-- Staff can see their own, managers can see company's
CREATE POLICY "schedules_select_policy"
ON schedules
FOR SELECT
TO authenticated
USING (
  staff_id = get_current_user_id()  -- Own schedules
  OR (
    company_id = get_current_company_id()
    AND get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager', 'team_leader')
  )
);

CREATE POLICY "schedules_insert_policy"
ON schedules
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_current_company_id()
  AND get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager', 'team_leader')
);

CREATE POLICY "schedules_update_policy"
ON schedules
FOR UPDATE
TO authenticated
USING (
  company_id = get_current_company_id()
  AND get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager', 'team_leader')
);

-- =============================================
-- 8. Fix SALARIES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "salaries_select" ON salaries;
DROP POLICY IF EXISTS "salaries_select_policy" ON salaries;

CREATE POLICY "salaries_select_policy"
ON salaries
FOR SELECT
TO authenticated
USING (
  staff_id = get_current_user_id()  -- Own salary records
  OR (
    company_id = get_current_company_id()
    AND get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
  )
);

-- =============================================
-- 9. Fix NOTICES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "notices_select" ON notices;
DROP POLICY IF EXISTS "notices_select_policy" ON notices;

CREATE POLICY "notices_select_policy"
ON notices
FOR SELECT
TO authenticated
USING (
  company_id = get_current_company_id()
  OR company_id IS NULL  -- Global notices
  OR get_current_user_role() = 'super_admin'
);

-- =============================================
-- 10. Fix NOTIFICATIONS TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;

CREATE POLICY "notifications_select_policy"
ON notifications
FOR SELECT
TO authenticated
USING (
  user_id = get_current_user_id()
);

CREATE POLICY "notifications_update_policy"
ON notifications
FOR UPDATE
TO authenticated
USING (
  user_id = get_current_user_id()
);

-- =============================================
-- 11. Fix MESSAGES TABLE RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_select_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;

CREATE POLICY "messages_select_policy"
ON messages
FOR SELECT
TO authenticated
USING (
  sender_id = get_current_user_id()
  OR recipient_id = get_current_user_id()
);

CREATE POLICY "messages_insert_policy"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = get_current_user_id()
);
