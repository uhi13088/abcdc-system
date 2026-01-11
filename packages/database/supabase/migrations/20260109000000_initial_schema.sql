-- ABC Staff System Database Schema
-- Version: 2.0
-- PostgreSQL 16 + Supabase

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. 회사 (Companies)
-- ============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  business_number VARCHAR(20) UNIQUE,
  ceo_name VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  subscription_plan_id UUID,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_status ON companies(status);

-- ============================================
-- 2. 브랜드 (Brands)
-- ============================================
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  logo_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, name)
);

CREATE INDEX idx_brands_company ON brands(company_id);

-- ============================================
-- 3. 매장 (Stores)
-- ============================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  allowed_radius INTEGER DEFAULT 100,  -- 미터
  early_checkin_minutes INTEGER DEFAULT 30,
  early_checkout_minutes INTEGER DEFAULT 30,
  default_hourly_rate INTEGER,
  qr_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(brand_id, name)
);

CREATE INDEX idx_stores_company ON stores(company_id);
CREATE INDEX idx_stores_brand ON stores(brand_id);

-- ============================================
-- 4. 팀 (Teams)
-- ============================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  leader_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(store_id, name)
);

CREATE INDEX idx_teams_store ON teams(store_id);

-- ============================================
-- 5. 사용자 (Users)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,  -- Supabase Auth ID
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN (
    'super_admin', 'company_admin', 'manager',
    'store_manager', 'team_leader', 'staff'
  )),

  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  phone VARCHAR(20),
  address TEXT,
  birth_date DATE,
  ssn_encrypted TEXT,  -- 주민등록번호 (암호화)
  position VARCHAR(100),

  bank_name VARCHAR(100),
  bank_account VARCHAR(50),
  account_holder VARCHAR(100),

  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'
  )),

  avatar_url TEXT,
  fcm_token TEXT,  -- Firebase Cloud Messaging token

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_company ON users(company_id, status);
CREATE INDEX idx_users_store ON users(store_id, status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- Update teams.leader_id foreign key after users table exists
ALTER TABLE teams ADD CONSTRAINT fk_teams_leader
  FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- 6. 계약서 (Contracts)
-- ============================================
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(50) UNIQUE,

  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- 기본 정보
  contract_type VARCHAR(50) CHECK (contract_type IN ('정규직', '계약직', '아르바이트', '인턴')),
  start_date DATE NOT NULL,
  end_date DATE,
  probation_months INTEGER,

  -- 근무 조건 (JSONB)
  work_schedules JSONB NOT NULL DEFAULT '[]',
  position VARCHAR(100),
  department VARCHAR(100),
  duties TEXT[],

  -- 급여 설정 (JSONB)
  salary_config JSONB NOT NULL,
  deduction_config JSONB NOT NULL,

  -- 근무시간
  standard_hours_per_week INTEGER DEFAULT 40,
  standard_hours_per_day INTEGER DEFAULT 8,
  break_minutes INTEGER DEFAULT 60,

  -- 휴가
  annual_leave_days INTEGER DEFAULT 15,
  paid_leave_days INTEGER DEFAULT 0,
  sick_leave_days INTEGER DEFAULT 0,

  -- 복리후생
  benefits JSONB,

  -- 계약 조건
  terms JSONB,

  -- 해지 설정
  termination_config JSONB,

  -- 서명
  employee_signed_at TIMESTAMP WITH TIME ZONE,
  employee_signature TEXT,
  employer_signed_at TIMESTAMP WITH TIME ZONE,
  employer_signature TEXT,

  -- 첨부
  attachments JSONB,

  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'SIGNED', 'REJECTED')),

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contracts_staff ON contracts(staff_id);
CREATE INDEX idx_contracts_company ON contracts(company_id);
CREATE INDEX idx_contracts_store ON contracts(store_id);
CREATE INDEX idx_contracts_status ON contracts(status);

-- ============================================
-- 7. 출퇴근 기록 (Attendances)
-- ============================================
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  work_date DATE NOT NULL,

  -- 시간
  scheduled_check_in TIMESTAMP WITH TIME ZONE,
  scheduled_check_out TIMESTAMP WITH TIME ZONE,
  actual_check_in TIMESTAMP WITH TIME ZONE,
  actual_check_out TIMESTAMP WITH TIME ZONE,

  -- 상태
  status VARCHAR(20) CHECK (status IN ('NORMAL', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'VACATION')),

  -- 위치
  check_in_lat DECIMAL(10, 8),
  check_in_lng DECIMAL(11, 8),
  check_out_lat DECIMAL(10, 8),
  check_out_lng DECIMAL(11, 8),
  check_in_method VARCHAR(20) CHECK (check_in_method IN ('QR', 'GEOFENCE', 'BEACON', 'MANUAL')),

  -- 시간 계산
  work_hours DECIMAL(5, 2),
  break_hours DECIMAL(5, 2),
  overtime_hours DECIMAL(5, 2),
  night_hours DECIMAL(5, 2),
  holiday_hours DECIMAL(5, 2),

  -- 금액
  base_pay INTEGER,
  overtime_pay INTEGER,
  night_pay INTEGER,
  holiday_pay INTEGER,
  daily_total INTEGER,

  -- 이상 감지
  anomalies JSONB,

  -- 확장 필드
  extensions JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(staff_id, work_date)
);

CREATE INDEX idx_attendances_staff_date ON attendances(staff_id, work_date DESC);
CREATE INDEX idx_attendances_store_date ON attendances(store_id, work_date DESC);
CREATE INDEX idx_attendances_company_date ON attendances(company_id, work_date DESC);

-- ============================================
-- 8. 급여 (Salaries)
-- ============================================
CREATE TABLE salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- 기본급
  base_salary INTEGER DEFAULT 0,

  -- 수당
  overtime_pay INTEGER DEFAULT 0,
  night_pay INTEGER DEFAULT 0,
  holiday_pay INTEGER DEFAULT 0,
  weekly_holiday_pay INTEGER DEFAULT 0,

  -- 추가 수당
  meal_allowance INTEGER DEFAULT 0,
  transport_allowance INTEGER DEFAULT 0,
  position_allowance INTEGER DEFAULT 0,
  other_allowances JSONB,

  -- 총 지급액
  total_gross_pay INTEGER,

  -- 공제
  national_pension INTEGER DEFAULT 0,
  health_insurance INTEGER DEFAULT 0,
  long_term_care INTEGER DEFAULT 0,
  employment_insurance INTEGER DEFAULT 0,
  income_tax INTEGER DEFAULT 0,
  local_income_tax INTEGER DEFAULT 0,
  other_deductions JSONB,

  total_deductions INTEGER,

  -- 실수령액
  net_pay INTEGER,

  -- 근무 정보
  work_days INTEGER,
  total_hours DECIMAL(5, 2),

  -- 상태
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'PAID')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID REFERENCES users(id),
  paid_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(staff_id, year, month)
);

CREATE INDEX idx_salaries_staff ON salaries(staff_id, year DESC, month DESC);
CREATE INDEX idx_salaries_company ON salaries(company_id, year DESC, month DESC);

-- ============================================
-- 9. 스케줄 (Schedules)
-- ============================================
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  work_date DATE NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  break_minutes INTEGER DEFAULT 60,

  status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED')),

  -- 생성 방식
  generated_by VARCHAR(20) CHECK (generated_by IN ('AI', 'MANUAL', 'CONTRACT')),
  ai_confidence DECIMAL(3, 2),

  -- 교환
  trade_request JSONB,

  -- 확장
  extensions JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(staff_id, work_date)
);

CREATE INDEX idx_schedules_staff_date ON schedules(staff_id, work_date);
CREATE INDEX idx_schedules_store_date ON schedules(store_id, work_date);

-- ============================================
-- 10. 승인 요청 (Approval Requests)
-- ============================================
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'LEAVE', 'OVERTIME', 'SCHEDULE_CHANGE', 'PURCHASE',
    'DISPOSAL', 'RESIGNATION', 'ABSENCE_EXCUSE', 'EXPENSE',
    'DOCUMENT', 'OTHER'
  )),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_name VARCHAR(100),
  requester_role VARCHAR(50),

  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  -- 승인 라인
  approval_line JSONB NOT NULL,
  current_step INTEGER DEFAULT 1,

  final_status VARCHAR(20) DEFAULT 'PENDING' CHECK (final_status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),

  -- 상세 내용
  details JSONB NOT NULL,

  -- 첨부
  attachments JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  finalized_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX idx_approval_requests_company ON approval_requests(company_id, final_status);
CREATE INDEX idx_approval_requests_status ON approval_requests(final_status);
CREATE INDEX idx_approval_line ON approval_requests USING GIN(approval_line);

-- ============================================
-- 11. 긴급 근무 모집 (Emergency Shifts)
-- ============================================
CREATE TABLE emergency_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  positions JSONB NOT NULL,  -- [{role, count}]

  reason VARCHAR(50) CHECK (reason IN ('명절', '공휴일', '결근대체', '행사', '기타')),
  description TEXT,

  hourly_rate INTEGER NOT NULL,
  bonus INTEGER,
  benefits TEXT[],

  status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FILLED', 'CANCELLED')),
  deadline TIMESTAMP WITH TIME ZONE,

  applicants JSONB,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_emergency_shifts_store ON emergency_shifts(store_id, work_date);
CREATE INDEX idx_emergency_shifts_status ON emergency_shifts(status);

-- ============================================
-- 12. 알림 (Notifications)
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  category VARCHAR(50) NOT NULL CHECK (category IN (
    'ATTENDANCE', 'SALARY', 'SCHEDULE', 'APPROVAL',
    'EMERGENCY_SHIFT', 'CONTRACT', 'NOTICE', 'MESSAGE', 'SYSTEM'
  )),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('CRITICAL', 'HIGH', 'NORMAL', 'LOW')),

  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,

  actions JSONB,
  deep_link TEXT,
  data JSONB,

  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- ============================================
-- 13. 메시지 (Messages)
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name VARCHAR(100),
  sender_role VARCHAR(50),

  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name VARCHAR(100),
  recipient_role VARCHAR(50),

  subject VARCHAR(255),
  body TEXT NOT NULL,

  attachments JSONB,

  status VARCHAR(20) DEFAULT 'SENT' CHECK (status IN ('SENT', 'READ', 'REPLIED')),
  read_at TIMESTAMP WITH TIME ZONE,

  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  has_replies BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_inbox ON messages(recipient_id, created_at DESC);
CREATE INDEX idx_messages_sentbox ON messages(sender_id, created_at DESC);

-- ============================================
-- 14. 공지사항 (Notices)
-- ============================================
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  target_roles VARCHAR(50)[],  -- 대상 역할

  attachments JSONB,

  published_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notices_company ON notices(company_id, published_at DESC);

-- ============================================
-- 15. 세무 전송 이력 (Tax Transmissions)
-- ============================================
CREATE TABLE tax_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  method VARCHAR(20) CHECK (method IN ('EMAIL', 'FAX', 'API', 'MANUAL')),

  data JSONB NOT NULL,
  file_url TEXT,

  transmitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  transmitted_by UUID REFERENCES users(id),

  status VARCHAR(20) DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
  error TEXT
);

CREATE INDEX idx_tax_transmissions_company ON tax_transmissions(company_id, year DESC, month DESC);

-- ============================================
-- 16. 세무대리인 설정 (Tax Accountant Settings)
-- ============================================
CREATE TABLE tax_accountant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

  -- 세무대리인 정보
  accountant_name VARCHAR(100),
  business_number VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  fax_number VARCHAR(20),

  -- 전송 설정
  transmission_method VARCHAR(20) CHECK (transmission_method IN ('EMAIL', 'FAX', 'API', 'MANUAL')),
  transmission_frequency VARCHAR(20) DEFAULT 'MONTHLY',
  auto_send BOOLEAN DEFAULT false,
  send_day INTEGER CHECK (send_day >= 1 AND send_day <= 31),
  include_attachments BOOLEAN DEFAULT true,
  format VARCHAR(20) DEFAULT 'EXCEL',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 17. 구독 플랜 (Subscription Plans)
-- ============================================
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,  -- 'FREE', 'STARTER', 'PRO'
  display_name VARCHAR(100),
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,

  limits JSONB,     -- { maxEmployees, maxStores }
  features JSONB,   -- { qrCheckin, payroll, scheduling, ... }

  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, limits, features) VALUES
('FREE', '무료', 0, 0,
  '{"maxEmployees": 10, "maxStores": 1}',
  '{"qrCheckin": true, "basicPayroll": true, "mobileApp": true, "scheduling": false, "contracts": false, "reports": false}'
),
('STARTER', '스타터', 39000, 390000,
  '{"maxEmployees": 50, "maxStores": 3}',
  '{"qrCheckin": true, "basicPayroll": true, "mobileApp": true, "scheduling": true, "contracts": true, "reports": true, "payslips": true}'
),
('PRO', '프로', 99000, 990000,
  '{"maxEmployees": 200, "maxStores": -1}',
  '{"qrCheckin": true, "basicPayroll": true, "mobileApp": true, "scheduling": true, "contracts": true, "reports": true, "payslips": true, "emergencyShift": true, "posIntegration": true, "businessAnalytics": true}'
);

-- ============================================
-- 18. 회사 구독 (Company Subscriptions)
-- ============================================
CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')),
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('MONTHLY', 'YEARLY')),

  current_period_start DATE,
  current_period_end DATE,

  payment_method JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update companies table to reference subscription
ALTER TABLE companies ADD CONSTRAINT fk_companies_subscription
  FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id);

-- ============================================
-- 19. 결제 이력 (Payment History)
-- ============================================
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES company_subscriptions(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  status VARCHAR(20) CHECK (status IN ('SUCCESS', 'FAILED', 'REFUNDED', 'PENDING')),

  payment_method VARCHAR(50),
  transaction_id VARCHAR(100),

  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_history_company ON payment_history(company_id, created_at DESC);

-- ============================================
-- 20. 근로기준법 버전 (Labor Law Versions)
-- ============================================
CREATE TABLE labor_law_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL,           -- "2026.01"
  effective_date DATE NOT NULL,
  source TEXT,                            -- 출처 URL

  -- 핵심 데이터
  minimum_wage_hourly INTEGER NOT NULL,   -- 원

  -- 근로시간
  standard_daily_hours INTEGER DEFAULT 8,
  standard_weekly_hours INTEGER DEFAULT 40,
  max_weekly_hours INTEGER DEFAULT 52,

  -- 수당 비율 (배수)
  overtime_rate DECIMAL(3,2) DEFAULT 1.5,
  night_rate DECIMAL(3,2) DEFAULT 0.5,
  holiday_rate DECIMAL(3,2) DEFAULT 1.5,

  -- 4대보험 요율 (%)
  national_pension_rate DECIMAL(4,2) DEFAULT 4.5,
  health_insurance_rate DECIMAL(5,3) DEFAULT 3.545,
  long_term_care_rate DECIMAL(5,3) DEFAULT 12.81,
  employment_insurance_rate DECIMAL(4,2) DEFAULT 0.9,

  -- 상태
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'VERIFIED', 'ACTIVE', 'ARCHIVED')),
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,

  -- 변경 이력
  changelog TEXT,
  previous_version_id UUID REFERENCES labor_law_versions(id),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  activated_at TIMESTAMP WITH TIME ZONE
);

-- Insert current law version (2025)
INSERT INTO labor_law_versions (
  version, effective_date, minimum_wage_hourly, status, activated_at
) VALUES (
  '2025.01', '2025-01-01', 9860, 'ACTIVE', '2025-01-01'
);

-- ============================================
-- 21. 트리거: updated_at 자동 업데이트
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
      AND table_schema = 'public'
  LOOP
    EXECUTE format('
      CREATE TRIGGER trigger_update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at()
    ', t, t);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 22. Row Level Security (RLS) 정책
-- ============================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION get_current_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT company_id FROM users
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM users
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Companies: super_admin can see all, others see their own
CREATE POLICY companies_select ON companies FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR id = get_current_company_id()
);

CREATE POLICY companies_insert ON companies FOR INSERT WITH CHECK (
  get_current_user_role() = 'super_admin'
);

CREATE POLICY companies_update ON companies FOR UPDATE USING (
  get_current_user_role() = 'super_admin'
  OR (get_current_user_role() = 'company_admin' AND id = get_current_company_id())
);

-- Brands: company isolation
CREATE POLICY brands_select ON brands FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR company_id = get_current_company_id()
);

CREATE POLICY brands_insert ON brands FOR INSERT WITH CHECK (
  get_current_user_role() IN ('super_admin', 'company_admin')
  AND company_id = get_current_company_id()
);

CREATE POLICY brands_update ON brands FOR UPDATE USING (
  get_current_user_role() IN ('super_admin', 'company_admin')
  AND company_id = get_current_company_id()
);

-- Stores: company isolation
CREATE POLICY stores_select ON stores FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR company_id = get_current_company_id()
);

CREATE POLICY stores_insert ON stores FOR INSERT WITH CHECK (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager')
  AND company_id = get_current_company_id()
);

CREATE POLICY stores_update ON stores FOR UPDATE USING (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
  AND company_id = get_current_company_id()
);

-- Users: company isolation + self
CREATE POLICY users_select ON users FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR company_id = get_current_company_id()
  OR auth_id = auth.uid()
);

CREATE POLICY users_update ON users FOR UPDATE USING (
  get_current_user_role() IN ('super_admin', 'company_admin', 'manager', 'store_manager')
  OR auth_id = auth.uid()
);

-- Attendances: staff can see their own, managers can see store's
CREATE POLICY attendances_select ON attendances FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR (
    company_id = get_current_company_id()
    AND (
      staff_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      OR get_current_user_role() IN ('company_admin', 'manager', 'store_manager', 'team_leader')
    )
  )
);

-- Salaries: staff can see their own, admins can see all
CREATE POLICY salaries_select ON salaries FOR SELECT USING (
  get_current_user_role() = 'super_admin'
  OR (
    company_id = get_current_company_id()
    AND (
      staff_id = (SELECT id FROM users WHERE auth_id = auth.uid())
      OR get_current_user_role() IN ('company_admin', 'manager')
    )
  )
);

-- Notifications: users can only see their own
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Messages: sender or recipient can see
CREATE POLICY messages_select ON messages FOR SELECT USING (
  sender_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  OR recipient_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ============================================
-- 23. 뷰: 월간 출퇴근 통계
-- ============================================
CREATE OR REPLACE VIEW monthly_attendance_stats AS
SELECT
  staff_id,
  company_id,
  store_id,
  EXTRACT(YEAR FROM work_date) AS year,
  EXTRACT(MONTH FROM work_date) AS month,
  COUNT(*) AS total_days,
  COUNT(*) FILTER (WHERE status = 'NORMAL') AS normal_days,
  COUNT(*) FILTER (WHERE status = 'LATE') AS late_days,
  COUNT(*) FILTER (WHERE status = 'EARLY_LEAVE') AS early_leave_days,
  COUNT(*) FILTER (WHERE status = 'ABSENT') AS absent_days,
  COUNT(*) FILTER (WHERE status = 'VACATION') AS vacation_days,
  SUM(work_hours) AS total_work_hours,
  SUM(overtime_hours) AS total_overtime_hours,
  SUM(night_hours) AS total_night_hours,
  SUM(holiday_hours) AS total_holiday_hours,
  SUM(daily_total) AS total_pay
FROM attendances
WHERE actual_check_in IS NOT NULL
GROUP BY staff_id, company_id, store_id,
  EXTRACT(YEAR FROM work_date), EXTRACT(MONTH FROM work_date);

-- ============================================
-- 24. 함수: 급여 자동 계산
-- ============================================
CREATE OR REPLACE FUNCTION calculate_monthly_salary(
  p_staff_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS salaries AS $$
DECLARE
  v_salary salaries;
  v_attendances RECORD;
  v_contract contracts;
  v_law labor_law_versions;
BEGIN
  -- Get active contract
  SELECT * INTO v_contract
  FROM contracts
  WHERE staff_id = p_staff_id AND status = 'SIGNED'
  ORDER BY start_date DESC
  LIMIT 1;

  -- Get current labor law
  SELECT * INTO v_law
  FROM labor_law_versions
  WHERE status = 'ACTIVE'
  LIMIT 1;

  -- Aggregate attendance data
  SELECT
    SUM(work_hours) as total_hours,
    SUM(overtime_hours) as overtime_hours,
    SUM(night_hours) as night_hours,
    SUM(holiday_hours) as holiday_hours,
    SUM(base_pay) as base_pay,
    SUM(overtime_pay) as overtime_pay,
    SUM(night_pay) as night_pay,
    SUM(holiday_pay) as holiday_pay,
    COUNT(*) as work_days
  INTO v_attendances
  FROM attendances
  WHERE staff_id = p_staff_id
    AND EXTRACT(YEAR FROM work_date) = p_year
    AND EXTRACT(MONTH FROM work_date) = p_month
    AND status != 'ABSENT';

  -- Calculate and return salary record
  v_salary.staff_id := p_staff_id;
  v_salary.company_id := v_contract.company_id;
  v_salary.year := p_year;
  v_salary.month := p_month;
  v_salary.base_salary := COALESCE(v_attendances.base_pay, 0);
  v_salary.overtime_pay := COALESCE(v_attendances.overtime_pay, 0);
  v_salary.night_pay := COALESCE(v_attendances.night_pay, 0);
  v_salary.holiday_pay := COALESCE(v_attendances.holiday_pay, 0);
  v_salary.work_days := COALESCE(v_attendances.work_days, 0);
  v_salary.total_hours := COALESCE(v_attendances.total_hours, 0);

  -- Calculate gross pay
  v_salary.total_gross_pay := v_salary.base_salary + v_salary.overtime_pay +
    v_salary.night_pay + v_salary.holiday_pay;

  -- Calculate deductions (simplified)
  v_salary.national_pension := ROUND(v_salary.total_gross_pay * v_law.national_pension_rate / 100);
  v_salary.health_insurance := ROUND(v_salary.total_gross_pay * v_law.health_insurance_rate / 100);
  v_salary.long_term_care := ROUND(v_salary.health_insurance * v_law.long_term_care_rate / 100);
  v_salary.employment_insurance := ROUND(v_salary.total_gross_pay * v_law.employment_insurance_rate / 100);

  v_salary.total_deductions := v_salary.national_pension + v_salary.health_insurance +
    v_salary.long_term_care + v_salary.employment_insurance;

  v_salary.net_pay := v_salary.total_gross_pay - v_salary.total_deductions;
  v_salary.status := 'PENDING';

  RETURN v_salary;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 25. 함수: 계약서 번호 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.contract_number := 'CNT-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
    LPAD(nextval('contract_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;

CREATE TRIGGER trigger_contract_number
BEFORE INSERT ON contracts
FOR EACH ROW
WHEN (NEW.contract_number IS NULL)
EXECUTE FUNCTION generate_contract_number();

-- ============================================
-- 26. 함수: QR 코드 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION generate_store_qr_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := 'QR-' || NEW.id || '-' ||
      encode(gen_random_bytes(8), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_store_qr_code
BEFORE INSERT ON stores
FOR EACH ROW
EXECUTE FUNCTION generate_store_qr_code();
