-- Migration: 006_extended_approvals
-- Description: Extended approval types and workflow tables
-- Created: 2026-01-10

-- Approval types enum-like reference
CREATE TABLE IF NOT EXISTS approval_types (
  code VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  default_approval_line JSONB,
  required_fields JSONB,
  is_active BOOLEAN DEFAULT true
);

-- Insert approval types
INSERT INTO approval_types (code, name, description, required_fields) VALUES
('LEAVE', '휴가', '휴가 신청', '["leaveType", "startDate", "endDate", "reason"]'),
('OVERTIME', '초과근무', '초과근무 신청', '["date", "startTime", "endTime", "reason"]'),
('SCHEDULE_CHANGE', '근무조정', '스케줄 변경 요청', '["originalDate", "newDate", "reason"]'),
('PURCHASE', '구매', '구매 승인 요청', '["category", "itemName", "quantity", "unitPrice", "totalAmount", "vendor", "purpose"]'),
('DISPOSAL', '폐기', '폐기 승인 요청', '["category", "itemName", "quantity", "estimatedValue", "reason", "disposalMethod"]'),
('RESIGNATION', '사직', '사직서', '["resignationType", "resignationDate", "reason"]'),
('ABSENCE_EXCUSE', '결근사유', '결근 사유서', '["absenceDate", "absenceType", "reason"]'),
('EXPENSE', '경비', '경비 지출 승인', '["category", "amount", "description", "receiptUrls"]'),
('DOCUMENT', '문서', '문서 결재', '["documentType", "title", "content"]')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  required_fields = EXCLUDED.required_fields;

-- Approval line templates
CREATE TABLE IF NOT EXISTS approval_line_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  approval_type VARCHAR(50) NOT NULL REFERENCES approval_types(code),

  -- Conditions for this template
  conditions JSONB,

  -- Approval line configuration
  approval_line JSONB NOT NULL,

  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase details
CREATE TABLE IF NOT EXISTS approval_purchase_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,

  category VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit VARCHAR(50),
  unit_price DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,

  vendor VARCHAR(255),
  vendor_contact VARCHAR(100),

  purpose TEXT,
  urgency VARCHAR(20) DEFAULT 'NORMAL',

  delivery_date DATE,
  quotation_url TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(approval_request_id)
);

-- Disposal details
CREATE TABLE IF NOT EXISTS approval_disposal_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,

  category VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit VARCHAR(50),
  estimated_value DECIMAL(12,2),

  reason VARCHAR(50) NOT NULL,
  reason_detail TEXT,

  disposal_method VARCHAR(50) NOT NULL,
  disposal_date DATE,

  photo_urls TEXT[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(approval_request_id)
);

-- Resignation details
CREATE TABLE IF NOT EXISTS approval_resignation_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,

  resignation_type VARCHAR(50) NOT NULL,
  resignation_date DATE NOT NULL,
  notice_date DATE NOT NULL,
  notice_period INTEGER,

  reason TEXT,

  -- Return items checklist
  return_items JSONB,

  -- Final settlement
  remaining_salary DECIMAL(12,2),
  severance_pay DECIMAL(12,2),
  unused_vacation_pay DECIMAL(12,2),
  deductions DECIMAL(12,2),
  settlement_total DECIMAL(12,2),

  -- Exit interview
  exit_interview_done BOOLEAN DEFAULT false,
  exit_interview_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(approval_request_id)
);

-- Absence excuse details
CREATE TABLE IF NOT EXISTS approval_absence_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,

  absence_date DATE NOT NULL,
  absence_type VARCHAR(50) NOT NULL,

  reason TEXT NOT NULL,
  evidence_url TEXT,

  makeup_work BOOLEAN DEFAULT false,
  makeup_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(approval_request_id)
);

-- Expense details
CREATE TABLE IF NOT EXISTS approval_expense_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,

  category VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,

  expense_date DATE NOT NULL,
  description TEXT NOT NULL,

  receipt_urls TEXT[],

  payment_method VARCHAR(50),
  card_last4 VARCHAR(4),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(approval_request_id)
);

-- Update approval_requests table to add new fields
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'NORMAL';
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_approval_line_template_company ON approval_line_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_approval_line_template_type ON approval_line_templates(approval_type);
