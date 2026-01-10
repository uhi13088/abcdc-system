-- ============================================
-- 1. Update role check constraint (platform_admin -> super_admin)
-- ============================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'super_admin', 'company_admin', 'manager',
  'store_manager', 'team_leader', 'staff'
));

-- ============================================
-- 2. Create test company (valid UUID format)
-- ============================================
INSERT INTO companies (id, name, business_number, ceo_name, status)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '테스트 회사',
  '123-45-67890',
  '홍길동',
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. Create test brand
-- ============================================
INSERT INTO brands (id, company_id, name, description)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  '테스트 브랜드',
  '테스트용 브랜드입니다'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Create test store
-- ============================================
INSERT INTO stores (id, company_id, brand_id, name, address)
VALUES (
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  '테스트 매장',
  '서울시 강남구 테헤란로 123'
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. Create super admin user
-- ============================================
INSERT INTO users (id, email, name, role, company_id, status)
VALUES (
  'a0000000-0000-0000-0000-000000000003',
  'admin@test.com',
  '슈퍼 관리자',
  'super_admin',
  NULL,
  'ACTIVE'
) ON CONFLICT (email) DO UPDATE SET
  role = 'super_admin',
  status = 'ACTIVE';

-- ============================================
-- 6. Create company admin user
-- ============================================
INSERT INTO users (id, email, name, role, company_id, brand_id, store_id, status)
VALUES (
  'a0000000-0000-0000-0000-000000000004',
  'company@test.com',
  '회사 관리자',
  'company_admin',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'ACTIVE'
) ON CONFLICT (email) DO UPDATE SET
  role = 'company_admin',
  status = 'ACTIVE';

-- ============================================
-- 7. Create test staff user
-- ============================================
INSERT INTO users (id, email, name, role, company_id, brand_id, store_id, status)
VALUES (
  'a0000000-0000-0000-0000-000000000005',
  'staff@test.com',
  '테스트 직원',
  'staff',
  'a0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'ACTIVE'
) ON CONFLICT (email) DO UPDATE SET
  role = 'staff',
  status = 'ACTIVE';

-- Done!
SELECT 'Migration and seed data completed successfully!' as result;
