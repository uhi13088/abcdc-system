-- Add ssn_hash column for duplicate registration prevention
-- This column stores a SHA-256 hash of the SSN for comparison without exposing the actual SSN

ALTER TABLE users ADD COLUMN IF NOT EXISTS ssn_hash VARCHAR(64);

-- Create unique index to prevent duplicate SSN registrations
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_ssn_hash ON users(ssn_hash) WHERE ssn_hash IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.ssn_hash IS 'SHA-256 hash of SSN for duplicate prevention';
