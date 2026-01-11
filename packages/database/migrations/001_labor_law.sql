-- Migration: 001_labor_law
-- Description: Labor law version management tables
-- Created: 2026-01-10

-- Labor law versions table
CREATE TABLE IF NOT EXISTS labor_law_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,
  effective_date DATE NOT NULL,
  source TEXT,

  -- Core data
  minimum_wage_hourly INTEGER NOT NULL,

  -- Working hours
  standard_daily_hours INTEGER DEFAULT 8,
  standard_weekly_hours INTEGER DEFAULT 40,
  max_weekly_hours INTEGER DEFAULT 52,

  -- Allowance rates (multipliers)
  overtime_rate DECIMAL(3,2) DEFAULT 1.5,
  night_rate DECIMAL(3,2) DEFAULT 0.5,
  holiday_rate DECIMAL(3,2) DEFAULT 1.5,

  -- Insurance rates (%)
  national_pension_rate DECIMAL(4,2) DEFAULT 4.5,
  health_insurance_rate DECIMAL(5,3) DEFAULT 3.545,
  long_term_care_rate DECIMAL(5,3) DEFAULT 12.81,
  employment_insurance_rate DECIMAL(4,2) DEFAULT 0.9,

  -- Break time (minutes)
  break_time_4hours INTEGER DEFAULT 30,
  break_time_8hours INTEGER DEFAULT 60,

  -- Weekly holiday pay
  weekly_holiday_min_hours INTEGER DEFAULT 15,

  -- Annual leave
  annual_leave_basic_days INTEGER DEFAULT 15,
  annual_leave_max_days INTEGER DEFAULT 25,

  -- Severance
  severance_min_service_months INTEGER DEFAULT 12,

  -- Status
  status VARCHAR(20) DEFAULT 'DRAFT',
  verified_by UUID,
  verified_at TIMESTAMP,

  -- History
  changelog TEXT,
  previous_version_id UUID REFERENCES labor_law_versions(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP,

  UNIQUE(version)
);

-- Law change logs table
CREATE TABLE IF NOT EXISTS law_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES labor_law_versions(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  impact_level VARCHAR(20),
  affected_companies INTEGER,
  affected_contracts INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_labor_law_status ON labor_law_versions(status);
CREATE INDEX IF NOT EXISTS idx_labor_law_effective ON labor_law_versions(effective_date);
CREATE INDEX IF NOT EXISTS idx_law_change_version ON law_change_logs(version_id);

-- Insert initial 2026 labor law data
INSERT INTO labor_law_versions (
  version,
  effective_date,
  minimum_wage_hourly,
  overtime_rate,
  night_rate,
  holiday_rate,
  national_pension_rate,
  health_insurance_rate,
  long_term_care_rate,
  employment_insurance_rate,
  status,
  activated_at
) VALUES (
  '2026.01',
  '2026-01-01',
  10030,
  1.5,
  0.5,
  1.5,
  4.5,
  3.545,
  12.81,
  0.9,
  'ACTIVE',
  CURRENT_TIMESTAMP
) ON CONFLICT (version) DO NOTHING;
