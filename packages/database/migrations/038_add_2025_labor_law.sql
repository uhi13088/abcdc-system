-- Migration: 038_add_2025_labor_law
-- Description: Add 2025 labor law data for year-over-year comparison
-- Created: 2026-01-24

-- Insert 2025 labor law data as ARCHIVED for comparison
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
  standard_daily_hours,
  standard_weekly_hours,
  status,
  activated_at
) VALUES (
  '2025.01',
  '2025-01-01',
  9860,
  1.5,
  0.5,
  1.5,
  4.5,
  3.495,
  12.27,
  0.9,
  8,
  40,
  'ARCHIVED',
  '2025-01-01'::timestamp
) ON CONFLICT (version) DO NOTHING;

-- Ensure 2026 data exists and is ACTIVE
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
  standard_daily_hours,
  standard_weekly_hours,
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
  8,
  40,
  'ACTIVE',
  CURRENT_TIMESTAMP
) ON CONFLICT (version) DO UPDATE SET
  status = 'ACTIVE',
  activated_at = CURRENT_TIMESTAMP
WHERE labor_law_versions.status != 'ACTIVE';
