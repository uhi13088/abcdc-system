-- Migration: 037_add_email_to_companies
-- Description: Add email column to companies table for consistency across apps
-- Created: 2026-01-24

-- Add email column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);
