-- Migration: 010_haccp_extensions
-- Description: HACCP automation and IoT tables
-- Created: 2026-01-10

-- IoT Sensors
CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Sensor info
  sensor_name VARCHAR(100) NOT NULL,
  sensor_type VARCHAR(50) NOT NULL,
  protocol VARCHAR(20) NOT NULL,

  -- Connection
  connection_string TEXT,
  device_id VARCHAR(100),

  -- Location
  location VARCHAR(255),
  store_id UUID REFERENCES stores(id),

  -- CCP link
  ccp_definition_id UUID REFERENCES ccp_definitions(id),

  -- Settings
  reading_interval_seconds INTEGER DEFAULT 60,
  alert_enabled BOOLEAN DEFAULT true,

  -- Calibration
  calibration_offset DECIMAL(10,4) DEFAULT 0,
  last_calibrated_at TIMESTAMP,
  calibration_due_at TIMESTAMP,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_reading_at TIMESTAMP,
  last_reading_value DECIMAL(10,4),
  status VARCHAR(20) DEFAULT 'UNKNOWN',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sensor readings
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES iot_sensors(id) ON DELETE CASCADE,

  reading_value DECIMAL(10,4) NOT NULL,
  reading_unit VARCHAR(20),

  is_within_limit BOOLEAN,

  raw_data JSONB,

  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HACCP reminders
CREATE TABLE IF NOT EXISTS haccp_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  reminder_type VARCHAR(50) NOT NULL,
  frequency VARCHAR(20) NOT NULL,

  -- Schedule
  time_of_day TIME,
  day_of_week INTEGER,
  day_of_month INTEGER,

  -- Target
  target_role VARCHAR(50),
  target_user_ids UUID[],

  -- Escalation
  escalation_enabled BOOLEAN DEFAULT true,
  escalation_delay_minutes INTEGER DEFAULT 120,
  escalation_role VARCHAR(50),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HACCP check status (for tracking completion)
CREATE TABLE IF NOT EXISTS haccp_check_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  check_type VARCHAR(50) NOT NULL,
  check_date DATE NOT NULL,
  shift VARCHAR(20),

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',

  -- Completion
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),

  -- Reminder
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMP,
  escalation_sent BOOLEAN DEFAULT false,
  escalation_sent_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, check_type, check_date, shift)
);

-- Corrective actions
CREATE TABLE IF NOT EXISTS corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Source
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,

  -- Issue
  issue_description TEXT NOT NULL,
  issue_severity VARCHAR(20),
  issue_date DATE NOT NULL,

  -- Workflow status
  status VARCHAR(50) DEFAULT 'IMMEDIATE_ACTION',
  workflow JSONB NOT NULL,

  -- Assignment
  assigned_to UUID REFERENCES users(id),

  -- Closure
  closed_at TIMESTAMP,
  closed_by UUID REFERENCES users(id),
  effectiveness_verified BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Corrective action steps
CREATE TABLE IF NOT EXISTS corrective_action_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corrective_action_id UUID NOT NULL REFERENCES corrective_actions(id) ON DELETE CASCADE,

  step_type VARCHAR(50) NOT NULL,
  step_order INTEGER NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',

  -- Due date
  due_date TIMESTAMP,

  -- Completion
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),

  -- Data
  data JSONB,
  notes TEXT,
  attachments TEXT[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Internal audits
CREATE TABLE IF NOT EXISTS internal_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  audit_date DATE NOT NULL,
  audit_type VARCHAR(50) NOT NULL,

  -- Auditor
  auditor_id UUID REFERENCES users(id),
  auditor_name VARCHAR(100),

  -- Checklist
  checklist_template_id UUID,
  checklist_items JSONB,

  -- Results
  total_items INTEGER DEFAULT 0,
  passed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  na_items INTEGER DEFAULT 0,

  score DECIMAL(5,2),

  -- Findings
  findings JSONB,

  -- Status
  status VARCHAR(20) DEFAULT 'DRAFT',

  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),

  next_audit_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sensor_company ON iot_sensors(company_id);
CREATE INDEX IF NOT EXISTS idx_sensor_ccp ON iot_sensors(ccp_definition_id);
CREATE INDEX IF NOT EXISTS idx_sensor_reading ON sensor_readings(sensor_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_status_company ON haccp_check_status(company_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_corrective_action_company ON corrective_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_corrective_action_status ON corrective_actions(status);
CREATE INDEX IF NOT EXISTS idx_internal_audit_company ON internal_audits(company_id, audit_date DESC);

-- Create partitioned table for sensor readings (for performance)
-- Note: This is a suggestion for production; may need adjustment based on PostgreSQL version
-- CREATE TABLE sensor_readings_partitioned (
--   LIKE sensor_readings INCLUDING ALL
-- ) PARTITION BY RANGE (recorded_at);
