-- Add RLS policies for emergency_shifts table

-- SELECT: Users can see emergency shifts for their company
CREATE POLICY emergency_shifts_select ON emergency_shifts FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR company_id = get_current_company_id()
);

-- INSERT: Admins and managers can create emergency shifts
CREATE POLICY emergency_shifts_insert ON emergency_shifts FOR INSERT WITH CHECK (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
  AND (
    get_current_user_role() = 'super_admin'
    OR company_id = get_current_company_id()
  )
);

-- UPDATE: Admins and managers can update emergency shifts
CREATE POLICY emergency_shifts_update ON emergency_shifts FOR UPDATE USING (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
  AND (
    get_current_user_role() = 'super_admin'
    OR company_id = get_current_company_id()
  )
);

-- DELETE: Admins and managers can delete emergency shifts
CREATE POLICY emergency_shifts_delete ON emergency_shifts FOR DELETE USING (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
  AND (
    get_current_user_role() = 'super_admin'
    OR company_id = get_current_company_id()
  )
);
