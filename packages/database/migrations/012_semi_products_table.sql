-- Semi-products Table
-- For HACCP Module: Intermediate product management

CREATE TABLE IF NOT EXISTS semi_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    store_id UUID REFERENCES stores(id),
    lot_number VARCHAR(50) UNIQUE NOT NULL,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    production_date DATE NOT NULL,

    -- Input materials (JSONB array)
    input_materials JSONB DEFAULT '[]'::jsonb,

    -- Production info
    process_name VARCHAR(255),
    planned_qty DECIMAL(10,2) DEFAULT 0,
    actual_qty DECIMAL(10,2) DEFAULT 0,
    production_unit VARCHAR(20) DEFAULT 'kg',
    yield_percentage DECIMAL(5,2),
    start_time TIME,
    end_time TIME,
    workers TEXT[] DEFAULT '{}',

    -- Quality inspection
    appearance VARCHAR(20) DEFAULT 'NORMAL' CHECK (appearance IN ('NORMAL', 'ABNORMAL')),
    texture VARCHAR(20) DEFAULT 'NORMAL' CHECK (texture IN ('NORMAL', 'ABNORMAL')),
    color_check VARCHAR(20) DEFAULT 'NORMAL' CHECK (color_check IN ('NORMAL', 'ABNORMAL')),
    sample_test BOOLEAN DEFAULT false,
    test_result VARCHAR(20) CHECK (test_result IN ('PASS', 'FAIL')),
    inspected_by VARCHAR(255),

    -- Storage info
    storage_location VARCHAR(255),
    storage_temperature DECIMAL(5,2),
    storage_condition VARCHAR(255),
    stored_at TIMESTAMP WITH TIME ZONE,

    -- Usage tracking
    used_qty DECIMAL(10,2) DEFAULT 0,
    remaining_qty DECIMAL(10,2) DEFAULT 0,
    used_for TEXT[] DEFAULT '{}',

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_semi_products_company ON semi_products(company_id);
CREATE INDEX IF NOT EXISTS idx_semi_products_store ON semi_products(store_id);
CREATE INDEX IF NOT EXISTS idx_semi_products_lot ON semi_products(lot_number);
CREATE INDEX IF NOT EXISTS idx_semi_products_date ON semi_products(production_date);
CREATE INDEX IF NOT EXISTS idx_semi_products_code ON semi_products(product_code);

-- Enable RLS
ALTER TABLE semi_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Semi-products visible to company members" ON semi_products
    FOR SELECT USING (
        company_id IS NULL OR
        company_id IN (
            SELECT company_id FROM users WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Semi-products manageable by authorized users" ON semi_products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_id = auth.uid()
            AND role IN ('super_admin', 'company_admin', 'manager', 'store_manager')
        )
    );
