-- ================================================
-- 사용자 시드 스크립트
-- ================================================
--
-- 주의: 이 스크립트는 Supabase Auth API를 통해 사용자를 생성해야 합니다.
-- SQL만으로는 auth.users 테이블에 직접 삽입할 수 없습니다.
--
-- 방법 1: API 호출
--   POST /api/auth/seed
--
-- 방법 2: Supabase Dashboard에서 수동 생성
--   1. Authentication > Users > Add user
--   2. 아래 정보로 사용자 생성
--
-- ================================================
-- 생성할 사용자 정보:
-- ================================================
--
-- 1. 슈퍼 관리자
--    - 이메일: uhi1308@naver.com
--    - 비밀번호: Ghrnfldks12!!@
--    - 역할: super_admin
--
-- 2. 테스트 직원
--    - 이메일: aaa@naver.com
--    - 비밀번호: 111111
--    - 역할: staff
--
-- ================================================

-- users 테이블에 프로필 삽입 (auth.users에 이미 존재하는 경우)
-- auth_id는 Supabase Auth에서 생성된 UUID로 대체해야 합니다.

-- 예시 (실제 auth_id로 대체 필요):
/*
INSERT INTO users (auth_id, email, name, role, status, created_at, updated_at)
VALUES
  ('AUTH_ID_FOR_SUPER_ADMIN', 'uhi1308@naver.com', '슈퍼 관리자', 'super_admin', 'ACTIVE', NOW(), NOW()),
  ('AUTH_ID_FOR_STAFF', 'aaa@naver.com', '테스트 직원', 'staff', 'ACTIVE', NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = NOW();
*/

-- ================================================
-- 사용자 생성 후 확인 쿼리
-- ================================================
-- SELECT * FROM users WHERE email IN ('uhi1308@naver.com', 'aaa@naver.com');
