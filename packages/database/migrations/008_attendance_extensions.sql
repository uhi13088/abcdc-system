-- Migration: 008_attendance_extensions
-- Description: QR code and geofence attendance tables
-- Created: 2026-01-10

-- Store QR codes
CREATE TABLE IF NOT EXISTS store_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- QR data
  qr_token TEXT NOT NULL,
  qr_data_url TEXT,

  -- Validity
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,

  -- Settings
  single_use BOOLEAN DEFAULT false,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),

  UNIQUE(store_id, qr_token)
);

-- Attendance anomalies
CREATE TABLE IF NOT EXISTS attendance_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,

  anomaly_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'MEDIUM',

  description TEXT,

  -- Location anomaly details
  expected_lat DECIMAL(10, 8),
  expected_lng DECIMAL(11, 8),
  actual_lat DECIMAL(10, 8),
  actual_lng DECIMAL(11, 8),
  distance_meters INTEGER,

  -- Time anomaly details
  expected_time TIMESTAMP,
  actual_time TIMESTAMP,
  difference_minutes INTEGER,

  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update stores table for geofence
ALTER TABLE stores ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN DEFAULT true;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS beacon_id VARCHAR(100);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Seoul';

-- Update attendances table
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS qr_code_id UUID REFERENCES store_qr_codes(id);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS check_in_photo_url TEXT;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS check_out_photo_url TEXT;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS auto_checkout BOOLEAN DEFAULT false;
ALTER TABLE attendances ADD COLUMN IF NOT EXISTS auto_checkout_reason TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qr_store ON store_qr_codes(store_id);
CREATE INDEX IF NOT EXISTS idx_qr_token ON store_qr_codes(qr_token);
CREATE INDEX IF NOT EXISTS idx_anomaly_attendance ON attendance_anomalies(attendance_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_unresolved ON attendance_anomalies(resolved, created_at DESC);
