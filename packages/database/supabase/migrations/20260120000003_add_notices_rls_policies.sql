-- Add RLS policies for notices table
-- The table has RLS enabled but no policies, causing all operations to fail

-- SELECT policy: Users can see notices for their company
CREATE POLICY notices_select ON notices FOR SELECT USING (
  -- Super admin can see all
  get_current_user_role() = 'super_admin'
  OR
  -- Others see their company's notices
  company_id = get_current_company_id()
);

-- INSERT policy: Admins and managers can create notices
CREATE POLICY notices_insert ON notices FOR INSERT WITH CHECK (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
  AND (
    get_current_user_role() = 'super_admin'
    OR company_id = get_current_company_id()
  )
);

-- UPDATE policy: Admins and managers can update notices
CREATE POLICY notices_update ON notices FOR UPDATE USING (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
  AND (
    get_current_user_role() = 'super_admin'
    OR company_id = get_current_company_id()
  )
);

-- DELETE policy: Admins and managers can delete notices
CREATE POLICY notices_delete ON notices FOR DELETE USING (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
  AND (
    get_current_user_role() = 'super_admin'
    OR company_id = get_current_company_id()
  )
);
