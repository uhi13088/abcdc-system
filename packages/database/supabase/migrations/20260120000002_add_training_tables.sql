-- Training (Education) Tables
-- For managing employee training programs and records

-- Training programs table
CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('ONBOARDING', 'SAFETY', 'HACCP', 'SERVICE', 'SKILL', 'COMPLIANCE')),
    duration_hours DECIMAL(5,2) DEFAULT 0,
    is_mandatory BOOLEAN DEFAULT false,
    valid_months INTEGER,
    content_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training records table (employee training completion)
CREATE TABLE IF NOT EXISTS training_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    training_id UUID REFERENCES trainings(id) NOT NULL,
    completed_at DATE,
    expires_at DATE,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    certificate_url TEXT,
    status VARCHAR(20) DEFAULT 'IN_PROGRESS' CHECK (status IN ('COMPLETED', 'IN_PROGRESS', 'EXPIRED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee evaluations table
CREATE TABLE IF NOT EXISTS employee_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    evaluator_id UUID REFERENCES users(id) NOT NULL,
    evaluation_period_start DATE NOT NULL,
    evaluation_period_end DATE NOT NULL,
    overall_score DECIMAL(3,1) CHECK (overall_score >= 0 AND overall_score <= 5),
    performance_score DECIMAL(3,1) CHECK (performance_score >= 0 AND performance_score <= 5),
    attendance_score DECIMAL(3,1) CHECK (attendance_score >= 0 AND attendance_score <= 5),
    teamwork_score DECIMAL(3,1) CHECK (teamwork_score >= 0 AND teamwork_score <= 5),
    skill_score DECIMAL(3,1) CHECK (skill_score >= 0 AND skill_score <= 5),
    strengths TEXT,
    improvements TEXT,
    goals TEXT,
    comments TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trainings_company ON trainings(company_id);
CREATE INDEX IF NOT EXISTS idx_trainings_category ON trainings(category);
CREATE INDEX IF NOT EXISTS idx_training_records_user ON training_records(user_id);
CREATE INDEX IF NOT EXISTS idx_training_records_training ON training_records(training_id);
CREATE INDEX IF NOT EXISTS idx_training_records_status ON training_records(status);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_user ON employee_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_evaluations_evaluator ON employee_evaluations(evaluator_id);

-- Enable RLS
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trainings
CREATE POLICY "Trainings visible to company members" ON trainings
    FOR SELECT USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Trainings manageable by admins" ON trainings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'company_admin', 'manager')
        )
    );

-- RLS Policies for training_records
CREATE POLICY "Training records visible to user and admins" ON training_records
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'company_admin', 'manager', 'store_manager')
        )
    );

CREATE POLICY "Training records manageable by admins" ON training_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'company_admin', 'manager')
        )
    );

-- RLS Policies for employee_evaluations
CREATE POLICY "Evaluations visible to involved users" ON employee_evaluations
    FOR SELECT USING (
        user_id = auth.uid() OR
        evaluator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'company_admin', 'manager')
        )
    );

CREATE POLICY "Evaluations manageable by admins and evaluators" ON employee_evaluations
    FOR ALL USING (
        evaluator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'company_admin', 'manager')
        )
    );

-- Comments for documentation
COMMENT ON TABLE trainings IS '교육 프로그램 테이블';
COMMENT ON TABLE training_records IS '직원 교육 이력 테이블';
COMMENT ON TABLE employee_evaluations IS '직원 평가 테이블';
