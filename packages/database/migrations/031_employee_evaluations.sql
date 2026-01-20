-- Employee Evaluations table for quarterly performance reviews
-- Migration: 031_employee_evaluations.sql

CREATE TABLE IF NOT EXISTS employee_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

    -- Evaluation period
    evaluation_period_start DATE NOT NULL,
    evaluation_period_end DATE NOT NULL,

    -- Scores (1-5 scale)
    overall_score DECIMAL(3,1) NOT NULL DEFAULT 3.0,
    attendance_score INTEGER NOT NULL DEFAULT 3 CHECK (attendance_score >= 1 AND attendance_score <= 5),
    performance_score INTEGER NOT NULL DEFAULT 3 CHECK (performance_score >= 1 AND performance_score <= 5),
    teamwork_score INTEGER NOT NULL DEFAULT 3 CHECK (teamwork_score >= 1 AND teamwork_score <= 5),
    skill_score INTEGER NOT NULL DEFAULT 3 CHECK (skill_score >= 1 AND skill_score <= 5),

    -- Feedback text
    strengths TEXT,
    improvements TEXT,
    goals TEXT,

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_user_id ON employee_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_evaluator_id ON employee_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_company_id ON employee_evaluations(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_period ON employee_evaluations(evaluation_period_start, evaluation_period_end);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_status ON employee_evaluations(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_employee_evaluations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employee_evaluations_updated_at ON employee_evaluations;
CREATE TRIGGER employee_evaluations_updated_at
    BEFORE UPDATE ON employee_evaluations
    FOR EACH ROW
    EXECUTE FUNCTION update_employee_evaluations_updated_at();

-- RLS Policies
ALTER TABLE employee_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy for viewing evaluations (admins and managers can view all in their company, users can view their own)
CREATE POLICY employee_evaluations_select_policy ON employee_evaluations
    FOR SELECT
    USING (
        -- Super admin can see all
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid() AND u.role = 'super_admin'
        )
        OR
        -- Company admin/manager can see their company's evaluations
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid()
            AND u.company_id = employee_evaluations.company_id
            AND u.role IN ('company_admin', 'manager', 'store_manager')
        )
        OR
        -- Users can see their own evaluations
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid() AND u.id = employee_evaluations.user_id
        )
    );

-- Policy for inserting evaluations (admins and managers only)
CREATE POLICY employee_evaluations_insert_policy ON employee_evaluations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid()
            AND u.role IN ('super_admin', 'company_admin', 'manager', 'store_manager')
        )
    );

-- Policy for updating evaluations (evaluator or admin can update)
CREATE POLICY employee_evaluations_update_policy ON employee_evaluations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid()
            AND (u.id = employee_evaluations.evaluator_id OR u.role IN ('super_admin', 'company_admin'))
        )
    );

-- Policy for deleting evaluations (admin only)
CREATE POLICY employee_evaluations_delete_policy ON employee_evaluations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid()
            AND u.role IN ('super_admin', 'company_admin')
        )
    );

-- Grant access to authenticated users
GRANT ALL ON employee_evaluations TO authenticated;
GRANT ALL ON employee_evaluations TO service_role;
