-- Migration: 023_haccp_addon_access
-- Description: Add HACCP add-on to subscriptions and HACCP access to users
-- Created: 2026-01-16

-- Add HACCP add-on fields to company_subscriptions
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS haccp_addon_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS haccp_addon_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS haccp_addon_price INTEGER DEFAULT 99000;

-- Add HACCP access field to users
-- This determines which employees can access the HACCP app
ALTER TABLE users
ADD COLUMN IF NOT EXISTS haccp_access BOOLEAN DEFAULT false;

-- Create index for HACCP access queries
CREATE INDEX IF NOT EXISTS idx_users_haccp_access ON users(company_id, haccp_access) WHERE haccp_access = true;

-- Comment
COMMENT ON COLUMN company_subscriptions.haccp_addon_enabled IS 'Whether HACCP add-on is enabled for this company';
COMMENT ON COLUMN company_subscriptions.haccp_addon_started_at IS 'When HACCP add-on was activated';
COMMENT ON COLUMN company_subscriptions.haccp_addon_price IS 'Monthly price for HACCP add-on (default: 99000 KRW)';
COMMENT ON COLUMN users.haccp_access IS 'Whether this user has access to HACCP app (for factory workers)';
