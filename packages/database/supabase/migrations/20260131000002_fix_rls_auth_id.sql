-- Fix RLS policies that incorrectly use id = auth.uid() instead of auth_id = auth.uid()
-- This patch fixes policies for semi_products, trainings, training_records, and employee_evaluations tables

-- =====================================================
-- 1. Fix semi_products RLS policies
-- =====================================================
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Semi-products visible to company members" ON semi_products;
    DROP POLICY IF EXISTS "Semi-products manageable by authorized users" ON semi_products;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

-- Create corrected policies for semi_products (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'semi_products') THEN
        EXECUTE 'CREATE POLICY "Semi-products visible to company members" ON semi_products
            FOR SELECT USING (
                company_id IS NULL OR
                company_id IN (
                    SELECT company_id FROM users WHERE auth_id = auth.uid()
                )
            )';

        EXECUTE 'CREATE POLICY "Semi-products manageable by authorized users" ON semi_products
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_id = auth.uid()
                    AND role IN (''super_admin'', ''company_admin'', ''manager'', ''store_manager'')
                )
            )';
    END IF;
END $$;

-- =====================================================
-- 2. Fix trainings RLS policies
-- =====================================================
DO $$
BEGIN
    DROP POLICY IF EXISTS "Trainings visible to company members" ON trainings;
    DROP POLICY IF EXISTS "Trainings manageable by admins" ON trainings;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trainings') THEN
        EXECUTE 'CREATE POLICY "Trainings visible to company members" ON trainings
            FOR SELECT USING (
                company_id IS NULL OR
                company_id IN (
                    SELECT company_id FROM users WHERE auth_id = auth.uid()
                )
            )';

        EXECUTE 'CREATE POLICY "Trainings manageable by admins" ON trainings
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_id = auth.uid()
                    AND role IN (''super_admin'', ''company_admin'', ''manager'')
                )
            )';
    END IF;
END $$;

-- =====================================================
-- 3. Fix training_records RLS policies
-- =====================================================
DO $$
BEGIN
    DROP POLICY IF EXISTS "Training records visible to user and admins" ON training_records;
    DROP POLICY IF EXISTS "Training records manageable by admins" ON training_records;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_records') THEN
        EXECUTE 'CREATE POLICY "Training records visible to user and admins" ON training_records
            FOR SELECT USING (
                user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_id = auth.uid()
                    AND role IN (''super_admin'', ''company_admin'', ''manager'', ''store_manager'')
                )
            )';

        EXECUTE 'CREATE POLICY "Training records manageable by admins" ON training_records
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_id = auth.uid()
                    AND role IN (''super_admin'', ''company_admin'', ''manager'')
                )
            )';
    END IF;
END $$;

-- =====================================================
-- 4. Fix employee_evaluations RLS policies
-- =====================================================
DO $$
BEGIN
    DROP POLICY IF EXISTS "Evaluations visible to involved users" ON employee_evaluations;
    DROP POLICY IF EXISTS "Evaluations manageable by admins and evaluators" ON employee_evaluations;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_evaluations') THEN
        EXECUTE 'CREATE POLICY "Evaluations visible to involved users" ON employee_evaluations
            FOR SELECT USING (
                user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
                evaluator_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_id = auth.uid()
                    AND role IN (''super_admin'', ''company_admin'', ''manager'')
                )
            )';

        EXECUTE 'CREATE POLICY "Evaluations manageable by admins and evaluators" ON employee_evaluations
            FOR ALL USING (
                evaluator_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_id = auth.uid()
                    AND role IN (''super_admin'', ''company_admin'', ''manager'')
                )
            )';
    END IF;
END $$;

-- =====================================================
-- 5. Add store_id to haccp_training_records if missing
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'haccp_training_records') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'haccp_training_records' AND column_name = 'store_id'
        ) THEN
            ALTER TABLE haccp_training_records ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_haccp_training_records_store ON haccp_training_records(store_id);
        END IF;
    END IF;
END $$;

-- =====================================================
-- 6. Add store_id to calibration_records if missing
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calibration_records') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'calibration_records' AND column_name = 'store_id'
        ) THEN
            ALTER TABLE calibration_records ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_calibration_records_store ON calibration_records(store_id);
        END IF;
    END IF;
END $$;

-- =====================================================
-- 7. Add store_id to returns_disposals if missing
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'returns_disposals') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'returns_disposals' AND column_name = 'store_id'
        ) THEN
            ALTER TABLE returns_disposals ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_returns_disposals_store ON returns_disposals(store_id);
        END IF;
    END IF;
END $$;
