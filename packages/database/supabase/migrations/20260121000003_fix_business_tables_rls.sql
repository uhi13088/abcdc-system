-- Fix RLS policies for business management tables
-- Use helper functions instead of raw subqueries for better permission handling
-- This migration is safe to run even if tables don't exist yet

DO $$
BEGIN
  -- Only proceed if the tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_sales') THEN

    -- Drop existing policies
    DROP POLICY IF EXISTS revenue_sources_policy ON revenue_sources;
    DROP POLICY IF EXISTS daily_sales_policy ON daily_sales;
    DROP POLICY IF EXISTS expense_transactions_policy ON expense_transactions;
    DROP POLICY IF EXISTS fixed_costs_policy ON fixed_costs;
    DROP POLICY IF EXISTS profit_loss_statements_policy ON profit_loss_statements;
    DROP POLICY IF EXISTS bank_accounts_policy ON bank_accounts;
    DROP POLICY IF EXISTS budget_plans_policy ON budget_plans;
    DROP POLICY IF EXISTS cost_alerts_policy ON cost_alerts;
    DROP POLICY IF EXISTS ai_insights_policy ON ai_insights;

    -- revenue_sources
    CREATE POLICY revenue_sources_select ON revenue_sources FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY revenue_sources_insert ON revenue_sources FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY revenue_sources_update ON revenue_sources FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY revenue_sources_delete ON revenue_sources FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- daily_sales
    CREATE POLICY daily_sales_select ON daily_sales FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY daily_sales_insert ON daily_sales FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY daily_sales_update ON daily_sales FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY daily_sales_delete ON daily_sales FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- expense_transactions
    CREATE POLICY expense_transactions_select ON expense_transactions FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY expense_transactions_insert ON expense_transactions FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY expense_transactions_update ON expense_transactions FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY expense_transactions_delete ON expense_transactions FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- fixed_costs
    CREATE POLICY fixed_costs_select ON fixed_costs FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY fixed_costs_insert ON fixed_costs FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY fixed_costs_update ON fixed_costs FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY fixed_costs_delete ON fixed_costs FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- profit_loss_statements
    CREATE POLICY profit_loss_statements_select ON profit_loss_statements FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY profit_loss_statements_insert ON profit_loss_statements FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY profit_loss_statements_update ON profit_loss_statements FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY profit_loss_statements_delete ON profit_loss_statements FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- bank_accounts
    CREATE POLICY bank_accounts_select ON bank_accounts FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY bank_accounts_insert ON bank_accounts FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY bank_accounts_update ON bank_accounts FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY bank_accounts_delete ON bank_accounts FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- budget_plans
    CREATE POLICY budget_plans_select ON budget_plans FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY budget_plans_insert ON budget_plans FOR INSERT WITH CHECK (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY budget_plans_update ON budget_plans FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY budget_plans_delete ON budget_plans FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- cost_alerts
    CREATE POLICY cost_alerts_select ON cost_alerts FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY cost_alerts_insert ON cost_alerts FOR INSERT WITH CHECK (true);
    CREATE POLICY cost_alerts_update ON cost_alerts FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY cost_alerts_delete ON cost_alerts FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    -- ai_insights
    CREATE POLICY ai_insights_select ON ai_insights FOR SELECT USING (
      get_current_user_role() = 'super_admin'
      OR company_id = get_current_company_id()
    );
    CREATE POLICY ai_insights_insert ON ai_insights FOR INSERT WITH CHECK (true);
    CREATE POLICY ai_insights_update ON ai_insights FOR UPDATE USING (
      get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
      OR company_id = get_current_company_id()
    );
    CREATE POLICY ai_insights_delete ON ai_insights FOR DELETE USING (
      get_current_user_role() IN ('super_admin', 'company_admin')
      OR company_id = get_current_company_id()
    );

    RAISE NOTICE 'Business management RLS policies fixed!';
  ELSE
    RAISE NOTICE 'Business management tables do not exist yet. Skipping RLS policy updates.';
  END IF;
END $$;
