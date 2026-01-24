-- Migration: 040_tosspayments_integration
-- Description: Add TossPayments billing fields
-- Created: 2026-01-24

-- Add TossPayments fields to payment_methods
ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS toss_billing_key VARCHAR(200),
ADD COLUMN IF NOT EXISTS toss_customer_key VARCHAR(200);

-- Add TossPayments fields to company_subscriptions
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS toss_customer_key VARCHAR(200);

-- Add TossPayments fields to payment_history
ALTER TABLE payment_history
ADD COLUMN IF NOT EXISTS toss_payment_key VARCHAR(200),
ADD COLUMN IF NOT EXISTS toss_order_id VARCHAR(200);

-- Create index for billing key lookups
CREATE INDEX IF NOT EXISTS idx_payment_methods_billing_key ON payment_methods(toss_billing_key);
CREATE INDEX IF NOT EXISTS idx_payment_history_payment_key ON payment_history(toss_payment_key);

-- Comment on columns
COMMENT ON COLUMN payment_methods.toss_billing_key IS '토스페이먼츠 빌링키 (정기결제용)';
COMMENT ON COLUMN payment_methods.toss_customer_key IS '토스페이먼츠 고객 식별키';
COMMENT ON COLUMN company_subscriptions.toss_customer_key IS '토스페이먼츠 고객 식별키';
COMMENT ON COLUMN payment_history.toss_payment_key IS '토스페이먼츠 결제키';
COMMENT ON COLUMN payment_history.toss_order_id IS '토스페이먼츠 주문ID';
