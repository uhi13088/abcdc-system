-- ============================================
-- HACCP Missing Tables
-- ============================================

-- ============================================
-- 1. IoT 센서 (IoT Sensors)
-- ============================================
CREATE TABLE IF NOT EXISTS iot_sensors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  sensor_code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sensor_type VARCHAR(30) NOT NULL CHECK (sensor_type IN ('TEMPERATURE', 'HUMIDITY', 'TEMPERATURE_HUMIDITY', 'PH', 'PRESSURE', 'CO2', 'OTHER')),

  location VARCHAR(100),
  description TEXT,

  -- 기준값
  min_value DECIMAL(10,2),
  max_value DECIMAL(10,2),
  unit VARCHAR(20) DEFAULT 'C',

  -- 연결 정보
  device_id VARCHAR(100),
  api_endpoint TEXT,

  -- 상태
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'ERROR')),
  is_online BOOLEAN DEFAULT false,
  last_reading_at TIMESTAMPTZ,
  last_value DECIMAL(10,2),

  -- 알림 설정
  alert_enabled BOOLEAN DEFAULT true,
  alert_threshold_min DECIMAL(10,2),
  alert_threshold_max DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, sensor_code)
);

-- ============================================
-- 2. 센서 측정값 (Sensor Readings)
-- ============================================
CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id UUID NOT NULL REFERENCES iot_sensors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  reading_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),

  -- 추가 측정값 (온습도 센서용)
  secondary_value DECIMAL(10,2),
  secondary_unit VARCHAR(20),

  is_within_range BOOLEAN,
  is_alert BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. 반제품 (Semi Products)
-- ============================================
CREATE TABLE IF NOT EXISTS semi_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,

  -- 제조 정보
  process_steps JSONB DEFAULT '[]',
  standard_yield DECIMAL(10,2),
  unit VARCHAR(20),

  -- 보관 조건
  storage_temp VARCHAR(50),
  shelf_life INTEGER,

  -- 원재료 구성
  ingredients JSONB DEFAULT '[]',

  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, code)
);

-- ============================================
-- 4. HACCP 회사 설정 (HACCP Company Settings)
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

  -- 기본 설정
  haccp_cert_number VARCHAR(100),
  haccp_cert_date DATE,
  haccp_cert_expiry DATE,

  -- 점검 시간 설정
  morning_check_time TIME DEFAULT '09:00',
  afternoon_check_time TIME DEFAULT '14:00',
  night_check_time TIME DEFAULT '22:00',

  -- 알림 설정
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_before_minutes INTEGER DEFAULT 30,

  -- 자동화 설정
  auto_generate_reports BOOLEAN DEFAULT false,
  report_generation_day INTEGER DEFAULT 1,

  -- 기타 설정
  settings JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. HACCP 점검 상태 (HACCP Check Status)
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_check_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  check_type VARCHAR(30) NOT NULL CHECK (check_type IN ('HYGIENE_MORNING', 'HYGIENE_AFTERNOON', 'HYGIENE_NIGHT', 'CCP', 'PEST_CONTROL', 'TEMPERATURE')),

  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, check_date, check_type)
);

-- ============================================
-- 6. HACCP 알림 설정 (HACCP Reminders)
-- ============================================
CREATE TABLE IF NOT EXISTS haccp_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  reminder_type VARCHAR(30) NOT NULL CHECK (reminder_type IN ('HYGIENE', 'CCP', 'PEST_CONTROL', 'CALIBRATION', 'TRAINING', 'VERIFICATION', 'CUSTOM')),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- 스케줄
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM')),
  time TIME,
  day_of_week INTEGER, -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly

  -- 대상
  target_users JSONB DEFAULT '[]',
  target_roles JSONB DEFAULT '[]',

  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 개선조치 (Corrective Actions)
-- ============================================
CREATE TABLE IF NOT EXISTS corrective_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  action_number VARCHAR(50) NOT NULL,
  action_date DATE NOT NULL,

  -- 발생 정보
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('CCP', 'HYGIENE', 'INSPECTION', 'AUDIT', 'CUSTOMER_COMPLAINT', 'OTHER')),
  source_id UUID,

  -- 문제 내용
  problem_description TEXT NOT NULL,
  root_cause TEXT,

  -- 조치 내용
  immediate_action TEXT,
  corrective_action TEXT NOT NULL,
  preventive_action TEXT,

  -- 담당자
  responsible_person UUID REFERENCES users(id),
  due_date DATE,

  -- 검증
  verification_method TEXT,
  verification_date DATE,
  verified_by UUID REFERENCES users(id),
  verification_result TEXT,

  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED')),

  attachment_urls JSONB DEFAULT '[]',

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, action_number)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_iot_sensors_company ON iot_sensors(company_id);
CREATE INDEX IF NOT EXISTS idx_iot_sensors_status ON iot_sensors(status);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_time ON sensor_readings(reading_time);
CREATE INDEX IF NOT EXISTS idx_semi_products_company ON semi_products(company_id);
CREATE INDEX IF NOT EXISTS idx_haccp_check_status_company_date ON haccp_check_status(company_id, check_date);
CREATE INDEX IF NOT EXISTS idx_haccp_reminders_company ON haccp_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_company ON corrective_actions(company_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_status ON corrective_actions(status);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE iot_sensors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE semi_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_check_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE haccp_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY iot_sensors_policy ON iot_sensors FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY sensor_readings_policy ON sensor_readings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY semi_products_policy ON semi_products FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY haccp_company_settings_policy ON haccp_company_settings FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY haccp_check_status_policy ON haccp_check_status FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY haccp_reminders_policy ON haccp_reminders FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY corrective_actions_policy ON corrective_actions FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Done
SELECT 'HACCP missing tables created successfully!' as result;
