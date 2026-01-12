-- Migration: 017_invitation_system
-- Description: 직원 초대 시스템 (템플릿 + 초대)
-- Created: 2026-01-12

-- =============================================
-- 초대 템플릿 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS invitation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- 근무 조건
  role VARCHAR(50) DEFAULT 'staff',
  position VARCHAR(100),

  -- 급여
  salary_type VARCHAR(20) NOT NULL DEFAULT 'hourly',  -- hourly, daily, monthly
  salary_amount INTEGER NOT NULL DEFAULT 0,

  -- 기본 스케줄
  work_days INTEGER[] DEFAULT '{1,2,3,4,5}',  -- 0=일, 1=월, 2=화...
  work_start_time TIME DEFAULT '09:00',
  work_end_time TIME DEFAULT '18:00',
  break_minutes INTEGER DEFAULT 60,

  -- 요청 서류
  required_documents JSONB DEFAULT '[]',
  -- ["health_certificate", "bank_copy", "career_certificate"]

  -- 커스텀 필드
  custom_fields JSONB DEFAULT '[]',
  -- [{name: "차량번호", type: "text", required: false}]

  -- 메타
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 회사별 템플릿명 유니크
  CONSTRAINT unique_template_name_per_company UNIQUE (company_id, name)
);

-- =============================================
-- 초대 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  template_id UUID REFERENCES invitation_templates(id) ON DELETE SET NULL,

  -- 초대 대상
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,

  -- 근무 조건 (템플릿에서 복사 또는 직접 입력)
  role VARCHAR(50) DEFAULT 'staff',
  position VARCHAR(100),
  salary_type VARCHAR(20) DEFAULT 'hourly',
  salary_amount INTEGER,
  work_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  work_start_time TIME,
  work_end_time TIME,
  break_minutes INTEGER DEFAULT 60,
  required_documents JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '[]',

  -- 초대 토큰
  token VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, ACCEPTED, EXPIRED, CANCELLED
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- 발송 방법 및 결과
  send_methods JSONB DEFAULT '[]',  -- ["kakao", "sms", "link"]
  send_results JSONB DEFAULT '{}',
  -- {"kakao": {"success": true, "sent_at": "..."}, "sms": {...}}

  -- 결과
  accepted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- 생성자
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- users 테이블 확장 (직원 추가 정보)
-- =============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ssn_last VARCHAR(7);  -- 주민번호 뒷자리 (암호화 필요)
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_detail TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact JSONB;  -- {name, phone, relationship}
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_holder VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'hourly';
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_amount INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_days INTEGER[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_start_time TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_end_time TIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS break_minutes INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS certifications JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '{}';
-- {"health_certificate": "url", "bank_copy": "url", ...}
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES invitations(id);

-- =============================================
-- 인덱스
-- =============================================
CREATE INDEX IF NOT EXISTS idx_invitation_templates_company ON invitation_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_store ON invitations(store_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_phone ON invitations(phone);

-- =============================================
-- RLS 정책
-- =============================================
ALTER TABLE invitation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- invitation_templates RLS
DROP POLICY IF EXISTS "invitation_templates_select" ON invitation_templates;
CREATE POLICY "invitation_templates_select" ON invitation_templates
FOR SELECT TO authenticated
USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "invitation_templates_insert" ON invitation_templates;
CREATE POLICY "invitation_templates_insert" ON invitation_templates
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "invitation_templates_update" ON invitation_templates;
CREATE POLICY "invitation_templates_update" ON invitation_templates
FOR UPDATE TO authenticated
USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "invitation_templates_delete" ON invitation_templates;
CREATE POLICY "invitation_templates_delete" ON invitation_templates
FOR DELETE TO authenticated
USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- invitations RLS
DROP POLICY IF EXISTS "invitations_select" ON invitations;
CREATE POLICY "invitations_select" ON invitations
FOR SELECT TO authenticated
USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "invitations_insert" ON invitations;
CREATE POLICY "invitations_insert" ON invitations
FOR INSERT TO authenticated
WITH CHECK (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "invitations_update" ON invitations;
CREATE POLICY "invitations_update" ON invitations
FOR UPDATE TO authenticated
USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

DROP POLICY IF EXISTS "invitations_delete" ON invitations;
CREATE POLICY "invitations_delete" ON invitations
FOR DELETE TO authenticated
USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- =============================================
-- 트리거: updated_at 자동 업데이트
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invitation_templates_updated_at ON invitation_templates;
CREATE TRIGGER update_invitation_templates_updated_at
  BEFORE UPDATE ON invitation_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invitations_updated_at ON invitations;
CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
