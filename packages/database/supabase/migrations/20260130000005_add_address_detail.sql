-- Add address_detail column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_detail TEXT;

-- Add address_detail column to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_detail TEXT;

-- Add address_detail column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address_detail TEXT;

-- Comments
COMMENT ON COLUMN companies.address_detail IS 'Detailed address (building name, floor, room number, etc.)';
COMMENT ON COLUMN suppliers.address_detail IS 'Detailed address (building name, floor, room number, etc.)';
COMMENT ON COLUMN customers.address_detail IS 'Detailed address (building name, floor, room number, etc.)';
