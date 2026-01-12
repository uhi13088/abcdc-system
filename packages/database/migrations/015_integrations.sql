-- Migration: 015_integrations
-- Description: Integration settings and OAuth tokens for external services
-- Created: 2026-01-12

-- Integrations table (연동 설정)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'toss_pos', 'open_banking', 'kakao_work', 'slack', etc.
  enabled BOOLEAN DEFAULT false,
  connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMP,

  -- OAuth tokens (encrypted)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,

  -- Provider-specific settings
  settings JSONB DEFAULT '{}',

  -- Sync status
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(20), -- 'SUCCESS', 'FAILED', 'PENDING'
  last_sync_error TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, provider)
);

-- OAuth states for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_integrations_company ON integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integrations
CREATE POLICY "Company admins can manage their integrations"
ON integrations
FOR ALL
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  )
);

-- RLS Policies for oauth_states
CREATE POLICY "Users can manage their own oauth states"
ON oauth_states
FOR ALL
TO authenticated
USING (user_id = auth.uid());

-- Cleanup expired oauth states (to be run by a cron job)
-- DELETE FROM oauth_states WHERE expires_at < NOW();
