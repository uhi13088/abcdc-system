-- Migration: 009_contract_extensions
-- Description: Contract PDF and e-signature tables
-- Created: 2026-01-10

-- Contract versions (for amendments)
CREATE TABLE IF NOT EXISTS contract_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  version_number INTEGER NOT NULL,

  -- Snapshot of contract data at this version
  contract_data JSONB NOT NULL,

  -- Change description
  change_description TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  UNIQUE(contract_id, version_number)
);

-- Contract PDFs
CREATE TABLE IF NOT EXISTS contract_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  pdf_type VARCHAR(20) NOT NULL,

  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,

  -- Watermark
  has_watermark BOOLEAN DEFAULT false,
  watermark_text TEXT,

  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_by UUID REFERENCES users(id)
);

-- Signatures
CREATE TABLE IF NOT EXISTS signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id),

  -- Signature image
  signature_data TEXT NOT NULL,
  signature_type VARCHAR(20) DEFAULT 'DRAWN',

  -- Device info
  device_info JSONB,
  ip_address VARCHAR(45),

  -- Usage tracking
  used_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contract signature events
CREATE TABLE IF NOT EXISTS contract_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL,

  -- Actor
  actor_type VARCHAR(20) NOT NULL,
  actor_id UUID REFERENCES users(id),
  actor_name VARCHAR(100),

  -- Signature
  signature_id UUID REFERENCES signatures(id),
  signature_data TEXT,

  -- Device info
  device_info JSONB,
  ip_address VARCHAR(45),

  -- Location (if available)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pdf_draft_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pdf_signed_url TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS sent_via VARCHAR(20);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contract_version ON contract_versions(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_pdf ON contract_pdfs(contract_id);
CREATE INDEX IF NOT EXISTS idx_signature_user ON signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_signature_event_contract ON contract_signature_events(contract_id);
