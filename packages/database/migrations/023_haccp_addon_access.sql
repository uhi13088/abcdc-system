-- Migration: 023_haccp_addon_access
-- Description: Add HACCP add-on to subscriptions and HACCP settings to stores
-- Created: 2026-01-16

-- Add HACCP add-on fields to company_subscriptions
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS haccp_addon_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS haccp_addon_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS haccp_addon_price INTEGER DEFAULT 99000;

-- Add HACCP enabled field to stores
-- When a store has haccp_enabled = true, all employees in that store can access HACCP app
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS haccp_enabled BOOLEAN DEFAULT false;

-- Optional: Keep user-level override for special cases (e.g., admin access without store assignment)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS haccp_access BOOLEAN DEFAULT false;

-- Create index for HACCP store queries
CREATE INDEX IF NOT EXISTS idx_stores_haccp_enabled ON stores(company_id, haccp_enabled) WHERE haccp_enabled = true;

-- Comments
COMMENT ON COLUMN company_subscriptions.haccp_addon_enabled IS 'Whether HACCP add-on is enabled for this company';
COMMENT ON COLUMN company_subscriptions.haccp_addon_started_at IS 'When HACCP add-on was activated';
COMMENT ON COLUMN company_subscriptions.haccp_addon_price IS 'Monthly price for HACCP add-on (default: 99000 KRW)';
COMMENT ON COLUMN stores.haccp_enabled IS 'Whether this store/factory uses HACCP - all employees in this store get HACCP access';
COMMENT ON COLUMN users.haccp_access IS 'Optional user-level HACCP access override';
