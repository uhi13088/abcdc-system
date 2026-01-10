-- Migration: 004_subscriptions
-- Description: Subscription and payment tables
-- Created: 2026-01-10

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  description TEXT,

  -- Pricing
  price_monthly INTEGER DEFAULT 0,
  price_yearly INTEGER DEFAULT 0,

  -- Limits
  max_employees INTEGER,
  max_stores INTEGER,
  max_brands INTEGER,

  -- Features (JSON for flexibility)
  features JSONB NOT NULL DEFAULT '{}',

  -- Stripe
  stripe_price_id_monthly VARCHAR(100),
  stripe_price_id_yearly VARCHAR(100),

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,

  -- Order for display
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company subscriptions
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE',

  -- Billing
  billing_cycle VARCHAR(20) DEFAULT 'MONTHLY',

  -- Period
  current_period_start DATE,
  current_period_end DATE,

  -- Trial
  trial_start DATE,
  trial_end DATE,

  -- Stripe
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id)
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Type
  type VARCHAR(20) NOT NULL,

  -- Card details (masked)
  card_brand VARCHAR(20),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,

  -- Stripe
  stripe_payment_method_id VARCHAR(100),

  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment history
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES company_subscriptions(id),

  -- Amount
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',

  -- Status
  status VARCHAR(20) NOT NULL,

  -- Type
  payment_type VARCHAR(20),

  -- Stripe
  stripe_payment_intent_id VARCHAR(100),
  stripe_invoice_id VARCHAR(100),

  -- Invoice
  invoice_url TEXT,
  receipt_url TEXT,

  -- Error
  error_code VARCHAR(50),
  error_message TEXT,

  -- Timestamps
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,

  -- Discount
  discount_type VARCHAR(20) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,

  -- Restrictions
  applicable_plans UUID[],
  min_billing_cycle VARCHAR(20),

  -- Limits
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  max_uses_per_company INTEGER DEFAULT 1,

  -- Validity
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Promo code usage
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  subscription_id UUID REFERENCES company_subscriptions(id),

  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(promo_code_id, company_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscription_company ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_status ON company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_company ON payment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_date ON payment_history(created_at DESC);

-- Insert default plans
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, max_employees, max_stores, max_brands, features, display_order) VALUES
('FREE', '무료', 0, 0, 10, 1, 1,
 '{"qrCheckin": true, "basicPayroll": true, "mobileApp": true, "pushNotifications": true}',
 1),
('STARTER', '스타터', 39000, 390000, 50, 3, 3,
 '{"qrCheckin": true, "basicPayroll": true, "mobileApp": true, "pushNotifications": true, "scheduling": true, "leaveManagement": true, "contracts": true, "eSignature": true, "payslipPdf": true, "emailPayslip": true, "insurance4": true, "basicReports": true, "excelExport": true}',
 2),
('PRO', '프로', 99000, 990000, 200, -1, -1,
 '{"all": true, "qrCheckin": true, "basicPayroll": true, "mobileApp": true, "pushNotifications": true, "scheduling": true, "leaveManagement": true, "contracts": true, "eSignature": true, "payslipPdf": true, "emailPayslip": true, "insurance4": true, "basicReports": true, "excelExport": true, "emergencyShift": true, "aiRecommendation": true, "employeeEvaluation": true, "trainingHistory": true, "tossPOS": true, "openBanking": true, "aiExpenseClassification": true, "autoProfitLoss": true, "costAnalysis": true, "aiRecommendations": true, "advancedReports": true, "customBranding": true, "allDataExport": true}',
 3),
('ENTERPRISE', '엔터프라이즈', 0, 0, -1, -1, -1,
 '{"all": true, "api": true, "onPremise": true, "sla": true, "customDev": true, "dedicatedSupport": true}',
 4)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_employees = EXCLUDED.max_employees,
  max_stores = EXCLUDED.max_stores,
  features = EXCLUDED.features;
