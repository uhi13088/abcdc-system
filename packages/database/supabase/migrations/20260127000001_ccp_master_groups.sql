-- ============================================
-- CCP Master Groups (CCP 그룹 마스터)
-- ============================================
-- CCP를 그룹으로 묶어서 관리하기 위한 테이블
-- 예: 1B-COOKIE (오븐-과자), 2B-CREAM (크림-휘핑) 등

-- ============================================
-- 1. CCP 마스터 그룹 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS ccp_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 그룹 코드 (예: "1B-COOKIE", "2B-CREAM", "3B-SYRUP")
  master_code VARCHAR(50) NOT NULL,

  -- 그룹 프리픽스 (예: "1B", "2B", "3B", "4B", "5P")
  group_prefix VARCHAR(10) NOT NULL,

  -- 공정명 (예: "오븐(굽기)-과자", "크림(휘핑)")
  process_name VARCHAR(100) NOT NULL,

  -- 위해 유형: B=생물학적, C=화학적, P=물리적
  hazard_type VARCHAR(10) CHECK (hazard_type IN ('B', 'C', 'P')),

  -- 모니터링 빈도 (예: "시작전/2시간마다/변경시/종료")
  monitoring_frequency VARCHAR(100),

  -- 설명
  description TEXT,

  -- 정렬 순서
  sort_order INTEGER DEFAULT 0,

  -- 상태
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(company_id, master_code)
);

-- ============================================
-- 2. CCP 정의 테이블에 master_id 컬럼 추가
-- ============================================
ALTER TABLE ccp_definitions
ADD COLUMN IF NOT EXISTS master_id UUID REFERENCES ccp_master(id) ON DELETE SET NULL;

-- 아이템 코드 (예: "TEMP", "TIME", "CORE")
ALTER TABLE ccp_definitions
ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);

-- ============================================
-- 3. 인덱스 생성
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ccp_master_company ON ccp_master(company_id);
CREATE INDEX IF NOT EXISTS idx_ccp_master_group_prefix ON ccp_master(company_id, group_prefix);
CREATE INDEX IF NOT EXISTS idx_ccp_definitions_master ON ccp_definitions(master_id);

-- ============================================
-- 4. RLS 정책
-- ============================================
ALTER TABLE ccp_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccp_master_policy ON ccp_master FOR ALL USING (
  company_id IN (SELECT company_id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
);

-- ============================================
-- 5. 트리거: updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_ccp_master_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ccp_master_updated_at ON ccp_master;
CREATE TRIGGER ccp_master_updated_at
  BEFORE UPDATE ON ccp_master
  FOR EACH ROW
  EXECUTE FUNCTION update_ccp_master_updated_at();

-- Done
SELECT 'CCP Master Groups table created successfully!' as result;
