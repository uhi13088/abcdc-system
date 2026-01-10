-- ============================================
-- Business Management (경영관리) Database Tables
-- ============================================

-- ============================================
-- 1. Revenue Sources (수입 소스 연동)
-- ============================================
CREATE TABLE IF NOT EXISTS revenue_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  source_type VARCHAR(50) NOT NULL, -- 'TOSS_POS', 'MANUAL', 'BAEMIN', 'COUPANG_EATS', 'YOGIYO'
  source_name VARCHAR(255) NOT NULL, -- 사용자 지정 이름

  -- API 연동 정보 (암호화 저장)
  api_credentials JSONB, -- {client_id, client_secret, access_token, refresh_token}

  is_active BOOLEAN DEFAULT TRUE,
  sync_frequency VARCHAR(20) DEFAULT 'HOURLY', -- 'HOURLY', 'DAILY', 'MANUAL'
  last_sync_at TIMESTAMP,
  last_sync_status VARCHAR(20), -- 'SUCCESS', 'FAILED', 'PENDING'

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. Daily Sales (일일 매출 기록)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  sale_date DATE NOT NULL,
  source_id UUID REFERENCES revenue_sources(id) ON DELETE SET NULL,
  source_type VARCHAR(50), -- 매출 출처

  -- 결제 방식별 금액
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  card_amount DECIMAL(12,2) DEFAULT 0,
  cash_amount DECIMAL(12,2) DEFAULT 0,
  transfer_amount DECIMAL(12,2) DEFAULT 0,

  transaction_count INTEGER DEFAULT 0,

  -- 상세 내역 (시간대별, 품목별)
  hourly_breakdown JSONB, -- [{hour: 10, amount: 50000, count: 5}, ...]
  item_breakdown JSONB, -- [{item: "아메리카노", amount: 10000, count: 20}, ...]

  is_auto_synced BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, store_id, sale_date, source_type)
);

-- ============================================
-- 3. Expense Transactions (지출 내역)
-- ============================================
CREATE TABLE IF NOT EXISTS expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  transaction_date DATE NOT NULL,
  transaction_time TIME,

  -- 거래 정보
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  merchant_name VARCHAR(255),
  bank_name VARCHAR(100),
  account_number VARCHAR(50), -- 마스킹된 계좌번호

  -- 카테고리 분류
  category VARCHAR(50), -- '재료비', '관리비', '월세', '인건비', '기타'
  sub_category VARCHAR(100),

  -- AI 자동 분류 정보
  ai_classified BOOLEAN DEFAULT FALSE,
  ai_confidence DECIMAL(3,2), -- 0.00 ~ 1.00
  ai_suggested_category VARCHAR(50),
  user_confirmed BOOLEAN DEFAULT FALSE,

  -- 연동 정보
  external_transaction_id VARCHAR(100), -- 오픈뱅킹 트랜잭션 ID
  is_auto_synced BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP,

  created_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. Fixed Costs (고정비용)
-- ============================================
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  cost_name VARCHAR(255) NOT NULL, -- 비용 이름
  category VARCHAR(50) NOT NULL, -- '월세', '관리비', '보험', '통신비', '기타'

  amount DECIMAL(12,2) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  payment_day INTEGER CHECK (payment_day >= 1 AND payment_day <= 31), -- 납부일

  start_date DATE,
  end_date DATE,

  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  created_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. Profit & Loss Statements (손익계산서)
-- ============================================
CREATE TABLE IF NOT EXISTS profit_loss_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('MONTHLY', 'QUARTERLY', 'YEARLY')),
  period_year INTEGER NOT NULL,
  period_month INTEGER, -- 월간일 경우
  period_quarter INTEGER CHECK (period_quarter >= 1 AND period_quarter <= 4), -- 분기일 경우

  -- 수익
  total_revenue DECIMAL(14,2) DEFAULT 0,
  revenue_breakdown JSONB, -- {TOSS_POS: 5000000, MANUAL: 100000, ...}

  -- 비용
  total_expense DECIMAL(14,2) DEFAULT 0,
  expense_breakdown JSONB, -- {재료비: 1500000, 관리비: 300000, ...}

  -- 인건비 (급여 시스템 연동)
  payroll_expense DECIMAL(14,2) DEFAULT 0,

  -- 손익
  net_profit DECIMAL(14,2) DEFAULT 0, -- total_revenue - total_expense - payroll_expense
  profit_margin DECIMAL(5,2), -- (net_profit / total_revenue) * 100

  -- 전기 대비 변동
  revenue_change DECIMAL(5,2), -- 전기 대비 수익 변화율 %
  expense_change DECIMAL(5,2), -- 전기 대비 비용 변화율 %
  profit_change DECIMAL(5,2), -- 전기 대비 이익 변화율 %

  -- 자동 생성 정보
  is_auto_generated BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMP,

  -- 확정 정보
  is_finalized BOOLEAN DEFAULT FALSE,
  finalized_by UUID REFERENCES users(id),
  finalized_at TIMESTAMP,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, period_type, period_year, period_month, period_quarter)
);

-- ============================================
-- 6. Bank Accounts (연동 계좌)
-- ============================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  bank_code VARCHAR(10) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(50) NOT NULL, -- 암호화 저장
  account_holder VARCHAR(100),
  account_type VARCHAR(50), -- 'CHECKING', 'SAVINGS', 'BUSINESS'

  -- 오픈뱅킹 연동 정보
  fintech_use_num VARCHAR(100), -- 핀테크이용번호
  access_token TEXT, -- 암호화 저장
  token_expires_at TIMESTAMP,

  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. Budget Plans (예산 계획)
-- ============================================
CREATE TABLE IF NOT EXISTS budget_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  budget_year INTEGER NOT NULL,
  budget_month INTEGER,

  -- 예산 항목
  category VARCHAR(50) NOT NULL,
  planned_amount DECIMAL(12,2) NOT NULL,
  actual_amount DECIMAL(12,2) DEFAULT 0,
  variance DECIMAL(12,2) DEFAULT 0, -- planned - actual

  notes TEXT,

  created_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, budget_year, budget_month, category)
);

-- ============================================
-- 8. Cost Alerts (비용 알림)
-- ============================================
CREATE TABLE IF NOT EXISTS cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  alert_type VARCHAR(50) NOT NULL, -- 'BUDGET_EXCEEDED', 'UNUSUAL_EXPENSE', 'LABOR_COST_HIGH', 'MATERIAL_COST_HIGH'
  category VARCHAR(50),

  threshold_type VARCHAR(20), -- 'PERCENTAGE', 'AMOUNT'
  threshold_value DECIMAL(12,2),
  current_value DECIMAL(12,2),

  message TEXT NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  is_read BOOLEAN DEFAULT FALSE,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 9. AI Insights (AI 인사이트)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  insight_type VARCHAR(50) NOT NULL, -- 'COST_OPTIMIZATION', 'LABOR_EFFICIENCY', 'REVENUE_TREND', 'BENCHMARK'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,

  -- 추천 내용
  recommendation TEXT,
  estimated_savings DECIMAL(12,2),
  confidence_score DECIMAL(3,2),

  -- 데이터 기반
  data_period_start DATE,
  data_period_end DATE,
  analysis_data JSONB,

  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_by UUID REFERENCES users(id),
  dismissed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_daily_sales_company_date ON daily_sales(company_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_company_date ON expense_transactions(company_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_category ON expense_transactions(company_id, category);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_company ON fixed_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_pnl_company_period ON profit_loss_statements(company_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_budget_plans_company_period ON budget_plans(company_id, budget_year, budget_month);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_company ON cost_alerts(company_id, is_read);
CREATE INDEX IF NOT EXISTS idx_ai_insights_company ON ai_insights(company_id, is_dismissed);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE revenue_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profit_loss_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY revenue_sources_policy ON revenue_sources FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY daily_sales_policy ON daily_sales FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY expense_transactions_policy ON expense_transactions FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY fixed_costs_policy ON fixed_costs FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY profit_loss_statements_policy ON profit_loss_statements FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY bank_accounts_policy ON bank_accounts FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY budget_plans_policy ON budget_plans FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY cost_alerts_policy ON cost_alerts FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY ai_insights_policy ON ai_insights FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Done
SELECT 'Business Management tables created successfully!' as result;
