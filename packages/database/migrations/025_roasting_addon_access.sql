-- Migration: 025_roasting_addon_access
-- Description: Add Roasting add-on to subscriptions and Roasting settings to stores
-- Created: 2026-01-17

-- Add Roasting add-on fields to company_subscriptions
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS roasting_addon_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS roasting_addon_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS roasting_addon_price INTEGER DEFAULT 99000;

-- Add Roasting enabled field to stores
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS roasting_enabled BOOLEAN DEFAULT false;

-- Add user-level override for Roasting access
ALTER TABLE users
ADD COLUMN IF NOT EXISTS roasting_access BOOLEAN DEFAULT false;

-- Create index for Roasting store queries
CREATE INDEX IF NOT EXISTS idx_stores_roasting_enabled
ON stores(company_id, roasting_enabled) WHERE roasting_enabled = true;

-- Comments
COMMENT ON COLUMN company_subscriptions.roasting_addon_enabled IS 'Whether Roasting add-on is enabled for this company';
COMMENT ON COLUMN company_subscriptions.roasting_addon_started_at IS 'When Roasting add-on was activated';
COMMENT ON COLUMN company_subscriptions.roasting_addon_price IS 'Monthly price for Roasting add-on (default: 99000 KRW)';
COMMENT ON COLUMN stores.roasting_enabled IS 'Whether this store uses Roasting - employees get Roasting app access';
COMMENT ON COLUMN users.roasting_access IS 'Optional user-level Roasting access override';
