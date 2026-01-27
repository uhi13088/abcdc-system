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

-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS ccp_master_policy ON ccp_master;
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

-- ============================================
-- 6. CCP 마스터 템플릿 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS ccp_master_template (
  id SERIAL PRIMARY KEY,
  master_code VARCHAR(50) NOT NULL UNIQUE,
  group_prefix VARCHAR(10) NOT NULL,
  process_name VARCHAR(100) NOT NULL,
  hazard_type VARCHAR(10),
  monitoring_frequency VARCHAR(100),
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 7. CCP 마스터 템플릿 시드 데이터
-- ============================================
DELETE FROM ccp_master_template;

INSERT INTO ccp_master_template (master_code, group_prefix, process_name, hazard_type, monitoring_frequency, description, sort_order) VALUES
  ('1B-COOKIE', '1B', '오븐(굽기)-과자', 'B', '시작전/2시간마다/변경시/종료', '과자류 오븐 굽기 공정의 가열온도, 시간, 품온 관리', 1),
  ('1B-BREAD', '1B', '오븐(굽기)-빵류', 'B', '시작전/2시간마다/변경시/종료', '빵류 오븐 굽기 공정의 가열온도, 시간, 품온 관리', 2),
  ('2B-CREAM', '2B', '크림(휘핑)', 'B', '제조 직후/소진 직전/작업 중', '휘핑크림 온도 및 사용시간 관리', 3),
  ('3B-SYRUP', '3B', '시럽가열', 'B', '매작업시', '시럽 가열온도, 시간, 품온 관리', 4),
  ('4B-WASH', '4B', '세척원료', 'B', '매작업시', '원료 세척 조건 관리', 5),
  ('5P-METAL', '5P', '금속검출', 'P', '작업시작/2시간/변경/종료', '금속 이물 검출 관리', 6);

-- ============================================
-- 8. CCP 마스터 시드 함수
-- ============================================
CREATE OR REPLACE FUNCTION seed_ccp_master_defaults(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  tmpl RECORD;
BEGIN
  FOR tmpl IN SELECT * FROM ccp_master_template ORDER BY sort_order
  LOOP
    INSERT INTO ccp_master (
      company_id,
      master_code,
      group_prefix,
      process_name,
      hazard_type,
      monitoring_frequency,
      description,
      sort_order,
      status
    ) VALUES (
      p_company_id,
      tmpl.master_code,
      tmpl.group_prefix,
      tmpl.process_name,
      tmpl.hazard_type,
      tmpl.monitoring_frequency,
      tmpl.description,
      tmpl.sort_order,
      'ACTIVE'
    )
    ON CONFLICT (company_id, master_code) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. 기존 회사들에 CCP 마스터 시드 적용
-- ============================================
DO $$
DECLARE
  company_rec RECORD;
BEGIN
  FOR company_rec IN SELECT id FROM companies
  LOOP
    PERFORM seed_ccp_master_defaults(company_rec.id);
  END LOOP;
END $$;

-- ============================================
-- 10. 트리거 업데이트 (회사 생성 시 CCP 마스터도 시드)
-- ============================================
CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_defaults_on_company_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- 방충방서 기본 데이터
  PERFORM seed_pest_control_defaults(NEW.id);
  -- CCP 기본 데이터
  PERFORM seed_ccp_defaults(NEW.id);
  -- CCP 마스터 기본 데이터
  PERFORM seed_ccp_master_defaults(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- HACCP 활성화 시에도 CCP 마스터 시드
CREATE OR REPLACE FUNCTION trigger_seed_all_haccp_on_haccp_enabled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.haccp_addon_enabled = true AND (OLD.haccp_addon_enabled IS NULL OR OLD.haccp_addon_enabled = false) THEN
    PERFORM seed_pest_control_defaults(NEW.company_id);
    PERFORM seed_ccp_defaults(NEW.company_id);
    PERFORM seed_ccp_master_defaults(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. 기존 CCP 정의에 master_id 연결
-- ============================================
-- CCP 코드에서 마스터 코드 추출하여 연결
CREATE OR REPLACE FUNCTION link_ccp_to_master()
RETURNS VOID AS $$
DECLARE
  ccp_rec RECORD;
  master_rec RECORD;
  extracted_master_code VARCHAR(50);
BEGIN
  -- 마스터 코드 형식: 1B-COOKIE, 2B-CREAM 등
  FOR ccp_rec IN SELECT id, company_id, ccp_number FROM ccp_definitions WHERE master_id IS NULL
  LOOP
    -- CCP 코드에서 마스터 코드 추출 (예: CCP-1B-COOKIE-TEMP -> 1B-COOKIE)
    IF ccp_rec.ccp_number LIKE 'CCP-%-%-%-' OR ccp_rec.ccp_number ~ '^CCP-[0-9]+[A-Z]+-[A-Z]+-' THEN
      extracted_master_code := SPLIT_PART(ccp_rec.ccp_number, '-', 2) || '-' || SPLIT_PART(ccp_rec.ccp_number, '-', 3);

      SELECT id INTO master_rec FROM ccp_master
      WHERE company_id = ccp_rec.company_id AND master_code = extracted_master_code;

      IF master_rec.id IS NOT NULL THEN
        UPDATE ccp_definitions SET master_id = master_rec.id, item_code = SPLIT_PART(ccp_rec.ccp_number, '-', 4)
        WHERE id = ccp_rec.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 기존 CCP들에 마스터 연결 실행
SELECT link_ccp_to_master();

-- Done
SELECT 'CCP Master Groups table and seed data created successfully!' as result;
