-- Migration: 003_business_management
-- Description: PRO plan business management tables (Toss POS, Open Banking, P&L)
-- Created: 2026-01-10

-- Revenue sources (Toss POS, Open Banking, Manual)
CREATE TABLE IF NOT EXISTS revenue_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  source_type VARCHAR(20) NOT NULL,
  source_name VARCHAR(100),

  is_active BOOLEAN DEFAULT true,

  -- OAuth connection data (encrypted)
  connection_data JSONB,

  -- Sync status
  last_synced_at TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'PENDING',
  sync_error TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily sales data
CREATE TABLE IF NOT EXISTS daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  revenue_source_id UUID REFERENCES revenue_sources(id),

  sales_date DATE NOT NULL,

  -- Amounts
  total_amount DECIMAL(12,2) DEFAULT 0,
  card_amount DECIMAL(12,2) DEFAULT 0,
  cash_amount DECIMAL(12,2) DEFAULT 0,
  transfer_amount DECIMAL(12,2) DEFAULT 0,

  -- Counts
  transaction_count INTEGER DEFAULT 0,

  -- Details (hourly breakdown, item breakdown)
  hourly_breakdown JSONB,
  item_breakdown JSONB,

  -- Source reference
  source_data JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, store_id, revenue_source_id, sales_date)
);

-- Expense transactions (from Open Banking or manual)
CREATE TABLE IF NOT EXISTS expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),

  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_time TIME,

  merchant_name VARCHAR(255),
  merchant_category VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL,

  -- AI classification
  category VARCHAR(50),
  ai_category VARCHAR(50),
  ai_confidence DECIMAL(3,2),

  -- User confirmation
  user_category VARCHAR(50),
  user_confirmed BOOLEAN DEFAULT false,

  note TEXT,

  -- Source
  source VARCHAR(50),
  source_transaction_id VARCHAR(100),
  source_data JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fixed costs (rent, utilities, etc.)
CREATE TABLE IF NOT EXISTS fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),

  cost_name VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,

  frequency VARCHAR(20) DEFAULT 'MONTHLY',
  payment_day INTEGER,

  category VARCHAR(50),

  -- Auto-detect from transactions
  auto_detect BOOLEAN DEFAULT false,
  merchant_pattern VARCHAR(255),

  is_active BOOLEAN DEFAULT true,

  start_date DATE,
  end_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profit & Loss statements
CREATE TABLE IF NOT EXISTS profit_loss_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),

  -- Period
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue
  total_revenue DECIMAL(15,2) DEFAULT 0,
  revenue_by_source JSONB,

  -- Expenses
  total_expense DECIMAL(15,2) DEFAULT 0,
  expense_by_category JSONB,

  -- Payroll (auto from salaries)
  payroll_expense DECIMAL(15,2) DEFAULT 0,

  -- Net profit
  net_profit DECIMAL(15,2) DEFAULT 0,
  profit_margin DECIMAL(5,2),

  -- Comparison with previous period
  revenue_change DECIMAL(5,2),
  expense_change DECIMAL(5,2),
  profit_change DECIMAL(5,2),

  -- AI recommendations
  ai_recommendations JSONB,

  -- Details
  details JSONB,

  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  generated_by UUID,

  UNIQUE(company_id, store_id, period_type, period_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_revenue_source_company ON revenue_sources(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_sales_date ON daily_sales(company_id, sales_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_sales_store ON daily_sales(store_id, sales_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_date ON expense_transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_expense_category ON expense_transactions(company_id, category);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_company ON fixed_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_pnl_period ON profit_loss_statements(company_id, period_start DESC);
