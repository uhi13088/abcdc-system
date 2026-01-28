-- ============================================
-- Fix corrective_actions source_type constraint
-- Add 'PRODUCTION' to allowed source types
-- ============================================

-- Drop the existing constraint and recreate with PRODUCTION included
DO $$
BEGIN
  -- Drop existing check constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%source_type%'
  ) THEN
    ALTER TABLE corrective_actions DROP CONSTRAINT IF EXISTS corrective_actions_source_type_check;
  END IF;
END $$;

-- Add new check constraint with PRODUCTION included
ALTER TABLE corrective_actions
ADD CONSTRAINT corrective_actions_source_type_check
CHECK (source_type IN ('CCP', 'HYGIENE', 'INSPECTION', 'AUDIT', 'CUSTOMER_COMPLAINT', 'PRODUCTION', 'OTHER'));

-- Add missing columns if not exist
ALTER TABLE corrective_actions
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'MINOR', 'MAJOR')),
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id);

-- Create index for assigned_to
CREATE INDEX IF NOT EXISTS idx_corrective_actions_assigned_to ON corrective_actions(assigned_to);

-- Done
SELECT 'Corrective actions source_type constraint fixed!' as result;
