-- Migration Fix: 004_subscriptions_fix
-- Description: Fix subscription_plans table by adding missing columns
-- Run this if 004_subscriptions.sql fails due to existing table

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add max_employees column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscription_plans' AND column_name = 'max_employees') THEN
    ALTER TABLE subscription_plans ADD COLUMN max_employees INTEGER;
  END IF;

  -- Add max_stores column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscription_plans' AND column_name = 'max_stores') THEN
    ALTER TABLE subscription_plans ADD COLUMN max_stores INTEGER;
  END IF;

  -- Add max_brands column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscription_plans' AND column_name = 'max_brands') THEN
    ALTER TABLE subscription_plans ADD COLUMN max_brands INTEGER;
  END IF;

  -- Add display_order column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscription_plans' AND column_name = 'display_order') THEN
    ALTER TABLE subscription_plans ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;

  -- Add display_name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscription_plans' AND column_name = 'display_name') THEN
    ALTER TABLE subscription_plans ADD COLUMN display_name VARCHAR(100);
  END IF;

  -- Add features column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'subscription_plans' AND column_name = 'features') THEN
    ALTER TABLE subscription_plans ADD COLUMN features JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Insert or update default plans
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
  max_brands = EXCLUDED.max_brands,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order;
