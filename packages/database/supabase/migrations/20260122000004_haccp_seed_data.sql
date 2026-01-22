-- ============================================
-- HACCP Seed Data (ABCDC Company)
-- Based on docs/HACCP_개발가이드_V2_최종.md
-- ============================================

-- Note: This script assumes company_id will be provided
-- Run this after getting your company_id from the companies table

-- ============================================
-- 1. Suppliers (공급업체) - 2개
-- ============================================
INSERT INTO suppliers (company_id, code, name, contact, phone, status)
SELECT
  c.id as company_id,
  s.code,
  s.name,
  s.contact,
  s.phone,
  'ACTIVE'
FROM companies c
CROSS JOIN (VALUES
  ('SUP-001', '선인', '구매담당', '02-1234-5678'),
  ('SUP-002', '고문당', '구매담당', '02-2345-6789')
) AS s(code, name, contact, phone)
WHERE c.name = 'ABCDC'
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================
-- 2. Materials (원료) - 26개
-- ============================================
INSERT INTO materials (company_id, code, name, type, specification, storage_temp, unit, status)
SELECT
  c.id as company_id,
  m.code,
  m.name,
  m.type,
  m.specification,
  m.storage_temp,
  m.unit,
  'ACTIVE'
FROM companies c
CROSS JOIN (VALUES
  ('RM-001', 'DB휘핑 (매일 휘핑크림 1L)', '원료', '1L', '냉장 -2~5°C', 'L'),
  ('RM-002', '생크림 (서울우유 500ml)', '원료', '500ml', '냉장 -2~5°C', 'ml'),
  ('RM-003', '버터 (서울우유 무염버터 450g)', '원료', '450g', '냉장 -2~5°C', 'g'),
  ('RM-004', '전란 (풀무원 전란액 10kg)', '원료', '10kg', '냉장 -2~5°C', 'kg'),
  ('RM-005', '노른자 (풀무원 난황액 5kg)', '원료', '5kg', '냉장 -2~5°C', 'kg'),
  ('RM-006', '계란 (30구)', '원료', '30개입', '냉장 -2~5°C', '개'),
  ('RM-007', '다크초콜릿 (발로나 과나라 70%)', '원료', '3kg', '실온 15~25°C', 'kg'),
  ('RM-008', '설탕 (백설 1kg)', '원료', '1kg', '실온', 'kg'),
  ('RM-009', '글루코스 (대상 3kg)', '원료', '3kg', '실온', 'kg'),
  ('RM-010', 'SP (삼립 500g)', '원료', '500g', '실온', 'g'),
  ('RM-011', '박력분 (CJ 1kg)', '원료', '1kg', '실온', 'kg'),
  ('RM-012', '전분 (대상 1kg)', '원료', '1kg', '실온', 'kg'),
  ('RM-013', 'BP (삼립 500g)', '원료', '500g', '실온', 'g'),
  ('RM-014', '식용유 (CJ 1.8L)', '원료', '1.8L', '실온', 'L'),
  ('RM-015', '바닐라에센스 (매일 100ml)', '원료', '100ml', '실온', 'ml'),
  ('RM-016', '우유 (서울우유 1L)', '원료', '1L', '냉장 -2~5°C', 'L'),
  ('RM-017', '소금 (천일염 1kg)', '원료', '1kg', '실온', 'kg'),
  ('RM-018', '아몬드분말 (1kg)', '원료', '1kg', '실온', 'kg'),
  ('RM-019', '코코아파우더 (1kg)', '원료', '1kg', '실온', 'kg'),
  ('RM-020', '얼그레이티 (100g)', '원료', '100g', '실온', 'g'),
  ('RM-021', '럼 (700ml)', '원료', '700ml', '실온', 'ml'),
  ('RM-022', '바닐라빈 (10개입)', '원료', '10개입', '실온', '개'),
  ('RM-023', '블루베리 (냉동 1kg)', '원료', '1kg', '냉동', 'kg'),
  ('RM-024', '복숭아 (냉동 1kg)', '원료', '1kg', '냉동', 'kg'),
  ('RM-025', '요거트 (플레인 1kg)', '원료', '1kg', '냉장 -2~5°C', 'kg'),
  ('RM-026', '까눌레박스 (포장재)', '포장재', '1개', '실온', '개')
) AS m(code, name, type, specification, storage_temp, unit)
WHERE c.name = 'ABCDC'
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================
-- 3. Products (제품) - 12개
-- ============================================
INSERT INTO products (company_id, code, name, category, specification, shelf_life, storage_condition, status)
SELECT
  c.id as company_id,
  p.code,
  p.name,
  p.category,
  p.specification,
  p.shelf_life,
  p.storage_condition,
  'ACTIVE'
FROM companies c
CROSS JOIN (VALUES
  ('P001', '바닐라빈까눌레 1개입', '납품용', '1개입', 60, '냉동'),
  ('P002', '바닐라빈까눌레 6개입', '납품용', '6개입', 60, '냉동'),
  ('P003', '얼그레이까눌레 1개입', '납품용', '1개입', 60, '냉동'),
  ('P004', '얼그레이까눌레 6개입', '납품용', '6개입', 60, '냉동'),
  ('P005', '초코까눌레 1개입', '납품용', '1개입', 60, '냉동'),
  ('P006', '초코까눌레 6개입', '납품용', '6개입', 60, '냉동'),
  ('P007', '버터사브레 1개입', '납품용', '1개입', 90, '실온'),
  ('P008', '버터사브레 10개입', '납품용', '10개입', 90, '실온'),
  ('P009', '스콘 1개입', '납품용', '1개입', 30, '냉동'),
  ('P010', '스콘 6개입', '납품용', '6개입', 30, '냉동'),
  ('P011', '요거트복숭아케이크', '납품용', '1호', 180, '냉동'),
  ('P012', '요거트블루베리케이크', '납품용', '1호', 180, '냉동')
) AS p(code, name, category, specification, shelf_life, storage_condition)
WHERE c.name = 'ABCDC'
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================
-- 4. Semi Products (반제품) - 2개
-- ============================================
INSERT INTO semi_products (company_id, code, name, category, storage_temp, shelf_life, status)
SELECT
  c.id as company_id,
  s.code,
  s.name,
  s.category,
  s.storage_temp,
  s.shelf_life,
  'ACTIVE'
FROM companies c
CROSS JOIN (VALUES
  ('S-001', '제누와즈 화이트', '시트', '냉동', 60),
  ('S-002', '제누와즈 초코', '시트', '냉동', 60)
) AS s(code, name, category, storage_temp, shelf_life)
WHERE c.name = 'ABCDC'
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================
-- 5. CCP Definitions (CCP 정의) - 20개
-- ============================================
INSERT INTO ccp_definitions (company_id, ccp_number, process, hazard, control_measure, critical_limit, monitoring_method, monitoring_frequency, corrective_action, status)
SELECT
  c.id as company_id,
  d.ccp_number,
  d.process,
  d.hazard,
  d.control_measure,
  d.critical_limit::jsonb,
  d.monitoring_method,
  d.monitoring_frequency,
  d.corrective_action,
  'ACTIVE'
FROM companies c
CROSS JOIN (VALUES
  -- CCP-1B: 오븐 가열 - 과자 (3개)
  ('CCP-1B-COOKIE-TEMP', '오븐(굽기)-과자-가열온도', '미생물 잔존', '가열 살균', '{"parameter": "온도", "min": 180, "max": 210, "unit": "°C"}', '온도계 측정', '작업시작/2시간마다/변경시/종료', '재가열 또는 폐기'),
  ('CCP-1B-COOKIE-TIME', '오븐(굽기)-과자-가열시간', '미생물 잔존', '가열 살균', '{"parameter": "시간", "min": 50, "max": 60, "unit": "분"}', '타이머 확인', '작업시작/2시간마다/변경시/종료', '재가열 또는 폐기'),
  ('CCP-1B-COOKIE-CORE', '오븐(굽기)-과자-가열후품온', '미생물 잔존', '가열 살균', '{"parameter": "품온", "min": 80, "max": 210, "unit": "°C"}', '중심온도계 측정', '작업시작/2시간마다/변경시/종료', '재가열 또는 폐기'),

  -- CCP-1B: 오븐 가열 - 빵류 (3개)
  ('CCP-1B-BREAD-TEMP', '오븐(굽기)-빵류-가열온도', '미생물 잔존', '가열 살균', '{"parameter": "온도", "min": 145, "max": 225, "unit": "°C"}', '온도계 측정', '작업시작/2시간마다/변경시/종료', '재가열 또는 폐기'),
  ('CCP-1B-BREAD-TIME', '오븐(굽기)-빵류-가열시간', '미생물 잔존', '가열 살균', '{"parameter": "시간", "min": 30, "max": 60, "unit": "분"}', '타이머 확인', '작업시작/2시간마다/변경시/종료', '재가열 또는 폐기'),
  ('CCP-1B-BREAD-CORE', '오븐(굽기)-빵류-가열후품온', '미생물 잔존', '가열 살균', '{"parameter": "품온", "min": 90, "max": 200, "unit": "°C"}', '중심온도계 측정', '작업시작/2시간마다/변경시/종료', '재가열 또는 폐기'),

  -- CCP-2B: 크림 휘핑 (5개)
  ('CCP-2B-CREAM-MASS', '크림(휘핑)-배합량', '미생물 증식', '저온 유지', '{"parameter": "배합량", "min": 0, "max": 3.5, "unit": "kg"}', '저울 측정', '제조 직후', '폐기 또는 즉시 사용'),
  ('CCP-2B-CREAM-TEMP-START', '크림(휘핑)-품온(제조직후)', '미생물 증식', '저온 유지', '{"parameter": "온도", "min": -99, "max": 15, "unit": "°C"}', '온도계 측정', '제조 직후', '폐기 또는 즉시 냉장'),
  ('CCP-2B-CREAM-TEMP-END', '크림(휘핑)-품온(소진직전)', '미생물 증식', '저온 유지', '{"parameter": "온도", "min": -99, "max": 15, "unit": "°C"}', '온도계 측정', '소진 직전', '폐기'),
  ('CCP-2B-CREAM-USE-TIME', '크림(휘핑)-소진시간', '미생물 증식', '시간 관리', '{"parameter": "시간", "min": 34, "max": 40, "unit": "분"}', '타이머 확인', '사용 중', '폐기'),
  ('CCP-2B-ENV-ROOM-TEMP', '크림(휘핑)-작업장온도', '미생물 증식', '저온 유지', '{"parameter": "온도", "min": 0, "max": 23, "unit": "°C"}', '온도계 측정', '작업 중 상시', '냉방 가동'),

  -- CCP-3B: 시럽 가열 (3개)
  ('CCP-3B-SYRUP-TEMP', '시럽가열-가열온도', '미생물 잔존', '가열 살균', '{"parameter": "온도", "min": 85, "max": 95, "unit": "°C"}', '온도계 측정', '매작업시', '재가열'),
  ('CCP-3B-SYRUP-TIME', '시럽가열-가열시간', '미생물 잔존', '가열 살균', '{"parameter": "시간", "min": 5, "max": 62, "unit": "분"}', '타이머 확인', '매작업시', '재가열'),
  ('CCP-3B-SYRUP-CORE', '시럽가열-가열후품온', '미생물 잔존', '가열 살균', '{"parameter": "품온", "min": 80, "max": 999, "unit": "°C"}', '온도계 측정', '매작업시', '재가열'),

  -- CCP-4B: 세척 (3개)
  ('CCP-4B-RAWWT', '세척원료-원료량', '이물질/미생물', '세척', '{"parameter": "원료량", "min": 0, "max": 500, "unit": "g"}', '저울 측정', '매작업시', '재세척'),
  ('CCP-4B-WASH-VOL', '세척원료-세척수량', '이물질/미생물', '세척', '{"parameter": "수량", "min": 3, "max": 9999, "unit": "L"}', '계량', '매작업시', '재세척'),
  ('CCP-4B-WASH-TIME', '세척원료-세척시간', '이물질/미생물', '세척', '{"parameter": "시간", "min": 5, "max": 9999, "unit": "분"}', '타이머 확인', '매작업시', '재세척'),

  -- CCP-5P: 금속검출 (3개)
  ('CCP-5P-PIECE-FE20', '금속검출-테스트피스 Fe2.0mm', '금속 이물질', '금속검출기', '{"parameter": "통과", "min": 1, "max": 1, "unit": "Bool"}', '금속검출기', '작업시작/2시간마다/변경시/종료', '기기 점검 후 재검사'),
  ('CCP-5P-PIECE-SUS25', '금속검출-테스트피스 SUS2.5mm', '금속 이물질', '금속검출기', '{"parameter": "통과", "min": 1, "max": 1, "unit": "Bool"}', '금속검출기', '작업시작/2시간마다/변경시/종료', '기기 점검 후 재검사'),
  ('CCP-5P-PROD', '금속검출-제품 불검출', '금속 이물질', '금속검출기', '{"parameter": "불검출", "min": 1, "max": 1, "unit": "Bool"}', '금속검출기', '작업시작/2시간마다/변경시/종료', '해당 제품 격리 및 재검사')
) AS d(ccp_number, process, hazard, control_measure, critical_limit, monitoring_method, monitoring_frequency, corrective_action)
WHERE c.name = 'ABCDC'
ON CONFLICT (company_id, ccp_number) DO NOTHING;

-- ============================================
-- 6. Customers (납품처) 테이블 생성 및 데이터
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  business_number VARCHAR(20),
  representative VARCHAR(100),
  business_type VARCHAR(100),
  business_item VARCHAR(100),
  address TEXT,
  contact VARCHAR(50),
  business_cert_url TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_policy ON customers FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

INSERT INTO customers (company_id, code, name, business_number, representative, business_type, business_item, address, contact, status)
SELECT
  c.id as company_id,
  cust.code,
  cust.name,
  cust.business_number,
  cust.representative,
  cust.business_type,
  cust.business_item,
  cust.address,
  cust.contact,
  'ACTIVE'
FROM companies c
CROSS JOIN (VALUES
  ('C001', '제이더블유푸드', '345-67-89012', '김OO', '제조업', '식품', '서울시 강서구', '02-3456-7890'),
  ('C002', '맛남살롱 본점', '456-78-90123', '이OO', '음식점업', '카페', '서울시 마포구', '02-4567-8901'),
  ('C003', '맛남살롱 2호점', '567-89-01234', '이OO', '음식점업', '카페', '서울시 용산구', '02-5678-9012'),
  ('C004', '맛남살롱 3호점', '678-90-12345', '이OO', '음식점업', '카페', '서울시 성동구', '02-6789-0123')
) AS cust(code, name, business_number, representative, business_type, business_item, address, contact)
WHERE c.name = 'ABCDC'
ON CONFLICT (company_id, code) DO NOTHING;

-- ============================================
-- 8. Product Recipes (레시피/BOM) 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  semi_product_id UUID REFERENCES semi_products(id) ON DELETE CASCADE,

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

CREATE INDEX IF NOT EXISTS idx_recipes_company ON product_recipes(company_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON product_recipes(product_id);

ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_recipes_policy ON product_recipes FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 7. Recipe Sample Data (바닐라빈까눌레 레시피)
-- ============================================
INSERT INTO product_recipes (company_id, product_name, component_name, material_name, amount, unit, production_qty, amount_per_unit)
SELECT
  c.id as company_id,
  r.product_name,
  r.component_name,
  r.material_name,
  r.amount,
  r.unit,
  r.production_qty,
  r.amount_per_unit
FROM companies c
CROSS JOIN (VALUES
  -- 바닐라빈까눌레 반죽
  ('바닐라빈까눌레', '까눌레반죽', '우유', 1000, 'g', 24, 41.67),
  ('바닐라빈까눌레', '까눌레반죽', '생크림', 500, 'g', 24, 20.83),
  ('바닐라빈까눌레', '까눌레반죽', '버터', 100, 'g', 24, 4.17),
  ('바닐라빈까눌레', '까눌레반죽', '설탕', 500, 'g', 24, 20.83),
  ('바닐라빈까눌레', '까눌레반죽', '박력분', 250, 'g', 24, 10.42),
  ('바닐라빈까눌레', '까눌레반죽', '노른자', 100, 'g', 24, 4.17),
  ('바닐라빈까눌레', '까눌레반죽', '전란', 100, 'g', 24, 4.17),
  ('바닐라빈까눌레', '까눌레반죽', '럼', 50, 'g', 24, 2.08),
  ('바닐라빈까눌레', '까눌레반죽', '바닐라빈', 2, '개', 24, 0.08),

  -- 얼그레이까눌레 반죽
  ('얼그레이까눌레', '까눌레반죽', '우유', 1000, 'g', 24, 41.67),
  ('얼그레이까눌레', '까눌레반죽', '생크림', 500, 'g', 24, 20.83),
  ('얼그레이까눌레', '까눌레반죽', '버터', 100, 'g', 24, 4.17),
  ('얼그레이까눌레', '까눌레반죽', '설탕', 500, 'g', 24, 20.83),
  ('얼그레이까눌레', '까눌레반죽', '박력분', 250, 'g', 24, 10.42),
  ('얼그레이까눌레', '까눌레반죽', '노른자', 100, 'g', 24, 4.17),
  ('얼그레이까눌레', '까눌레반죽', '전란', 100, 'g', 24, 4.17),
  ('얼그레이까눌레', '까눌레반죽', '럼', 50, 'g', 24, 2.08),
  ('얼그레이까눌레', '까눌레반죽', '얼그레이티', 30, 'g', 24, 1.25),

  -- 초코까눌레 반죽
  ('초코까눌레', '까눌레반죽', '우유', 1000, 'g', 24, 41.67),
  ('초코까눌레', '까눌레반죽', '생크림', 500, 'g', 24, 20.83),
  ('초코까눌레', '까눌레반죽', '버터', 100, 'g', 24, 4.17),
  ('초코까눌레', '까눌레반죽', '설탕', 450, 'g', 24, 18.75),
  ('초코까눌레', '까눌레반죽', '박력분', 220, 'g', 24, 9.17),
  ('초코까눌레', '까눌레반죽', '코코아파우더', 50, 'g', 24, 2.08),
  ('초코까눌레', '까눌레반죽', '노른자', 100, 'g', 24, 4.17),
  ('초코까눌레', '까눌레반죽', '전란', 100, 'g', 24, 4.17),
  ('초코까눌레', '까눌레반죽', '럼', 50, 'g', 24, 2.08),
  ('초코까눌레', '까눌레반죽', '다크초콜릿', 100, 'g', 24, 4.17),

  -- 버터사브레
  ('버터사브레', 'Base', '발효버터', 744, 'g', 60, 12.4),
  ('버터사브레', 'Base', '설탕', 300, 'g', 60, 5.0),
  ('버터사브레', 'Base', '소금', 6, 'g', 60, 0.1),
  ('버터사브레', 'Base', '노른자', 120, 'g', 60, 2.0),
  ('버터사브레', 'Base', '박력분', 900, 'g', 60, 15.0),
  ('버터사브레', 'Base', '아몬드분말', 150, 'g', 60, 2.5),

  -- 제누와즈 화이트 (반제품)
  ('제누와즈 화이트', 'Base', '전란', 2392, 'g', 6, 398.67),
  ('제누와즈 화이트', 'Base', '설탕', 1434, 'g', 6, 239.0),
  ('제누와즈 화이트', 'Base', '박력분', 1195, 'g', 6, 199.17),
  ('제누와즈 화이트', 'Base', '전분', 239, 'g', 6, 39.83),
  ('제누와즈 화이트', 'Base', '버터', 204, 'g', 6, 34.0),
  ('제누와즈 화이트', 'Base', '우유', 204, 'g', 6, 34.0),
  ('제누와즈 화이트', 'Base', 'SP', 48, 'g', 6, 8.0),

  -- 제누와즈 초코 (반제품)
  ('제누와즈 초코', 'Base', '전란', 2392, 'g', 6, 398.67),
  ('제누와즈 초코', 'Base', '설탕', 1434, 'g', 6, 239.0),
  ('제누와즈 초코', 'Base', '박력분', 1075, 'g', 6, 179.17),
  ('제누와즈 초코', 'Base', '코코아파우더', 120, 'g', 6, 20.0),
  ('제누와즈 초코', 'Base', '전분', 239, 'g', 6, 39.83),
  ('제누와즈 초코', 'Base', '버터', 204, 'g', 6, 34.0),
  ('제누와즈 초코', 'Base', '우유', 204, 'g', 6, 34.0),
  ('제누와즈 초코', 'Base', 'SP', 48, 'g', 6, 8.0)
) AS r(product_name, component_name, material_name, amount, unit, production_qty, amount_per_unit)
WHERE c.name = 'ABCDC';

-- Done
SELECT 'HACCP seed data with recipes inserted successfully!' as result;
