-- Migration: 007_schedule_extensions
-- Description: Schedule trade and auto-generation tables
-- Created: 2026-01-10

-- Schedule trade requests
CREATE TABLE IF NOT EXISTS schedule_trade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Original schedule
  requester_id UUID NOT NULL REFERENCES users(id),
  requester_schedule_id UUID NOT NULL REFERENCES schedules(id),

  -- Target schedule
  target_id UUID NOT NULL REFERENCES users(id),
  target_schedule_id UUID NOT NULL REFERENCES schedules(id),

  reason TEXT,

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',

  -- Response
  responded_at TIMESTAMP,
  response_comment TEXT,

  -- Manager approval (if required)
  requires_manager_approval BOOLEAN DEFAULT true,
  manager_approved BOOLEAN,
  manager_id UUID REFERENCES users(id),
  manager_responded_at TIMESTAMP,
  manager_comment TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule generation logs
CREATE TABLE IF NOT EXISTS schedule_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),

  -- Generation period
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Source
  generation_source VARCHAR(50) NOT NULL,
  contract_id UUID REFERENCES contracts(id),

  -- Results
  schedules_created INTEGER DEFAULT 0,
  schedules_updated INTEGER DEFAULT 0,
  schedules_deleted INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'SUCCESS',
  error_message TEXT,

  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update schedules table
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT false;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS holiday_name VARCHAR(100);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS traded_from_id UUID REFERENCES schedules(id);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS original_staff_id UUID REFERENCES users(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trade_requester ON schedule_trade_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_trade_target ON schedule_trade_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_trade_status ON schedule_trade_requests(status);
CREATE INDEX IF NOT EXISTS idx_schedule_gen_company ON schedule_generation_logs(company_id);
