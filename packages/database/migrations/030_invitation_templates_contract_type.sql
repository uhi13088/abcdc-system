-- Migration: 030_invitation_templates_contract_type
-- Description: Add contract_type column to invitation_templates
-- Created: 2026-01-20

-- Add contract_type column to invitation_templates
ALTER TABLE invitation_templates
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50)
CHECK (contract_type IN ('정규직', '계약직', '아르바이트', '인턴') OR contract_type IS NULL);

-- Add comment explaining the column
COMMENT ON COLUMN invitation_templates.contract_type IS '계약 유형: 정규직, 계약직, 아르바이트, 인턴';

-- Also add contract_type to invitations table for consistency
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50)
CHECK (contract_type IN ('정규직', '계약직', '아르바이트', '인턴') OR contract_type IS NULL);

COMMENT ON COLUMN invitations.contract_type IS '계약 유형: 정규직, 계약직, 아르바이트, 인턴';
