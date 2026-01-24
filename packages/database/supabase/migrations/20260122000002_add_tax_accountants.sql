-- Migration: Add tax accountants tables
-- Description: Tax accountant integration for payroll transmission

-- Tax accountants table
CREATE TABLE IF NOT EXISTS tax_accountants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(100) NOT NULL,
  business_number VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  fax_number VARCHAR(20),
  address TEXT,

  -- Transmission settings
  transmission_method VARCHAR(20) DEFAULT 'EMAIL',
  frequency VARCHAR(20) DEFAULT 'MONTHLY',
  auto_send BOOLEAN DEFAULT false,
  send_day INTEGER DEFAULT 5,
  include_attachments BOOLEAN DEFAULT true,
  format VARCHAR(20) DEFAULT 'EXCEL',

  -- API integration (for future)
  api_endpoint TEXT,
  api_key_encrypted TEXT,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax transmissions history table
CREATE TABLE IF NOT EXISTS tax_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_accountant_id UUID REFERENCES tax_accountants(id),

  -- Period
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,

  -- Transmission details
  method VARCHAR(20) NOT NULL,
  format VARCHAR(20),

  -- Data summary
  total_employees INTEGER,
  total_gross_pay DECIMAL(15,2),
  total_deductions DECIMAL(15,2),
  total_net_pay DECIMAL(15,2),

  -- File
  file_url TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,

  -- Status
  status VARCHAR(20) DEFAULT 'PENDING',
  error_message TEXT,

  -- Timestamps
  transmitted_at TIMESTAMPTZ,
  transmitted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, year, month, method)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tax_accountant_company ON tax_accountants(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_transmission_company ON tax_transmissions(company_id);
CREATE INDEX IF NOT EXISTS idx_tax_transmission_period ON tax_transmissions(year, month);

-- RLS Policies for tax_accountants
ALTER TABLE tax_accountants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company tax accountants"
  ON tax_accountants FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Company admins can manage tax accountants"
  ON tax_accountants FOR ALL
  USING (company_id IN (
    SELECT company_id FROM users
    WHERE auth_id = auth.uid()
    AND role IN ('super_admin', 'company_admin')
  ));

-- RLS Policies for tax_transmissions
ALTER TABLE tax_transmissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company tax transmissions"
  ON tax_transmissions FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_id = auth.uid()
  ));

CREATE POLICY "Company admins can manage tax transmissions"
  ON tax_transmissions FOR ALL
  USING (company_id IN (
    SELECT company_id FROM users
    WHERE auth_id = auth.uid()
    AND role IN ('super_admin', 'company_admin')
  ));
