-- Product Recipes (레시피/BOM) 테이블 생성
-- 기존 테이블이 없는 경우에만 생성

CREATE TABLE IF NOT EXISTS product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID, -- FK는 products 테이블이 있을 경우만 적용
  semi_product_id UUID, -- FK는 semi_products 테이블이 있을 경우만 적용

  product_name VARCHAR(255) NOT NULL,
  component_name VARCHAR(100),  -- 구성명 (예: 까눌레반죽, Base)

  material_code VARCHAR(50),
  material_name VARCHAR(255) NOT NULL,

  batch_size DECIMAL(10,2) DEFAULT 1,  -- 배치 기준
  amount DECIMAL(10,3) NOT NULL,        -- 배합량
  unit VARCHAR(20) DEFAULT 'g',         -- 단위

  production_qty DECIMAL(10,2),         -- 생산수량
  amount_per_unit DECIMAL(10,3),        -- 1개당 소요량

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recipes_company ON product_recipes(company_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_semi_product ON product_recipes(semi_product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product_name ON product_recipes(product_name);

-- Enable RLS
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DO $$
BEGIN
    DROP POLICY IF EXISTS "product_recipes_policy" ON product_recipes;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "product_recipes_policy" ON product_recipes FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- Add foreign keys conditionally (if tables exist)
DO $$
BEGIN
    -- Add products FK if products table exists and FK doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        BEGIN
            ALTER TABLE product_recipes
                ADD CONSTRAINT fk_product_recipes_product
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Comment
COMMENT ON TABLE product_recipes IS '제품 레시피(BOM) 테이블';
